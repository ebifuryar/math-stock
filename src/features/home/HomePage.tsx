// src/features/home/HomePage.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, LinkButton } from '@/components/ui';
import { db } from '@/data/db';
import { toDeviation } from '@/domain/irt';
import { MIN_RESPONSES_FOR_STABLE, rankOf } from '@/domain/rank';

export function HomePage() {
  const now = new Date();
  const dueCount = useLiveQuery(() => db.reviewCards.where('due').belowOrEqual(now).count(), []);
  const overall = useLiveQuery(() => db.abilities.get('overall'), []);
  const totalAttempts = useLiveQuery(() => db.attempts.count(), []);

  const deviation = overall ? toDeviation(overall.theta) : undefined;
  const rank = deviation !== undefined ? rankOf(deviation) : undefined;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">数学ストック</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">学校数学から入試まで、出題者の目線で積み上げる。</p>
      </header>

      <Card className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-slate-500">今日の復習</p>
          <p className="text-3xl font-bold">{dueCount ?? '—'}<span className="ml-1 text-base font-normal">問</span></p>
        </div>
        <LinkButton to="/practice?mode=review" variant={dueCount ? 'primary' : 'secondary'}>
          復習する
        </LinkButton>
      </Card>

      <Card>
        <p className="text-sm text-slate-500">擬似全国偏差値</p>
        {deviation !== undefined && rank && overall ? (
          <div className="flex items-end gap-3">
            <p className="text-4xl font-bold">{deviation.toFixed(1)}</p>
            <p className="pb-1">
              ランク <span className="text-xl font-bold">{rank.rank}</span>
              <span className="ml-2 text-sm text-slate-500">{rank.label}</span>
            </p>
          </div>
        ) : (
          <p className="mt-1 text-slate-600 dark:text-slate-400">問題を解くと表示されます。</p>
        )}
        {overall && overall.n < MIN_RESPONSES_FOR_STABLE && (
          <p className="mt-1 text-xs text-slate-500">
            参考値（初回解答 {overall.n}/{MIN_RESPONSES_FOR_STABLE} 問）
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <LinkButton to="/practice?count=10" className="min-h-16">
          おまかせ10問
        </LinkButton>
        <LinkButton to="/units" variant="secondary" className="min-h-16">
          単元を選ぶ
        </LinkButton>
      </div>
      <p className="text-center text-xs text-slate-500">累計解答数 {totalAttempts ?? 0}</p>
    </div>
  );
}
