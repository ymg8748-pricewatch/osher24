import { rpc, json } from '../../_db.js';
import { names } from '../../_branches.js';
import { okCode } from '../../_guard.js';
import { overrides, bust, hashPw } from '../../_pw.js';

// Network manager only. GET: which branches have a custom password. POST {code, password} sets it; POST {code, reset:true} returns the branch to its default.
const guard = data => (data.role === 'admin' ? null : json({ error: 'forbidden' }, 403));

export async function onRequestGet({ env, data }) {
  const g = guard(data); if (g) return g;
  bust(); const ov = await overrides(env);
  return json({ rows: Object.keys(names).sort((a, b) => names[a].localeCompare(names[b], 'he')).map(c => ({ code: c, name: names[c], custom: !!ov[c], at: ov[c]?.t || null })) });
}
export async function onRequestPost({ request, env, data }) {
  const g = guard(data); if (g) return g;
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'bad' }, 400); }
  if (!okCode(b.code)) return json({ error: 'branch' }, 400);
  try {
    if (b.reset) await rpc(env, 'br24_pw_del', { c: b.code });
    else {
      const p = String(b.password || '');
      if (p.length < 4 || p.length > 64) return json({ error: 'length' }, 400);
      await rpc(env, 'br24_pw_set', { c: b.code, hh: await hashPw(env, b.code, p) });
    }
  } catch (e) { console.error('pw save failed', String(e)); return json({ error: 'db' }, 502); }
  bust();
  return json({ ok: true });
}
