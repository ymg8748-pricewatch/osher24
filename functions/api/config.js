import { json } from '../_db.js';
import { branches, regions, names } from '../_branches.js';
// Branch configuration for the page, plus the data-staleness threshold (hours; set STALE_HOURS to change).
export async function onRequestGet({ env }) {
  const geo = {}, reg = {};
  for (const [c, b] of Object.entries(branches)) { geo[c] = [b.lat, b.lon]; reg[c] = b.region; }
  return json({ names, geo, reg, regions, staleHours: Number(env.STALE_HOURS) || 36 });
}
