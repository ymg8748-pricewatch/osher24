import { rpc, json } from '../_db.js';
import { meOf, cached } from '../_guard.js';
// Branch war: my branch against each other branch, over the products they share.
export async function onRequestGet({ request, env, data }) {
  const u = new URL(request.url), me = meOf(data, u), mode = u.searchParams.get('mode') === 'reg' ? 0 : 1;
  try { return json({ me, mode, ...(await cached(`war:${me}:${mode}`, 300, () => rpc(env, 'br24_war', { me, mode }))) }); }
  catch (e) { console.error('war failed', String(e)); return json({ error: 'db' }, 502); }
}
