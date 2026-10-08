// src/data/queries.ts
// 画面表示用の集計クエリ。
import { buildReviewQueue, type ReviewCard } from '@/domain/scheduler';
import type { Format, Level, Problem } from '@/domain/schema';
import { db } from './db';
import { getSetting, SETTING_DAILY_LIMIT } from './progressRepository';
import { DEFAULT_DAILY_REVIEW_LIMIT } from '@/domain/scheduler';

export type ProblemStat = { attempts: number; lastScore: number; bestScore: number; lastAt: Date };

export async function getProblemStats(): Promise<Map<string, ProblemStat>> {
  const map = new Map<string, ProblemStat>();
  await db.attempts.orderBy('answeredAt').each((a) => {
    const prev = map.get(a.problemId);
    map.set(a.problemId, {
      attempts: (prev?.attempts ?? 0) + 1,
      lastScore: a.outcome.scoreRatio,
      bestScore: Math.max(prev?.bestScore ?? 0, a.outcome.scoreRatio),
      lastAt: a.answeredAt,
    });
  });
  return map;
}

export async function getDailyLimit(): Promise<number> {
  return getSetting(SETTING_DAILY_LIMIT, DEFAULT_DAILY_REVIEW_LIMIT);
}

export async function getDueQueue(now = new Date()): Promise<ReviewCard[]> {
  const due = await db.reviewCards.where('due').belowOrEqual(now).toArray();
  return buildReviewQueue(due, now, await getDailyLimit());
}

export type PracticeFilter = { unitId?: string; level?: Level; format?: Format; count: number };

/**
 * 演習の出題順を決める。未解答の問題を優先し、次に「最後に解いてから時間が経った問題」。
 * 同じ優先度の中ではシャッフルして、毎回同じ並びにならないようにする。
 */
export function selectPracticeProblems(problems: Problem[], stats: Map<string, ProblemStat>, filter: PracticeFilter, random = Math.random): Problem[] {
  const candidates = problems.filter(
    (p) => (!filter.unitId || p.unitId === filter.unitId) && (!filter.level || p.level === filter.level) && (!filter.format || p.format === filter.format),
  );
  const shuffled = candidates.map((p) => ({ p, r: random() }));
  shuffled.sort((x, y) => {
    const sx = stats.get(x.p.id);
    const sy = stats.get(y.p.id);
    if (!sx !== !sy) return sx ? 1 : -1;
    if (sx && sy && sx.lastAt.getTime() !== sy.lastAt.getTime()) return sx.lastAt.getTime() - sy.lastAt.getTime();
    return x.r - y.r;
  });
  return shuffled.slice(0, filter.count).map((x) => x.p);
}
