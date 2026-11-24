import { rpc, json } from '../_db.js';
import { meOf, okCode, num, cached } from '../_guard.js';
// "Where am I expensive": products where my branch is more expensive than the cheapest other branch (or than `vs`).
export async function onRequestGet({ request, env, data }) {
  const u = new URL(request.url), sp = u.searchParams, me = meOf(data, u), mode = sp.get('mode') === 'reg' ? 0 : 1;
  const vs = okCode(sp.get('vs')) && sp.get('vs') !== me ? sp.get('vs') : '';
  const minc = num(sp.get('minc'), 1, 0.01, 1000), minp = num(sp.get('minp'), 0, 0, 1000), page = Math.floor(num(sp.get('page'), 0, 0, 1000));
  const sort = sp.get('sort') === 'n' ? 'n' : 'gap', q = (sp.get('q') || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60);
  try {
    const body = { me, vs, minc, minp, mode, page, sort, q };
    return json({ me, vs, mode, ...(await cached('exp:' + JSON.stringify(body), 120, () => rpc(env, 'br24_exp', body))) });
  } catch (e) { console.error('exp failed', String(e)); return json({ error: 'db' }, 502); }
}
