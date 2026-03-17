# ECharts 차트 컴포넌트 React.memo + useMemo 성능 최적화

> 5초 폴링 환경에서 ECharts 차트의 불필요한 리렌더링을 React.memo + useMemo로 80% 감소시킨 최적화 사례

## 배경

- **문제**: Finnhub REST API 5초 폴링으로 종목 가격을 갱신할 때, 부모 컴포넌트(`USPortfolioSection`)가 리렌더링되면서 **props가 변하지 않은 차트 컴포넌트까지 매번 리렌더링**됨
- **제약 조건**:
  - 5초 주기 폴링 + 종목 3개 = 빈번한 부모 리렌더링 발생
  - ECharts option 객체는 매 렌더마다 새로 생성 → 차트 인스턴스가 불필요하게 업데이트
  - 금융 앱 특성상 실시간 데이터 갱신과 렌더링 성능을 동시에 확보해야 함

## 선택지 비교

| 항목 | 최적화 없음 (1단계) | React.memo만 적용 | React.memo + useMemo (최종 선택) |
|------|------|------|------|
| 부모 리렌더링 시 차트 렌더링 | 매번 렌더링 | props 동일하면 스킵 | props 동일하면 스킵 |
| ECharts option 객체 재생성 | 매번 새 객체 생성 | 매번 새 객체 생성 | deps 변경 시에만 재생성 |
| 30초 기준 렌더링 횟수 | 약 20회 | 4회 (props 비교로 스킵) | 4회 + option 재생성도 최소화 |
| 구현 복잡도 | 없음 | 낮음 | 보통 |

## 최종 결정 및 근거

**React.memo + useMemo 조합**을 선택한 이유:

1. **React.memo 단독으로는 부족** — memo가 props 얕은 비교로 리렌더링을 스킵하더라도, 실제 렌더링이 발생하는 경우(가격 변경 시) option 객체가 매번 새로 생성됨. useMemo로 option 재생성도 deps 기반으로 제한해야 ECharts 내부 diff 비용까지 절감 가능
2. **측정 기반 의사결정** — 추측이 아닌 console.log 측정으로 최적화 전 약 20회 → 적용 후 4회 확인. 4회는 실제 가격 변동으로 인한 정당한 리렌더링

## 구현 방식

### 리렌더링 원인 분석

```
Finnhub 5초 폴링 (종목 3개: AAPL, MSFT, GOOGL)
  ↓
TanStack Query가 가격 데이터 갱신
  ↓
USPortfolioSection 리렌더링 (priceMap 변경)
  ↓
자식 차트 컴포넌트 3개도 리렌더링 ← 문제 지점
```

### 3단계 최적화 프로세스

**1단계**: memo 없이 순수 함수로 구현

```typescript
function PieChart({ data, market }: PieChartProps) {
  const option = { ... }; // 매 렌더마다 새 객체 생성
  return <ReactECharts option={option} />;
}
```

**2단계**: console.log로 렌더링 횟수 측정

```typescript
console.log('[PieChart] 렌더링 발생', Date.now());
// → 30초간 약 20회 출력 확인
```

**3단계**: React.memo + useMemo 적용

```typescript
const PieChart = memo(function PieChart({ data, market }: PieChartProps) {
  const option = useMemo(() => {
    // data/market이 변경될 때만 option 객체 재생성
    return { ... };
  }, [data, market]);

  return <ReactECharts option={option} notMerge={true} />;
});
```

### 부모 컴포넌트의 협력 (useMemo로 props 참조 안정화)

memo가 효과를 내려면 부모에서 전달하는 props의 참조가 안정적이어야 함:

```typescript
// USPortfolioSection.tsx
const pieData = useMemo<PieChartItem[]>(() => {
  return stocks
    .filter((s) => priceMap[s.symbol] !== undefined)
    .map((s) => ({
      name: s.name, symbol: s.symbol,
      value: calcMarketValue(priceMap[s.symbol], s.quantity),
    }));
}, [stocks, priceMap]);

// priceMap이 동일하면 pieData도 동일한 참조 → PieChart는 memo로 스킵
<PieChart data={pieData} market="US" />
```

### 측정 결과

| 지표 | 최적화 전 (1단계) | 최적화 후 (3단계) |
|------|------|------|
| 30초간 렌더링 횟수 | 약 20회 | 4회 |
| 불필요한 렌더링 | 약 16회 | 0회 |
| 감소율 | — | **80%** |

- 잔존 4회 = 실제 가격 변동으로 `pieData` 참조가 바뀐 경우 → **정당한 리렌더링**

## 트레이드오프

- **얻은 것**: 리렌더링 80% 감소, ECharts option 객체 불필요한 재생성 방지
- **감수한 것**: useMemo deps 관리 복잡도 증가, 부모-자식 간 참조 안정성을 함께 고려해야 함
- **대응 방법**: 부모(`USPortfolioSection`)에서 차트에 전달하는 데이터를 useMemo로 감싸서 참조 안정성 확보. displayName을 명시하여 Profiler에서 컴포넌트 식별 용이하게 함

## 면접 포인트

1. **측정 기반 최적화**: "느리다"는 감이 아닌 console.log/Profiler로 수치를 먼저 측정하고, 최적화 후 개선폭(80%)을 정량적으로 입증
2. **memo 단독이 아닌 부모-자식 협력 구조 이해**: React.memo는 자식에 걸지만, 효과를 내려면 부모의 useMemo로 props 참조를 안정화해야 한다는 점을 설계에 반영
3. **ECharts 특성에 맞는 최적화**: `notMerge={true}` + useMemo 조합으로 ECharts 내부 diff 비용까지 고려한 최적화 (단순 React 최적화를 넘어 라이브러리 특성 이해)
