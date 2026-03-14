import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { CandlestickData, Market } from '../../types/stock';
import { formatCurrency } from '../../utils/formatter';

interface CandlestickChartProps {
  /** OHLCV 데이터 배열 (날짜순 정렬) */
  data: CandlestickData[];
  /** 종목 심볼 */
  symbol: string;
  market: Market;
}

/**
 * 개별 종목 OHLCV 캔들스틱 차트
 * [의사결정] ECharts 캔들스틱 기본 지원 활용 — Recharts는 캔들스틱 미지원으로 제외
 * [의사결정] 한국식 색상: 상승 빨강(#ef4444), 하락 파랑(#3b82f6) — 미국 색상 반전과 반대
 * [의사결정] 거래량 바차트를 하단에 배치 — 가격과 거래량을 동시에 분석 가능
 * [성능] React.memo 적용 — data/symbol/market 변경 시에만 리렌더링
 */
const CandlestickChart = memo(function CandlestickChart({
  data,
  symbol,
  market,
}: CandlestickChartProps) {
  // [성능] useMemo — 데이터 변경 시에만 옵션 재계산
  const option = useMemo(() => {
    const dates = data.map((d) => d.date);
    // [의사결정] ECharts candlestick data 형식: [open, close, low, high]
    const ohlcData = data.map((d) => [d.open, d.close, d.low, d.high]);

    // 상승/하락 여부에 따른 거래량 바 색상
    const volumeColorData = data.map((d) => ({
      value: d.volume,
      itemStyle: {
        color: d.close >= d.open
          ? 'rgba(239, 68, 68, 0.5)'   // 상승 — 빨강 반투명
          : 'rgba(59, 130, 246, 0.5)',  // 하락 — 파랑 반투명
      },
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'cross' as const },
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#f3f4f6', fontSize: 12 },
        formatter: (params: Array<{ seriesType: string; data: number[]; axisValue: string; value: number }>) => {
          const candleParam = params.find((p) => p.seriesType === 'candlestick');
          const volumeParam = params.find((p) => p.seriesType === 'bar');
          if (!candleParam) return '';

          const [open, close, low, high] = candleParam.data;
          const date = candleParam.axisValue;
          const volume = volumeParam?.value ?? 0;

          return `
            <strong>${symbol} — ${date}</strong><br/>
            시가: ${formatCurrency(open, market)}<br/>
            종가: ${formatCurrency(close, market)}<br/>
            고가: ${formatCurrency(high, market)}<br/>
            저가: ${formatCurrency(low, market)}<br/>
            거래량: ${volume.toLocaleString()}
          `.trim();
        },
      },
      // [의사결정] 브러시 영역 선택 기능 — 데이터 줌과 연계하여 특정 구간 확대 가능
      axisPointer: {
        link: [{ xAxisIndex: 'all' as const }],
      },
      grid: [
        { left: 60, right: 20, top: 30, height: '55%' },
        { left: 60, right: 20, top: '75%', height: '15%' },
      ],
      xAxis: [
        {
          type: 'category' as const,
          data: dates,
          gridIndex: 0,
          axisLine: { lineStyle: { color: '#374151' } },
          axisLabel: { show: false },
          axisTick: { show: false },
        },
        {
          type: 'category' as const,
          data: dates,
          gridIndex: 1,
          axisLine: { lineStyle: { color: '#374151' } },
          axisLabel: { color: '#6b7280', fontSize: 10 },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        {
          type: 'value' as const,
          gridIndex: 0,
          axisLine: { show: false },
          axisLabel: {
            color: '#6b7280',
            fontSize: 11,
            formatter: (value: number) => formatCurrency(value, market),
          },
          splitLine: { lineStyle: { color: '#1f2937' } },
          // [의사결정] 가격 축 자동 스케일 — 데이터 범위에 맞게 최적 표시
          scale: true,
        },
        {
          type: 'value' as const,
          gridIndex: 1,
          axisLine: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
          axisTick: { show: false },
        },
      ],
      // [의사결정] 데이터 줌 — 마우스 스크롤로 구간 확대/축소, 드래그로 이동 가능
      dataZoom: [
        {
          type: 'inside' as const,
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
        },
      ],
      series: [
        {
          type: 'candlestick',
          data: ohlcData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          // [의사결정] 한국식 색상 — 상승 빨강, 하락 파랑 (미국식과 반대)
          itemStyle: {
            color: '#ef4444',        // 상승 몸통 — 빨강
            color0: '#3b82f6',       // 하락 몸통 — 파랑
            borderColor: '#ef4444',  // 상승 테두리
            borderColor0: '#3b82f6', // 하락 테두리
          },
        },
        {
          type: 'bar',
          data: volumeColorData,
          xAxisIndex: 1,
          yAxisIndex: 1,
          barWidth: '60%',
        },
      ],
    };
  }, [data, symbol, market]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
        <p className="text-sm text-gray-500">캔들스틱 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-400">
        {symbol} 일봉 차트
      </h3>
      <ReactECharts
        option={option}
        style={{ height: 450 }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
      />
    </div>
  );
});

export default CandlestickChart;
