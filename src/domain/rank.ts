// src/domain/rank.ts
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';

export const RANK_THRESHOLDS: { rank: Rank; min: number; label: string }[] = [
  { rank: 'S', min: 70, label: '全国上位約2%' },
  { rank: 'A', min: 60, label: '全国上位約16%' },
  { rank: 'B', min: 50, label: '全国平均以上' },
  { rank: 'C', min: 40, label: '全国平均よりやや下' },
  { rank: 'D', min: -Infinity, label: '基礎の復習が必要' },
];

// 解答数がこれ未満の推定は誤差が大きいので「参考値」と表示する
export const MIN_RESPONSES_FOR_STABLE = 10;

export function rankOf(deviation: number): { rank: Rank; label: string } {
  const hit = RANK_THRESHOLDS.find((t) => deviation >= t.min) ?? RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1]!;
  return { rank: hit.rank, label: hit.label };
}

/** 偏差値から上位何%かを求める（正規分布の上側確率） */
export function topPercent(deviation: number): number {
  const z = (deviation - 50) / 10;
  return Math.round((1 - normalCdf(z)) * 1000) / 10;
}

// Abramowitz–Stegun 7.1.26 による誤差関数近似（表示用途には十分な精度）
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
