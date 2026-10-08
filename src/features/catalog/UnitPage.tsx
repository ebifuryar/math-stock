// src/features/catalog/UnitPage.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Card, ErrorView, FormatBadge, LevelBadge, LinkButton, Loading, PageHeader } from '@/components/ui';
import { getCatalog, getUnitProblems } from '@/data/contentRepository';
import { getProblemStats } from '@/data/queries';
import { CONCEPT_KIND_LABEL, FORMAT_LABEL, FORMATS, LEVEL_LABEL, LEVELS, type Format, type Level } from '@/domain/schema';
import { useAsync } from '@/lib/useAsync';

export function UnitPage() {
  const { unitId = '' } = useParams();
  const [level, setLevel] = useState<Level | ''>('');
  const [format, setFormat] = useState<Format | ''>('');
  const state = useAsync(async () => ({ catalog: await getCatalog(), problems: await getUnitProblems(unitId) }), [unitId]);
  const stats = useLiveQuery(() => getProblemStats(), []);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const { catalog, problems } = state.data;
  const unit = catalog.subjects.flatMap((s) => s.units).find((u) => u.id === unitId);
  const concepts = catalog.concepts.filter((c) => c.unitId === unitId);
  const filtered = problems.filter((p) => (!level || p.level === level) && (!format || p.format === format));
  const query = new URLSearchParams({ unit: unitId, count: '10' });
  if (level) query.set('level', level);
  if (format) query.set('format', format);

  return (
    <div className="space-y-4">
      <PageHeader title={unit?.title ?? unitId} subtitle={unit?.summary} back="/units" />

      <Card>
        <h2 className="mb-2 font-bold">基礎概念（学校数学）</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {concepts.map((c) => (
            <li key={c.id}>
              <Link to={`/concepts/${c.id}`} className="flex min-h-12 items-center gap-2 py-2">
                <span className="rounded bg-indigo-50 px-1.5 text-xs text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">{CONCEPT_KIND_LABEL[c.kind]}</span>
                <span className="flex-1">{c.title}</span>
                <span className="text-slate-400">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">演習</h2>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="難易度" className="min-h-11 rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900" value={level} onChange={(e) => setLevel(e.target.value as Level | '')}>
            <option value="">すべての難易度</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
            ))}
          </select>
          <select aria-label="形式" className="min-h-11 rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900" value={format} onChange={(e) => setFormat(e.target.value as Format | '')}>
            <option value="">すべての形式</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
            ))}
          </select>
        </div>
        <LinkButton to={`/practice?${query.toString()}`} className="w-full">
          この条件で解く（{Math.min(filtered.length, 10)}問）
        </LinkButton>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {filtered.map((p) => {
            const st = stats?.get(p.id);
            return (
              <li key={p.id} className="flex min-h-14 items-center gap-2 py-2">
                <Link to={`/practice?problem=${p.id}`} className="flex-1">
                  <span className="flex flex-wrap items-center gap-1">
                    <LevelBadge level={p.level} />
                    <FormatBadge format={p.format} />
                  </span>
                  <span className="mt-1 block">{p.title}</span>
                </Link>
                <span className="w-12 text-right text-sm">
                  {st ? <span className={st.bestScore >= 0.999 ? 'text-emerald-700' : 'text-amber-700'}>{Math.round(st.bestScore * 100)}%</span> : <span className="text-slate-400">未</span>}
                </span>
                {/* 解答済みの問題だけ、解答と出題者メタを直接開ける（未解答で答えを見てしまわないように） */}
                {st && (
                  <Link to={`/problems/${p.id}`} aria-label="出題者メタを見る" className="flex min-h-11 min-w-11 items-center justify-center text-indigo-700 dark:text-indigo-300">
                    ✎
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
