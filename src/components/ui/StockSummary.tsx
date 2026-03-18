import React from 'react';
import { useStockSummary } from '@/hooks/useStockSummary';
import type { Market } from '@/types/stock';

/**
 * 종목 AI 요약 컴포넌트
 * [의사결정] Gemini 1.5 Flash로 종목 동향 2~3줄 요약 — 포트폴리오 분석 편의성 향상
 * [성능] React.memo 적용 — symbol 변경 시에만 리렌더링
 */

interface StockSummaryProps {
  symbol: string;
  name: string;
  market: Market;
}

/** 스켈레톤 로딩 UI */
function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-3.5 w-full rounded bg-gray-700/50" />
      <div className="h-3.5 w-[90%] rounded bg-gray-700/50" />
      <div className="h-3.5 w-[75%] rounded bg-gray-700/50" />
    </div>
  );
}

const StockSummary = React.memo(function StockSummary({
  symbol,
  name,
  market,
}: StockSummaryProps) {
  const { data: summary, isLoading, isError, error, refetch } = useStockSummary(symbol, name, market);

  return (
    <div className="mt-3 rounded-lg border border-gray-700/50 bg-gray-800/50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-indigo-400">AI 종목 요약</span>
        <span className="text-[10px] text-gray-500">Powered by Gemini</span>
      </div>

      {isLoading && <SummarySkeleton />}

      {isError && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-red-400">
            {error instanceof Error ? error.message : '요약을 불러오지 못했습니다.'}
          </p>
          <button
            onClick={() => refetch()}
            className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition hover:bg-gray-600"
          >
            재시도
          </button>
        </div>
      )}

      {summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-300">
          {summary}
        </p>
      )}
    </div>
  );
});

export default StockSummary;
