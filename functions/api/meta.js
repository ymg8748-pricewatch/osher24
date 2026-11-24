import { rpc, json } from '../_db.js';
export async function onRequestGet({ env }) {
  try { return json(await rpc(env, 'br24_meta', {})); } catch (e) { return json({ error: 'db' }, 502); }
}
