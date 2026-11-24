// Optional usage statistics. Needs a Cloudflare KV namespace bound as "KV"; without it every function here does nothing.
// Stores only aggregate counters (search text and counts), never who searched. Counts are approximate (no locking).
const KEY = 'stats';
const fresh = () => ({ since: Date.now(), total: 0, noResult: 0, top: {}, miss: {}, byBranch: {}, errors: 0 });
function prune(o, keep = 150, max = 300) {
  const k = Object.keys(o);
  if (k.length <= max) return;
  k.sort((a, b) => o[b] - o[a]).slice(keep).forEach(x => delete o[x]);
}
export async function record(env, { q, found, role, branch, error }) {
  if (!env.KV) return;
  try {
    const s = (await env.KV.get(KEY, 'json')) || fresh();
    if (error) s.errors++;
    else {
      s.total++;
      const t = q.toLowerCase();
      s.top[t] = (s.top[t] || 0) + 1;
      if (!found) { s.noResult++; s.miss[t] = (s.miss[t] || 0) + 1; }
      const who = role === 'branch' ? branch : 'admin';
      s.byBranch[who] = (s.byBranch[who] || 0) + 1;
      prune(s.top); prune(s.miss);
    }
    await env.KV.put(KEY, JSON.stringify(s));
  } catch (e) { console.error('stats failed', String(e)); }
}
export async function readStats(env) {
  if (!env.KV) return null;
  return (await env.KV.get(KEY, 'json')) || fresh();
}
export async function resetStats(env) { if (env.KV) await env.KV.put(KEY, JSON.stringify(fresh())); }
