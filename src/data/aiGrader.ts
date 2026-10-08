// src/data/aiGrader.ts
// 記述式の採点。オンラインかつ採点APIの合言葉が設定されていれば AI 採点、
// それ以外（オフライン・未設定・API障害）は端末内の簡易採点にフォールバックする。
import { gradeErrorSchema, gradeResponseSchema, type GradeRequest } from '@/domain/grading-contract';
import { applyAiGrade, gradeWrittenLocally, type GradeOutcome } from '@/domain/grading';
import type { Problem } from '@/domain/schema';
import type { EncodedImage } from '@/lib/image';
import { getSetting, SETTING_GRADER_TOKEN } from './progressRepository';

const ENDPOINT = `${import.meta.env.BASE_URL}api/grade`;
const TIMEOUT_MS = 120_000;

export type WrittenGradeResult = { outcome: GradeOutcome; aiError?: string };

export async function gradeWritten(problem: Problem, text: string, image?: EncodedImage): Promise<WrittenGradeResult> {
  if (problem.body.kind !== 'written') throw new Error('記述式ではない問題です');
  const rubric = problem.body.rubric;
  const local = () => gradeWrittenLocally(rubric, text);

  const token = await getSetting<string>(SETTING_GRADER_TOKEN, '');
  if (!token) return { outcome: local(), aiError: 'AI採点の合言葉が未設定のため、簡易採点しました（設定画面から登録できます）。' };
  if (!navigator.onLine) return { outcome: local(), aiError: 'オフラインのため、簡易採点しました。' };

  const body: GradeRequest = {
    problemId: problem.id,
    stem: problem.stem,
    modelAnswer: problem.body.modelAnswer,
    rubric: rubric.map(({ id, criterion, points }) => ({ id, criterion, points })),
    answerText: text,
    answerImage: image ? { mediaType: image.mediaType, base64: image.base64 } : undefined,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data: unknown = await res.json().catch(() => undefined);
    const ok = gradeResponseSchema.safeParse(data);
    if (ok.success) return { outcome: applyAiGrade(rubric, ok.data.result) };
    const err = gradeErrorSchema.safeParse(data);
    const reason = err.success ? err.data.error : `採点APIの応答が不正です（${res.status}）。`;
    return { outcome: local(), aiError: `${reason} 簡易採点に切り替えました。` };
  } catch (e) {
    const reason = (e as Error).name === 'AbortError' ? '採点がタイムアウトしました。' : '採点APIに接続できませんでした。';
    return { outcome: local(), aiError: `${reason} 簡易採点に切り替えました。` };
  } finally {
    clearTimeout(timer);
  }
}
