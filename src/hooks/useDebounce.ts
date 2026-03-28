import { useState, useEffect } from 'react';

/**
 * 값의 변경을 지연시키는 디바운스 훅
 * [의사결정] 종목명 검색 시 타이핑마다 API 호출 방지 — 입력 완료 후 delay(ms) 뒤에 반영
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
