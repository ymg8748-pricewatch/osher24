import { rpc, json } from '../_db.js';
import { meOf, cached } from '../_guard.js';
// Branch war: my branch against each other branch, over the products they share.
export async function onRequestGet({ request, env, data }) {
  const u = new URL(request.url), me = meOf(data, u), mode = u.searchParams.get('mode') === 'reg' ? 0 : 1;
  try { return json({ me, mode, ...(await cached(`war:${me}:${mode}`, 300, () => rpc(env, 'br24_war', { me, mode }))) }); }
  catch (e) { console.error('war failed', String(e)); return json({ error: 'db' }, 502); }
}

// Same, filtered to a set of product codes (one department, classified on the client by product name).
// Needs the read-only function br24_war_dept in the database (db/br24_war_dept.sql).
export async function onRequestPost({ request, env, data }) {
  const u = new URL(request.url), me = meOf(data, u), mode = u.searchParams.get('mode') === 'reg' ? 0 : 1;
  let codes;
  try { codes = (await request.json()).codes; } catch (e) { return json({ error: 'bad' }, 400); }
  if (!Array.isArray(codes)) return json({ error: 'bad' }, 400);
  codes = [...new Set(codes.map(c => String(c).replace(/[^0-9A-Za-z]/g, '').slice(0, 20)).filter(Boolean))].slice(0, 5000);
  if (!codes.length) return json({ me, mode, rows: [] });
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codes.join(',')));
  const key = [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
  try { return json({ me, mode, ...(await cached(`wardept:${me}:${mode}:${key}`, 300, () => rpc(env, 'br24_war_dept', { me, mode, codes }))) }); }
  catch (e) { console.error('war dept failed', String(e)); return json({ error: 'db' }, 502); }
}
