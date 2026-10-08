// src/components/ui.tsx
// 画面共通の小さな部品。タップ領域は 44px 以上を確保する（モバイルの操作性のため）。
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { FORMAT_LABEL, LEVEL_LABEL, type Format, type Level } from '@/domain/schema';
import { toUserMessage } from '@/lib/errors';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' };

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-blue-800 text-white active:bg-blue-900 disabled:bg-slate-400 dark:bg-blue-600',
  secondary:
    'border border-slate-300 bg-white text-slate-800 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  ghost: 'text-blue-800 active:bg-blue-50 dark:text-blue-300 dark:active:bg-slate-800',
  danger: 'bg-red-700 text-white active:bg-red-800',
};

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-xl px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  );
}

export function LinkButton({ to, children, variant = 'primary', className = '' }: { to: string; children: ReactNode; variant?: ButtonProps['variant']; className?: string }) {
  return (
    <Link to={to} className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 font-semibold ${VARIANT[variant]} ${className}`}>
      {children}
    </Link>
  );
}

const LEVEL_COLOR: Record<Level, string> = {
  school: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  applied: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  exam: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
};

export function LevelBadge({ level }: { level: Level }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_COLOR[level]}`}>{LEVEL_LABEL[level]}</span>;
}

export function FormatBadge({ format }: { format: Format }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {FORMAT_LABEL[format]}
    </span>
  );
}

export function Loading({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" />
      {label}
    </div>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { message, hint } = toUserMessage(error);
  return (
    <Card className="border-red-200 dark:border-red-900">
      <p role="alert" className="font-semibold text-red-700 dark:text-red-300">{message}</p>
      {hint && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{hint}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          再試行
        </Button>
      )}
    </Card>
  );
}

export function PageHeader({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <header className="mb-4">
      {back && (
        <Link to={back} className="mb-1 inline-flex min-h-11 items-center text-sm text-blue-800 dark:text-blue-300">
          ← 戻る
        </Link>
      )}
      <h1 className="text-xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
    </header>
  );
}
