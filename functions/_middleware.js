// Per-branch password gate.
// Secrets (Cloudflare Pages environment, never in this repo):
//   COOKIE_SECRET      long random string used to sign sessions
//   BRANCH_PASSWORDS   JSON object: {"022":"password-for-ashkelon","024":"password-for-tel-aviv", ...}
//   VIEWER_PASSWORDS   optional JSON {"022":"password"}: a read-only viewer of that branch (search and compare only: no basket, export or management tools)
//   ADMIN_PASSWORD     optional; a network manager who can switch between branches (SITE_PASSWORD is accepted as a legacy name)
//   KV (binding)       optional; enables login rate limiting (and usage statistics)
import { names } from './_branches.js';

const enc = new TextEncoder();
const TTL = 30 * 86400; // session length, seconds
const PUBLIC = new Set(['/manifest.webmanifest', '/sw.js', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/logo.png']);
const MAX_FAILS = 8, WINDOW = 900; // login failures per IP per 15 minutes (needs KV)

async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// constant-time comparison (both sides are hashed first, so length is not leaked either)
async function safeEq(secret, a, b) {
  const [x, y] = await Promise.all([hmac(secret, 'eq:' + a), hmac(secret, 'eq:' + b)]);
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return r === 0;
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(err, chosen, codes) {
  const opts = codes.map(c => `<option value="${esc(c)}"${c === chosen ? ' selected' : ''}>${esc(names[c])}</option>`).join('');
  return new Response(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>כניסה · אושר24</title>
<body style="margin:0;background:#f2eee3;font-family:system-ui,Arial,sans-serif;display:flex;justify-content:center;padding:14vh 14px 0">
<form method="post" action="/login" style="width:100%;max-width:340px;background:#fffdf7;border:2px solid #111;box-shadow:4px 4px 0 #111;padding:20px">
<div style="text-align:center;margin-bottom:10px"><img src="/logo.png" alt="השוואת מחירים" style="width:70%;max-width:230px;height:auto"></div>
<label style="font:700 12px ui-monospace,monospace;color:#6d6a60">סניף</label>
<select name="branch" style="display:block;width:100%;margin:4px 0 12px;padding:10px;font:700 16px inherit;border:2px solid #111;background:#fff;border-radius:0">${opts}<option value="admin"${chosen === 'admin' ? ' selected' : ''}>מנהל רשת</option></select>
<label style="font:700 12px ui-monospace,monospace;color:#6d6a60">סוג כניסה</label>
<select name="kind" style="display:block;width:100%;margin:4px 0 12px;padding:10px;font:700 16px inherit;border:2px solid #111;background:#fff;border-radius:0"><option value="manager">מנהל סניף</option><option value="viewer">צופה</option></select>
<label style="font:700 12px ui-monospace,monospace;color:#6d6a60">סיסמה</label>
<input type="password" name="password" autocomplete="current-password" autofocus required style="display:block;width:100%;margin:4px 0 14px;padding:10px;font-size:16px;border:2px solid #111;border-radius:0">
<button style="width:100%;padding:12px;font:900 18px inherit;background:#c9ff2f;border:2px solid #111;cursor:pointer">כניסה</button>
${err ? '<p style="color:#c0310a;font-weight:700;margin:12px 0 0">סניף או סיסמה שגויים</p>' : ''}
</form></body></html>`, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

const tooMany = () => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body dir="rtl" style="font-family:system-ui;padding:20vh 20px;text-align:center"><h2>יותר מדי ניסיונות</h2><p>נסה שוב בעוד 15 דקות.</p></body>', { status: 429, headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': String(WINDOW), 'cache-control': 'no-store' } });

export async function onRequest(ctx) {
  const { request, env, next, data } = ctx;
  const admin = env.ADMIN_PASSWORD || env.SITE_PASSWORD || '';
  let pw = {};
  try { pw = JSON.parse(env.BRANCH_PASSWORDS || '{}'); } catch (e) { return new Response('bad BRANCH_PASSWORDS', { status: 503 }); }
  let vpw = {}; try { vpw = JSON.parse(env.VIEWER_PASSWORDS || '{}'); } catch (e) { return new Response('bad VIEWER_PASSWORDS', { status: 503 }); }
  const codes = Object.keys({ ...pw, ...vpw }).filter(c => names[c] && (pw[c] || vpw[c])).sort((a, b) => names[a].localeCompare(names[b], 'he'));
  if (!env.COOKIE_SECRET || (!admin && !codes.length)) return new Response('not configured', { status: 503 });
  const secretFor = role => (role === 'admin' ? admin : /^v\d+$/.test(role) ? vpw[role.slice(1)] : pw[role]) || '';
  const url = new URL(request.url);
  if (url.pathname === '/api/health') return next(); // protected by its own HEALTH_KEY
  if (PUBLIC.has(url.pathname)) return next();

  if (url.pathname === '/login' && request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown', rlKey = 'rl:' + ip;
    let fails = 0;
    if (env.KV) {
      try { fails = parseInt(await env.KV.get(rlKey), 10) || 0; } catch (e) { console.error('rl read failed', String(e)); }
      if (fails >= MAX_FAILS) return tooMany();
    }
    const f = await request.formData();
    let role = String(f.get('branch') || ''); const given = String(f.get('password') || '');
    if (f.get('kind') === 'viewer' && codes.includes(role)) role = 'v' + role;
    const real = (role === 'admin' || codes.includes(role) || (/^v\d+$/.test(role) && codes.includes(role.slice(1)))) ? secretFor(role) : '';
    // always run one comparison so a wrong branch and a wrong password take the same time
    const ok = (await safeEq(env.COOKIE_SECRET, given, real || '\u0000no-such-password')) && !!real;
    if (!ok) {
      console.warn('login failed', JSON.stringify({ role: role.slice(0, 8), ip }));
      if (env.KV) { try { await env.KV.put(rlKey, String(fails + 1), { expirationTtl: WINDOW }); } catch (e) { console.error('rl write failed', String(e)); } }
      await new Promise(r => setTimeout(r, 700));
      return page(true, role, codes);
    }
    if (env.KV && fails) { try { await env.KV.delete(rlKey); } catch (e) {} }
    const payload = `${role}.${Math.floor(Date.now() / 1000) + TTL}`;
    const sig = await hmac(env.COOKIE_SECRET, payload + ':' + real);
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `o24=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}` } });
  }
  if (url.pathname === '/logout') {
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': 'o24=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' } });
  }

  const m = (request.headers.get('cookie') || '').match(/(?:^|; )o24=(admin|v?\d+)\.(\d+)\.([0-9a-f]+)/);
  if (m) {
    const [, role, exp, sig] = m, real = secretFor(role);
    if (real && Number(exp) > Date.now() / 1000 && await safeEq(env.COOKIE_SECRET, sig, await hmac(env.COOKIE_SECRET, `${role}.${exp}:${real}`))) {
      data.role = role === 'admin' ? 'admin' : role[0] === 'v' ? 'viewer' : 'branch';
      data.branch = role === 'admin' ? null : role.replace(/^v/, '');
      return next();
    }
  }
  return page(false, '', codes);
}
