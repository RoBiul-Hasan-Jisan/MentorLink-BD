'use client';
import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { User } from 'firebase/auth';
import { api } from '../lib/api';
import type { Me, Row } from '../lib/types';

export default function Home() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u); setMe(null); setError('');
    if (u) {
      try { setMe((await api('/me')).user); } catch (e: any) { setError(e.message); }
    }
  }), []);

  if (user === undefined) return <div className="wrap">Loading…</div>;
  if (!user) return <Login />;
  if (error) return <div className="wrap"><div className="err">{error}</div><button className="btn" onClick={() => signOut(auth)}>Sign out</button></div>;
  if (!me) return <div className="wrap">Loading…</div>;
  if (me.role !== 'admin') return <div className="wrap"><div className="err">This panel is for admins only. You are signed in as {me.role}.</div><button className="btn" onClick={() => signOut(auth)}>Sign out</button></div>;
  return <Panel me={me} />;
}

function Login() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  async function go(e: React.FormEvent) { e.preventDefault(); setErr(''); try { await signInWithEmailAndPassword(auth, email, pw); } catch (x: any) { setErr(x.message); } }
  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <h1>MentorLink BD Admin</h1>
      <p className="muted">Sign in with your admin account.</p>
      {err && <div className="err">{err}</div>}
      <form onSubmit={go}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn" style={{ width: '100%' }}>Sign in</button>
      </form>
    </div>
  );
}

const TABS = ['Queue', 'Companies', 'Resources', 'Audit log', 'Fairness', 'Universities'];
function Panel({ me }: { me: Me }) {
  const [tab, setTab] = useState('Queue');
  return (
    <>
      <div className="top"><h1>MentorLink BD Admin</h1><div>{me.displayName} · <a href="#" style={{ color: '#fff' }} onClick={(e) => { e.preventDefault(); signOut(auth); }}>Sign out</a></div></div>
      <div className="wrap">
        <div className="tabs">{TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div>
        {tab === 'Queue' && <Queue />}
        {tab === 'Companies' && <Companies />}
        {tab === 'Resources' && <Resources />}
        {tab === 'Audit log' && <Audit />}
        {tab === 'Fairness' && <Fairness />}
        {tab === 'Universities' && <Universities />}
      </div>
    </>
  );
}

function useLoad(path: string) {
  const [data, setData] = useState<Row | null>(null); const [err, setErr] = useState('');
  const load = useCallback(() => api(path).then(setData).catch((e) => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return { data, err, reload: load };
}

function Queue() {
  const { data, err, reload } = useLoad('/admin/verification-queue');
  const [msg, setMsg] = useState('');
  async function act(path: string, decision: string) { setMsg(''); try { await api(path, { method: 'POST', body: { decision } }); reload(); } catch (e: any) { setMsg(e.message); } }
  if (err) return <div className="err">{err}</div>;
  if (!data) return <p>Loading…</p>;
  const empty = !data.users.length && !data.mentorApplications.length && !data.opportunities.length;
  const Buttons = ({ path, yes, no }: { path: string; yes: string; no: string }) => <div><button className="btn" onClick={() => act(path, yes)}>Approve</button> <button className="btn alt" onClick={() => act(path, no)}>Reject</button></div>;
  return (
    <>
      {msg && <div className="err">{msg}</div>}
      {empty && <div className="card">Nothing is waiting for review.</div>}
      {data.mentorApplications.map((u: Row) => <div className="card row" key={u._id}><div><h3>{u.displayName} → mentor</h3><span className="muted">{u.mentorApplication.roleTitle} · {u.mentorApplication.industry} · {u.mentorApplication.yearsExperience} yrs</span></div><Buttons path={`/admin/mentor-applications/${u._id}`} yes="approved" no="rejected" /></div>)}
      {data.users.map((u: Row) => <div className="card row" key={u._id}><div><h3>{u.displayName}</h3><span className="pill">{u.role}</span><span className="muted">{u.email}</span></div><Buttons path={`/admin/users/${u._id}/verify`} yes="verified" no="rejected" /></div>)}
      {data.opportunities.map((o: Row) => <div className="card row" key={o._id}><div><h3>{o.title}</h3><div className="muted">{o.organization}</div>{o.suspiciousFlags.map((f: string) => <span key={f} className="pill warn">⚠ {f}</span>)}<p>{o.description}</p></div><Buttons path={`/admin/opportunities/${o._id}/review`} yes="approve" no="reject" /></div>)}
    </>
  );
}

function Audit() {
  const { data, err } = useLoad('/admin/audit-logs');
  if (err) return <div className="err">{err}</div>;
  if (!data) return <p>Loading…</p>;
  return <div className="card"><table><thead><tr><th>When</th><th>Action</th><th>Target</th></tr></thead><tbody>{data.logs.map((l: Row) => <tr key={l._id}><td>{new Date(l.createdAt).toLocaleString()}</td><td>{l.action}</td><td>{l.targetType} {String(l.targetId || '').slice(-6)}</td></tr>)}</tbody></table>{!data.logs.length && <p className="muted">No actions yet.</p>}</div>;
}

function Fairness() {
  const { data, err } = useLoad('/admin/fairness');
  if (err) return <div className="err">{err}</div>;
  if (!data) return <p>Loading…</p>;
  return <div className="card"><h3>Share of recent recommendations</h3><p className="muted">{data.total} recommendations. No mentor should dominate.</p>{data.mentors.map((m: Row) => <div key={m.name} style={{ margin: '10px 0' }}><div className="row"><b>{m.name}</b><span>{m.share}%</span></div><div className="bar"><div style={{ width: `${m.share}%` }} /></div></div>)}</div>;
}

function Universities() {
  const { data, err, reload } = useLoad('/universities');
  const [f, setF] = useState({ name: '', shortName: '', city: '', lat: '', lng: '' });
  const [msg, setMsg] = useState('');
  async function add(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try { await api('/admin/universities', { method: 'POST', body: { name: f.name, shortName: f.shortName, city: f.city, lat: Number(f.lat), lng: Number(f.lng) } }); setF({ name: '', shortName: '', city: '', lat: '', lng: '' }); reload(); }
    catch (x: any) { setMsg(x.message); }
  }
  if (err) return <div className="err">{err}</div>;
  if (!data) return <p>Loading…</p>;
  return (
    <>
      <div className="card"><table><thead><tr><th>University</th><th>City</th><th>Campus pin</th></tr></thead><tbody>{data.universities.map((u: Row) => <tr key={u.id}><td>{u.name}</td><td>{u.city}</td><td>{u.campus.lat.toFixed(4)}, {u.campus.lng.toFixed(4)}</td></tr>)}</tbody></table></div>
      <div className="card"><h3>Add a university</h3><p className="muted">Use the exact campus pin, not the city centre.</p>{msg && <div className="err">{msg}</div>}
        <form onSubmit={add}>
          <input placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input placeholder="Short name" value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} />
          <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <input placeholder="Latitude (e.g. 22.3726)" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} />
          <input placeholder="Longitude (e.g. 91.8076)" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} />
          <button className="btn">Add</button>
        </form></div>
    </>
  );
}

