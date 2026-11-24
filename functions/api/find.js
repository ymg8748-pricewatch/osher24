import { rpc, json } from '../_db.js';
import names from '../_names.json';
export async function onRequestGet({ request, env }) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ items: [], names });
  try {
    const items = await rpc(env, 'br24_find', { q, lim: 30 });
    return json({ items, names });
  } catch (e) { return json({ error: 'db' }, 502); }
}
