// tests/unit/progress.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { exportBackup, importBackup, recordAttempt, replaceOutcome, resetAllProgress } from '@/data/progressRepository';
import { selectPracticeProblems } from '@/data/queries';
import { makeProblem } from './fixtures';

beforeEach(async () => {
  await resetAllProgress();
});

const now = new Date('2026-10-08T09:00:00Z');

describe('recordAttempt', () => {
  it('初回解答で能力値を更新し、不正解なら復習プールに入れる', async () => {
    const p = makeProblem('choice');
    const r = await recordAttempt({
      problem: p,
      response: { kind: 'choice', choiceId: 'b' },
      outcome: { scoreRatio: 0, gradedBy: 'auto' },
      confidence: 'high',
      durationMs: 10_000,
      mode: 'practice',
      now,
    });
    expect(r.isFirst).toBe(true);
    expect(r.overallAfter?.theta).toBeLessThan(0);
    expect(await db.reviewCards.get(p.id)).toBeDefined();
  });

  it('2回目以降は能力値に影響しない', async () => {
    const p = makeProblem('choice');
    const base = { problem: p, response: { kind: 'choice' as const, choiceId: 'a' }, confidence: 'mid' as const, durationMs: 1000, mode: 'practice' as const, now };
    await recordAttempt({ ...base, outcome: { scoreRatio: 0, gradedBy: 'auto' } });
    const theta = (await db.abilities.get('overall'))!.theta;
    const second = await recordAttempt({ ...base, outcome: { scoreRatio: 1, gradedBy: 'auto' } });
    expect(second.isFirst).toBe(false);
    expect((await db.abilities.get('overall'))!.theta).toBeCloseTo(theta, 9);
  });

  it('再採点で初回の結果を差し替えると能力値が再計算される', async () => {
    const p = makeProblem('written');
    const r = await recordAttempt({
      problem: p,
      response: { kind: 'written', text: 'x', hasImage: false },
      outcome: { scoreRatio: 0, gradedBy: 'local' },
      confidence: 'mid',
      durationMs: 1000,
      mode: 'practice',
      now,
    });
    await replaceOutcome(r.attemptId, { scoreRatio: 1, gradedBy: 'ai' });
    expect((await db.abilities.get('overall'))!.theta).toBeGreaterThan(r.overallAfter!.theta);
  });
});

describe('バックアップ', () => {
  it('書き出したデータを読み込むと日付型も含めて復元される', async () => {
    const p = makeProblem('choice');
    await recordAttempt({ problem: p, response: { kind: 'choice', choiceId: 'b' }, outcome: { scoreRatio: 0, gradedBy: 'auto' }, confidence: 'low', durationMs: 1, mode: 'practice', now });
    const blob = await exportBackup();
    await resetAllProgress();
    const file = new File([await blob.text()], 'b.json', { type: 'application/json' });
    expect((await importBackup(file)).attempts).toBe(1);
    const card = await db.reviewCards.get(p.id);
    expect(card?.due).toBeInstanceOf(Date);
    expect(await db.abilities.get('overall')).toBeDefined();
  });
  it('不正なファイルは拒否する', async () => {
    await expect(importBackup(new File(['{"x":1}'], 'x.json'))).rejects.toThrow('形式');
  });
});

describe('selectPracticeProblems', () => {
  it('未解答の問題を優先し、条件で絞り込む', () => {
    const a = makeProblem('choice', { id: 'a' });
    const b = makeProblem('choice', { id: 'b', level: 'exam' });
    const c = makeProblem('mark', { id: 'c' });
    const stats = new Map([['a', { attempts: 1, lastScore: 1, bestScore: 1, lastAt: now }]]);
    expect(selectPracticeProblems([a, b, c], stats, { count: 3 }).map((p) => p.id).at(-1)).toBe('a');
    expect(selectPracticeProblems([a, b, c], stats, { count: 5, level: 'exam' }).map((p) => p.id)).toEqual(['b']);
    expect(selectPracticeProblems([a, b, c], stats, { count: 1 })).toHaveLength(1);
  });
});
