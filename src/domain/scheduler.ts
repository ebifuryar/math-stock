// src/domain/scheduler.ts
// 忘却曲線に基づく復習スケジューリング（FSRS）。
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import type { Confidence } from './grading';

// 目標保持率 90%: 「覚えている確率が9割を切る日」に再出題する
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }));

export type ReviewCard = Card & { problemId: string };

export const DEFAULT_DAILY_REVIEW_LIMIT = 20;
// この回数以上忘れた問題は「つまずき」とみなし、前提概念へ戻る導線を出す
export const LEECH_LAPSES = 4;

export function ratingFor(input: {
  scoreRatio: number;
  confidence: Confidence;
  durationMs: number;
  targetSeconds: number;
}): Grade {
  const { scoreRatio, confidence, durationMs, targetSeconds } = input;
  if (scoreRatio < 0.5) return Rating.Again;
  if (scoreRatio < 0.999) return Rating.Hard;
  if (confidence === 'low') return Rating.Hard;
  if (durationMs > targetSeconds * 2000) return Rating.Hard;
  if (confidence === 'high' && durationMs <= targetSeconds * 1000) return Rating.Easy;
  return Rating.Good;
}

/**
 * 解答結果から復習カードを更新する。
 * - まだプールに無い問題は「間違えた／自信が無かった」ときだけプールに入れる
 * - 既にプールにある問題は結果に関わらずFSRSで次回日時を更新する
 * 戻り値 undefined は「プール対象外」を意味する。
 */
export function updateReviewCard(
  existing: ReviewCard | undefined,
  problemId: string,
  rating: Grade,
  now: Date,
): ReviewCard | undefined {
  if (!existing && (rating === Rating.Good || rating === Rating.Easy)) return undefined;
  const base: Card = existing ?? createEmptyCard(now);
  const { card } = scheduler.next(base, now, rating);
  return { ...card, problemId };
}

export function retrievability(card: ReviewCard, now: Date): number {
  return scheduler.get_retrievability(card, now, false);
}

/** 期限切れのカードを「忘れていそうな順」に並べ、1日の上限で切る */
export function buildReviewQueue(cards: ReviewCard[], now: Date, limit = DEFAULT_DAILY_REVIEW_LIMIT): ReviewCard[] {
  return cards
    .filter((c) => c.due.getTime() <= now.getTime())
    .map((c) => ({ c, r: retrievability(c, now) }))
    .sort((x, y) => x.r - y.r)
    .slice(0, limit)
    .map((x) => x.c);
}

export function isLeech(card: ReviewCard): boolean {
  return card.lapses >= LEECH_LAPSES;
}
