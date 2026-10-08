// src/features/practice/ResultView.tsx
// 採点結果。この画面がアプリの中心で、誤答パターンの照合と出題者メタデータをここで見せる。
import { useState } from 'react';
import { Link } from 'react-router';
import { MathText } from '@/components/MathText';
import { Button, Card } from '@/components/ui';
import type { RecordAttemptResult } from '@/data/progressRepository';
import { isCorrect, normalizeMark, type GradeOutcome } from '@/domain/grading';
import { toDeviation } from '@/domain/irt';
import { isLeech } from '@/domain/scheduler';
import type { Catalog, Problem } from '@/domain/schema';
import { AuthorMetaPanel } from '@/features/author-view/AuthorMetaPanel';
import { choiceLabel } from './AnswerInputs';

const GRADED_BY_LABEL: Record<GradeOutcome['gradedBy'], string> = {
  auto: '自動採点',
  ai: 'AI採点',
  local: '簡易採点（キーワード照合）',
};

export function ResultView({
  problem,
  catalog,
  outcome,
  record,
  choiceOrder,
  chosenId,
  markValues,
  notice,
  onRegrade,
  onNext,
}: {
  problem: Problem;
  catalog: Catalog;
  outcome: GradeOutcome;
  record: RecordAttemptResult;
  choiceOrder: string[];
  chosenId: string | null;
  markValues: Record<string, string>;
  notice: string | null;
  onRegrade?: () => Promise<void>;
  onNext: () => void;
}) {
  const [regrading, setRegrading] = useState(false);
  const correct = isCorrect(outcome);
  const percent = Math.round(outcome.scoreRatio * 100);
  const misconception = outcome.matchedMisconceptionId
    ? catalog.misconceptions.find((m) => m.id === outcome.matchedMisconceptionId)
    : undefined;
  const before = record.overallBefore;
  const after = record.overallAfter;

  return (
    <div className="space-y-4">
      <Card className={correct ? 'border-emerald-300 dark:border-emerald-800' : 'border-rose-300 dark:border-rose-800'}>
        <p className={`text-2xl font-bold ${correct ? 'text-emerald-700 dark:text-emerald-300' : percent > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>
          {correct ? '正解' : percent > 0 ? `部分点 ${percent}%` : '不正解'}
        </p>
        <p className="mt-1 text-xs text-slate-500">{GRADED_BY_LABEL[outcome.gradedBy]}</p>
        {record.isFirst && after && (
          <p className="mt-2 text-sm">
            偏差値 {before ? toDeviation(before.theta).toFixed(1) : '—'} → <span className="font-bold">{toDeviation(after.theta).toFixed(1)}</span>
          </p>
        )}
        {!record.isFirst && <p className="mt-2 text-xs text-slate-500">2回目以降の解答は偏差値に反映しません（答えを覚えた影響を除くため）。</p>}
        {record.card && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            次回の復習: {record.card.due.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {notice && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{notice}</p>}
      </Card>

      {misconception && (
        <Card className="border-amber-300 dark:border-amber-800">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">典型的な誤答パターン</p>
          <p className="mt-1 font-bold">{misconception.title}</p>
          <MathText source={misconception.description} className="text-sm" />
          <p className="mt-2 text-xs font-semibold text-slate-500">なぜ起きるか</p>
          <MathText source={misconception.cause} className="text-sm" />
          {misconception.remedyConceptIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {misconception.remedyConceptIds.map((id) => (
                <Link key={id} to={`/concepts/${id}`} className="inline-flex min-h-9 items-center rounded-full bg-amber-50 px-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  基礎に戻る: {catalog.concepts.find((c) => c.id === id)?.title ?? id}
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {record.card && isLeech(record.card) && (
        <Card className="border-rose-300">
          <p className="font-semibold">この問題で何度もつまずいています</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">問題演習を繰り返す前に、土台の概念（学校数学）を確認しましょう。</p>
        </Card>
      )}

      {problem.body.kind === 'choice' && (
        <Card>
          <h2 className="mb-2 font-bold">選択肢ごとの解説</h2>
          <ul className="space-y-3">
            {choiceOrder.map((id) => {
              const body = problem.body.kind === 'choice' ? problem.body : null;
              const c = body?.choices.find((x) => x.id === id);
              if (!body || !c) return null;
              const isAnswer = c.id === body.answerId;
              const isChosen = c.id === chosenId;
              return (
                <li key={id} className={`rounded-xl p-3 ${isAnswer ? 'bg-emerald-50 dark:bg-emerald-950/50' : isChosen ? 'bg-rose-50 dark:bg-rose-950/50' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span>{choiceLabel(choiceOrder, id)}</span>
                    {isAnswer && <span className="text-emerald-700 dark:text-emerald-300">正解</span>}
                    {isChosen && !isAnswer && <span className="text-rose-700 dark:text-rose-300">あなたの解答</span>}
                  </div>
                  <MathText source={c.text} />
                  <MathText source={c.rationale} className="text-sm text-slate-700 dark:text-slate-300" />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {problem.body.kind === 'mark' && (
        <Card>
          <h2 className="mb-2 font-bold">解答欄</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">欄</th>
                <th>あなた</th>
                <th>正解</th>
              </tr>
            </thead>
            <tbody>
              {problem.body.blanks.map((b) => {
                const given = markValues[b.label] ?? '';
                const ok = [b.answer, ...b.accept].some((a) => normalizeMark(a) === normalizeMark(given));
                return (
                  <tr key={b.label} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-2 font-semibold">{b.label}</td>
                    <td className={ok ? 'text-emerald-700' : 'text-rose-700'}>{given || '（空欄）'}</td>
                    <td>{b.answer}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {problem.body.kind === 'written' && (
        <Card className="space-y-3">
          <h2 className="font-bold">採点基準ごとの評価</h2>
          <ul className="space-y-2">
            {outcome.rubricScores?.map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="flex items-start justify-between gap-2">
                  <MathText source={r.criterion} className="flex-1 text-sm" />
                  <span className={`shrink-0 font-bold ${r.awarded === r.points ? 'text-emerald-700' : r.awarded > 0 ? 'text-amber-700' : 'text-rose-700'}`}>
                    {r.awarded}/{r.points}
                  </span>
                </div>
                <MathText source={r.comment} className="text-xs text-slate-600 dark:text-slate-400" />
              </li>
            ))}
          </ul>
          {outcome.feedback && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500">講評</h3>
              <MathText source={outcome.feedback} className="text-sm" />
            </div>
          )}
          {outcome.transcription && (
            <details>
              <summary className="min-h-11 cursor-pointer text-sm text-slate-500">AIが読み取った答案</summary>
              <MathText source={outcome.transcription} className="text-sm" />
            </details>
          )}
          {onRegrade && (
            <Button
              variant="secondary"
              disabled={regrading}
              onClick={async () => {
                setRegrading(true);
                await onRegrade();
                setRegrading(false);
              }}
            >
              {regrading ? 'AI採点中…' : 'AIで採点し直す'}
            </Button>
          )}
          <div>
            <h3 className="text-sm font-semibold text-slate-500">模範解答</h3>
            <MathText source={problem.body.modelAnswer} />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 font-bold">解説</h2>
        <MathText source={problem.solution} />
      </Card>

      <AuthorMetaPanel problem={problem} catalog={catalog} theta={after?.theta} />

      <div className="safe-bottom sticky bottom-0 bg-slate-50/95 py-3 dark:bg-slate-950/95">
        <Button className="w-full" onClick={onNext}>
          次へ
        </Button>
      </div>
    </div>
  );
}
