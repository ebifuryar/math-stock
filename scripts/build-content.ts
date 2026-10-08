// scripts/build-content.ts
// content/ の YAML 原稿を検証し、TeX を事前レンダリングした JSON を public/data/ に出力する。
// 1件でも不正があれば全件のエラーを表示して非ゼロ終了する（壊れた教材を配信しないため）。
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { load as loadYamlText } from 'js-yaml';
import { z } from 'zod';
import {
  catalogSchema,
  FORMATS,
  LEVELS,
  manifestSchema,
  problemSchema,
  SUBJECTS,
  unitFileSchema,
  type Catalog,
  type Manifest,
  type Problem,
} from '../src/domain/schema.ts';
import { renderMarkdownMath } from '../src/lib/render.ts';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'content');
const OUT = join(ROOT, 'public', 'data');

const errors: string[] = [];
// 配信するのは原文だが、TeX の構文エラーはここで全件検出しておく
const md = (src: string, where: string): string => {
  try {
    renderMarkdownMath(src, { strict: true });
  } catch (e) {
    errors.push(`${where}: ${(e as Error).message}`);
  }
  return src;
};

// ---- 原稿スキーマ（人が書く形式） ----
const sourceProblemSchema = z.object({
  id: z.string(),
  version: z.number().int().positive().default(1),
  level: z.enum(LEVELS),
  format: z.enum(FORMATS),
  title: z.string(),
  stem: z.string(),
  choices: z
    .array(z.object({ id: z.string(), text: z.string(), misconception: z.string().optional(), rationale: z.string() }))
    .optional(),
  answer: z.string().optional(),
  blanks: z
    .array(z.object({ label: z.string(), answer: z.string(), accept: z.array(z.string()).default([]) }))
    .optional(),
  modelAnswer: z.string().optional(),
  rubric: z
    .array(
      z.object({
        id: z.string(),
        criterion: z.string(),
        points: z.number().int().positive(),
        keywords: z.array(z.string()).default([]),
      }),
    )
    .optional(),
  solution: z.string(),
  concepts: z.array(z.string()).default([]),
  misconceptions: z.array(z.string()).default([]),
  targetSeconds: z.number().int().positive(),
  irt: z.object({ expectedCorrectRate: z.number(), discrimination: z.number().default(1) }),
  author: z.object({
    intent: z.string(),
    assessedAbilities: z.array(z.string()),
    curriculumRefs: z.array(z.string()),
    variations: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }),
});

const curriculumSchema = z.object({
  subjects: z.array(
    z.object({
      id: z.enum(SUBJECTS),
      title: z.string(),
      units: z.array(
        z.object({ id: z.string(), title: z.string(), curriculumCode: z.string(), summary: z.string().default('') }),
      ),
    }),
  ),
});

const sourceConceptSchema = z.object({
  id: z.string(),
  kind: z.enum(['definition', 'theorem', 'formula', 'property', 'method']),
  title: z.string(),
  body: z.string(),
  prerequisites: z.array(z.string()).default([]),
});

const sourceMisconceptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  cause: z.string(),
  remedyConcepts: z.array(z.string()).default([]),
});

