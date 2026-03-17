# Finnhub 캔들 API 403 에러 — Alpha Vantage 전환 및 Fallback 설계

> Finnhub 무료 플랜에서 `/stock/candle` 엔드포인트가 프리미엄 전용으로 변경되어 403 에러 발생 → Alpha Vantage + Mock fallback 이중 대체 구조로 해결

## 증상

- **발생 시점**: 캔들스틱 차트 렌더링 시 (종목 선택 후 일봉 데이터 조회)
- **증상**: 캔들스틱 차트가 표시되지 않음, 콘솔에 403 에러
- **에러 메시지**:
```
GET https://finnhub.io/api/v1/stock/candle?symbol=AAPL&resolution=D&from=...&to=...&token=... 403
```

## 원인 분석

### 시도한 접근

1. API 키 오류 의심 → `/quote` 엔드포인트는 동일 키로 정상 동작, 키 문제 아님
2. 요청 파라미터(from/to 타임스탬프) 오류 의심 → 값 정상, 파라미터 문제 아님

### 실제 원인

Finnhub이 `/stock/candle` 엔드포인트를 **프리미엄 플랜 전용**으로 변경. 무료 플랜에서는 실시간 시세(`/quote`, WebSocket)만 제공하고, 과거 일봉 데이터는 유료 전용으로 전환됨.

| 엔드포인트 | 무료 플랜 | 비고 |
|-----------|----------|------|
| `/quote` | ✅ 사용 가능 | 실시간 현재가 |
| WebSocket | ✅ 사용 가능 | 실시간 체결가 |
| `/stock/candle` | ❌ 403 | 과거 일봉 (프리미엄 전용) |

## 해결

### 해결 방법

**API 용도 분리 전략**: 실시간 시세는 Finnhub 유지, 과거 일봉은 Alpha Vantage로 대체

```
기존: Finnhub 단일 의존
  /quote (실시간) + /stock/candle (일봉) — 일봉 403 발생

변경: API 용도 분리 + 이중 fallback
  Finnhub /quote, WebSocket (실시간 시세) — 분당 60회, 무료
  Alpha Vantage TIME_SERIES_DAILY (과거 일봉) — 일 25회, 무료
  Mock fallback (Alpha Vantage 한도 초과 시) — 현재가 기반 시뮬레이션
```

**Alpha Vantage 일 25회 한도가 충분한 이유**:
- 캔들 데이터는 종목당 1회만 호출하고 5분간 캐싱 (`staleTime: 5분`)
- 포트폴리오 10종목 기준 하루 10~20회 수준
- 초기 설계 시 Alpha Vantage를 제외한 이유는 "실시간 폴링(5초 주기)"에 부적합해서였고, 일봉 조회 용도에는 충분

**Mock fallback 시 사용자 알림**:
- Alpha Vantage 한도 초과/오류 시 현재가 기반 Mock 캔들로 자동 전환
- UI에 "현재 표시되는 데이터는 시뮬레이션입니다" 배너 표시

```typescript
// useStockCandles.ts — 이중 fallback 구조
queryFn: async () => {
  // 1순위: Alpha Vantage (실제 과거 일봉)
  try {
    const candles = await fetchAlphaVantageCandles(symbol, days);
    if (candles.length > 0) return { candles, isRealData: true };
  } catch { /* fallback으로 진행 */ }

  // 2순위: 현재가 기반 Mock (한도 초과/오류 시)
  const quote = await fetchQuote(symbol);
  return {
    candles: generateUsMockCandles(symbol, quote.currentPrice, days),
    isRealData: false,
  };
}
```

### 관련 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/constants/api.ts` | Alpha Vantage API 키/URL 상수 추가 |
| `src/services/alphaVantage.ts` | Alpha Vantage TIME_SERIES_DAILY 호출 서비스 (신규) |
| `src/services/finnhub.ts` | `generateUsMockCandles()` Mock 캔들 생성 함수 추가 |
| `src/hooks/useStockCandles.ts` | Alpha Vantage 1순위 → Mock fallback 2순위 구조로 변경, `isRealData` 플래그 추가 |
| `src/components/portfolio/USPortfolioSection.tsx` | Mock 데이터 시 시뮬레이션 안내 배너 표시 |

## 배운 점

- **무료 API의 정책 변경 리스크**: 외부 API에 단일 의존하면 정책 변경 시 기능 전체가 중단될 수 있다. 용도별로 API를 분리하고 fallback을 두는 것이 안전하다.
- **API 용도 분리의 가치**: 동일 API의 모든 엔드포인트가 같은 조건은 아니다. 엔드포인트별 제한을 파악하고, 용도에 맞는 최적의 소스를 선택해야 한다.

## 면접 포인트

- **단일 장애점(SPOF) 제거**: Finnhub 하나에 의존하던 구조에서, 실시간/과거 데이터를 용도별로 분리하고 3단계 fallback(Alpha Vantage → Mock → 에러)을 설계하여 어떤 상황에서도 앱이 중단되지 않도록 한 점
- **제약 조건 내 최적 설계**: Alpha Vantage 일 25회 제한이 "실시간 폴링"에는 부적합하지만 "일봉 캐싱 조회"에는 충분하다는 판단 — 같은 도구도 용도에 따라 적합성이 달라진다는 엔지니어링 판단
- **Graceful Degradation**: 데이터 품질이 떨어지더라도(실제 → 시뮬레이션) 사용자에게 투명하게 알리며 서비스를 유지하는 UX 설계
