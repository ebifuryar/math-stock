// src/app/Layout.tsx
import { NavLink, Outlet } from 'react-router';
import { UpdatePrompt } from './UpdatePrompt';

const TABS = [
  { to: '/', label: 'ホーム', icon: '⌂', end: true },
  { to: '/units', label: '単元', icon: '▤', end: false },
  { to: '/review', label: '復習', icon: '↻', end: false },
  { to: '/dashboard', label: '分析', icon: '▲', end: false },
  { to: '/settings', label: '設定', icon: '⚙', end: false },
];

export function Layout() {
  return (
    <div className="min-h-dvh">
      <UpdatePrompt />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        <Outlet />
      </main>
      {/* 親指で届く位置に主要機能を置く（モバイルファースト） */}
      <nav
        aria-label="メインメニュー"
        className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center text-xs ${
                    isActive ? 'font-bold text-blue-800 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
                  }`
                }
              >
                <span aria-hidden className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
