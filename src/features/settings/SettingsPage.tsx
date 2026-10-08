// src/features/settings/SettingsPage.tsx
import { useEffect, useRef, useState } from 'react';
import { Button, Card, PageHeader } from '@/components/ui';
import { getManifest } from '@/data/contentRepository';
import {
  exportBackup,
  getSetting,
  importBackup,
  resetAllProgress,
  setSetting,
  SETTING_DAILY_LIMIT,
  SETTING_GRADER_TOKEN,
} from '@/data/progressRepository';
import { DEFAULT_DAILY_REVIEW_LIMIT } from '@/domain/scheduler';
import { toUserMessage } from '@/lib/errors';
import { useAsync } from '@/lib/useAsync';

export default function SettingsPage() {
  const [token, setToken] = useState('');
  const [limit, setLimit] = useState(DEFAULT_DAILY_REVIEW_LIMIT);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const manifest = useAsync(() => getManifest(), []);

  useEffect(() => {
    getSetting(SETTING_GRADER_TOKEN, '').then(setToken, () => undefined);
    getSetting(SETTING_DAILY_LIMIT, DEFAULT_DAILY_REVIEW_LIMIT).then(setLimit, () => undefined);
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const run = async (fn: () => Promise<string>) => {
    setMessage(null);
    try {
      setMessage({ kind: 'ok', text: await fn() });
    } catch (e) {
      const m = toUserMessage(e);
      setMessage({ kind: 'error', text: [m.message, m.hint].filter(Boolean).join(' ') });
    }
  };

  const download = async () => {
    const blob = await exportBackup();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `math-stock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return '学習データを書き出しました。';
  };

  return (
    <div className="space-y-4">
      <PageHeader title="設定" />
      {message && (
        <p role="status" className={`rounded-xl p-3 text-sm ${message.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200'}`}>
          {message.text}
        </p>
      )}

      <Card className="space-y-2">
        <h2 className="font-bold">記述式のAI採点</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          採点サーバーに設定した合言葉（GRADER_ACCESS_TOKEN）を入力します。未設定・オフライン時はキーワード照合の簡易採点になります。
        </p>
        <input
          type="password"
          autoComplete="off"
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          placeholder="合言葉"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button onClick={() => run(async () => (await setSetting(SETTING_GRADER_TOKEN, token.trim()), '保存しました。'))}>保存</Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">復習</h2>
        <label className="flex items-center justify-between gap-2">
          <span>1回の復習の上限</span>
          <input
            type="number"
            min={5}
            max={100}
            className="min-h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <Button
          variant="secondary"
          onClick={() =>
            run(async () => {
              if (!Number.isInteger(limit) || limit < 5 || limit > 100) throw new Error('5〜100 の整数で入力してください。');
              await setSetting(SETTING_DAILY_LIMIT, limit);
              return '保存しました。';
            })
          }
        >
          保存
        </Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">学習データ</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          データはこの端末だけに保存されています。機種変更に備えて定期的に書き出してください。
          {persisted === false && ' （ブラウザが容量不足時にデータを削除する可能性があります。ホーム画面に追加すると保護されやすくなります。）'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => run(download)}>書き出す</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>読み込む</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (!confirm('現在の学習データを、読み込むファイルの内容で置き換えます。よろしいですか？')) return;
              run(async () => `${(await importBackup(file)).attempts} 件の解答履歴を読み込みました。`);
            }}
          />
        </div>
        <Button
          variant="danger"
          onClick={() => {
            if (!confirm('すべての学習データを削除します。元に戻せません。よろしいですか？')) return;
            run(async () => (await resetAllProgress(), 'すべての学習データを削除しました。'));
          }}
        >
          学習データをすべて削除
        </Button>
      </Card>

      <p className="text-center text-xs text-slate-500">
        教材バージョン {manifest.status === 'success' ? manifest.data.contentVersion : '—'}
      </p>
    </div>
  );
}
