// Calls the two token-gated read functions in the existing database. Read only.
export async function rpc(env, fn, body) {
  const r = await fetch(`${env.SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SB_ANON, Authorization: `Bearer ${env.SB_ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify({ tok: env.BR24_TOKEN, ...body }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('db ' + r.status);
  return r.json();
}
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
