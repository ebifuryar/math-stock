// src/features/practice/PracticePage.tsx
// 出題条件は URL で受け取る（例: /practice?unit=math1-quadratic-function&level=exam&count=5、/practice?mode=review）。
// URL にしておくと、ホーム画面のショートカットやブラウザの戻る操作と自然に連携できる。
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, Card, ErrorView, Loading } from '@/components/ui';
import { getAllProblems, getCatalog } from '@/data/contentRepository';
import { getDueQueue, getProblemStats, selectPracticeProblems } from '@/data/queries';
import { FORMATS, LEVELS, type Catalog, type Format, type Level, type Problem } from '@/domain/schema';
import { useAsync } from '@/lib/useAsync';
import { ProblemRunner } from './ProblemRunner';
import { useSession, type SessionMode } from './sessionStore';

const DEFAULT_COUNT = 10;

function parseParams(params: URLSearchParams) {
  const mode: SessionMode = params.get('mode') === 'review' ? 'review' : 'practice';
  const level = params.get('level');
  const format = params.get('format');
  const count = Number(params.get('count') ?? DEFAULT_COUNT);
  return {
    mode,
    unitId: params.get('unit') ?? undefined,
    problemId: params.get('problem') ?? undefined,
    level: LEVELS.includes(level as Level) ? (level as Level) : undefined,
    format: FORMATS.includes(format as Format) ? (format as Format) : undefined,
    count: Number.isFinite(count) && count > 0 ? Math.min(count, 50) : DEFAULT_COUNT,
  };
}

async function buildQueue(p: ReturnType<typeof parseParams>, problems: Problem[]): Promise<string[]> {
  if (p.problemId) return problems.some((x) => x.id === p.problemId) ? [p.problemId] : [];
  if (p.mode === 'review') {
    const ids = new Set(problems.map((x) => x.id));
    // 教材の更新で削除された問題のカードは出題しない
    return (await getDueQueue()).map((c) => c.problemId).filter((id) => ids.has(id));
  }
  const stats = await getProblemStats();
  return selectPracticeProblems(problems, stats, p).map((x) => x.id);
}

export function PracticePage() {
  const [searchParams] = useSearchParams();
  const key = searchParams.toString();
  const params = useMemo(() => parseParams(searchParams), [searchParams]);
  const session = useSession();
  const navigate = useNavigate();
  const [queueError, setQueueError] = useState<unknown>(null);

  const content = useAsync(async () => {
    const [catalog, problems] = await Promise.all([getCatalog(), getAllProblems()]);
    return { catalog, problems };
  }, []);

  // 同じ条件で戻ってきたときは続きから。条件が変わったら新しいセッションを作る
  useEffect(() => {
    if (content.status !== 'success' || session.key === key) return;
    buildQueue(params, content.data.problems).then(
      (ids) => useSession.getState().start(key, params.mode, ids),
      (e: unknown) => setQueueError(e),
    );
  }, [content.status, content, key, params, session.key]);

  const exit = () => {
    useSession.getState().reset();
    navigate(params.mode === 'review' ? '/review' : params.unitId ? `/units/${params.unitId}` : '/');
  };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-3 pb-8">
      <header className="mb-3 flex items-center justify-between">
        <button type="button" className="min-h-11 pr-3 text-sm text-blue-800 dark:text-blue-300" onClick={exit}>
          × 終了
        </button>
        {session.key === key && session.problemIds.length > 0 && (
          <span className="text-sm text-slate-500">
            {Math.min(session.index + 1, session.problemIds.length)} / {session.problemIds.length}
            {params.mode === 'review' && '（復習）'}
          </span>
        )}
      </header>
      {content.status === 'loading' && <Loading />}
      {content.status === 'error' && <ErrorView error={content.error} onRetry={content.reload} />}
      {queueError !== null && <ErrorView error={queueError} />}
      {content.status === 'success' && session.key === key && (
        <SessionBody catalog={content.data.catalog} problems={content.data.problems} onExit={exit} />
      )}
    </div>
  );
}

function SessionBody({ catalog, problems, onExit }: { catalog: Catalog; problems: Problem[]; onExit: () => void }) {
  const { problemIds, index, mode, scores, recordScore, next } = useSession();
  const currentId = problemIds[index];
  const current = problems.find((p) => p.id === currentId);

  if (problemIds.length === 0) {
    return (
      <Card>
        <p className="font-semibold">{mode === 'review' ? '今日の復習はすべて完了しています。' : '条件に合う問題がありません。'}</p>
        <Button variant="secondary" className="mt-3" onClick={onExit}>
          戻る
        </Button>
      </Card>
    );
  }

  if (!current) {
    const avg = scores.length ? scores.reduce((s, x) => s + x.scoreRatio, 0) / scores.length : 0;
    const correct = scores.filter((s) => s.scoreRatio >= 0.999).length;
    return (
      <Card className="space-y-3 text-center">
        <p className="text-lg font-bold">おつかれさまでした</p>
        <p>
          {scores.length}問中 {correct}問正解（平均得点率 {Math.round(avg * 100)}%）
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={onExit}>終了</Button>
          <Link to="/dashboard" className="inline-flex min-h-11 items-center px-4 font-semibold text-blue-800 dark:text-blue-300">
            分析を見る
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <ProblemRunner
      // key を問題IDにして、問題が変わるたびに解答状態とタイマーをリセットする
      key={`${current.id}-${index}`}
      problem={current}
      catalog={catalog}
      mode={mode}
      onDone={(score) => {
        recordScore(current.id, score);
        next();
        window.scrollTo({ top: 0 });
      }}
    />
  );
}
