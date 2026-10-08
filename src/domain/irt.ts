// src/domain/irt.ts
// 擬似全国偏差値の算出（IRT 2パラメータロジスティックモデル）。
// 実際の受験者集団データは無いので「全国の能力分布は標準正規分布」と仮定し、
// 問題作成者が見積もった想定正答率から困難度 b を逆算する。
// これは実際の模試で項目パラメータを設計するときと同じ発想で、使うこと自体が出題者の訓練になる。

export type ItemResponse = {
  a: number; // 識別力
  b: number; // 困難度
  score: number; // 0〜1（記述式は部分点）
};

export type AbilityEstimate = {
  theta: number;
  se: number; // 事後標準偏差。小さいほど推定が安定
  n: number;
};

const GRID_MIN = -4;
const GRID_MAX = 4;
const GRID_STEP = 0.05;
const GRID: number[] = Array.from(
  { length: Math.round((GRID_MAX - GRID_MIN) / GRID_STEP) + 1 },
  (_, i) => GRID_MIN + i * GRID_STEP,
);

export function probability(theta: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(-a * (theta - b)));
}

/**
 * 想定正答率 p から困難度 b を求める。
 * θ=0（全国平均の受験者）の正答確率が p になるよう b を置く近似。
 */
export function difficultyFromExpectedRate(p: number, a: number): number {
  const clamped = Math.min(0.98, Math.max(0.02, p));
  return Math.log((1 - clamped) / clamped) / a;
}

/**
 * EAP（期待事後推定）。θ をグリッドで離散化し、事前分布 N(0,1) × 尤度の期待値をとる。
 * 部分点 s は P^s (1-P)^(1-s) として尤度に入れる（記述式の部分点を連続的に扱うため）。
 * 解答数が少ないうちは事前分布に引き寄せられ、極端な偏差値が出にくい。
 */
export function estimateAbility(responses: ItemResponse[]): AbilityEstimate {
  // 対数で計算してアンダーフローを防ぐ
  const logPost = GRID.map((theta) => {
    let lp = -0.5 * theta * theta;
    for (const r of responses) {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, probability(theta, r.a, r.b)));
      const s = Math.min(1, Math.max(0, r.score));
      lp += s * Math.log(p) + (1 - s) * Math.log(1 - p);
    }
    return lp;
  });
  const max = Math.max(...logPost);
  const weights = logPost.map((lp) => Math.exp(lp - max));
  const total = weights.reduce((s, w) => s + w, 0);
  let mean = 0;
  GRID.forEach((t, i) => (mean += t * (weights[i] ?? 0)));
  mean /= total;
  let variance = 0;
  GRID.forEach((t, i) => (variance += (t - mean) ** 2 * (weights[i] ?? 0)));
  variance /= total;
  return { theta: mean, se: Math.sqrt(variance), n: responses.length };
}

export const DEVIATION_MIN = 20;
export const DEVIATION_MAX = 80;

export function toDeviation(theta: number): number {
  const d = 50 + 10 * theta;
  return Math.round(Math.min(DEVIATION_MAX, Math.max(DEVIATION_MIN, d)) * 10) / 10;
}

/** 偏差値の 68% 信頼区間（±1SE） */
export function deviationInterval(est: AbilityEstimate): [number, number] {
  return [toDeviation(est.theta - est.se), toDeviation(est.theta + est.se)];
}
