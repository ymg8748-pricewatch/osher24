import { rpc, json } from '../_db.js';
import { names } from '../_branches.js';
import { record } from '../_stats.js';

const MAX_Q = 60;
const clean = s => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_Q);

export async function onRequestGet({ request, env, data, waitUntil }) {
  const u = new URL(request.url);
  const q = clean(u.searchParams.get('q') || '');
  const lim = Math.min(50, Math.max(1, parseInt(u.searchParams.get('lim'), 10) || 30));
  if (q.length < 2) return json({ items: [], names });

  // 60-second edge cache: the same search by several branches hits the database once
  const cache = caches.default;
  const key = new Request(`https://cache.osher24.internal/find?lim=${lim}&q=${encodeURIComponent(q.toLowerCase())}`);
  try {
    const hit = await cache.match(key);
    if (hit) {
      const items = await hit.json();
      waitUntil(record(env, { q, found: items.length > 0, role: data.role, branch: data.branch }));
      return json({ items, names });
    }
  } catch (e) { console.error('cache read failed', String(e)); }

  try {
    let items = await rpc(env, 'br24_find', { q, lim });
    // several words and nothing found: search by the longest words (up to 3 tries), then keep names containing every word (any order)
    const words = q.split(' ').filter(w => w.length >= 2);
    if (!items.length && words.length > 1) {
      const lc = words.map(w => w.toLowerCase());
      for (const w of [...words].sort((a, b) => b.length - a.length).slice(0, 3)) {
        const wide = await rpc(env, 'br24_find', { q: w, lim: 50 });
        items = wide.filter(it => lc.every(x => String(it.name).toLowerCase().includes(x))).slice(0, lim);
        if (items.length) break;
      }
    }
    waitUntil((async () => {
      try { await cache.put(key, new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } })); }
      catch (e) { console.error('cache write failed', String(e)); }
    })());
    waitUntil(record(env, { q, found: items.length > 0, role: data.role, branch: data.branch }));
    return json({ items, names });
  } catch (e) {
    console.error('find failed', JSON.stringify({ q, err: String(e) }));
    waitUntil(record(env, { error: true }));
    return json({ error: 'db' }, 502);
  }
}
