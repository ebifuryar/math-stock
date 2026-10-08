// src/data/db.ts
// 端末内データベース（IndexedDB / Dexie）。学習履歴はすべてここに保存する。
import Dexie, { type EntityTable } from 'dexie';
import type { Confidence, GradeOutcome } from '@/domain/grading';
import type { ReviewCard } from '@/domain/scheduler';
import type { Format, Level, SubjectId } from '@/domain/schema';

export type AttemptRecord = {
  id?: number;
  problemId: string;
  problemVersion: number;
  subjectId: SubjectId;
  unitId: string;
  level: Level;
  format: Format;
  mode: 'practice' | 'review';
  // 偏差値の再計算に教材データを読み込まなくて済むよう、解答時点のIRTパラメータを保存する
  irtA: number;
  irtB: number;
  // 偏差値推定には各問題の初回解答だけを使う（IndexedDB は boolean をインデックスできないため 0/1）
  isFirst: 0 | 1;
  response: unknown;
  outcome: GradeOutcome;
  confidence: Confidence;
  durationMs: number;
  answeredAt: Date;
};

export type AbilityScope = 'overall' | `subject:${string}` | `unit:${string}` | `level:${string}` | `format:${string}`;

export type AbilityRecord = {
  scope: AbilityScope;
  theta: number;
  se: number;
  n: number;
  updatedAt: Date;
};

export type AbilityHistoryRecord = {
  id?: number;
  theta: number;
  se: number;
  n: number;
  at: Date;
};

export type AuthorNoteRecord = {
  problemId: string;
  body: string;
  updatedAt: Date;
};

export type SettingRecord = { key: string; value: unknown };

export class MathDb extends Dexie {
  attempts!: EntityTable<AttemptRecord, 'id'>;
  reviewCards!: EntityTable<ReviewCard, 'problemId'>;
  abilities!: EntityTable<AbilityRecord, 'scope'>;
  abilityHistory!: EntityTable<AbilityHistoryRecord, 'id'>;
  authorNotes!: EntityTable<AuthorNoteRecord, 'problemId'>;
  settings!: EntityTable<SettingRecord, 'key'>;

  constructor(name = 'math-pwa') {
    super(name);
    // スキーマを変えるときは version を上げて upgrade 処理を追加する（既存の学習履歴を壊さないため）
    this.version(1).stores({
      attempts: '++id, problemId, answeredAt, isFirst, unitId, [problemId+answeredAt]',
      reviewCards: 'problemId, due',
      abilities: 'scope',
      abilityHistory: '++id, at',
      authorNotes: 'problemId, updatedAt',
      settings: 'key',
    });
  }
}

export const db = new MathDb();
