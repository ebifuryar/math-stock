// src/features/catalog/CatalogPage.tsx
import { Link } from 'react-router';
import { Card, ErrorView, Loading, PageHeader } from '@/components/ui';
import { getCatalog, getManifest } from '@/data/contentRepository';
import { useAsync } from '@/lib/useAsync';

export function CatalogPage() {
  const state = useAsync(async () => ({ catalog: await getCatalog(), manifest: await getManifest() }), []);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const { catalog, manifest } = state.data;
  return (
    <div>
      <PageHeader title="単元" subtitle="学習指導要領の科目・単元の順に並んでいます" />
      <div className="space-y-4">
        {catalog.subjects.map((s) => (
          <Card key={s.id}>
            <h2 className="mb-2 font-bold">{s.title}</h2>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {s.units.map((u) => {
                const count = manifest.units.find((m) => m.id === u.id)?.problemCount ?? 0;
                return (
                  <li key={u.id}>
                    <Link to={`/units/${u.id}`} className="flex min-h-14 items-center justify-between gap-2 py-2">
                      <span>
                        <span className="block font-semibold">{u.title}</span>
                        <span className="block text-xs text-slate-500">{u.curriculumCode}</span>
                      </span>
                      <span className="text-sm text-slate-500">{count}問 ›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
