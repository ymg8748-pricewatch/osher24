import { json } from '../_db.js';
import { names } from '../_branches.js';
// Who is logged in: {role:'branch', branch, name} or {role:'admin'}. Set by the middleware.
export async function onRequestGet({ data }) {
  if (data.role === 'branch' || data.role === 'viewer') return json({ role: data.role, branch: data.branch, name: names[data.branch] || data.branch });
  return json({ role: 'admin' });
}
