// tests/unit/scheduler.test.ts
import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { buildReviewQueue, ratingFor, updateReviewCard } from '@/domain/scheduler';

const now = new Date('2026-10-08T09:00:00Z');

describe('ratingFor', () => {
  const base = { durationMs: 30_000, targetSeconds: 60 };
  it('得点率・自信度・時間から評価を決める', () => {
    expect(ratingFor({ ...base, scoreRatio: 0, confidence: 'high' })).toBe(Rating.Again);
    expect(ratingFor({ ...base, scoreRatio: 0.6, confidence: 'high' })).toBe(Rating.Hard);
    expect(ratingFor({ ...base, scoreRatio: 1, confidence: 'low' })).toBe(Rating.Hard);
    expect(ratingFor({ ...base, scoreRatio: 1, confidence: 'mid' })).toBe(Rating.Good);
    expect(ratingFor({ ...base, scoreRatio: 1, confidence: 'high' })).toBe(Rating.Easy);
    expect(ratingFor({ scoreRatio: 1, confidence: 'high', durationMs: 200_000, targetSeconds: 60 })).toBe(Rating.Hard);
  });
});

describe('updateReviewCard', () => {
  it('初めて正解した問題はプールに入れない', () => {
    expect(updateReviewCard(undefined, 'p1', Rating.Good, now)).toBeUndefined();
  });
  it('間違えた問題はプールに入り、短い間隔で再出題される', () => {
    const card = updateReviewCard(undefined, 'p1', Rating.Again, now);
    expect(card?.problemId).toBe('p1');
    expect(card!.due.getTime() - now.getTime()).toBeLessThan(24 * 3600_000);
  });
  it('プール内の問題に正解すると間隔が伸びる', () => {
    const first = updateReviewCard(undefined, 'p1', Rating.Again, now)!;
    const later = new Date(first.due.getTime() + 60_000);
    const second = updateReviewCard(first, 'p1', Rating.Good, later)!;
    expect(second.due.getTime()).toBeGreaterThan(later.getTime());
    expect(second.reps).toBe(2);
  });
});

describe('buildReviewQueue', () => {
  it('期限切れだけを上限件数まで返す', () => {
    const due = updateReviewCard(undefined, 'a', Rating.Again, new Date(now.getTime() - 7 * 86400_000))!;
    const future = { ...due, problemId: 'b', due: new Date(now.getTime() + 86400_000) };
    expect(buildReviewQueue([due, future], now).map((c) => c.problemId)).toEqual(['a']);
    expect(buildReviewQueue([due, { ...due, problemId: 'c' }], now, 1)).toHaveLength(1);
  });
});
