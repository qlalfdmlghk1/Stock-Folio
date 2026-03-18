import { GEMINI_API_KEY, GEMINI_BASE_URL } from '@/constants/api';

/**
 * Gemini API를 사용한 종목 동향 요약
 * [의사결정] gemini-2.5-flash-lite 선택 — 무료 티어 하루 1,000회 +
 * 종목 요약 용도에 충분한 성능. gemini-1.5-flash는 2026년 지원 종료.
 * [의사결정] 한국어 프롬프트로 요청 — 한국어 요약 품질 보장
 */

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

/**
 * 종목의 최근 동향을 2~3줄로 한국어 요약
 * @param symbol 종목 코드 (예: AAPL, 005930)
 * @param name 종목명 (예: Apple, 삼성전자)
 * @param market 시장 구분 (US | KR)
 */
export async function fetchStockSummary(
  symbol: string,
  name: string,
  market: 'US' | 'KR'
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const marketLabel = market === 'US' ? '미국' : '한국';

  // [의사결정] 프롬프트 엔지니어링 — 간결한 투자 동향 요약에 최적화
  const prompt = `${marketLabel} 주식 ${name}(${symbol})의 최근 동향을 2~3줄로 간결하게 한국어로 요약해주세요.
주가 흐름, 주요 이슈, 시장 전망 위주로 작성하되, 투자 권유 문구는 제외해주세요.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 256
          }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API 오류 (${response.status})`);
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API에서 빈 응답을 받았습니다.');
    }

    return text.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Gemini API 응답 시간 초과 (15초)');
    }
    throw error;
  }
}
