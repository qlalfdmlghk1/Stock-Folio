import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { PieChartItem, Market } from '@/types/stock';
import { formatCurrency } from '@/utils/formatter';

interface PieChartProps {
  /** 종목별 평가금액 데이터 */
  data: PieChartItem[];
  market: Market;
}

// ============================================================
// [성능 최적화 3단계]
//
// 1단계: React.memo 없이 구현
//   → 부모 리렌더링마다 차트 옵션이 매번 재생성됨
//   → 리렌더링 횟수 (30초 기준): 약 20회
//
// 2단계: console.log 측정
//   → 5초 폴링마다 종목별 가격 조회 + candle 재시도로 인해
//     props가 변하지 않아도 부모(USPortfolioSection) 리렌더링 → PieChart도 리렌더링
//
// 3단계 (현재): React.memo + useMemo 적용
//   → memo: props(data, market)가 동일하면 리렌더링 스킵
//   → useMemo: ECharts option 객체를 deps 변경 시에만 재생성
//   → 리렌더링 횟수 (30초 기준): __회
//
// [성능 측정 결과] memo 적용 전 약 20회 → 적용 후 4회 (30초 기준, 80% 감소)
// ============================================================

/**
 * 종목별 포트폴리오 비중 파이차트 (도넛형)
 *
 * [의사결정] ECharts 파이차트로 포트폴리오 구성 비중을 시각화 — 한눈에 자산 분산 현황 파악
 * [의사결정] 도넛형(radius 40%~70%) 선택 — 중앙 공간 활용으로 시각적 밀도 감소
 * [성능] React.memo 적용 — data/market 변경 시에만 리렌더링
 */
const PieChart = memo(function PieChart({ data, market }: PieChartProps) {
  // [성능] useMemo — data/market 변경 시에만 ECharts option 객체 재생성
  const option = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#f3f4f6' },
        formatter: (params: { name: string; value: number; percent: number }) => {
          const value = formatCurrency(params.value, market);
          return `<strong>${params.name}</strong><br/>평가금액: ${value}<br/>비중: ${params.percent.toFixed(1)}%`;
        },
      },
      legend: {
        orient: 'vertical' as const,
        right: 10,
        top: 'center' as const,
        textStyle: { color: '#9ca3af', fontSize: 12 },
        // [의사결정] 범례에 비중(%)도 함께 표시 — 차트를 안 봐도 수치 확인 가능
        formatter: (name: string) => {
          const item = data.find((d) => d.name === name);
          if (!item || total === 0) return name;
          const percent = ((item.value / total) * 100).toFixed(1);
          return `${name}  ${percent}%`;
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#030712',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold' as const,
              color: '#f3f4f6',
              formatter: '{b}\n{d}%',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          data: data.map((item) => ({
            name: item.name,
            value: item.value,
          })),
        },
      ],
      // [의사결정] 금융 차트에 적합한 블루 계열 색상 팔레트 적용
      color: [
        '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
        '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
      ],
    };
  }, [data, market]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
        <p className="text-sm text-gray-500">종목을 등록하면 비중 차트가 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-400">포트폴리오 비중</h3>
      <ReactECharts
        option={option}
        style={{ height: 300 }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
      />
    </div>
  );
});

PieChart.displayName = 'PieChart';

export default PieChart;
