// tests/unit/irt.test.ts
import { describe, expect, it } from 'vitest';
import { difficultyFromExpectedRate, estimateAbility, probability, toDeviation } from '@/domain/irt';
import { rankOf, topPercent } from '@/domain/rank';

describe('IRT', () => {
  it('想定正答率から求めた b で、平均的な受験者(θ=0)の正答確率が p に戻る', () => {
    for (const p of [0.25, 0.5, 0.75]) {
      const b = difficultyFromExpectedRate(p, 1.3);
      expect(probability(0, 1.3, b)).toBeCloseTo(p, 6);
    }
  });
  it('解答なしでは事前分布の平均（偏差値50）', () => {
    const e = estimateAbility([]);
    expect(e.theta).toBeCloseTo(0, 3);
    expect(e.se).toBeCloseTo(1, 1);
  });
  it('難問に正解し続けると θ が上がり、誤差が縮む', () => {
    const hard = { a: 1.2, b: 1, score: 1 };
    const few = estimateAbility([hard]);
    const many = estimateAbility(Array(10).fill(hard));
    expect(many.theta).toBeGreaterThan(few.theta);
    expect(few.theta).toBeGreaterThan(0);
    expect(many.se).toBeLessThan(few.se);
  });
  it('易問を落とすと θ は負になる', () => {
    expect(estimateAbility(Array(5).fill({ a: 1, b: -1, score: 0 })).theta).toBeLessThan(-0.5);
  });
  it('部分点は満点と0点の間になる', () => {
    const item = { a: 1, b: 0 };
    const full = estimateAbility([{ ...item, score: 1 }]).theta;
    const half = estimateAbility([{ ...item, score: 0.5 }]).theta;
    const zero = estimateAbility([{ ...item, score: 0 }]).theta;
    expect(half).toBeLessThan(full);
    expect(half).toBeGreaterThan(zero);
  });
  it('偏差値は 20〜80 に丸める', () => {
    expect(toDeviation(0)).toBe(50);
    expect(toDeviation(10)).toBe(80);
    expect(toDeviation(-10)).toBe(20);
  });
});

describe('rank', () => {
  it('偏差値の境界でランクが切り替わる', () => {
    expect(rankOf(70).rank).toBe('S');
    expect(rankOf(69.9).rank).toBe('A');
    expect(rankOf(50).rank).toBe('B');
    expect(rankOf(39.9).rank).toBe('D');
  });
  it('上位%は正規分布の上側確率', () => {
    expect(topPercent(50)).toBeCloseTo(50, 0);
    expect(topPercent(60)).toBeCloseTo(15.9, 0);
  });
});
