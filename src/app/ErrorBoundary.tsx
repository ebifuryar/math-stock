// src/app/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null };

/** 描画中の想定外エラーで画面が真っ白にならないよう、再読み込みの導線を出す */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-lg font-bold">表示中にエラーが発生しました</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{this.state.error.message}</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">学習履歴は端末に保存されています。再読み込みしてください。</p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl bg-blue-800 px-4 font-semibold text-white"
          onClick={() => location.reload()}
        >
          再読み込み
        </button>
      </main>
    );
  }
}