function Companies() {
  const { data, err, reload } = useLoad('/admin/organizations');
  const [msg, setMsg] = useState('');
  async function act(id: string, decision: string) { setMsg(''); try { await api(`/admin/organizations/${id}/review`, { method: 'POST', body: { decision } }); reload(); } catch (e: any) { setMsg(e.message); } }
  if (err) return <div className="err">{err}</div>;
  if (!data) return <p>Loading…</p>;
  return (
    <>
      {msg && <div className="err">{msg}</div>}
      {!data.organizations.length && <div className="card">No company requests.</div>}
      {data.organizations.map((o: Row) => (
        <div className="card" key={o._id}>
          <div className="row"><div><h3>{o.name}</h3><span className={`pill ${o.verificationStatus === 'verified' ? '' : 'warn'}`}>{o.verificationStatus}</span><span className="muted">{o.industry} · {o.city} · {o.workEmail}</span></div>
            <div><button className="btn" onClick={() => act(o._id, 'verified')}>Verify</button> <button className="btn alt" onClick={() => act(o._id, 'rejected')}>Reject</button> <button className="btn red" onClick={() => act(o._id, 'suspended')}>Suspend</button></div></div>
          <p className="muted">Website: {o.website || '-'}</p>
          <p><b>Private proof (admins only):</b> {o.verificationEvidence}</p>
        </div>
      ))}
    </>
  );
}

function Resources() {
  const { data, err, reload } = useLoad('/resources');
  const [f, setF] = useState({ title: '', url: '', skillKey: 'sql', language: 'bn' });
  const [msg, setMsg] = useState('');
  async function add(e: React.FormEvent) { e.preventDefault(); setMsg(''); try { await api('/admin/resources', { method: 'POST', body: f }); setF({ ...f, title: '', url: '' }); reload(); } catch (x: any) { setMsg(x.message); } }
  async function check() { setMsg('Checking links…'); try { const r = await api('/admin/resources/check-links', { method: 'POST', body: {} }); setMsg(`Checked: ${r.ok} ok, ${r.broken} broken, ${r.blocked} blocked`); reload(); } catch (x: any) { setMsg(x.message); } }
  async function hide(id: string) { try { await api(`/admin/resources/${id}`, { method: 'DELETE' }); reload(); } catch (x: any) { setMsg(x.message); } }
  if (err) return <div className="err">{err}</div>;
  if (!data) return <p>Loading…</p>;
  return (
    <>
      <div className="card"><button className="btn" onClick={check}>Check all links</button> {msg && <span className="muted">{msg}</span>}<table><thead><tr><th>Title</th><th>Skill</th><th>Lang</th><th>Link</th><th></th></tr></thead><tbody>{data.resources.map((r: Row) => <tr key={r.id}><td><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></td><td>{r.skillKey}</td><td>{r.language}</td><td>{r.linkStatus ? `${r.linkStatus} · ${String(r.lastLinkCheckedAt).slice(0, 10)}` : 'not checked'}</td><td><button className="btn alt" onClick={() => hide(r.id)}>Hide</button></td></tr>)}</tbody></table></div>
      <div className="card"><h3>Add a resource</h3><p className="muted">Links only (https). Add Bangla-language resources here.</p>{msg && <div className="err">{msg}</div>}
        <form onSubmit={add}>
          <input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          <input placeholder="Skill key (sql, excel, python, statistics, dashboard, git…)" value={f.skillKey} onChange={(e) => setF({ ...f, skillKey: e.target.value })} />
          <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="bn">Bangla</option><option value="en">English</option></select>
          <button className="btn">Add</button>
        </form></div>
    </>
  );
}
