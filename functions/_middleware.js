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
const PUBLIC = new Set(['/manifest.webmanifest', '/sw.js', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/logo.png', '/notice.js', '/privacy', '/terms', '/accessibility', '/privacy.html', '/terms.html', '/accessibility.html']);
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

function page(err, chosen, codes, vname, mode) {
  mode = mode === 'viewer' ? 'viewer' : 'admin';
  const opts = codes.map(c => `<option value="${esc(c)}"${c === chosen ? ' selected' : ''}>${esc(names[c])}</option>`).join('');
  const isV = mode === 'viewer';
  const fields = `<div class="seg" role="radiogroup"><label><input type="radio" name="rk" value="admin"${isV ? '' : ' checked'}><span>כניסה כמנהל רשת</span></label><label><input type="radio" name="rk" value="branch"${isV ? ' checked' : ''}><span>כניסה כסניף</span></label></div>
<div id="brbox" style="display:${isV ? '' : 'none'}"><label class="pill"><small>בחרו סניף</small><select name="branch" id="brsel"><option value="" disabled${chosen ? '' : ' selected'}>בחרו סניף מהרשימה</option>${opts}<option value="w"${chosen === 'w' ? ' selected' : ''}>צופה ללא סניף · כל האתר</option></select></label>
<div id="vnrow" class="pill" style="display:none"><small>שם הצופה</small><input type="text" name="vname" value="${esc(vname || '')}" maxlength="24" autocomplete="username"></div></div>`;
  const title = 'כניסה';
  const sub = 'בחרו איך נכנסים';
  const other = '';
  const errTxt = err ? '<p class="er">' + (err === 'consent' ? 'יש לאשר את השימוש באתר כדי להיכנס' : (isV ? 'סניף או סיסמה שגויים' : 'סיסמה שגויה')) + '</p>' : '';
  return new Response(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · אושר24</title>
<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{background:radial-gradient(circle at 50% 18%,#27306b,#0a0d20 64%);color:#fff;font-family:system-ui,Arial,sans-serif;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden}
.hero{position:relative;height:300px;flex:none;perspective:1000px;display:flex;flex-direction:column;align-items:center}
.stack{position:absolute;left:50%;top:44px;width:170px;height:170px;margin-left:-85px;transform-style:preserve-3d;transform:rotateX(58deg) rotateZ(-32deg)}
.layer{position:absolute;inset:0;border-radius:32px;border:1px solid #ffffff44}.l1{background:linear-gradient(135deg,#6d4dff88,#3b82f655);box-shadow:0 0 60px #6d4dff66}.l2{background:linear-gradient(135deg,#00d4ff77,#2f6bff44);transform:translateZ(36px)}.l3{background:linear-gradient(135deg,#c6ff4d99,#7ee08a55);transform:translateZ(72px)}
.lg{position:absolute;left:50%;top:64px;margin-left:-62px;width:124px;background:#fff;border-radius:22px;padding:7px;box-shadow:0 30px 50px #000a,0 0 0 6px #ffffff18}.lg img{width:100%;height:auto;display:block}
.ttl{position:absolute;top:226px;left:0;right:0;text-align:center;font-size:24px;font-weight:800}.sb{position:absolute;top:262px;left:0;right:0;text-align:center;font-size:13px;color:#9aa3d6}
.sheet{flex:1;background:#fff;border-radius:34px 34px 0 0;padding:26px 22px 18px;color:#141a3a;box-shadow:0 -20px 60px #6d4dff55;position:relative}
.sheet:before{content:"";position:absolute;top:8px;left:50%;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:#d7dbf0}
form{max-width:420px;margin:0 auto}.pill{display:block;background:#f1f3fc;border-radius:16px;padding:10px 14px;margin-bottom:12px}.pill small{display:block;font-size:11px;color:#7a82b0}
.pill select,.pill input,.pw input{width:100%;border:0;background:none;font:700 16px inherit;color:#141a3a;outline:0;padding:4px 0}.pw{display:block;background:#f1f3fc;border-radius:16px;padding:6px 14px;margin-bottom:12px}.pw input{padding:12px 0;font-weight:400}
.tg{display:flex;align-items:center;gap:12px;margin:14px 0;font-size:13px;line-height:1.55;color:#3a4270;cursor:pointer}.tg input{appearance:none;-webkit-appearance:none;width:50px;height:30px;border-radius:15px;background:#d3d8ee;position:relative;flex:none;margin:0;cursor:pointer;transition:background .15s}.tg input:after{content:"";position:absolute;top:3px;right:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px #0003;transition:transform .15s}.tg input:checked{background:#4a3df0}.tg input:checked:after{transform:translateX(-20px)}.tg a{color:#4a3df0}
.go{width:100%;border:0;border-radius:20px;padding:17px;font:800 18px inherit;color:#fff;background:linear-gradient(135deg,#6a4dff,#2f6bff);box-shadow:0 8px 0 #2a3fb0,0 18px 30px #4a3df055;cursor:pointer;margin-bottom:8px}.go:disabled{opacity:.4;cursor:not-allowed}
.seg{display:flex;gap:8px;margin-bottom:14px}.seg label{flex:1}.seg input{position:absolute;opacity:0;pointer-events:none}.seg span{display:block;text-align:center;padding:14px 6px;border-radius:16px;background:#f1f3fc;color:#7a82b0;font-weight:800;font-size:15px;cursor:pointer}.seg input:checked+span{background:#141a3a;color:#fff;box-shadow:0 6px 14px #141a3a44}.er{color:#c0310a;font-weight:700;margin:10px 0 0;text-align:center}.ft{text-align:center;font-size:13px;margin-top:18px;display:flex;justify-content:center;gap:18px}.ft a{color:#6a73a8}</style>
<body><div class="hero"><div class="stack"><i class="layer l1"></i><i class="layer l2"></i><i class="layer l3"></i></div><div class="lg"><img src="/logo.png" alt="השוואת מחירים"></div><div class="ttl">${title}</div><div class="sb">${sub}</div></div>
<div class="sheet"><form method="post" action="/login">
${fields}
<label class="pw"><input type="password" name="password" placeholder="סיסמה" autocomplete="current-password" required></label>
<label class="tg"><input type="checkbox" id="consent" name="consent" value="yes" required><span>אישור שימוש באתר: קראתי ואני מסכים ל<a href="/terms" target="_blank" rel="noopener">תנאי השימוש</a> ול<a href="/privacy" target="_blank" rel="noopener">מדיניות הפרטיות</a></span></label>
<button class="go" id="go" disabled>כניסה</button>${errTxt}
<div class="ft">${other}<a href="/accessibility" target="_blank" rel="noopener">נגישות</a></div></form></div>
<script>(function(){var b=document.getElementById('brsel'),v=document.getElementById('vnrow'),bx=document.getElementById('brbox'),rs=document.querySelectorAll('input[name=rk]');function cur(){return document.querySelector('input[name=rk]:checked').value}function t(){var br=cur()==='branch';bx.style.display=br?'':'none';b.required=br;v.style.display=(br&&b.value==='w')?'':'none'}b.addEventListener('change',t);for(var i=0;i<rs.length;i++)rs[i].addEventListener('change',t);t();var c=document.getElementById('consent'),g=document.getElementById('go');function u(){g.disabled=!c.checked}c.addEventListener('change',u);u();document.querySelector('form').addEventListener('submit',function(e){if(!c.checked){e.preventDefault();c.focus()}})})()</script>
<script src="/notice.js" defer></script></body></html>`, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

const tooMany = () => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body dir="rtl" style="font-family:system-ui;padding:20vh 20px;text-align:center"><h2>יותר מדי ניסיונות</h2><p>נסה שוב בעוד 15 דקות.</p></body>', { status: 429, headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': String(WINDOW), 'cache-control': 'no-store' } });

const SEC = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  // Report-Only first: check the browser console for violations, then rename the header to enforce.
  'content-security-policy-report-only': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};
export async function onRequest(ctx) {
  const res = await handle(ctx), out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SEC)) out.headers.set(k, v);
  return out;
}

async function handle(ctx) {
  const { request, env, next, data, waitUntil } = ctx;
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
  if (PUBLIC.has(url.pathname) || url.pathname === '/vendor/heebo.css' || url.pathname.startsWith('/vendor/fonts/')) return next();

  if (url.pathname === '/login' && request.method === 'POST') {
    let mode = 'admin';
    const ip = request.headers.get('cf-connecting-ip') || 'unknown', rlKey = 'rl:' + ip;
    let fails = 0;
    if (env.KV) {
      try { fails = parseInt(await env.KV.get(rlKey), 10) || 0; } catch (e) { console.error('rl read failed', String(e)); }
      if (fails >= MAX_FAILS) return tooMany();
    }
    const f = await request.formData();
    if (f.get('rk') === 'branch') mode = 'viewer'; else if (f.get('rk') === 'admin') mode = 'admin';
    if (String(f.get('consent') || '') !== 'yes') return page('consent', String(f.get('branch') || ''), codes, String(f.get('vname') || '').trim().slice(0, 24), mode);
    let role = mode === 'admin' ? 'admin' : String(f.get('branch') || ''); if (role === 'admin' && mode === 'viewer') role = ''; const given = String(f.get('password') || '');
    const chosen = role;
    let pwCode = role;
    if (role === 'w') { pwCode = 'vw:' + String(f.get('vname') || '').trim().slice(0, 24); role = 'w:' + await sha12(pwCode); }
    else if (mode === 'viewer' && codes.includes(role)) role = 'v' + role;
    const known = role === 'admin' || codes.includes(role) || (/^v\d+$/.test(role) && codes.includes(role.slice(1))) || (role.startsWith('w:') && !!wmap[role]);
    const real = known ? secretFor(role) : '';
    // always run one comparison so a wrong branch and a wrong password take the same time
    const givenId = role.startsWith('w:') ? 'h:' + await hashPw(env, pwCode, given) : ovOf(role) ? 'h:' + await hashPw(env, role, given) : given;
    const ok = (await safeEq(env.COOKIE_SECRET, givenId, real || '\u0000no-such-password')) && !!real;
    if (!ok) {
      console.warn('login failed', JSON.stringify({ role: role.slice(0, 8), ip }));
      if (env.KV) { try { await env.KV.put(rlKey, String(fails + 1), { expirationTtl: WINDOW }); } catch (e) { console.error('rl write failed', String(e)); } }
      if (fails + 1 === MAX_FAILS && env.ALERT_WEBHOOK && waitUntil) { // suspicious activity: one alert when an IP gets locked out
        const text = 'אושר24: ' + MAX_FAILS + ' ניסיונות כניסה כושלים מכתובת ' + ip + ' (נעילה ל-15 דקות)';
        waitUntil(fetch(env.ALERT_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }) }).catch(() => {}));
      }
      await new Promise(r => setTimeout(r, 700));
      return page(true, chosen || role, codes, chosen === 'w' ? String(f.get('vname') || '').trim().slice(0, 24) : '', mode);
    }
    if (env.KV && fails) { try { await env.KV.delete(rlKey); } catch (e) {} }
    if (role === 'admin') console.warn('admin login', JSON.stringify({ ip }));
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
      if (/^\/admin(\.html)?\/?$/.test(url.pathname) && data.role !== 'admin') return new Response(null, { status: 303, headers: { location: '/' } });
      const res = await next();
      if (url.pathname === '/' && request.method === 'GET') { // keep the session alive: a new year from every visit
        const exp2 = Math.floor(Date.now() / 1000) + TTL, out = new Response(res.body, res);
        out.headers.append('set-cookie', `o24=${role}.${exp2}.${await hmac(env.COOKIE_SECRET, `${role}.${exp2}:${real}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL}`);
        return out;
      }
      return res;
    }
  }
  return page(false, '', codes, '', 'admin');
}
