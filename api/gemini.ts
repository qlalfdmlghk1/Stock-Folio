export const config = { runtime: 'edge' };

/**
 * Gemini API 프록시
 * [의사결정] API 키를 서버에서 주입 — 과금 가능한 API이므로 보안 우선
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST method required' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.text();
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const data = await response.json();

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
