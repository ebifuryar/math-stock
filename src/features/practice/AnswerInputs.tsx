// src/features/practice/AnswerInputs.tsx
import { useId, useRef, useState } from 'react';
import { MathText } from '@/components/MathText';
import { Button } from '@/components/ui';
import { CONFIDENCE_LABEL, type Confidence } from '@/domain/grading';
import type { Problem } from '@/domain/schema';
import { compressImage, type EncodedImage } from '@/lib/image';
import { toUserMessage } from '@/lib/errors';

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

type ChoiceBody = Extract<Problem['body'], { kind: 'choice' }>;

export function ChoiceInput({
  body,
  order,
  value,
  onChange,
}: {
  body: ChoiceBody;
  order: string[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">選択肢</legend>
      {order.map((id, i) => {
        const choice = body.choices.find((c) => c.id === id);
        if (!choice) return null;
        const checked = value === id;
        return (
          <label
            key={id}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 ${
              checked ? 'border-blue-700 bg-blue-50 dark:bg-blue-950' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <input type="radio" name={name} className="sr-only" checked={checked} onChange={() => onChange(id)} />
            <span className="text-lg font-bold text-slate-500">{CIRCLED[i] ?? i + 1}</span>
            <MathText source={choice.text} className="flex-1 overflow-x-auto" />
          </label>
        );
      })}
    </fieldset>
  );
}

export function choiceLabel(order: string[], id: string): string {
  const i = order.indexOf(id);
  return CIRCLED[i] ?? id;
}

type MarkBody = Extract<Problem['body'], { kind: 'mark' }>;

export function MarkInput({ body, values, onChange }: { body: MarkBody; values: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {body.blanks.map((b) => (
        <label key={b.label} className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">［{b.label}］</span>
          <input
            // 符号付きの数を入れるため numeric ではなく text。数字キーボードは inputMode で出す
            inputMode="text"
            autoComplete="off"
            enterKeyHint="next"
            className="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-3 text-lg dark:border-slate-700 dark:bg-slate-900"
            value={values[b.label] ?? ''}
            onChange={(e) => onChange({ ...values, [b.label]: e.target.value })}
          />
        </label>
      ))}
      <p className="col-span-2 text-xs text-slate-500">負の数は「-2」のように入力。全角でも判定できます。</p>
    </div>
  );
}

export function WrittenInput({
  text,
  onTextChange,
  image,
  onImageChange,
}: {
  text: string;
  onTextChange: (t: string) => void;
  image: EncodedImage | null;
  onImageChange: (img: EncodedImage | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onImageChange(await compressImage(file));
    } catch (e) {
      setError(toUserMessage(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">答案（テキスト）</span>
        <textarea
          className="mt-1 min-h-40 w-full rounded-xl border-2 border-slate-300 bg-white p-3 text-base dark:border-slate-700 dark:bg-slate-900"
          placeholder={'例: y=(x-2)^2-3 より軸は x=2 …\n数式は x^2、分数は 1/3 のように書けます'}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
        />
      </label>
      <div>
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">または、紙に書いた答案の写真</span>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="mt-1 flex items-center gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? '変換中…' : image ? '撮り直す' : '写真を撮る／選ぶ'}
          </Button>
          {image && (
            <Button variant="ghost" onClick={() => onImageChange(null)}>
              写真を外す
            </Button>
          )}
        </div>
        {image && <img src={image.previewUrl} alt="答案の写真" className="mt-2 max-h-64 rounded-xl border border-slate-200 object-contain" />}
        {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
        <p className="mt-1 text-xs text-slate-500">写真の答案はAI採点（オンライン時）でのみ読み取れます。</p>
      </div>
    </div>
  );
}

export function ConfidencePicker({ value, onChange }: { value: Confidence | null; onChange: (c: Confidence) => void }) {
  const items: Confidence[] = ['high', 'mid', 'low'];
  return (
    <div role="radiogroup" aria-label="解答の自信度" className="grid grid-cols-3 gap-2">
      {items.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          className={`min-h-11 rounded-xl border-2 px-2 text-sm font-semibold ${
            value === c ? 'border-blue-700 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100' : 'border-slate-200 dark:border-slate-700'
          }`}
          onClick={() => onChange(c)}
        >
          {CONFIDENCE_LABEL[c]}
        </button>
      ))}
    </div>
  );
}
