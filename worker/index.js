import {createRemoteJWKSet, jwtVerify} from 'jose';
const keys = new Map();
const json = (value, status=200) => Response.json(value, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function contactInput(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid contact.');
  const row = {};
  for (const field of ['name','email','title','department','college']) {
    if (input[field] != null && typeof input[field] !== 'string') throw new Error(`Invalid ${field}.`);
    row[field] = (input[field] || '').trim();
    if (row[field].length > 500) throw new Error(`${field} is too long.`);
  }
  if (!row.name || !row.department || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error('Name, valid email, and department are required.');
  row.email = row.email.toLowerCase(); return row;
}
export function interactionInput(input) {
  const row = {};
  for (const field of ['contact_id','interaction_date','service','description','staff_member']) {
    if (typeof input?.[field] !== 'string') throw new Error(`Invalid ${field}.`);
    row[field] = input[field].trim();
    if (row[field].length > (field === 'description' ? 10000 : 500)) throw new Error(`${field} is too long.`);
  }
  if (!row.contact_id || !row.service || !row.description) throw new Error('Contact, service, and description are required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.interaction_date) || !Number.isFinite(Date.parse(row.interaction_date)) || new Date(row.interaction_date).toISOString().slice(0,10) !== row.interaction_date) throw new Error('Invalid interaction date.');
  return row;
}
async function authorized(request, env) {
  const host = new URL(request.url).hostname;
  if (env.LOCAL_DEV === 'true' && ['localhost','127.0.0.1','[::1]'].includes(host)) return true;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || env.ACCESS_TEAM_DOMAIN.includes('YOUR-TEAM') || env.ACCESS_AUD.includes('REPLACE_')) return false;
  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'');
  if (!keys.has(issuer)) keys.set(issuer, createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs')));
  try {
    await jwtVerify(request.headers.get('Cf-Access-Jwt-Assertion') || '', keys.get(issuer), {issuer, audience:env.ACCESS_AUD, algorithms:['RS256']});
    return true;
  } catch {return false;}
}
const insertContact = (db, row, ignore=false) => db.prepare(`INSERT ${ignore?'OR IGNORE ':''}INTO contacts (id,name,email,title,department,college) VALUES (?,?,?,?,?,?)`).bind(row.id,row.name,row.email,row.title,row.department,row.college);
export default {
  async fetch(request, env) {
    if (!await authorized(request, env)) return json({error:'Sign-in required. Configure Cloudflare Access and reload this page.'},401);
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'POST') {
      if (request.headers.get('Origin') !== url.origin) return json({error:'Request origin rejected.'},403);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'JSON required.'},415);
    }
    try {
      if (url.pathname === '/api/data' && request.method === 'GET') {
        const [contacts, interactions] = await env.DB.batch([env.DB.prepare('SELECT * FROM contacts ORDER BY name'),env.DB.prepare('SELECT * FROM interactions ORDER BY interaction_date DESC, created_at DESC')]);
        return json({contacts:contacts.results, interactions:interactions.results});
      }
      if (request.method !== 'POST') return json({error:'Route not found.'},404);
      if (Number(request.headers.get('Content-Length')) > 1048576) return json({error:'Request too large.'},413);
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 1048576) return json({error:'Request too large.'},413);
      let input; try {input = JSON.parse(text);} catch {return json({error:'Invalid JSON.'},400);}
      if (url.pathname === '/api/contacts') {
        let row; try {row = {...contactInput(input),id:crypto.randomUUID()};} catch(e) {return json({error:e.message},400);}
        try {await insertContact(env.DB,row).run();} catch(e) {if (String(e).includes('UNIQUE')) return json({error:'A contact with that email already exists.'},409); throw e;}
        return json(row,201);
      }
      if (url.pathname === '/api/interactions') {
        let row; try {row = {...interactionInput(input),id:crypto.randomUUID()};} catch(e) {return json({error:e.message},400);}
        if (!await env.DB.prepare('SELECT id FROM contacts WHERE id=?').bind(row.contact_id).first()) return json({error:'Contact no longer exists. Refresh data.'},400);
        await env.DB.prepare('INSERT INTO interactions (id,contact_id,interaction_date,service,description,staff_member) VALUES (?,?,?,?,?,?)').bind(row.id,row.contact_id,row.interaction_date,row.service,row.description,row.staff_member).run();
        return json(row,201);
      }
      if (url.pathname === '/api/import') {
        if (!Array.isArray(input?.contacts) || !input.contacts.length || input.contacts.length > 100) return json({error:'Import between 1 and 100 contacts at a time.'},400);
        let rows;
        try { rows = input.contacts.map((r,i) => {try {return {...contactInput(r),id:crypto.randomUUID()};} catch(e) {throw new Error(`CSV row ${i+2}: ${e.message}`);}}); } catch(e) {return json({error:e.message},400);}
        const results = await env.DB.batch(rows.map(r => insertContact(env.DB,r,true)));
        const imported = results.reduce((n,r) => n + r.meta.changes,0);
        return json({imported,skipped:rows.length-imported});
      }
      return json({error:'Route not found.'},404);
    } catch(error) { console.error(error); return json({error:'Database request failed. Check the D1 binding and applied migrations.'},500); }
  }
};
