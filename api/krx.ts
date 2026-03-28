export const config = { runtime: 'edge' };

/**
 * 공공데이터포털 KRX API 프록시
 * [의사결정] API 키를 서버에서 주입하여 클라이언트 노출 방지
 */
export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const apiKey = process.env.KRX_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'KRX_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params = new URLSearchParams(searchParams);
  params.set('serviceKey', apiKey);

  const apiUrl = `https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?${params.toString()}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
