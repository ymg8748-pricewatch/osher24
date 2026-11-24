import { rpc, json } from '../_db.js';
import { meOf, num, cached } from '../_guard.js';
// Compact catalog (code, name, my price, cheapest, cheapest branch, branches cheaper) for the department screens.
export async function onRequestGet({ request, env, data }) {
  const u = new URL(request.url), me = meOf(data, u), mode = u.searchParams.get('mode') === 'reg' ? 0 : 1, page = Math.floor(num(u.searchParams.get('page'), 0, 0, 100));
  try { return json({ me, mode, ...(await cached(`list:${me}:${mode}:${page}`, 300, () => rpc(env, 'br24_list', { me, mode, page }))) }); }
  catch (e) { console.error('list failed', String(e)); return json({ error: 'db' }, 502); }
}
