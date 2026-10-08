// src/features/home/HomePage.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, LinkButton } from '@/components/ui';
import { db } from '@/data/db';
import { getSetting, setSetting, SETTING_QUICK_LEVEL } from '@/data/progressRepository';
import { toDeviation } from '@/domain/irt';
import { MIN_RESPONSES_FOR_STABLE, rankOf } from '@/domain/rank';
import { LEVEL_LABEL, LEVELS, type Level } from '@/domain/schema';

// 「おまかせ」の難易度。random は難易度を絞らず全レベルから出題する
type QuickLevel = Level | 'random';
const QUICK_LEVELS: { value: QuickLevel; label: string }[] = [
  { value: 'random', label: 'ランダム' },
  ...LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] })),
];

export function HomePage() {
  const now = new Date();
  const dueCount = useLiveQuery(() => db.reviewCards.where('due').belowOrEqual(now).count(), []);
  const overall = useLiveQuery(() => db.abilities.get('overall'), []);
  const totalAttempts = useLiveQuery(() => db.attempts.count(), []);
  // 選んだ難易度は次回も引き継ぐ
  const quickLevel = useLiveQuery(() => getSetting<QuickLevel>(SETTING_QUICK_LEVEL, 'random'), []) ?? 'random';
  const quickHref = quickLevel === 'random' ? '/practice?count=10' : `/practice?count=10&level=${quickLevel}`;

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

      <Card className="space-y-3">
        <fieldset>
          <legend className="mb-2 text-sm text-slate-500">おまかせの難易度</legend>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {QUICK_LEVELS.map(({ value, label }) => (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${
                  quickLevel === value ? 'bg-white text-blue-800 shadow-sm dark:bg-slate-900 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="quick-level"
                  value={value}
                  checked={quickLevel === value}
                  onChange={() => void setSetting(SETTING_QUICK_LEVEL, value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <LinkButton to={quickHref} className="min-h-14 w-full">
          おまかせ10問（{QUICK_LEVELS.find((q) => q.value === quickLevel)?.label}）
        </LinkButton>
      </Card>

      <LinkButton to="/units" variant="secondary" className="min-h-14 w-full">
        単元を選ぶ
      </LinkButton>
      <p className="text-center text-xs text-slate-500">累計解答数 {totalAttempts ?? 0}</p>
    </div>
  );
}
