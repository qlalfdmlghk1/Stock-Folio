import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { LineChartPoint, Market } from '../../types/stock';
import { formatCurrency } from '../../utils/formatter';

interface LineChartProps {
  /** 기간별 손익 데이터 포인트 배열 */
  data: LineChartPoint[];
  market: Market;
}

/**
 * 기간별 손익 추이 라인차트
 * [의사결정] 라인차트 + 영역(area) 채우기 — 손익 추이를 직관적으로 표현
 * [의사결정] 0 기준선 표시 — 수익/손실 전환 시점을 명확하게 시각화
 * [성능] React.memo 적용 — data/market 변경 시에만 리렌더링
 */
const LineChart = memo(function LineChart({ data, market }: LineChartProps) {
  // [성능] useMemo — 데이터 변경 시에만 옵션 재계산
  const option = useMemo(() => {
    const dates = data.map((d) => d.date);
    const profitLossValues = data.map((d) => d.profitLoss);
    const returnRateValues = data.map((d) => d.returnRate);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#f3f4f6', fontSize: 12 },
        formatter: (params: Array<{ axisValue: string; value: number; seriesName: string; marker: string }>) => {
          const date = params[0].axisValue;
          let html = `<strong>${date}</strong>`;
          params.forEach((p) => {
            if (p.seriesName === '평가손익') {
              html += `<br/>${p.marker} ${p.seriesName}: ${formatCurrency(p.value, market)}`;
            } else {
              const sign = p.value >= 0 ? '+' : '';
              html += `<br/>${p.marker} ${p.seriesName}: ${sign}${p.value.toFixed(2)}%`;
            }
          });
          return html;
        },
      },
      legend: {
        data: ['평가손익', '수익률'],
        textStyle: { color: '#9ca3af', fontSize: 12 },
        top: 0,
      },
      grid: {
        left: 60,
        right: 60,
        top: 40,
        bottom: 30,
      },
      xAxis: {
        type: 'category' as const,
        data: dates,
        axisLine: { lineStyle: { color: '#374151' } },
        axisLabel: { color: '#6b7280', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value' as const,
          name: '손익',
          nameTextStyle: { color: '#6b7280', fontSize: 11 },
          axisLine: { show: false },
          axisLabel: {
            color: '#6b7280',
            fontSize: 11,
            formatter: (value: number) => formatCurrency(value, market),
          },
          splitLine: { lineStyle: { color: '#1f2937' } },
        },
        {
          type: 'value' as const,
          name: '수익률',
          nameTextStyle: { color: '#6b7280', fontSize: 11 },
          axisLine: { show: false },
          axisLabel: {
            color: '#6b7280',
            fontSize: 11,
            formatter: (value: number) => `${value.toFixed(1)}%`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '평가손익',
          type: 'line',
          yAxisIndex: 0,
          data: profitLossValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          // [의사결정] 영역 채우기 — 0 기준으로 수익은 빨강, 손실은 파랑 그래디언트
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
              ],
            },
          },
          // [의사결정] 0 기준선 — 손익 전환 시점을 시각적으로 명확하게 표현
          markLine: {
            silent: true,
            data: [{ yAxis: 0 }],
            lineStyle: { color: '#4b5563', type: 'dashed' as const },
            label: { show: false },
          },
        },
        {
          name: '수익률',
          type: 'line',
          yAxisIndex: 1,
          data: returnRateValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 1.5, color: '#8b5cf6', type: 'dashed' as const },
          itemStyle: { color: '#8b5cf6' },
        },
      ],
    };
  }, [data, market]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
        <p className="text-sm text-gray-500">손익 추이 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-400">기간별 손익 추이</h3>
      <ReactECharts
        option={option}
        style={{ height: 350 }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
      />
    </div>
  );
});

export default LineChart;
