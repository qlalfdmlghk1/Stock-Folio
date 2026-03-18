import { useState, useEffect, useMemo } from 'react';
import type { Market } from '@/types/stock';

/** 장 상태 정보 */
export interface MarketStatus {
  /** 장 열림 여부 */
  isOpen: boolean;
  /** 상태 라벨 (예: "장중", "장 마감", "프리마켓") */
  label: string;
  /** 다음 상태 변경까지 남은 시간 (ms) — UI 타이머용 */
  nextChangeMs: number | null;
}

/**
 * 미국 장 열림 여부를 판단한다 (ET 기준).
 * [의사결정] 정규장만 판단 — 프리/애프터마켓은 Finnhub 무료 플랜에서 체결가 미수신
 *
 * NYSE/NASDAQ 정규장: 월~금 09:30~16:00 ET
 * ET = UTC-5 (겨울) / UTC-4 (서머타임)
 */
function getUsMarketStatus(): MarketStatus {
  const now = new Date();

  // ET(미국 동부시간)로 변환
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const dayOfWeek = et.getDay(); // 0=일, 6=토

  // 주말
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { isOpen: false, label: '장 마감 (주말)', nextChangeMs: null };
  }

  const marketOpen = 9 * 60 + 30;  // 09:30 ET
  const marketClose = 16 * 60;      // 16:00 ET

  if (totalMinutes >= marketOpen && totalMinutes < marketClose) {
    // 장중 — 장 마감까지 남은 시간 계산
    const remainingMinutes = marketClose - totalMinutes;
    return {
      isOpen: true,
      label: '장중',
      nextChangeMs: remainingMinutes * 60 * 1000,
    };
  }

  if (totalMinutes < marketOpen) {
    // 장 시작 전
    const remainingMinutes = marketOpen - totalMinutes;
    return {
      isOpen: false,
      label: '장 시작 전',
      nextChangeMs: remainingMinutes * 60 * 1000,
    };
  }

  // 장 마감 후
  return { isOpen: false, label: '장 마감', nextChangeMs: null };
}

/** 한국 장 상태를 판단한다 (KST 기준, 09:00~15:30) */
function getKrMarketStatus(): MarketStatus {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const hours = kst.getHours();
  const minutes = kst.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const dayOfWeek = kst.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { isOpen: false, label: '장 마감 (주말)', nextChangeMs: null };
  }

  const marketOpen = 9 * 60;       // 09:00 KST
  const marketClose = 15 * 60 + 30; // 15:30 KST

  if (totalMinutes >= marketOpen && totalMinutes < marketClose) {
    const remainingMinutes = marketClose - totalMinutes;
    return {
      isOpen: true,
      label: '장중',
      nextChangeMs: remainingMinutes * 60 * 1000,
    };
  }

  if (totalMinutes < marketOpen) {
    const remainingMinutes = marketOpen - totalMinutes;
    return {
      isOpen: false,
      label: '장 시작 전',
      nextChangeMs: remainingMinutes * 60 * 1000,
    };
  }

  return { isOpen: false, label: '장 마감', nextChangeMs: null };
}

/**
 * 미국/한국 장 상태를 실시간으로 감지하는 훅
 * [의사결정] 1분 주기로 장 상태 갱신 — 초 단위 정밀도는 불필요, 리렌더링 최소화
 */
export function useMarketStatus(market: Market): MarketStatus {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // 1분마다 장 상태 재계산
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    // tick을 의존성에 포함하여 1분마다 재계산
    void tick;
    return market === 'US' ? getUsMarketStatus() : getKrMarketStatus();
  }, [market, tick]);
}
