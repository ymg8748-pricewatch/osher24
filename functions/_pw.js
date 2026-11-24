// Branch passwords changed from the admin screen live in table br24_pw (hash only, never the password itself).
// Branches without a row keep the password from the BRANCH_PASSWORDS secret.
import { rpc } from './_db.js';
let cache = null, at = 0;
export async function overrides(env) {
  if (cache && Date.now() - at < 60000) return cache;
  try {
    const r = await rpc(env, 'br24_pw_all', {});
    cache = r && typeof r === 'object' ? r : {}; at = Date.now();
  } catch (e) { console.error('pw overrides failed', String(e)); at = Date.now() - 50000; cache = cache || {}; } // retry in 10s, keep last known
  return cache;
}
export const bust = () => { cache = null; at = 0; };
export async function hashPw(env, code, pw) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.COOKIE_SECRET}:pw:${code}:${pw}`));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
