// Per-branch password gate.
// Secrets (Cloudflare Pages environment, never in this repo):
//   COOKIE_SECRET      long random string used to sign sessions
//   BRANCH_PASSWORDS   JSON object: {"022":"password-for-ashkelon","024":"password-for-tel-aviv", ...}
//   VIEWER_PASSWORDS   optional JSON {"022":"password"}: a read-only viewer of that branch (search and compare only: no basket, export or management tools)
//   Viewers with no branch (see the whole site, read-only) are added from the admin screen; only their hashes live in table br24_pw, as code "vw:<name>".
//   ADMIN_PASSWORD     optional; a network manager who can switch between branches (SITE_PASSWORD is accepted as a legacy name)
//   KV (binding)       optional; enables login rate limiting (and usage statistics)
import { names } from './_branches.js';
import { overrides, hashPw } from './_pw.js';

const enc = new TextEncoder();
const TTL = 365 * 86400; // session length, seconds (renewed on every visit to the home page)
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
async function sha12(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(err, chosen, codes, vname) {
  const opts = codes.map(c => `<option value="${esc(c)}"${c === chosen ? ' selected' : ''}>${esc(names[c])}</option>`).join('');
  return new Response(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>כניסה · אושר24</title>
<body style="margin:0;background:#f2eee3;font-family:system-ui,Arial,sans-serif;display:flex;justify-content:center;padding:14vh 14px 0">
<form method="post" action="/login" style="width:100%;max-width:340px;background:#fffdf7;border:2px solid #111;box-shadow:4px 4px 0 #111;padding:20px">
<div style="text-align:center;margin-bottom:10px"><img src="/logo.png" alt="השוואת מחירים" style="width:70%;max-width:230px;height:auto"></div>
<label style="font:700 12px ui-monospace,monospace;color:#6d6a60">סניף</label>
<select name="branch" id="brsel" style="display:block;width:100%;margin:4px 0 12px;padding:10px;font:700 16px inherit;border:2px solid #111;background:#fff;border-radius:0">${opts}<option value="admin"${chosen === 'admin' ? ' selected' : ''}>מנהל רשת</option><option value="w"${chosen === 'w' ? ' selected' : ''}>צופה ללא סניף · כל האתר</option></select>
<div id="vnrow" style="display:none"><label style="font:700 12px ui-monospace,monospace;color:#6d6a60">שם הצופה</label>
<input type="text" name="vname" value="${esc(vname || '')}" maxlength="24" autocomplete="username" style="display:block;width:100%;margin:4px 0 12px;padding:10px;font-size:16px;border:2px solid #111;border-radius:0"></div>
<div id="kindrow"><label style="font:700 12px ui-monospace,monospace;color:#6d6a60">סוג כניסה</label>
<select name="kind" style="display:block;width:100%;margin:4px 0 12px;padding:10px;font:700 16px inherit;border:2px solid #111;background:#fff;border-radius:0"><option value="manager">מנהל סניף</option><option value="viewer">צופה</option></select></div>
<label style="font:700 12px ui-monospace,monospace;color:#6d6a60">סיסמה</label>
<input type="password" name="password" autocomplete="current-password" autofocus required style="display:block;width:100%;margin:4px 0 14px;padding:10px;font-size:16px;border:2px solid #111;border-radius:0">
<button style="width:100%;padding:12px;font:900 18px inherit;background:#c9ff2f;border:2px solid #111;cursor:pointer">כניסה</button>
<script>(function(){var b=document.getElementById('brsel'),v=document.getElementById('vnrow'),k=document.getElementById('kindrow');function t(){var w=b.value==='w';v.style.display=w?'':'none';k.style.display=w?'none':''}b.addEventListener('change',t);t()})()</script>
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
  const ov = await overrides(env); // branch passwords changed from the admin screen (hashes)
  const ovOf = r => (/^\d+$/.test(r) && ov[r] && ov[r].h) ? 'h:' + ov[r].h : null;
  const codes = Object.keys({ ...pw, ...vpw, ...ov }).filter(c => names[c] && (pw[c] || vpw[c] || ov[c])).sort((a, b) => names[a].localeCompare(names[b], 'he'));
  if (!env.COOKIE_SECRET || (!admin && !codes.length)) return new Response('not configured', { status: 503 });
  const wmap = {}; // viewer-without-branch sessions: role "w:<hash>" -> br24_pw code "vw:<name>"
  for (const k of Object.keys(ov)) if (k.startsWith('vw:') && k.length > 3 && k.length <= 27) wmap['w:' + await sha12(k)] = k;
  const secretFor = role => (role === 'admin' ? admin : role.startsWith('w:') ? (wmap[role] && ov[wmap[role]].h ? 'h:' + ov[wmap[role]].h : '') : /^v\d+$/.test(role) ? vpw[role.slice(1)] : (ovOf(role) || pw[role])) || '';
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
    const chosen = role;
    let pwCode = role;
    if (role === 'w') { pwCode = 'vw:' + String(f.get('vname') || '').trim().slice(0, 24); role = 'w:' + await sha12(pwCode); }
    else if (f.get('kind') === 'viewer' && codes.includes(role)) role = 'v' + role;
    const known = role === 'admin' || codes.includes(role) || (/^v\d+$/.test(role) && codes.includes(role.slice(1))) || (role.startsWith('w:') && !!wmap[role]);
    const real = known ? secretFor(role) : '';
    // always run one comparison so a wrong branch and a wrong password take the same time
    const givenId = role.startsWith('w:') ? 'h:' + await hashPw(env, pwCode, given) : ovOf(role) ? 'h:' + await hashPw(env, role, given) : given;
    const ok = (await safeEq(env.COOKIE_SECRET, givenId, real || '\u0000no-such-password')) && !!real;
    if (!ok) {
      console.warn('login failed', JSON.stringify({ role: role.slice(0, 8), ip }));
      if (env.KV) { try { await env.KV.put(rlKey, String(fails + 1), { expirationTtl: WINDOW }); } catch (e) { console.error('rl write failed', String(e)); } }
      await new Promise(r => setTimeout(r, 700));
      return page(true, chosen || role, codes, chosen === 'w' ? String(f.get('vname') || '').trim().slice(0, 24) : '');
    }
    if (env.KV && fails) { try { await env.KV.delete(rlKey); } catch (e) {} }
    const payload = `${role}.${Math.floor(Date.now() / 1000) + TTL}`;
    const sig = await hmac(env.COOKIE_SECRET, payload + ':' + real);
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `o24=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL}` } });
  }
  if (url.pathname === '/logout') {
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': 'o24=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' } });
  }

  const m = (request.headers.get('cookie') || '').match(/(?:^|; )o24=(admin|v?\d+|w:[0-9a-f]{12})\.(\d+)\.([0-9a-f]+)/);
  if (m) {
    const [, role, exp, sig] = m, real = secretFor(role);
    if (real && Number(exp) > Date.now() / 1000 && await safeEq(env.COOKIE_SECRET, sig, await hmac(env.COOKIE_SECRET, `${role}.${exp}:${real}`))) {
      data.role = role === 'admin' ? 'admin' : role[0] === 'v' || role.startsWith('w:') ? 'viewer' : 'branch';
      data.branch = role === 'admin' || role.startsWith('w:') ? null : role.replace(/^v/, '');
      if (role.startsWith('w:')) data.vname = wmap[role].slice(3);
      const res = await next();
      if (url.pathname === '/' && request.method === 'GET') { // keep the session alive: a new year from every visit
        const exp2 = Math.floor(Date.now() / 1000) + TTL, out = new Response(res.body, res);
        out.headers.append('set-cookie', `o24=${role}.${exp2}.${await hmac(env.COOKIE_SECRET, `${role}.${exp2}:${real}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL}`);
        return out;
      }
      return res;
    }
  }
  return page(false, '', codes);
}
