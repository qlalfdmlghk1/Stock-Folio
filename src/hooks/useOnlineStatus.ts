import { useState, useEffect } from 'react';

/**
 * 브라우저 네트워크 온/오프라인 상태를 감지하는 훅
 * [의사결정] navigator.onLine + 이벤트 리스너 — 네트워크 단절 시 즉각 UI 반영
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
