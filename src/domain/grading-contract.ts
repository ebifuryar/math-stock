// src/domain/grading-contract.ts
// 記述式AI採点API（functions/api/grade.ts）とクライアントの間の契約。
// 両側で同じZodスキーマを使い、サーバー応答もクライアント側で再検証する。
import { z } from 'zod';

export const MAX_ANSWER_TEXT = 4000;
// 端末側で縮小してから送るため、これを超えるのは異常入力とみなす
export const MAX_IMAGE_BASE64 = 2_000_000;

export const gradeRequestSchema = z
  .object({
    problemId: z.string().min(1).max(100),
    stem: z.string().min(1).max(8000),
    modelAnswer: z.string().min(1).max(8000),
    rubric: z
      .array(
        z.object({
          id: z.string().min(1).max(50),
          criterion: z.string().min(1).max(500),
          points: z.number().int().positive().max(100),
        }),
      )
      .min(1)
      .max(20),
    answerText: z.string().max(MAX_ANSWER_TEXT).default(''),
    answerImage: z
      .object({
        mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        base64: z.string().min(1).max(MAX_IMAGE_BASE64),
      })
      .optional(),
  })
  .refine((r) => r.answerText.trim().length > 0 || r.answerImage, {
    message: '解答テキストか画像のどちらかが必要です',
  });
export type GradeRequest = z.infer<typeof gradeRequestSchema>;

// モデルに返させる構造化出力。points は採点基準ごとの付与点。
export const gradeResultSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      awarded: z.number(),
      comment: z.string(),
    }),
  ),
  feedback: z.string(),
  transcription: z.string(),
});
export type GradeResult = z.infer<typeof gradeResultSchema>;

export const gradeResponseSchema = z.object({
  ok: z.literal(true),
  result: gradeResultSchema,
});
export const gradeErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});
