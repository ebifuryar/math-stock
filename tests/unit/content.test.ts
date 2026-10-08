// tests/unit/content.test.ts
// ビルド済み教材がアプリのスキーマを満たし、問題の正解が整合しているかを検査する。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gradeChoice, gradeMark } from '@/domain/grading';
import { catalogSchema, manifestSchema, unitFileSchema } from '@/domain/schema';

const read = (p: string) => JSON.parse(readFileSync(`public/data/${p}`, 'utf8')) as unknown;

describe('ビルド済み教材', () => {
  const manifest = manifestSchema.parse(read('manifest.json'));
  catalogSchema.parse(read('catalog.json'));
  const problems = manifest.units.flatMap((u) => unitFileSchema.parse(read(u.path)).problems);

  it('3難易度 × 3形式がそろっている', () => {
    for (const level of ['school', 'applied', 'exam']) {
      for (const format of ['choice', 'mark', 'written']) {
        expect(problems.some((p) => p.level === level && p.format === format), `${level}/${format}`).toBe(true);
      }
    }
  });

  it('模範解答をそのまま入力すると満点になる', () => {
    for (const p of problems) {
      if (p.body.kind === 'choice') expect(gradeChoice(p, { kind: 'choice', choiceId: p.body.answerId }).scoreRatio).toBe(1);
      if (p.body.kind === 'mark') {
        const values = Object.fromEntries(p.body.blanks.map((b) => [b.label, b.answer]));
        expect(gradeMark(p, { kind: 'mark', values }).scoreRatio).toBe(1);
      }
    }
  });

  it('選択式の誤答選択肢には誤答パターンか解説がある', () => {
    for (const p of problems) {
      if (p.body.kind !== 'choice') continue;
      for (const c of p.body.choices) expect(c.rationale.length).toBeGreaterThan(5);
    }
  });
});
