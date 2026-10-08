// src/features/catalog/ConceptPage.tsx
import { Link, useNavigate, useParams } from 'react-router';
import { MathText } from '@/components/MathText';
import { Card, ErrorView, Loading } from '@/components/ui';
import { getCatalog, getAllProblems } from '@/data/contentRepository';
import { CONCEPT_KIND_LABEL, LEVEL_LABEL } from '@/domain/schema';
import { useAsync } from '@/lib/useAsync';

export function ConceptPage() {
  const { conceptId = '' } = useParams();
  const navigate = useNavigate();
  const state = useAsync(async () => ({ catalog: await getCatalog(), problems: await getAllProblems() }), []);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const { catalog, problems } = state.data;
  const concept = catalog.concepts.find((c) => c.id === conceptId);
  if (!concept) return <ErrorView error={new Error('概念が見つかりません')} />;

  const prereqs = concept.prerequisiteIds.map((id) => catalog.concepts.find((c) => c.id === id)).filter((c) => c !== undefined);
  const dependents = catalog.concepts.filter((c) => c.prerequisiteIds.includes(concept.id));
  const related = problems.filter((p) => p.conceptIds.includes(concept.id));
  const misconceptions = catalog.misconceptions.filter((m) => m.remedyConceptIds.includes(concept.id));

  return (
    <div className="space-y-4">
      <button type="button" className="min-h-11 text-sm text-blue-800 dark:text-blue-300" onClick={() => navigate(-1)}>
        ← 戻る
      </button>
      <Card>
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{CONCEPT_KIND_LABEL[concept.kind]}</p>
        <h1 className="text-xl font-bold">{concept.title}</h1>
        <MathText source={concept.body} className="mt-2" />
      </Card>

      {(prereqs.length > 0 || dependents.length > 0) && (
        <Card className="space-y-2 text-sm">
          {prereqs.length > 0 && (
            <p>
              前提: {prereqs.map((c, i) => (
                <span key={c.id}>{i > 0 && '、'}<Link className="text-blue-800 underline dark:text-blue-300" to={`/concepts/${c.id}`}>{c.title}</Link></span>
              ))}
            </p>
          )}
          {dependents.length > 0 && (
            <p>
              発展: {dependents.map((c, i) => (
                <span key={c.id}>{i > 0 && '、'}<Link className="text-blue-800 underline dark:text-blue-300" to={`/concepts/${c.id}`}>{c.title}</Link></span>
              ))}
            </p>
          )}
        </Card>
      )}

      {misconceptions.length > 0 && (
        <Card>
          <h2 className="mb-1 font-bold">この概念に関わる誤答パターン</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {misconceptions.map((m) => <li key={m.id}>{m.title}</li>)}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-bold">この概念を使う問題</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {related.map((p) => (
            <li key={p.id}>
              <Link to={`/practice?problem=${p.id}`} className="flex min-h-12 items-center justify-between py-2">
                <span>{p.title}</span>
                <span className="text-xs text-slate-500">{LEVEL_LABEL[p.level]} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
