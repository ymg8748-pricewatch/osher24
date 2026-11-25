import { rpc, json } from '../_db.js';
import { names } from '../_branches.js';
import { cached } from '../_guard.js';

// Basket refresh in one request: up to 40 barcodes, answered from the same database search as /api/find (one call per barcode, cached 60 seconds).
// 40 is the limit so one run stays well under the 50 outgoing calls the free plan allows.
const MAX = 40;
export async function onRequestGet({ request, env }) {
  const codes = [...new Set((new URL(request.url).searchParams.get('codes') || '').split(',').map(s => s.trim()).filter(s => /^[0-9A-Za-z_-]{2,20}$/.test(s)))].slice(0, MAX);
  if (!codes.length) return json({ items: [], names });
  try {
    const found = await Promise.all(codes.map(async c => {
      const items = await cached('cart:' + c, 60, () => rpc(env, 'br24_find', { q: c, lim: 5 }));
      return (items || []).find(x => x.code === c) || null;
    }));
    return json({ items: found.filter(Boolean), names });
  } catch (e) { console.error('cart failed', String(e)); return json({ error: 'db' }, 502); }
}
