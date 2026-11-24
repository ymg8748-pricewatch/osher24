import { rpc, json } from '../_db.js';

// For uptime monitors (UptimeRobot, Better Stack, ...): GET /api/health?key=<HEALTH_KEY>
// 200 = prices are fresh, 503 = data older than STALE_HOURS or the database is unreachable.
// Optional ALERT_WEBHOOK (Slack / Discord / Teams / Make / Zapier URL): a message is posted when stale
// (at most once every 6 hours, needs the KV binding).
const safeEq = async (a, b) => {
  const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]; return d === 0;
};

export async function onRequestGet({ request, env, waitUntil }) {
  if (!env.HEALTH_KEY) return json({ error: 'not configured' }, 404);
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!(await safeEq(key, env.HEALTH_KEY))) return json({ error: 'forbidden' }, 403);
  const limit = Number(env.STALE_HOURS) || 36;
  let ok = false, hours = null, updated = null, why = '';
  try {
    const m = await rpc(env, 'br24_meta', {});
    updated = m && m.updated_at; hours = updated ? (Date.now() - new Date(updated)) / 36e5 : null;
    ok = hours !== null && hours <= limit; if (!ok) why = hours === null ? 'no update time' : 'stale';
  } catch (e) { why = 'db'; console.error('health failed', String(e)); }
  if (!ok && env.ALERT_WEBHOOK && env.KV) {
    const last = Number(await env.KV.get('alert:last')) || 0;
    if (Date.now() - last > 6 * 36e5) {
      const text = why === 'db' ? 'אושר24: מסד הנתונים לא זמין' : 'אושר24: המחירים לא התעדכנו כבר ' + (hours ? Math.round(hours) + ' שעות' : 'זמן רב');
      waitUntil(Promise.all([
        env.KV.put('alert:last', String(Date.now())),
        fetch(env.ALERT_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }) }).catch(() => {}),
      ]));
    }
  }
  return json({ ok, why, hours: hours === null ? null : Math.round(hours * 10) / 10, updated_at: updated, limit }, ok ? 200 : 503);
}
