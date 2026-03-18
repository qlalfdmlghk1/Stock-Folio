import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * 네트워크 오프라인 배너 — 인터넷 연결 끊김 시 화면 상단에 표시
 * [예외처리] 금융 서비스는 네트워크 상태가 치명적 — 오프라인 시 명확한 안내 필수
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
      네트워크 연결이 끊겼습니다. 인터넷 연결을 확인해주세요.
    </div>
  );
}
