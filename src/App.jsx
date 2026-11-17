import React, { useEffect, useMemo, useState } from 'react';import Papa from 'papaparse';
import { LayoutDashboard, Users, Building2, ClipboardList, Upload, Plus, Search, GraduationCap, Download, Info } from 'lucide-react';

async function api(path, body) {
  const response = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Sign-in expired. Reload this page to sign in again.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Cloud request failed.');
  return result;
}

const services = ['Career Connectors','Classroom Engagement','Career Fairs','Career Treks','Curriculum Integration','Handshake Support','Mock Interviews','Career Coaching Referrals','Career Resources','Department Partnership','Other'];

function downloadCsv(rows, filename) {
  const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [contacts, setContacts] = useState(() => []);
  const [interactions, setInteractions] = useState(() => []);
  const [tab, setTab] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [contact, setContact] = useState({ name:'', email:'', title:'', department:'', college:'' });
  const [entry, setEntry] = useState({ contact_id:'', interaction_date:new Date().toISOString().slice(0,10), service:services[0], description:'', staff_member:'' });
  const [csvText, setCsvText] = useState('name,email,title,department,college\n');
  const [busy, setBusy] = useState(false);

  const [connected, setConnected] = useState(false);
  useEffect(() => { refreshFromCloud(); }, []);
  const engaged = new Set(interactions.map(x => x.contact_id)).size;
  const departments = new Set(contacts.map(x => x.department).filter(Boolean)).size;
  const filtered = useMemo(() => contacts.filter(c => [c.name,c.email,c.department,c.college].join(' ').toLowerCase().includes(search.toLowerCase())), [contacts, search]);

  async function refreshFromCloud() {
    setBusy(true);
    try {
      const data = await api('data');
      setContacts(data.contacts); setInteractions(data.interactions); setConnected(true);
      setNotice('Loaded records from Cloudflare D1.');
    } catch (error) { setConnected(false); setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function addContact(e) {
    e.preventDefault(); setBusy(true);
    try {
      const row = await api('contacts', contact);
      setContacts(previous => [...previous, row]);
      setContact({name:'',email:'',title:'',department:'',college:''});
      setNotice('Contact saved to Cloudflare.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function addInteraction(e) {
    e.preventDefault(); setBusy(true);
    try {
      const row = await api('interactions', entry);
      setInteractions(previous => [row, ...previous]);
      setEntry({...entry, description:''}); setNotice('Interaction saved to Cloudflare.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function importCsv() {
    setBusy(true);
    try {
      const parsed = Papa.parse(csvText.trim(), {header:true, skipEmptyLines:'greedy', transformHeader: h => h.trim().toLowerCase()});
      if (parsed.errors.length) throw new Error('CSV error: ' + parsed.errors[0].message);
      if (!['name','email','department'].every(h => parsed.meta.fields?.includes(h))) throw new Error('CSV needs name, email, and department columns.');
      const result = await api('import', {contacts:parsed.data});
      await refreshFromCloud();
      setNotice(`${result.imported} contact(s) saved to Cloudflare; ${result.skipped} duplicate email(s) skipped.`);
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  const nav = [
    ['Dashboard',LayoutDashboard],['Contacts',Users],['Departments',Building2],['Log Interaction',Plus],['Interactions',ClipboardList],['Import / Export',Upload]
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><GraduationCap size={27}/><div><strong>Hawkeye Engagement</strong><small>Pomerantz Career Center</small></div></div>
      <nav>{nav.map(([name,Icon]) => <button key={name} className={tab===name?'active':''} onClick={()=>{setTab(name);setNotice('')}}><Icon size={18}/>{name}</button>)}</nav>
      <div className="sidebar-foot">Faculty &amp; Staff Relationship Management</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">POMERANTZ CAREER CENTER</span><h1>{tab}</h1></div><div className="top-actions"><span className={connected?'cloud-on':'cloud-off'}>{connected?'Cloudflare connected':'Cloudflare disconnected'}</span><button className="secondary" onClick={refreshFromCloud} disabled={busy}>{busy?'Loading…':'Refresh data'}</button></div></header>
      {notice && <div className="notice"><Info size={17}/>{notice}<button onClick={()=>setNotice('')}>×</button></div>}
      {tab==='Dashboard' && <>
        <p className="intro">A central view of faculty and staff relationships and Career Center services.</p>
        <section className="stats">
          <Stat label="Total contacts" value={contacts.length}/><Stat label="Total interactions" value={interactions.length}/><Stat label="People engaged" value={engaged}/><Stat label="Departments represented" value={departments}/>
        </section>
        <section className="panel"><div className="panel-head"><h2>Recent interactions</h2><button onClick={()=>setTab('Log Interaction')}><Plus size={16}/> Log interaction</button></div>
          {interactions.slice().sort((a,b)=>b.interaction_date.localeCompare(a.interaction_date)).slice(0,6).map(i=><InteractionRow key={i.id} item={i} contacts={contacts}/>)}
          {!interactions.length && <Empty/>}
        </section>
        <section className="panel"><h2>Engagement by service</h2><div className="service-list">{services.map(s=>{const n=interactions.filter(i=>i.service===s).length;return <div className="service-row" key={s}><span>{s}</span><div className="bar"><i style={{width:`${interactions.length?Math.max(2,n/interactions.length*100):0}%`}}/></div><b>{n}</b></div>})}</div></section>
      </>}
      {tab==='Contacts' && <div className="two-col"><section className="panel"><div className="panel-head"><h2>Contact directory</h2><span className="count">{contacts.length} contacts</span></div><div className="search"><Search size={17}/><input placeholder="Search name, email, department…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{filtered.map(c=><button className="contact-row" key={c.id} onClick={()=>{setSelected(c);setTab('Contact profile')}}><span className="avatar">{c.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><span className="contact-info"><b>{c.name}</b><small>{c.title} · {c.department}</small><small>{c.email}</small></span><span>›</span></button>)}{!filtered.length&&<Empty/>}</section>
        <section className="panel"><h2>Add a contact</h2><form onSubmit={addContact}><Field label="Full name" value={contact.name} onChange={v=>setContact({...contact,name:v})} required/><Field label="University email" type="email" value={contact.email} onChange={v=>setContact({...contact,email:v})} required/><Field label="Job title" value={contact.title} onChange={v=>setContact({...contact,title:v})}/><Field label="Department" value={contact.department} onChange={v=>setContact({...contact,department:v})} required/><Field label="College" value={contact.college} onChange={v=>setContact({...contact,college:v})}/><button disabled={busy || !connected} className="primary"><Plus size={16}/> Add contact</button></form></section></div>}
      {tab==='Contact profile' && selected && <section className="panel profile"><button className="text-button" onClick={()=>setTab('Contacts')}>← Back to contacts</button><div className="profile-head"><span className="avatar large">{selected.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><h2>{selected.name}</h2><p>{selected.title}</p><p>{selected.email}</p></div></div><div className="profile-meta"><div><small>Department</small><b>{selected.department}</b></div><div><small>College</small><b>{selected.college || 'Not provided'}</b></div></div><div className="panel-head"><h2>Interaction history</h2><button onClick={()=>{setEntry({...entry,contact_id:selected.id});setTab('Log Interaction')}}><Plus size={16}/> Add interaction</button></div>{interactions.filter(i=>i.contact_id===selected.id).map(i=><InteractionRow key={i.id} item={i} contacts={contacts}/>)}</section>}
      {tab==='Departments' && <section className="panel"><h2>Department directory &amp; engagement</h2><p className="muted">Department metrics count distinct contacts and logged interactions.</p><div className="table-wrap"><table><thead><tr><th>Department</th><th>College</th><th>Contacts</th><th>Interactions</th></tr></thead><tbody>{[...new Set(contacts.map(c=>c.department))].sort().map(d=>{const members=contacts.filter(c=>c.department===d);const ids=members.map(c=>c.id);return <tr key={d}><td><b>{d}</b></td><td>{members[0]?.college||'—'}</td><td>{members.length}</td><td>{interactions.filter(i=>ids.includes(i.contact_id)).length}</td></tr>})}</tbody></table></div></section>}
      {tab==='Log Interaction' && <section className="panel form-panel"><h2>Record an interaction</h2><p className="muted">Log a meeting, referral, presentation, event, or other service.</p><form onSubmit={addInteraction}><label>Faculty / staff contact<select value={entry.contact_id} onChange={e=>setEntry({...entry,contact_id:e.target.value})} required><option value="">Choose a contact</option>{contacts.map(c=><option value={c.id} key={c.id}>{c.name} — {c.department}</option>)}</select></label><label>Service category<select value={entry.service} onChange={e=>setEntry({...entry,service:e.target.value})}>{services.map(s=><option key={s}>{s}</option>)}</select></label><Field label="Interaction date" type="date" value={entry.interaction_date} onChange={v=>setEntry({...entry,interaction_date:v})} required/><label>Description / notes<textarea rows="4" value={entry.description} onChange={e=>setEntry({...entry,description:e.target.value})} placeholder="What was discussed? What service was provided?" required/></label><Field label="Career Center staff member" value={entry.staff_member} onChange={v=>setEntry({...entry,staff_member:v})}/><button disabled={busy || !connected} className="primary"><Plus size={16}/> Save interaction</button></form></section>}
      {tab==='Interactions' && <section className="panel"><h2>All interactions</h2>{interactions.slice().sort((a,b)=>b.interaction_date.localeCompare(a.interaction_date)).map(i=><InteractionRow key={i.id} item={i} contacts={contacts}/>)}{!interactions.length&&<Empty/>}</section>}
      {tab==='Import / Export' && <div className="two-col"><section className="panel"><h2>Import contacts (CSV)</h2><p className="muted">Required columns: name, email, department. Optional: title, college. Quoted commas are supported. Paste CSV text; .xlsx files must first be saved as CSV. Maximum 100 contacts per import.</p><textarea rows="9" value={csvText} onChange={e=>setCsvText(e.target.value)}/><button disabled={busy || !connected} className="primary" onClick={importCsv}><Upload size={16}/> Import pasted CSV</button></section><section className="panel"><h2>Export data</h2><p className="muted">Download the currently loaded shared records as CSV files. Refresh data first to include recent changes by others.</p><button className="secondary full" onClick={()=>downloadCsv([['name','email','title','department','college'],...contacts.map(c=>[c.name,c.email,c.title,c.department,c.college])],'hawkeye-contacts.csv')}><Download size={16}/> Export contacts</button><button className="secondary full" onClick={()=>downloadCsv([['contact_email','date','service','description','staff_member'],...interactions.map(i=>[contacts.find(c=>c.id===i.contact_id)?.email,i.interaction_date,i.service,i.description,i.staff_member])],'hawkeye-interactions.csv')}><Download size={16}/> Export interactions</button></section></div>}
      <footer>Hawkeye Engagement · Cloudflare D1 · Shared staff workspace</footer>
    </main>
  </div>;
}
function Stat({label,value}) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div> }
function Field({label,value,onChange,type='text',required=false}) { return <label>{label}<input type={type} value={value} onChange={e=>onChange(e.target.value)} required={required}/></label> }
function InteractionRow({item,contacts}) { const c=contacts.find(x=>x.id===item.contact_id); return <div className="interaction-row"><div className="date-chip">{item.interaction_date}</div><div className="interaction-copy"><b>{item.service}</b><span>{c?.name || 'Unknown contact'} · {c?.department || ''}</span><small>{item.description}</small></div></div> }
function Empty() { return <div className="empty">No records yet. Add a contact or log an interaction to get started.</div> }
