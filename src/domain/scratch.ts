// src/domain/scratch.ts
// 計算メモ（手書き）のデータ形式。
// 画像ではなく筆跡の座標で保存する。容量が小さく、画面幅や向きが変わっても描き直せ、
// 「1つ戻す」も筆跡単位で行えるため。座標はメモ用紙の幅を 1 とした相対値で持つ。

export type ScratchTool = 'pen' | 'eraser';

export type Stroke = {
  tool: ScratchTool;
  color: string;
  /** 線の太さ（用紙の幅に対する比） */
  width: number;
  /** [x0, y0, x1, y1, ...]。x は 0〜1、y は用紙の幅を 1 とした値 */
  points: number[];
};

export type ScratchPage = Stroke[];

export const MAX_SCRATCH_PAGES = 5;

export const PEN_COLORS = [
  { value: '#0f172a', label: '黒' },
  { value: '#dc2626', label: '赤' },
  { value: '#2563eb', label: '青' },
] as const;

export const PEN_WIDTH = 0.006;
export const ERASER_WIDTH = 0.05;

/** 小数点以下4桁に丸めて保存量を抑える（幅1000pxの画面で0.1px相当の精度） */
export function roundPoint(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function isBlankPages(pages: ScratchPage[]): boolean {
  return pages.every((p) => p.every((s) => s.tool === 'eraser'));
}

/**
 * 筆跡をキャンバスに描く。scale は用紙の幅（px）。
 * 消しゴムは destination-out で描くので、背景は別のキャンバスまたは CSS で用意すること。
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number): void {
  const pts = stroke.points;
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.width * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const x = (i: number) => (pts[i] ?? 0) * scale;
  if (pts.length === 2) {
    // タップしただけの点
    ctx.beginPath();
    ctx.arc(x(0), x(1), ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x(0), x(1));
  // 隣り合う点の中点を通る2次曲線でつなぎ、指で書いた線の角ばりを抑える
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (x(i) + x(i + 2)) / 2;
    const my = (x(i + 1) + x(i + 3)) / 2;
    ctx.quadraticCurveTo(x(i), x(i + 1), mx, my);
  }
  ctx.lineTo(x(pts.length - 2), x(pts.length - 1));
  ctx.stroke();
  ctx.restore();
}
