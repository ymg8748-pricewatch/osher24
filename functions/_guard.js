import { branches } from './_branches.js';
// Shared helpers for the list screens. `me` is always a real branch code; roles other than admin and a viewer with no branch are locked to their own branch.
export const okCode = c => typeof c === 'string' && Object.prototype.hasOwnProperty.call(branches, c);
export const meOf = (data, u) => (data.role === 'admin' || (data.role === 'viewer' && !data.branch) ? (okCode(u.searchParams.get('me')) ? u.searchParams.get('me') : '022') : data.branch);
export const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, n)) : d; };
export async function cached(key, ttl, fn) {
  const c = caches.default, k = new Request('https://cache.osher24.internal/' + key);
  try { const h = await c.match(k); if (h) return await h.json(); } catch (e) {}
  const v = await fn();
  try { await c.put(k, new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + ttl } })); } catch (e) {}
  return v;
}
