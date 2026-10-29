import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import Icon from './Icon';

// Reviewer-only: see who has an account and promote or demote people who signed up.
export default function TeamPanel({ me }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => apiFetch('/api/users').then(async r => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || 'Could not load the team.');
    setUsers(await r.json());
  }).catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const change = async (name, role) => {
    setBusy(name); setError('');
    const res = await apiFetch(`/api/users/${encodeURIComponent(name)}/role`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).detail || 'The change was refused.');
    await load();
    setBusy('');
  };

  const reviewers = users ? users.filter(u => u.role === 'reviewer').length : 0;
  return (
    <section style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}>
      <h2 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#18181b', margin: '0 0 6px' }}>Team</h2>
      <p style={{ color: '#71717a', fontSize: 14.5, margin: '0 0 22px' }}>
        {users ? `${users.length} ${users.length === 1 ? 'person' : 'people'}, ${reviewers} can approve requests.` : 'Loading…'} New sign-ups start as staff.
      </p>
      {error && <div role="alert" className="auth-msg error" style={{ marginBottom: 14 }}><Icon name="alert" size={17} />{error}</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {(users || []).map(u => {
          const isMe = u.name === me.name;
          const fixed = u.source !== 'signed up' || isMe;
          const shown = u.display || u.name;
          return (
            <div key={u.name} className="team-row">
              <span className={`user-avatar lg ${u.role}`} aria-hidden="true">{shown[0].toUpperCase()}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, color: '#18181b', fontSize: 15.5 }}>{shown}{isMe && <span className="team-you">You</span>}</span>
                <span style={{ display: 'block', fontSize: 13, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[u.display && u.display !== u.name ? u.name : null, u.organization, u.source === 'signed up' ? null : 'Demo account'].filter(Boolean).join(' · ') || ' '}
                </span>
              </span>
              <span className={`role-pill ${u.role}`}>{u.role}</span>
              {fixed ? <span style={{ width: 118 }} aria-hidden="true" /> : (
                <button className="team-action" disabled={busy === u.name} onClick={() => change(u.name, u.role === 'reviewer' ? 'staff' : 'reviewer')}>
                  {u.role === 'reviewer' ? 'Make staff' : 'Make reviewer'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
