import { rpc, json } from '../_db.js';
import { okCode, meOf, num, cached } from '../_guard.js';
// Active promotions in one branch (default: mine).
export async function onRequestGet({ request, env, data }) {
  const u = new URL(request.url), br = okCode(u.searchParams.get('br')) ? u.searchParams.get('br') : meOf(data, u), page = Math.floor(num(u.searchParams.get('page'), 0, 0, 1000));
  try { return json({ br, ...(await cached(`promos:${br}:${page}`, 300, () => rpc(env, 'br24_promos', { br, page }))) }); }
  catch (e) { console.error('promos failed', String(e)); return json({ error: 'db' }, 502); }
}
