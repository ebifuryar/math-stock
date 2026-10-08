// tests/unit/grading.test.ts
import { describe, expect, it } from 'vitest';
import { applyAiGrade, gradeChoice, gradeMark, gradeWrittenLocally, normalizeMark } from '@/domain/grading';
import type { Problem } from '@/domain/schema';
import { makeProblem } from './fixtures';

describe('normalizeMark', () => {
  it('全角数字・全角マイナス・長音記号を半角に統一する', () => {
    expect(normalizeMark('－２')).toBe('-2');
    expect(normalizeMark('ー3')).toBe('-3');
    expect(normalizeMark(' − 1 ')).toBe('-1');
  });
});

describe('gradeChoice', () => {
  const p = makeProblem('choice');
  it('正解は 1、誤答は 0 で誤答パターンを返す', () => {
    expect(gradeChoice(p, { kind: 'choice', choiceId: 'a' }).scoreRatio).toBe(1);
    const wrong = gradeChoice(p, { kind: 'choice', choiceId: 'b' });
    expect(wrong.scoreRatio).toBe(0);
    expect(wrong.matchedMisconceptionId).toBe('mc-x');
  });
  it('存在しない選択肢は例外', () => {
    expect(() => gradeChoice(p, { kind: 'choice', choiceId: 'zz' })).toThrow();
  });
});

describe('gradeMark', () => {
  const p = makeProblem('mark');
  it('欄ごとの正答率を返し、別解表記も受け付ける', () => {
    expect(gradeMark(p, { kind: 'mark', values: { ア: '－２', イ: '0.5' } }).scoreRatio).toBe(1);
    expect(gradeMark(p, { kind: 'mark', values: { ア: '2', イ: '1/2' } }).scoreRatio).toBe(0.5);
    expect(gradeMark(p, { kind: 'mark', values: {} }).scoreRatio).toBe(0);
  });
});

describe('記述式', () => {
  const p = makeProblem('written') as Problem & { body: { kind: 'written' } };
  it('簡易採点は手がかり語句の半数以上で満点、なければ0点', () => {
    const o = gradeWrittenLocally(p.body.rubric, 'y = (x-2)^2 - 3 なので x=2 で最小');
    expect(o.gradedBy).toBe('local');
    expect(o.rubricScores?.map((r) => r.awarded)).toEqual([2, 0]);
    expect(o.scoreRatio).toBeCloseTo(2 / 5);
  });
  it('AI採点結果は配点の範囲に丸め、欠けた項目は0点にする', () => {
    const o = applyAiGrade(p.body.rubric, {
      items: [{ id: 'r1', awarded: 10, comment: 'ok' }],
      feedback: 'よい',
      transcription: '',
    });
    expect(o.rubricScores?.map((r) => r.awarded)).toEqual([2, 0]);
    expect(o.scoreRatio).toBeCloseTo(0.4);
  });
});
