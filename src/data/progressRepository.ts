// src/data/progressRepository.ts
// 学習履歴・復習カード・能力推定の読み書き。
// 1回の解答で「履歴の追加・復習カード更新・能力値更新」を1トランザクションで行い、
// 途中で失敗しても中途半端な状態が残らないようにする。
import { z } from 'zod';
import type { AnswerResponse, Confidence, GradeOutcome } from '@/domain/grading';
import { difficultyFromExpectedRate, estimateAbility, type ItemResponse } from '@/domain/irt';
import { ratingFor, updateReviewCard, type ReviewCard } from '@/domain/scheduler';
import type { Problem } from '@/domain/schema';
import { AppError } from '@/lib/errors';
import { db, type AbilityRecord, type AbilityScope, type AttemptRecord } from './db';

export type RecordAttemptInput = {
  problem: Problem;
  response: AnswerResponse;
  outcome: GradeOutcome;
  confidence: Confidence;
  durationMs: number;
  mode: AttemptRecord['mode'];
  now?: Date;
};

export type RecordAttemptResult = {
  attemptId: number;
  isFirst: boolean;
  card: ReviewCard | undefined;
  overallBefore: AbilityRecord | undefined;
  overallAfter: AbilityRecord | undefined;
};

export async function recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptResult> {
  const { problem, response, outcome, confidence, durationMs, mode } = input;
  const now = input.now ?? new Date();
  return db.transaction('rw', [db.attempts, db.reviewCards, db.abilities, db.abilityHistory], async () => {
    const previous = await db.attempts.where('problemId').equals(problem.id).count();
    const isFirst = previous === 0;
    const a = problem.irt.discrimination;
    const attemptId = await db.attempts.add({
      problemId: problem.id,
      problemVersion: problem.version,
      subjectId: problem.subjectId,
      unitId: problem.unitId,
      level: problem.level,
      format: problem.format,
      mode,
      irtA: a,
      irtB: difficultyFromExpectedRate(problem.irt.expectedCorrectRate, a),
      isFirst: isFirst ? 1 : 0,
      response,
      outcome,
      confidence,
      durationMs,
      answeredAt: now,
    });

    const rating = ratingFor({ scoreRatio: outcome.scoreRatio, confidence, durationMs, targetSeconds: problem.targetSeconds });
    const existing = await db.reviewCards.get(problem.id);
    const card = updateReviewCard(existing, problem.id, rating, now);
    if (card) await db.reviewCards.put(card);

    const overallBefore = await db.abilities.get('overall');
    if (isFirst) await recomputeAbilities(now);
    const overallAfter = await db.abilities.get('overall');
    return { attemptId: attemptId as number, isFirst, card, overallBefore, overallAfter };
  });
}

/**
 * 記述式を後から再採点したとき（オフライン簡易採点 → AI採点など）に結果を差し替える。
 * 復習カードは初回の判定のまま据え置く（同じ解答で二重にスケジュールを進めないため）。
 */
export async function replaceOutcome(attemptId: number, outcome: GradeOutcome): Promise<void> {
  await db.transaction('rw', [db.attempts, db.abilities, db.abilityHistory], async () => {
    const attempt = await db.attempts.get(attemptId);
    if (!attempt) throw new AppError('再採点する解答が見つかりません。');
    await db.attempts.update(attemptId, { outcome });
    if (attempt.isFirst) await recomputeAbilities(new Date());
  });
}

function scopesOf(a: AttemptRecord): AbilityScope[] {
  return ['overall', `subject:${a.subjectId}`, `unit:${a.unitId}`, `level:${a.level}`, `format:${a.format}`];
}

/** 初回解答だけを使って、全体・科目・単元・難易度・形式ごとの能力値を再推定する */
export async function recomputeAbilities(now: Date): Promise<void> {
  const firsts = await db.attempts.where('isFirst').equals(1).toArray();
  const groups = new Map<AbilityScope, ItemResponse[]>();
  for (const a of firsts) {
    for (const scope of scopesOf(a)) {
      const list = groups.get(scope) ?? [];
      list.push({ a: a.irtA, b: a.irtB, score: a.outcome.scoreRatio });
      groups.set(scope, list);
    }
  }
  const records: AbilityRecord[] = [...groups.entries()].map(([scope, responses]) => ({
    scope,
    ...estimateAbility(responses),
    updatedAt: now,
  }));
  await db.abilities.clear();
  await db.abilities.bulkPut(records);
  const overall = records.find((r) => r.scope === 'overall');
  if (overall) await db.abilityHistory.add({ theta: overall.theta, se: overall.se, n: overall.n, at: now });
}

// ---- 書き出し・読み込み（端末故障や機種変更への備え） ----

const EXPORT_FORMAT = 'math-pwa-backup';
const EXPORT_VERSION = 1;

const backupSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  attempts: z.array(z.record(z.string(), z.unknown())),
  reviewCards: z.array(z.record(z.string(), z.unknown())),
  authorNotes: z.array(z.record(z.string(), z.unknown())),
  abilityHistory: z.array(z.record(z.string(), z.unknown())),
});

const DATE_KEYS = new Set(['answeredAt', 'due', 'last_review', 'updatedAt', 'at']);

// JSON では Date が文字列になるため、既知の日付フィールドを Date に戻す
function reviveDates<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const key of DATE_KEYS) {
      if (typeof out[key] === 'string') out[key] = new Date(out[key] as string);
    }
    return out as T;
  });
}

export async function exportBackup(): Promise<Blob> {
  const data = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    attempts: await db.attempts.toArray(),
    reviewCards: await db.reviewCards.toArray(),
    authorNotes: await db.authorNotes.toArray(),
    abilityHistory: await db.abilityHistory.toArray(),
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function importBackup(file: File): Promise<{ attempts: number }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch (e) {
    throw new AppError('ファイルを読み込めませんでした。', 'このアプリで書き出したJSONファイルを選んでください。', { cause: e });
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError('バックアップファイルの形式が正しくありません。', 'このアプリで書き出したJSONファイルを選んでください。');
  }
  const b = parsed.data;
  await db.transaction('rw', [db.attempts, db.reviewCards, db.authorNotes, db.abilityHistory, db.abilities], async () => {
    await Promise.all([db.attempts.clear(), db.reviewCards.clear(), db.authorNotes.clear(), db.abilityHistory.clear()]);
    await db.attempts.bulkAdd(reviveDates<AttemptRecord>(b.attempts));
    await db.reviewCards.bulkAdd(reviveDates<ReviewCard>(b.reviewCards));
    await db.authorNotes.bulkAdd(reviveDates(b.authorNotes));
    await db.abilityHistory.bulkAdd(reviveDates(b.abilityHistory));
    await recomputeAbilities(new Date());
  });
  return { attempts: b.attempts.length };
}

export async function resetAllProgress(): Promise<void> {
  await db.transaction('rw', [db.attempts, db.reviewCards, db.authorNotes, db.abilityHistory, db.abilities], async () => {
    await Promise.all([
      db.attempts.clear(),
      db.reviewCards.clear(),
      db.authorNotes.clear(),
      db.abilityHistory.clear(),
      db.abilities.clear(),
    ]);
  });
}

// ---- 設定 ----

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export const SETTING_GRADER_TOKEN = 'graderToken';
export const SETTING_DAILY_LIMIT = 'dailyReviewLimit';
