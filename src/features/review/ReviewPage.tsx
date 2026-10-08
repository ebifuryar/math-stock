// src/features/review/ReviewPage.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, ErrorView, LevelBadge, LinkButton, Loading, PageHeader } from '@/components/ui';
import { getAllProblems } from '@/data/contentRepository';
import { db } from '@/data/db';
import { getDailyLimit } from '@/data/queries';
import { isLeech, retrievability } from '@/domain/scheduler';
import { useAsync } from '@/lib/useAsync';

export function ReviewPage() {
  const problems = useAsync(() => getAllProblems(), []);
  const cards = useLiveQuery(() => db.reviewCards.orderBy('due').toArray(), []);
  const limit = useLiveQuery(() => getDailyLimit(), []);

  if (problems.status === 'loading' || !cards) return <Loading />;
  if (problems.status === 'error') return <ErrorView error={problems.error} onRetry={problems.reload} />;
  const now = new Date();
  const byId = new Map(problems.data.map((p) => [p.id, p]));
  const due = cards.filter((c) => c.due <= now);

  return (
    <div className="space-y-4">
      <PageHeader title="復習" subtitle="間違えた問題・自信がなかった問題を、忘れかけた頃に再出題します" />
      <Card className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-slate-500">いま復習すべき問題</p>
          <p className="text-3xl font-bold">{due.length}<span className="ml-1 text-base font-normal">問</span></p>
          {limit !== undefined && due.length > limit && <p className="text-xs text-slate-500">1回 {limit} 問ずつ出題します</p>}
        </div>
        <LinkButton to="/practice?mode=review" variant={due.length ? 'primary' : 'secondary'}>
          開始
        </LinkButton>
      </Card>

      <Card>
        <h2 className="mb-2 font-bold">復習プール（{cards.length}問）</h2>
        {cards.length === 0 && <p className="text-sm text-slate-500">まだありません。間違えた問題は自動でここに入ります。</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {cards.map((c) => {
            const p = byId.get(c.problemId);
            const r = retrievability(c, now);
            return (
              <li key={c.problemId} className="flex min-h-14 items-center gap-2 py-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    {p && <LevelBadge level={p.level} />}
                    {isLeech(c) && <span className="rounded-full bg-rose-100 px-2 text-xs text-rose-800">つまずき</span>}
                  </div>
                  <p className="mt-1">{p?.title ?? '（削除された問題）'}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{c.due <= now ? '期限切れ' : c.due.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</p>
                  <p>記憶 {Math.round(r * 100)}%</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
