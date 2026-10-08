// src/app/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Loading } from '@/components/ui';
import { CatalogPage } from '@/features/catalog/CatalogPage';
import { ConceptPage } from '@/features/catalog/ConceptPage';
import { UnitPage } from '@/features/catalog/UnitPage';
import { HomePage } from '@/features/home/HomePage';
import { PracticePage } from '@/features/practice/PracticePage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';

// グラフ描画ライブラリを含む画面・利用頻度の低い画面は遅延読み込みにして初回表示を軽くする
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ProblemDetailPage = lazy(() => import('@/features/author-view/ProblemDetailPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="units" element={<CatalogPage />} />
              <Route path="units/:unitId" element={<UnitPage />} />
              <Route path="concepts/:conceptId" element={<ConceptPage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="problems/:problemId" element={<ProblemDetailPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            {/* 演習中は下部タブを隠して問題に集中できるようにする */}
            <Route path="practice" element={<PracticePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
