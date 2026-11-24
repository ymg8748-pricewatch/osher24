// Password gate. SITE_PASSWORD and COOKIE_SECRET are Cloudflare Pages environment secrets, never in this repo.
const enc = new TextEncoder();
async function sign(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const page = (err) => new Response(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>כניסה</title><body style="font-family:sans-serif;display:flex;justify-content:center;padding-top:20vh"><form method="post" action="/login"><h3>סניפי אושר עד</h3><input type="password" name="password" placeholder="סיסמה" autofocus style="padding:10px;font-size:16px"><button style="padding:10px">כניסה</button>${err ? '<p style="color:#b00">סיסמה שגויה</p>' : ''}</form></body></html>`, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  if (!env.SITE_PASSWORD || !env.COOKIE_SECRET) return new Response('not configured', { status: 503 });
  const url = new URL(request.url);
  const good = await sign(env.COOKIE_SECRET, 'osher24:' + env.SITE_PASSWORD);
  if (url.pathname === '/login' && request.method === 'POST') {
    const f = await request.formData();
    if (f.get('password') === env.SITE_PASSWORD) {
      return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `o24=${good}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` } });
    }
    return page(true);
  }
  const m = (request.headers.get('cookie') || '').match(/(?:^|; )o24=([0-9a-f]+)/);
  if (!m || m[1] !== good) return page(false);
  return next();
}
