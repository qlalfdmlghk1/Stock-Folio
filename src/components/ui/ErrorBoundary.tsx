import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 에러 발생 시 표시할 대체 UI 커스텀 (선택) */
  fallback?: ReactNode;
  /** 에러 발생 시 호출되는 콜백 (선택) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 컴포넌트 에러 격리 — 자식 트리에서 발생한 렌더링 에러를 잡아 앱 전체 중단 방지
 * [의사결정] 차트/포트폴리오 섹션별로 개별 적용하여 한 영역 에러가 전체에 영향 안 미치도록 설계
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] 컴포넌트 에러 포착:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-6 text-center">
          <p className="text-sm font-medium text-red-400">
            이 영역에서 오류가 발생했습니다.
          </p>
          <p className="mt-1 text-xs text-red-500/70">
            {this.state.error?.message ?? '알 수 없는 오류'}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
