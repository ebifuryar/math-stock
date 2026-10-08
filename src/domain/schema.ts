// src/domain/schema.ts
// 配信用（ビルド済み）コンテンツのスキーマ。
// scripts/build-content.ts の出力検証と、クライアントでの読み込み時検証の両方で使う。
// 同じ定義を共有することで「ビルドは通ったのに実行時に型が合わない」状態を防ぐ。
//
// テキスト系フィールドは Markdown + TeX の原文のまま配信し、端末側で KaTeX 描画する。
// KaTeX の HTML を事前生成すると1問あたり約20KBに膨らみ、問題数が増えると
// オフラインキャッシュを圧迫するため（TeX の構文検査はビルド時に済ませる）。
import { z } from 'zod';

export const LEVELS = ['school', 'applied', 'exam'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = {
  school: '学校数学',
  applied: '応用',
  exam: '入試',
};

export const FORMATS = ['choice', 'mark', 'written'] as const;
export type Format = (typeof FORMATS)[number];
export const FORMAT_LABEL: Record<Format, string> = {
  choice: '選択式',
  mark: 'マーク式',
  written: '記述式',
};

// 現行学習指導要領（2022年度入学生〜）の科目区分
export const SUBJECTS = ['math1', 'mathA', 'math2', 'mathB', 'math3', 'mathC'] as const;
export type SubjectId = (typeof SUBJECTS)[number];

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id は英小文字・数字・ハイフンのみ');
const md = z.string().min(1); // Markdown + TeX

export const choiceBodySchema = z.object({
  kind: z.literal('choice'),
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        text: md,
        // 誤答選択肢ごとに「どの誤答パターンを狙ったか」を持たせる（ディストラクタ設計の記録）
        misconceptionId: z.string().optional(),
        rationale: md,
      }),
    )
    .min(2),
  answerId: z.string().min(1),
});

export const markBodySchema = z.object({
  kind: z.literal('mark'),
  blanks: z
    .array(
      z.object({
        label: z.string().min(1), // 「ア」「イウ」など
        answer: z.string().min(1),
        // 表記ゆれとして許容する別解（例: "1/2" と "0.5"）
        accept: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});

export const rubricItemSchema = z.object({
  id: z.string().min(1),
  criterion: z.string().min(1),
  points: z.number().int().positive(),
  // オフライン簡易採点用の手がかり語句。AI採点では使わない。
  keywords: z.array(z.string()).default([]),
});
export type RubricItem = z.infer<typeof rubricItemSchema>;

export const writtenBodySchema = z.object({
  kind: z.literal('written'),
  modelAnswer: md,
  rubric: z.array(rubricItemSchema).min(1),
});

export const problemSchema = z
  .object({
    id,
    version: z.number().int().positive(),
    subjectId: z.enum(SUBJECTS),
    unitId: id,
    level: z.enum(LEVELS),
    format: z.enum(FORMATS),
    title: z.string().min(1),
    stem: md,
    body: z.discriminatedUnion('kind', [choiceBodySchema, markBodySchema, writtenBodySchema]),
    solution: md,
    conceptIds: z.array(id).default([]),
    misconceptionIds: z.array(id).default([]),
    targetSeconds: z.number().int().positive(),
    irt: z.object({
      // 作成者が見積もる「全国の受験者の想定正答率」。IRT の困難度 b に変換して使う。
      expectedCorrectRate: z.number().min(0.02).max(0.98),
      discrimination: z.number().min(0.3).max(3).default(1),
    }),
    author: z.object({
      intent: md,
      assessedAbilities: z.array(z.string()).min(1),
      curriculumRefs: z.array(z.string()).min(1),
      variations: z.array(md).default([]),
      notes: z.string().optional(),
    }),
  })
  .superRefine((p, ctx) => {
    if (p.format !== p.body.kind) {
      ctx.addIssue({ code: 'custom', message: `format(${p.format}) と body.kind(${p.body.kind}) が不一致` });
    }
    const body = p.body;
    if (body.kind === 'choice' && !body.choices.some((c) => c.id === body.answerId)) {
      ctx.addIssue({ code: 'custom', message: `answerId(${body.answerId}) が choices に存在しない` });
    }
  });
export type Problem = z.infer<typeof problemSchema>;

export const unitFileSchema = z.object({
  unitId: id,
  problems: z.array(problemSchema),
});
export type UnitFile = z.infer<typeof unitFileSchema>;

export const conceptSchema = z.object({
  id,
  unitId: id,
  kind: z.enum(['definition', 'theorem', 'formula', 'property', 'method']),
  title: z.string().min(1),
  body: md,
  prerequisiteIds: z.array(id).default([]),
});
export type Concept = z.infer<typeof conceptSchema>;

export const CONCEPT_KIND_LABEL: Record<Concept['kind'], string> = {
  definition: '定義',
  theorem: '定理',
  formula: '公式',
  property: '性質',
  method: '解法',
};

export const misconceptionSchema = z.object({
  id,
  title: z.string().min(1),
  description: md,
  cause: md,
  remedyConceptIds: z.array(id).default([]),
});
export type Misconception = z.infer<typeof misconceptionSchema>;

export const unitMetaSchema = z.object({
  id,
  title: z.string().min(1),
  curriculumCode: z.string().min(1),
  summary: z.string().default(''),
});
export type UnitMeta = z.infer<typeof unitMetaSchema>;

export const catalogSchema = z.object({
  subjects: z.array(
    z.object({
      id: z.enum(SUBJECTS),
      title: z.string().min(1),
      units: z.array(unitMetaSchema),
    }),
  ),
  concepts: z.array(conceptSchema),
  misconceptions: z.array(misconceptionSchema),
});
export type Catalog = z.infer<typeof catalogSchema>;

export const manifestSchema = z.object({
  contentVersion: z.string().min(1),
  generatedAt: z.string(),
  units: z.array(
    z.object({
      id,
      subjectId: z.enum(SUBJECTS),
      path: z.string().min(1),
      problemCount: z.number().int().nonnegative(),
    }),
  ),
});
export type Manifest = z.infer<typeof manifestSchema>;
