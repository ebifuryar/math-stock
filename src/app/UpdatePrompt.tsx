// src/app/UpdatePrompt.tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

/** 新しい版（教材の追加を含む）が配信されたとき、利用者の操作で更新する */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error: unknown) {
      console.error('Service Worker の登録に失敗しました', error);
    },
  });

  if (!needRefresh && !offlineReady) return null;
  return (
    <div role="status" className="mx-auto mt-2 flex max-w-2xl items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950">
      <span className="flex-1">
        {needRefresh ? '新しい版（問題の追加など）があります。' : 'オフラインでも使えるようになりました。'}
      </span>
      {needRefresh && (
        <button type="button" className="min-h-11 font-semibold text-blue-800 dark:text-blue-300" onClick={() => updateServiceWorker(true)}>
          更新
        </button>
      )}
      <button
        type="button"
        aria-label="閉じる"
        className="min-h-11 px-2 text-slate-500"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
