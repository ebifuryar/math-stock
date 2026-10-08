// src/features/practice/sessionStore.ts
// 演習セッションの一時状態。永続データ（解答履歴）は DB 側にあるので、ここは画面遷移をまたぐ進行状況だけを持つ。
import { create } from 'zustand';

export type SessionMode = 'practice' | 'review';

type SessionState = {
  key: string | null; // 出題条件（URL）。同じ条件で戻ってきたら続きから再開する
  mode: SessionMode;
  problemIds: string[];
  index: number;
  scores: { problemId: string; scoreRatio: number }[];
  start: (key: string, mode: SessionMode, problemIds: string[]) => void;
  recordScore: (problemId: string, scoreRatio: number) => void;
  next: () => void;
  reset: () => void;
};

export const useSession = create<SessionState>((set) => ({
  key: null,
  mode: 'practice',
  problemIds: [],
  index: 0,
  scores: [],
  start: (key, mode, problemIds) => set({ key, mode, problemIds, index: 0, scores: [] }),
  recordScore: (problemId, scoreRatio) =>
    set((s) => ({ scores: [...s.scores.filter((x) => x.problemId !== problemId), { problemId, scoreRatio }] })),
  next: () => set((s) => ({ index: s.index + 1 })),
  reset: () => set({ key: null, problemIds: [], index: 0, scores: [] }),
}));
