import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';

/**
 * [의사결정] QueryClient 전역 기본값 — 모든 쿼리에 Exponential Backoff 재시도 적용
 * retry: 3회, retryDelay: 1초 → 2초 → 4초 (최대 30초)
 * [의사결정] staleTime 1분 — 불필요한 재요청 방지 (실시간 시세는 개별 훅에서 오버라이드)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
