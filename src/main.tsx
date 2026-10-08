// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';

// ブラウザの容量逼迫時に学習履歴が自動削除されないよう、永続ストレージを要求する。
// 拒否されても動作には影響しないので結果は設定画面で表示するだけにとどめる。
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => undefined);
}

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
