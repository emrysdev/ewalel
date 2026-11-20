import React, { useState } from 'react';
import './email-centre.css';

const folders = ['Inbox', 'Starred', 'Sent', 'Drafts', 'Scheduled', 'Spam', 'Trash'];
const initialDraft = { to: '', subject: '', body: '' };

export default function EmailCentre() {
  const [folder, setFolder] = useState('Inbox');
  const [draft, setDraft] = useState(initialDraft);
  const [compose, setCompose] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [drafts, setDrafts] = useState([]);
  const saveDraft = () => {
    if (!draft.to.trim() && !draft.subject.trim() && !draft.body.trim()) return;
    setDrafts(old => [{ ...draft, id: Date.now(), date: new Date().toISOString() }, ...old]);
    setDraft(initialDraft);
    setCompose(false);
    setNotice('Draft saved in this browser session. Email delivery is not yet configured.');
  };
  const rows = folder === 'Drafts' ? drafts.filter(d => [d.to, d.subject, d.body].some(v => v.toLowerCase().includes(search.toLowerCase()))) : [];
  return <section className="ew-mail" aria-label="Ewalel Email Centre">
    <div className="ew-mail-head"><div><span className="ew-mail-kicker">EWALEL COTTAGES</span><h1>Email Centre</h1><p>Manage guest correspondence and booking notifications.</p></div><span className="ew-mail-status">Email provider not connected</span></div>
    <div className="ew-mail-layout"><aside className="ew-mail-sidebar"><button className="ew-mail-compose" onClick={() => { setCompose(true); setNotice(''); }}>+ Compose</button>{folders.map(name => <button key={name} className={folder === name ? 'selected' : ''} onClick={() => { setFolder(name); setCompose(false); }}>{name}{name === 'Drafts' && drafts.length ? ` (${drafts.length})` : ''}</button>)}<button onClick={() => { setFolder('Settings'); setCompose(false); }}>Settings</button></aside>
    <div className="ew-mail-content"><div className="ew-mail-toolbar"><h2>{compose ? 'New message' : folder}</h2>{!compose && <input aria-label="Search messages" placeholder="Search messages" value={search} onChange={e => setSearch(e.target.value)} />}</div>
      {notice && <p className="ew-mail-notice" role="status">{notice}</p>}
      {compose ? <form className="ew-mail-form" onSubmit={e => { e.preventDefault(); setNotice('Sending is unavailable until a mail provider and secure backend are configured. You can save a draft.'); }}><label>To<input type="email" placeholder="guest@example.com" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })}/></label><label>Subject<input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })}/></label><label>Message<textarea rows={12} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })}/></label><div className="ew-mail-actions"><button type="submit" disabled>Send (setup required)</button><button type="button" onClick={saveDraft}>Save draft</button><button type="button" onClick={() => setCompose(false)}>Close</button></div></form> : rows.length ? <div className="ew-mail-rows">{rows.map(d => <button key={d.id} onClick={() => { setDraft({ to: d.to, subject: d.subject, body: d.body }); setCompose(true); }}><b>{d.to || 'No recipient'}</b><span>{d.subject || '(No subject)'}</span><small>{new Date(d.date).toLocaleString()}</small></button>)}</div> : <div className="ew-mail-empty"><div className="ew-mail-envelope">✉</div><h3>{folder === 'Settings' ? 'Connect an email provider' : `No ${folder.toLowerCase()} messages yet`}</h3><p>{folder === 'Settings' ? 'Configure an authenticated backend, sender domain, and inbound email service to enable real messaging.' : 'This mailbox is a UI preview. Real email syncing, sending, and automated booking messages are not yet enabled.'}</p></div>}
    </div></div>
  </section>;
}
