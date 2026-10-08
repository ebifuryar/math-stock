// src/domain/grading.ts
// 採点ロジック（React・DBに依存しない純粋関数）。
import type { GradeResult } from './grading-contract';
import type { Problem, RubricItem } from './schema';

export type Confidence = 'high' | 'mid' | 'low';
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: '自信あり',
  mid: '少し不安',
  low: '勘・わからない',
};

export type ChoiceResponse = { kind: 'choice'; choiceId: string };
export type MarkResponse = { kind: 'mark'; values: Record<string, string> };
export type WrittenResponse = { kind: 'written'; text: string; hasImage: boolean };
export type AnswerResponse = ChoiceResponse | MarkResponse | WrittenResponse;

export type RubricScore = { id: string; criterion: string; points: number; awarded: number; comment: string };

export type GradeOutcome = {
  scoreRatio: number; // 0〜1
  matchedMisconceptionId?: string;
  // 記述式のみ
  rubricScores?: RubricScore[];
  feedback?: string;
  transcription?: string;
  gradedBy: 'auto' | 'ai' | 'local';
};

export class GradingError extends Error {}

/**
 * マーク式の表記ゆれを吸収する。
 * スマホの日本語入力では全角数字・全角マイナス・長音記号が混ざりやすいため、
 * NFKC 正規化に加えてマイナス系の文字を半角ハイフンに統一する。
 */
export function normalizeMark(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[−‐-―ー－]/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function gradeChoice(problem: Problem, res: ChoiceResponse): GradeOutcome {
  if (problem.body.kind !== 'choice') throw new GradingError('選択式ではない問題です');
  const choice = problem.body.choices.find((c) => c.id === res.choiceId);
  if (!choice) throw new GradingError(`存在しない選択肢です: ${res.choiceId}`);
  const correct = choice.id === problem.body.answerId;
  return {
    scoreRatio: correct ? 1 : 0,
    matchedMisconceptionId: correct ? undefined : choice.misconceptionId,
    gradedBy: 'auto',
  };
}

export function gradeMark(problem: Problem, res: MarkResponse): GradeOutcome {
  if (problem.body.kind !== 'mark') throw new GradingError('マーク式ではない問題です');
  const blanks = problem.body.blanks;
  const correctCount = blanks.filter((b) => {
    const given = normalizeMark(res.values[b.label] ?? '');
    return [b.answer, ...b.accept].some((a) => normalizeMark(a) === given);
  }).length;
  return { scoreRatio: correctCount / blanks.length, gradedBy: 'auto' };
}

function normalizeForKeyword(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[\\{}]/g, '')
    .toLowerCase();
}

/**
 * オフライン時の簡易採点。
 * 採点基準ごとに用意した手がかり語句のうち半数以上が解答に現れれば満点とみなす。
 * 論理の正しさまでは判定できないため、結果画面では「簡易採点」と明示する。
 */
export function gradeWrittenLocally(rubric: RubricItem[], text: string): GradeOutcome {
  const normalized = normalizeForKeyword(text);
  const rubricScores: RubricScore[] = rubric.map((item) => {
    if (item.keywords.length === 0) {
      return { ...pick(item), awarded: 0, comment: 'オフラインでは判定できない観点です' };
    }
    const hits = item.keywords.filter((k) => normalized.includes(normalizeForKeyword(k))).length;
    const ok = hits * 2 >= item.keywords.length;
    return {
      ...pick(item),
      awarded: ok ? item.points : 0,
      comment: ok ? '必要な記述が見つかりました' : '必要な記述が見つかりません',
    };
  });
  return {
    scoreRatio: ratioOf(rubricScores),
    rubricScores,
    feedback: 'オフラインのため、キーワード照合による簡易採点です。オンライン時に再採点できます。',
    gradedBy: 'local',
  };
}

/** AI採点結果を採点基準に突き合わせる。モデルが範囲外の点や未知のIDを返しても壊れないよう丸める。 */
export function applyAiGrade(rubric: RubricItem[], result: GradeResult): GradeOutcome {
  const rubricScores: RubricScore[] = rubric.map((item) => {
    const r = result.items.find((x) => x.id === item.id);
    const awarded = r ? Math.min(item.points, Math.max(0, Math.round(r.awarded))) : 0;
    return { ...pick(item), awarded, comment: r?.comment ?? '採点結果がありませんでした' };
  });
  return {
    scoreRatio: ratioOf(rubricScores),
    rubricScores,
    feedback: result.feedback,
    transcription: result.transcription,
    gradedBy: 'ai',
  };
}

function pick(item: RubricItem) {
  return { id: item.id, criterion: item.criterion, points: item.points };
}

function ratioOf(scores: RubricScore[]): number {
  const total = scores.reduce((s, x) => s + x.points, 0);
  if (total === 0) return 0;
  return scores.reduce((s, x) => s + x.awarded, 0) / total;
}

export function isCorrect(outcome: GradeOutcome): boolean {
  return outcome.scoreRatio >= 0.999;
}
