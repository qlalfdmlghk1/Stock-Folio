export const config = { runtime: 'edge' };

/**
 * Finnhub REST API 프록시
 * [의사결정] API 키를 서버에서 주입하여 클라이언트 노출 방지
 */
export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return new Response(JSON.stringify({ error: 'path parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'FINNHUB_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // path 파라미터를 제외한 나머지를 외부 API로 전달
  const params = new URLSearchParams(searchParams);
  params.delete('path');
  params.set('token', apiKey);

  const apiUrl = `https://finnhub.io/api/v1/${path}?${params.toString()}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
