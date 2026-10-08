// src/features/scratch/ScratchPad.tsx
// 計算メモ。問題文を見ながら指で式変形を書けるよう、画面の下側にシートとして開く。
// 筆跡は問題ごとに端末へ保存し、記述式ではそのまま答案画像として提出できる。
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getScratch, getSetting, saveScratch, SETTING_GRADER_TOKEN } from '@/data/progressRepository';
import {
  drawStroke,
  ERASER_WIDTH,
  isBlankPages,
  MAX_SCRATCH_PAGES,
  PEN_COLORS,
  PEN_WIDTH,
  roundPoint,
  type ScratchPage,
  type ScratchTool,
  type Stroke,
} from '@/domain/scratch';
import { canvasToImage, MAX_IMAGE_EDGE, type EncodedImage } from '@/lib/image';
import { toUserMessage } from '@/lib/errors';

const SAVE_DELAY_MS = 400;

type Props = {
  problemId: string;
  open: boolean;
  onClose: () => void;
  /** 記述式のときだけ渡す。メモを答案画像にして返す */
  onUseAsAnswer?: (image: EncodedImage) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

export function ScratchPad({ problemId, open, onClose, onUseAsAnswer, expanded, onExpandedChange }: Props) {
  const [pages, setPages] = useState<ScratchPage[]>([[]]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<ScratchTool>('pen');
  const [color, setColor] = useState<string>(PEN_COLORS[0].value);
  const [message, setMessage] = useState<string | null>(null);
  // 「1つ戻す」用。各ページの変更前の状態を積む
  const history = useRef<{ pageIndex: number; strokes: ScratchPage }[]>([]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const drawing = useRef<{ pointerId: number; stroke: Stroke } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // ---- 読み込みと保存 ----
  useEffect(() => {
    let cancelled = false;
    getScratch(problemId).then(
      (saved) => {
        if (cancelled) return;
        if (saved && saved.length > 0) setPages(saved);
        setLoaded(true);
      },
      () => !cancelled && setLoaded(true),
    );
    return () => {
      cancelled = true;
    };
  }, [problemId]);

  const scheduleSave = useCallback(
    (next: ScratchPage[]) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void saveScratch(problemId, next), SAVE_DELAY_MS);
    },
    [problemId],
  );

  // 閉じる・問題を移るときは保存し損ねないよう即座に書き込む
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      void saveScratch(problemId, pagesRef.current);
    },
    [problemId],
  );

  const commit = (pageIdx: number, strokes: ScratchPage) => {
    const prev = pagesRef.current;
    history.current.push({ pageIndex: pageIdx, strokes: prev[pageIdx] ?? [] });
    const next = prev.map((p, i) => (i === pageIdx ? strokes : p));
    setPages(next);
    scheduleSave(next);
  };

  // ---- 描画 ----
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const s of pagesRef.current[pageIndex] ?? []) drawStroke(ctx, s, width);
    if (drawing.current) drawStroke(ctx, drawing.current.stroke, width);
  }, [pageIndex]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!open || !wrap || !canvas) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [open, redraw]);

  useEffect(redraw, [redraw, pages, loaded]);

  const toPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = rect.width || 1;
    return [roundPoint((e.clientX - rect.left) / w), roundPoint((e.clientY - rect.top) / w)] as const;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drawing.current) {
      // 2本目の指が触れたら書きかけの線を取り消す（手のひらや持ち替えによる誤入力を防ぐ）
      drawing.current = null;
      redraw();
      return;
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toPoint(e);
    drawing.current = {
      pointerId: e.pointerId,
      stroke: {
        tool,
        color: tool === 'eraser' ? '#000000' : color,
        width: tool === 'eraser' ? ERASER_WIDTH : PEN_WIDTH,
        points: [x, y],
      },
    };
    redraw();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drawing.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // 間引かれたイベントも拾い、速く書いたときの線の欠けを防ぐ
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
      const [x, y] = toPoint(ev);
      const pts = d.stroke.points;
      if (pts[pts.length - 2] === x && pts[pts.length - 1] === y) continue;
      pts.push(x, y);
    }
    redraw();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drawing.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drawing.current = null;
    commit(pageIndex, [...(pagesRef.current[pageIndex] ?? []), d.stroke]);
  };

  const onPointerCancel = () => {
    drawing.current = null;
    redraw();
  };

  // ---- 操作 ----
  const undo = () => {
    const last = history.current.pop();
    if (!last) return;
    const next = pagesRef.current.map((p, i) => (i === last.pageIndex ? last.strokes : p));
    setPages(next);
    setPageIndex(last.pageIndex);
    scheduleSave(next);
  };

  const clearPage = () => {
    if ((pages[pageIndex] ?? []).length === 0) return;
    commit(pageIndex, []);
  };

  const addPage = () => {
    if (pages.length >= MAX_SCRATCH_PAGES) return;
    const next = [...pages, []];
    setPages(next);
    setPageIndex(next.length - 1);
  };

  const useAsAnswer = async () => {
    if (!onUseAsAnswer) return;
    setMessage(null);
    try {
      onUseAsAnswer(await exportPage(pages[pageIndex] ?? [], sizeRef.current));
      // 手書きの答案を読めるのは AI 採点だけなので、未設定ならその旨を伝える
      const token = await getSetting<string>(SETTING_GRADER_TOKEN, '');
      setMessage(
        token
          ? 'このページを答案の画像にしました。'
          : 'このページを答案の画像にしました。ただし手書きの答案はAI採点でしか読み取れないため、今の設定では答案欄のテキストだけで採点されます。',
      );
    } catch (e) {
      setMessage(toUserMessage(e).message);
    }
  };

  if (!open) return null;

  const strokes = pages[pageIndex] ?? [];
  const toolButton = (active: boolean) =>
    `min-h-10 min-w-10 rounded-lg px-2 text-sm font-semibold ${active ? 'bg-blue-800 text-white dark:bg-blue-600' : 'text-slate-700 active:bg-slate-200 dark:text-slate-200 dark:active:bg-slate-700'}`;

  return (
    <section
      aria-label="計算メモ"
      className={`fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-2xl flex-col rounded-t-2xl border border-slate-300 bg-slate-100 shadow-2xl dark:border-slate-700 dark:bg-slate-800 ${expanded ? 'h-[88dvh]' : 'h-[55dvh]'}`}
    >
      <div className="flex flex-wrap items-center gap-1 px-2 pt-2">
        {PEN_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={`ペン（${c.label}）`}
            aria-pressed={tool === 'pen' && color === c.value}
            className={toolButton(tool === 'pen' && color === c.value)}
            onClick={() => {
              setTool('pen');
              setColor(c.value);
            }}
          >
            <span className="inline-block size-4 rounded-full border border-white/70 align-middle" style={{ backgroundColor: c.value }} />
          </button>
        ))}
        <button type="button" aria-pressed={tool === 'eraser'} className={toolButton(tool === 'eraser')} onClick={() => setTool('eraser')}>
          消しゴム
        </button>
        <button type="button" className={toolButton(false)} onClick={undo} disabled={history.current.length === 0}>
          戻す
        </button>
        <button type="button" className={toolButton(false)} onClick={clearPage} disabled={strokes.length === 0}>
          全消去
        </button>
        <span className="flex-1" />
        <button type="button" aria-label="閉じる" className={`${toolButton(false)} text-lg`} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="flex items-center gap-1 px-2 pb-1 text-sm text-slate-600 dark:text-slate-300">
        <button type="button" aria-label="前のページ" className={toolButton(false)} disabled={pageIndex === 0} onClick={() => setPageIndex((i) => i - 1)}>
          ‹
        </button>
        <span aria-live="polite">
          {pageIndex + 1}/{pages.length}
        </span>
        <button
          type="button"
          aria-label="次のページ"
          className={toolButton(false)}
          disabled={pageIndex >= pages.length - 1}
          onClick={() => setPageIndex((i) => i + 1)}
        >
          ›
        </button>
        <button type="button" aria-label="ページを追加" className={toolButton(false)} disabled={pages.length >= MAX_SCRATCH_PAGES} onClick={addPage}>
          ＋
        </button>
        <span className="flex-1" />
        {onUseAsAnswer && (
          <button type="button" className={toolButton(false)} disabled={isBlankPages([strokes])} onClick={useAsAnswer}>
            答案に使う
          </button>
        )}
        <button type="button" className={toolButton(false)} onClick={() => onExpandedChange(!expanded)}>
          {expanded ? '縮める' : '広げる'}
        </button>
      </div>
      {message && <p role="status" className="px-3 pb-1 text-xs text-slate-700 dark:text-slate-200">{message}</p>}
      <div ref={wrapRef} className="scratch-paper relative mx-2 mb-2 flex-1 overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-600">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={(e) => drawing.current?.pointerId === e.pointerId && onPointerUp(e)}
        />
        {loaded && strokes.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">指やペンで自由に書けます</p>
        )}
      </div>
    </section>
  );
}

/** 1ページを白背景の JPEG にする（消しゴムが背景まで消さないよう、筆跡は別のキャンバスに描いてから重ねる） */
async function exportPage(strokes: ScratchPage, size: { width: number; height: number }): Promise<EncodedImage> {
  const aspect = size.width > 0 ? size.height / size.width : 1.4;
  const width = Math.min(1200, MAX_IMAGE_EDGE);
  const height = Math.round(width * aspect);
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const lctx = layer.getContext('2d');
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const octx = out.getContext('2d');
  if (!lctx || !octx) throw new Error('キャンバスを作成できませんでした');
  for (const s of strokes) drawStroke(lctx, s, width);
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, width, height);
  octx.drawImage(layer, 0, 0);
  return canvasToImage(out);
}
