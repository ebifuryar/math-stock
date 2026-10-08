// src/features/dashboard/DashboardPage.tsx
// 全国立ち位置の可視化。偏差値は IRT で推定した能力値 θ を 50+10θ に換算したもの。
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, ErrorView, Loading, PageHeader } from '@/components/ui';
import { getCatalog } from '@/data/contentRepository';
import { db, type AbilityRecord } from '@/data/db';
import { deviationInterval, toDeviation } from '@/domain/irt';
import { MIN_RESPONSES_FOR_STABLE, rankOf, topPercent } from '@/domain/rank';
import { FORMAT_LABEL, FORMATS, LEVEL_LABEL, LEVELS } from '@/domain/schema';
import { useAsync } from '@/lib/useAsync';

const AXIS = { fontSize: 12, fill: 'currentColor' };

export default function DashboardPage() {
  const catalog = useAsync(() => getCatalog(), []);
  const abilities = useLiveQuery(() => db.abilities.toArray(), []);
  const history = useLiveQuery(() => db.abilityHistory.orderBy('at').toArray(), []);

  if (catalog.status === 'loading' || !abilities || !history) return <Loading />;
  if (catalog.status === 'error') return <ErrorView error={catalog.error} onRetry={catalog.reload} />;

  const byScope = new Map(abilities.map((a) => [a.scope, a]));
  const overall = byScope.get('overall');
  if (!overall) {
    return (
      <div>
        <PageHeader title="分析" />
        <Card>まだデータがありません。問題を解くと偏差値やランクが表示されます。</Card>
      </div>
    );
  }

  const dev = toDeviation(overall.theta);
  const [lo, hi] = deviationInterval(overall);
  const rank = rankOf(dev);
  const historyData = history.map((h, i) => ({ n: i + 1, deviation: toDeviation(h.theta) }));
  const bar = (scope: string, label: string) => {
    const a: AbilityRecord | undefined = byScope.get(scope as AbilityRecord['scope']);
    return { label, deviation: a ? toDeviation(a.theta) : null, n: a?.n ?? 0 };
  };
  const levelData = LEVELS.map((l) => bar(`level:${l}`, LEVEL_LABEL[l]));
  const formatData = FORMATS.map((f) => bar(`format:${f}`, FORMAT_LABEL[f]));
  const units = catalog.data.subjects.flatMap((s) => s.units.map((u) => ({ ...u, subject: s.title })));

  return (
    <div className="space-y-4">
      <PageHeader title="分析" subtitle="各問題の想定正答率から推定した擬似的な全国の立ち位置です" />

      <Card>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-sm text-slate-500">擬似全国偏差値</p>
            <p className="text-5xl font-bold">{dev.toFixed(1)}</p>
          </div>
          <div className="pb-1">
            <p className="text-3xl font-bold">{rank.rank}</p>
            <p className="text-xs text-slate-500">{rank.label}</p>
          </div>
        </div>
        <p className="mt-2 text-sm">
          全国上位 約 {topPercent(dev)}%（推定の幅 {lo.toFixed(1)}〜{hi.toFixed(1)}）
        </p>
        {overall.n < MIN_RESPONSES_FOR_STABLE && (
          <p className="mt-1 text-xs text-amber-700">初回解答が {overall.n} 問のため参考値です。{MIN_RESPONSES_FOR_STABLE} 問以上で安定します。</p>
        )}
      </Card>

      {historyData.length > 1 && (
        <Card>
          <h2 className="mb-2 font-bold">偏差値の推移</h2>
          <div className="h-56 text-slate-500" role="img" aria-label="解答ごとの偏差値の推移">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="n" tick={AXIS} />
                <YAxis domain={[30, 70]} tick={AXIS} />
                <ReferenceLine y={50} stroke="currentColor" strokeDasharray="4 4" />
                <Tooltip formatter={(v) => [`${v}`, '偏差値']} labelFormatter={(n) => `${n}問目`} />
                <Line type="monotone" dataKey="deviation" stroke="#1e40af" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-bold">難易度・形式別</h2>
        <p className="mb-2 text-xs text-slate-500">「学校数学は高いのに入試が低い」なら応用力、「選択式より記述式が低い」なら答案の表現力が課題です。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[{ title: '難易度', data: levelData }, { title: '形式', data: formatData }].map(({ title, data }) => (
            <div key={title} className="h-48 text-slate-500" role="img" aria-label={`${title}別の偏差値`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} />
                  <YAxis domain={[20, 80]} tick={AXIS} />
                  <ReferenceLine y={50} stroke="currentColor" strokeDasharray="4 4" />
                  <Tooltip cursor={{ fillOpacity: 0.08 }} formatter={(v, _n, item) => [`${v ?? '—'}（${(item.payload as { n: number }).n}問）`, '偏差値']} />
                  <Bar dataKey="deviation" fill="#1e40af" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-bold">単元別</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">単元</th>
              <th>偏差値</th>
              <th>ランク</th>
              <th>解答</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const a = byScope.get(`unit:${u.id}`);
              const d = a ? toDeviation(a.theta) : undefined;
              return (
                <tr key={u.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-2">
                    {u.title}
                    <span className="block text-xs text-slate-500">{u.subject}</span>
                  </td>
                  <td>{d?.toFixed(1) ?? '—'}</td>
                  <td className="font-bold">{d !== undefined ? rankOf(d).rank : '—'}</td>
                  <td>{a?.n ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-slate-500">
        偏差値は「全国の受験者の能力が正規分布する」と仮定した擬似値です。各問題の困難度は作成者が見積もった想定正答率から設定しており、実際の受験者データに基づくものではありません。
      </p>
    </div>
  );
}
