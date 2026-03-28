export const config = { runtime: 'edge' };

/**
 * Alpha Vantage API 프록시
 * [의사결정] API 키를 서버에서 주입하여 클라이언트 노출 방지
 */
export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ALPHA_VANTAGE_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params = new URLSearchParams(searchParams);
  params.set('apikey', apiKey);

  const apiUrl = `https://www.alphavantage.co/query?${params.toString()}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
