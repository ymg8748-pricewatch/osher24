import { rpc, json } from '../../_db.js';
import { names } from '../../_branches.js';
import { readStats, resetStats } from '../../_stats.js';

// Admin only (network manager). GET: health + usage statistics. POST ?reset=1: zero the statistics.
const guard = data => (data.role === 'admin' ? null : json({ error: 'forbidden' }, 403));

export async function onRequestGet({ env, data }) {
  const g = guard(data); if (g) return g;
  let meta = null, dbOk = true;
  try { meta = await rpc(env, 'br24_meta', {}); } catch (e) { dbOk = false; console.error('admin meta failed', String(e)); }
  const stats = await readStats(env);
  return json({ dbOk, meta, kv: !!env.KV, stats, names, staleHours: Number(env.STALE_HOURS) || 36 });
}
export async function onRequestPost({ request, env, data }) {
  const g = guard(data); if (g) return g;
  if (new URL(request.url).searchParams.get('reset') === '1') await resetStats(env);
  return json({ ok: true });
}
