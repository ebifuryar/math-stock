// src/features/author-view/AuthorMetaPanel.tsx
// 出題者目線のメタデータ表示。結果画面と問題詳細画面の両方で使う。
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MathText } from '@/components/MathText';
import { Button, Card } from '@/components/ui';
import { db } from '@/data/db';
import { difficultyFromExpectedRate, probability } from '@/domain/irt';
import type { Catalog, Problem } from '@/domain/schema';
import { toUserMessage } from '@/lib/errors';

export function AuthorMetaPanel({ problem, catalog, theta }: { problem: Problem; catalog: Catalog; theta?: number }) {
  const { author, irt } = problem;
  const b = difficultyFromExpectedRate(irt.expectedCorrectRate, irt.discrimination);
  const predicted = theta === undefined ? undefined : probability(theta, irt.discrimination, b);
  const misconceptions = problem.misconceptionIds
    .map((id) => catalog.misconceptions.find((m) => m.id === id))
    .filter((m) => m !== undefined);

  return (
    <Card className="space-y-4 border-indigo-200 dark:border-indigo-900">
      <h2 className="text-base font-bold text-indigo-900 dark:text-indigo-200">出題者の視点</h2>

      <div>
        <h3 className="text-sm font-semibold text-slate-500">出題のねらい</h3>
        <MathText source={author.intent} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">問う力</dt>
        <dd>{author.assessedAbilities.join(' / ')}</dd>
        <dt className="text-slate-500">指導要領</dt>
        <dd>{author.curriculumRefs.join('、')}</dd>
        <dt className="text-slate-500">想定正答率</dt>
        <dd>
          {Math.round(irt.expectedCorrectRate * 100)}%
          {predicted !== undefined && (
            <span className="ml-2 text-slate-500">（あなたの能力値からの予測 {Math.round(predicted * 100)}%）</span>
          )}
        </dd>
        <dt className="text-slate-500">IRT</dt>
        <dd>
          困難度 b = {b.toFixed(2)}、識別力 a = {irt.discrimination.toFixed(1)}
        </dd>
        <dt className="text-slate-500">目安時間</dt>
        <dd>{Math.round(problem.targetSeconds / 60 * 10) / 10} 分</dd>
      </dl>

      {misconceptions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500">想定している誤答パターン</h3>
          <ul className="mt-1 space-y-2">
            {misconceptions.map((m) => (
              <li key={m.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <p className="font-semibold">{m.title}</p>
                <MathText source={m.description} className="text-sm" />
                <p className="mt-1 text-xs font-semibold text-slate-500">なぜ起きるか</p>
                <MathText source={m.cause} className="text-sm" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {author.variations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500">改題の方向性</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {author.variations.map((v, i) => (
              <li key={i}>
                <MathText source={v} inline />
              </li>
            ))}
          </ul>
        </div>
      )}

      {author.notes && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500">補足</h3>
          <MathText source={author.notes} className="text-sm" />
        </div>
      )}

      {problem.conceptIds.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500">土台となる概念</h3>
          <ul className="mt-1 flex flex-wrap gap-2">
            {problem.conceptIds.map((id) => {
              const c = catalog.concepts.find((x) => x.id === id);
              return (
                <li key={id}>
                  <Link to={`/concepts/${id}`} className="inline-flex min-h-9 items-center rounded-full bg-indigo-50 px-3 text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
                    {c?.title ?? id}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <AuthorNoteEditor problemId={problem.id} />
    </Card>
  );
}

/** 自分なりの出題メモ（改題案・気づき）を問題ごとに残す。将来の作問のための知識ストック。 */
function AuthorNoteEditor({ problemId }: { problemId: string }) {
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    db.authorNotes.get(problemId).then(
      (n) => active && setBody(n?.body ?? ''),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [problemId]);

  const save = async () => {
    setSaved('saving');
    try {
      await db.authorNotes.put({ problemId, body, updatedAt: new Date() });
      setSaved('saved');
    } catch (e) {
      setSaved('error');
      setError(toUserMessage(e).message);
    }
  };

  return (
    <div>
      <label className="block">
        <span className="text-sm font-semibold text-slate-500">自分の出題メモ</span>
        <textarea
          className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="改題のアイデア、引っかかった点、採点で迷いそうな箇所など"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSaved('idle');
          }}
        />
      </label>
      <div className="mt-1 flex items-center gap-2">
        <Button variant="secondary" onClick={save} disabled={saved === 'saving'}>
          メモを保存
        </Button>
        {saved === 'saved' && <span className="text-sm text-emerald-700">保存しました</span>}
        {saved === 'error' && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}
