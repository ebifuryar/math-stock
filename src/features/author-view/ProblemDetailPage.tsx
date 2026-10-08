// src/features/author-view/ProblemDetailPage.tsx
// 解答済みの問題を「出題者の資料」として読み返す画面。
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { MathText } from '@/components/MathText';
import { Card, ErrorView, FormatBadge, LevelBadge, LinkButton, Loading } from '@/components/ui';
import { getCatalog, getProblem } from '@/data/contentRepository';
import { db } from '@/data/db';
import { useAsync } from '@/lib/useAsync';
import { AuthorMetaPanel } from './AuthorMetaPanel';

export default function ProblemDetailPage() {
  const { problemId = '' } = useParams();
  const navigate = useNavigate();
  const state = useAsync(async () => ({ catalog: await getCatalog(), problem: await getProblem(problemId) }), [problemId]);
  const overall = useLiveQuery(() => db.abilities.get('overall'), []);
  const attempts = useLiveQuery(() => db.attempts.where('problemId').equals(problemId).reverse().sortBy('answeredAt'), [problemId]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorView error={state.error} onRetry={state.reload} />;
  const { catalog, problem } = state.data;

  return (
    <div className="space-y-4">
      <button type="button" className="min-h-11 text-sm text-blue-800 dark:text-blue-300" onClick={() => navigate(-1)}>
        ← 戻る
      </button>
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <LevelBadge level={problem.level} />
          <FormatBadge format={problem.format} />
          <span className="text-sm text-slate-500">{problem.title}</span>
        </div>
        <MathText source={problem.stem} />
      </Card>

      <Card>
        <h2 className="mb-1 font-bold">正解・解説</h2>
        {problem.body.kind === 'choice' && (
          <MathText source={problem.body.choices.find((c) => c.id === (problem.body.kind === 'choice' ? problem.body.answerId : ''))?.text ?? ''} />
        )}
        {problem.body.kind === 'mark' && (
          <p>{problem.body.blanks.map((b) => `${b.label} = ${b.answer}`).join('、')}</p>
        )}
        {problem.body.kind === 'written' && <MathText source={problem.body.modelAnswer} />}
        <MathText source={problem.solution} className="mt-2 text-sm" />
      </Card>

      {problem.body.kind === 'choice' && (
        <Card>
          <h2 className="mb-2 font-bold">選択肢の設計（ディストラクタ）</h2>
          <ul className="space-y-2">
            {problem.body.choices.map((c) => (
              <li key={c.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <MathText source={c.text} />
                <MathText source={c.rationale} className="text-sm text-slate-600 dark:text-slate-300" />
                {c.misconceptionId && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    狙い: {catalog.misconceptions.find((m) => m.id === c.misconceptionId)?.title}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {problem.body.kind === 'written' && (
        <Card>
          <h2 className="mb-2 font-bold">採点基準</h2>
          <ul className="space-y-1 text-sm">
            {problem.body.rubric.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="w-10 shrink-0 font-bold">{r.points}点</span>
                <MathText source={r.criterion} inline />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AuthorMetaPanel problem={problem} catalog={catalog} theta={overall?.theta} />

      {attempts && attempts.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">あなたの解答履歴</h2>
          <ul className="text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="flex justify-between border-t border-slate-200 py-2 dark:border-slate-800">
                <span>{a.answeredAt.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span>{Math.round(a.outcome.scoreRatio * 100)}%</span>
                <span className="text-slate-500">{Math.round(a.durationMs / 1000)}秒</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <LinkButton to={`/practice?problem=${problem.id}`} className="w-full">
        もう一度解く
      </LinkButton>
    </div>
  );
}
