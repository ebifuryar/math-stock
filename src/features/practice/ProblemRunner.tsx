// src/features/practice/ProblemRunner.tsx
// 1問分の「解答 → 採点 → 記録 → 結果表示」を担う。
import { useMemo, useRef, useState } from 'react';
import { MathText } from '@/components/MathText';
import { Button, Card, FormatBadge, LevelBadge } from '@/components/ui';
import { gradeWritten } from '@/data/aiGrader';
import { recordAttempt, replaceOutcome, type RecordAttemptResult } from '@/data/progressRepository';
import { gradeChoice, gradeMark, type AnswerResponse, type Confidence, type GradeOutcome } from '@/domain/grading';
import type { Catalog, Problem } from '@/domain/schema';
import type { EncodedImage } from '@/lib/image';
import { toUserMessage } from '@/lib/errors';
import { ScratchPad } from '@/features/scratch/ScratchPad';
import { ChoiceInput, ConfidencePicker, MarkInput, WrittenInput } from './AnswerInputs';
import { ResultView } from './ResultView';
import type { SessionMode } from './sessionStore';

type Phase = 'answering' | 'grading' | 'result';

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function ProblemRunner({
  problem,
  catalog,
  mode,
  onDone,
}: {
  problem: Problem;
  catalog: Catalog;
  mode: SessionMode;
  onDone: (scoreRatio: number) => void;
}) {
  const startedAt = useRef(Date.now());
  const [phase, setPhase] = useState<Phase>('answering');
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [markValues, setMarkValues] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [image, setImage] = useState<EncodedImage | null>(null);
  const [outcome, setOutcome] = useState<GradeOutcome | null>(null);
  const [record, setRecord] = useState<RecordAttemptResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratchExpanded, setScratchExpanded] = useState(false);

  // 復習では選択肢の並びを入れ替え、位置の暗記で正解できないようにする
  const choiceOrder = useMemo(() => {
    if (problem.body.kind !== 'choice') return [];
    const ids = problem.body.choices.map((c) => c.id);
    return mode === 'review' ? shuffle(ids) : ids;
  }, [problem, mode]);

  const answered = (() => {
    switch (problem.body.kind) {
      case 'choice':
        return choiceId !== null;
      case 'mark':
        return problem.body.blanks.every((b) => (markValues[b.label] ?? '').trim() !== '');
      case 'written':
        return text.trim() !== '' || image !== null;
    }
  })();

  const submit = async () => {
    if (!answered || !confidence) return;
    setPhase('grading');
    setError(null);
    const durationMs = Date.now() - startedAt.current;
    try {
      let response: AnswerResponse;
      let result: GradeOutcome;
      if (problem.body.kind === 'choice') {
        response = { kind: 'choice', choiceId: choiceId! };
        result = gradeChoice(problem, response);
      } else if (problem.body.kind === 'mark') {
        response = { kind: 'mark', values: markValues };
        result = gradeMark(problem, response);
      } else {
        response = { kind: 'written', text, hasImage: image !== null };
        const graded = await gradeWritten(problem, text, image ?? undefined);
        result = graded.outcome;
        setNotice(graded.aiError ?? null);
      }
      const saved = await recordAttempt({ problem, response, outcome: result, confidence, durationMs, mode });
      setOutcome(result);
      setRecord(saved);
      setPhase('result');
    } catch (e) {
      setError(toUserMessage(e).message);
      setPhase('answering');
    }
  };

  const regrade = async () => {
    if (!record) return;
    setNotice(null);
    try {
      const graded = await gradeWritten(problem, text, image ?? undefined);
      if (graded.aiError) {
        setNotice(graded.aiError);
        return;
      }
      await replaceOutcome(record.attemptId, graded.outcome);
      setOutcome(graded.outcome);
    } catch (e) {
      setNotice(toUserMessage(e).message);
    }
  };

  return (
    // メモを開いている間は、問題文をメモの上までスクロールできるよう下に余白をとる
    <div className={`space-y-4 ${scratchOpen ? (scratchExpanded ? 'pb-[88dvh]' : 'pb-[55dvh]') : ''}`}>
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <LevelBadge level={problem.level} />
          <FormatBadge format={problem.format} />
          <span className="text-sm text-slate-500">{problem.title}</span>
        </div>
        <MathText source={problem.stem} />
      </Card>

      {phase !== 'result' && (
        <>
          {problem.body.kind === 'choice' && (
            <ChoiceInput body={problem.body} order={choiceOrder} value={choiceId} onChange={setChoiceId} />
          )}
          {problem.body.kind === 'mark' && <MarkInput body={problem.body} values={markValues} onChange={setMarkValues} />}
          {problem.body.kind === 'written' && (
            <WrittenInput text={text} onTextChange={setText} image={image} onImageChange={setImage} />
          )}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">自信度（復習の間隔に使います）</p>
            <ConfidencePicker value={confidence} onChange={setConfidence} />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button className="w-full" disabled={!answered || !confidence || phase === 'grading'} onClick={submit}>
            {phase === 'grading' ? (problem.format === 'written' ? '採点中…（最大1分ほど）' : '採点中…') : '解答する'}
          </Button>
        </>
      )}

      {phase === 'result' && outcome && record && (
        <ResultView
          problem={problem}
          catalog={catalog}
          outcome={outcome}
          record={record}
          choiceOrder={choiceOrder}
          chosenId={choiceId}
          markValues={markValues}
          notice={notice}
          onRegrade={problem.format === 'written' && outcome.gradedBy === 'local' ? regrade : undefined}
          onNext={() => onDone(outcome.scoreRatio)}
        />
      )}

      {!scratchOpen && (
        <button
          type="button"
          className="fixed right-4 bottom-24 z-20 min-h-12 rounded-full bg-slate-800 px-4 text-sm font-semibold text-white shadow-lg active:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          onClick={() => setScratchOpen(true)}
        >
          ✎ 計算メモ
        </button>
      )}
      <ScratchPad
        problemId={problem.id}
        open={scratchOpen}
        onClose={() => setScratchOpen(false)}
        expanded={scratchExpanded}
        onExpandedChange={setScratchExpanded}
        onUseAsAnswer={problem.format === 'written' && phase === 'answering' ? setImage : undefined}
      />
    </div>
  );
}
