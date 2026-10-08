// src/lib/errors.ts
// 画面に出すエラーは「何が起きて、利用者が何をすればよいか」が分かる文言にそろえる。
export class AppError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export function toUserMessage(error: unknown): { message: string; hint?: string } {
  if (error instanceof AppError) return { message: error.message, hint: error.hint };
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return {
      message: '端末の保存容量が不足しています。',
      hint: '設定画面から学習データを書き出し、不要なデータを削除してください。',
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: '不明なエラーが発生しました。' };
}