function loadYaml(path: string): unknown {
  // YAML の構文エラーで処理全体を止めず、他のファイルのエラーとまとめて報告する
  try {
    return loadYamlText(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${relative(ROOT, path)}: YAML の構文エラー\n${(e as Error).message}`);
    return undefined;
  }
}

function yamlFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.yaml'))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function parseOrReport<T>(schema: z.ZodType<T>, data: unknown, where: string): T | undefined {
  const r = schema.safeParse(data);
  if (!r.success) {
    errors.push(`${where}:\n${z.prettifyError(r.error)}`);
    return undefined;
  }
  return r.data;
}

function compileProblem(src: z.infer<typeof sourceProblemSchema>, subjectId: Problem['subjectId'], unitId: string, where: string): unknown {
  let body: unknown;
  if (src.format === 'choice') {
    body = {
      kind: 'choice',
      choices: (src.choices ?? []).map((c, i) => ({
        id: c.id,
        text: md(c.text, `${where} choices[${i}]`),
        misconceptionId: c.misconception,
        rationale: md(c.rationale, `${where} choices[${i}].rationale`),
      })),
      answerId: src.answer,
    };
  } else if (src.format === 'mark') {
    body = { kind: 'mark', blanks: src.blanks };
  } else {
    body = {
      kind: 'written',
      modelAnswer: md(src.modelAnswer ?? '', `${where} modelAnswer`),
      rubric: src.rubric,
    };
  }
  return {
    id: src.id,
    version: src.version,
    subjectId,
    unitId,
    level: src.level,
    format: src.format,
    title: src.title,
    stem: md(src.stem, `${where} stem`),
    body,
    solution: md(src.solution, `${where} solution`),
    conceptIds: src.concepts,
    misconceptionIds: src.misconceptions,
    targetSeconds: src.targetSeconds,
    irt: src.irt,
    author: {
      intent: md(src.author.intent, `${where} author.intent`),
      assessedAbilities: src.author.assessedAbilities,
      curriculumRefs: src.author.curriculumRefs,
      variations: src.author.variations.map((v, i) => md(v, `${where} author.variations[${i}]`)),
      notes: src.author.notes ? md(src.author.notes, `${where} author.notes`) : undefined,
    },
  };
}

function countBy(ids: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

function main() {
  const curriculum = parseOrReport(curriculumSchema, loadYaml(join(CONTENT, 'curriculum.yaml')), 'curriculum.yaml');
  // 誤答パターンは単元ごとのファイルに分けて書き、ここで1つにまとめる
  const misconceptionsSrc = yamlFiles(join(CONTENT, 'misconceptions')).flatMap(
    (file) => parseOrReport(z.array(sourceMisconceptionSchema), loadYaml(file), relative(ROOT, file)) ?? [],
  );
  if (!curriculum) return finish();

  const concepts: Catalog['concepts'] = [];
  const unitFiles: { subjectId: Problem['subjectId']; unitId: string; problems: unknown[] }[] = [];

  for (const subject of curriculum.subjects) {
    for (const unit of subject.units) {
      // 単元IDは小文字のみなので、科目ID（mathA など）との照合は大文字小文字を区別しない
      const shortUnit = unit.id.slice(subject.id.length + 1);
      if (unit.id.slice(0, subject.id.length + 1).toLowerCase() !== `${subject.id.toLowerCase()}-`) {
        errors.push(`curriculum.yaml: 単元ID ${unit.id} は「${subject.id.toLowerCase()}-」で始めてください`);
      }
      for (const file of yamlFiles(join(CONTENT, 'concepts', subject.id, shortUnit))) {
        const where = relative(ROOT, file);
        const c = parseOrReport(sourceConceptSchema, loadYaml(file), where);
        if (c) {
          concepts.push({
            id: c.id,
            unitId: unit.id,
            kind: c.kind,
            title: c.title,
            body: md(c.body, where),
            prerequisiteIds: c.prerequisites,
          });
        }
      }
      const problems: unknown[] = [];
      for (const file of yamlFiles(join(CONTENT, 'problems', subject.id, shortUnit))) {
        const where = relative(ROOT, file);
        const p = parseOrReport(sourceProblemSchema, loadYaml(file), where);
        if (p) problems.push(compileProblem(p, subject.id, unit.id, where));
      }
      unitFiles.push({ subjectId: subject.id, unitId: unit.id, problems });
    }
  }

  const catalog = parseOrReport(
    catalogSchema,
    {
      subjects: curriculum.subjects,
      concepts,
      misconceptions: misconceptionsSrc.map((m) => ({
        id: m.id,
        title: m.title,
        description: md(m.description, `misconceptions ${m.id}`),
        cause: md(m.cause, `misconceptions ${m.id}.cause`),
        remedyConceptIds: m.remedyConcepts,
      })),
    },
    'catalog',
  );

  const validUnits = unitFiles
    .map((u) => ({ meta: u, parsed: parseOrReport(unitFileSchema, { unitId: u.unitId, problems: u.problems }, u.unitId) }))
    .filter((u): u is { meta: (typeof unitFiles)[number]; parsed: z.infer<typeof unitFileSchema> } => !!u.parsed);

  // 参照整合性: 存在しない概念・誤答パターンIDや重複IDを検出する
  if (catalog) {
    const conceptIds = new Set(catalog.concepts.map((c) => c.id));
    const misIds = new Set(catalog.misconceptions.map((m) => m.id));
    const seen = new Set<string>();
    for (const c of catalog.concepts) {
      for (const pre of c.prerequisiteIds) if (!conceptIds.has(pre)) errors.push(`concept ${c.id}: 未知の前提概念 ${pre}`);
    }
    for (const m of catalog.misconceptions) {
      for (const r of m.remedyConceptIds) if (!conceptIds.has(r)) errors.push(`misconception ${m.id}: 未知の概念 ${r}`);
    }
    // 題名や指導要領の項目名は数式として描画しないため、TeX を書くとそのまま表示されてしまう
    const plain = (text: string, where: string) => {
      if (text.includes('$')) errors.push(`${where}: 数式を描画しない欄に TeX があります（${text}）`);
    };
    for (const c of catalog.concepts) plain(c.title, `concept ${c.id} title`);
    for (const m of catalog.misconceptions) plain(m.title, `misconception ${m.id} title`);
    for (const { parsed } of validUnits) {
      for (const p of parsed.problems) {
        plain(p.title, `${p.id} title`);
        for (const r of p.author.curriculumRefs) plain(r, `${p.id} curriculumRefs`);
        for (const a of p.author.assessedAbilities) plain(a, `${p.id} assessedAbilities`);
        if (seen.has(p.id)) errors.push(`問題IDが重複: ${p.id}`);
        seen.add(p.id);
        for (const c of p.conceptIds) if (!conceptIds.has(c)) errors.push(`${p.id}: 未知の概念 ${c}`);
        for (const m of p.misconceptionIds) if (!misIds.has(m)) errors.push(`${p.id}: 未知の誤答パターン ${m}`);
        if (p.body.kind === 'choice') {
          for (const ch of p.body.choices) {
            if (ch.misconceptionId && !misIds.has(ch.misconceptionId)) {
              errors.push(`${p.id}: 選択肢 ${ch.id} の誤答パターン ${ch.misconceptionId} が未定義`);
            }
          }
        }
      }
    }
  }

  for (const [id, n] of countBy(catalog?.misconceptions.map((m) => m.id) ?? [])) {
    if (n > 1) errors.push(`誤答パターンIDが重複: ${id}`);
  }
  for (const [id, n] of countBy(catalog?.concepts.map((c) => c.id) ?? [])) {
    if (n > 1) errors.push(`概念IDが重複: ${id}`);
  }

  if (errors.length > 0 || !catalog) return finish();
  // --check: 検証だけ行い public/data は書き換えない（作問中の確認用）
  if (process.argv.includes('--check')) {
    console.log(`content check OK: ${validUnits.reduce((s, u) => s + u.parsed.problems.length, 0)} problems`);
    return finish();
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'units'), { recursive: true });
  const catalogJson = JSON.stringify(catalog);
  writeFileSync(join(OUT, 'catalog.json'), catalogJson);

  const manifestUnits: Manifest['units'] = [];
  const hashes = [hash(catalogJson)];
  for (const { meta, parsed } of validUnits) {
    const json = JSON.stringify(parsed);
    const path = `units/${meta.unitId}.json`;
    writeFileSync(join(OUT, path), json);
    hashes.push(hash(json));
    manifestUnits.push({ id: meta.unitId, subjectId: meta.subjectId, path, problemCount: parsed.problems.length });
  }
  const manifest = manifestSchema.parse({
    contentVersion: hash(hashes.join(':')),
    generatedAt: new Date().toISOString(),
    units: manifestUnits,
  });
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const total = manifestUnits.reduce((s, u) => s + u.problemCount, 0);
  const size = statSync(OUT).isDirectory() ? manifestUnits.length : 0;
  console.log(`content: ${total} problems / ${size} units / ${catalog.concepts.length} concepts -> public/data (v${manifest.contentVersion})`);
  finish();
}

function finish() {
  if (errors.length > 0) {
    console.error(`\n✖ コンテンツ検証エラー ${errors.length} 件\n`);
    for (const e of errors) console.error(`- ${e}\n`);
    process.exit(1);
  }
}

main();
