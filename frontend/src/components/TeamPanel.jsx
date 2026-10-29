import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

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

  const cell = { padding: '12px 16px', borderBottom: '1px solid #f5f5f4', fontSize: 15 };
  return (
    <section style={{ maxWidth: 760, margin: '28px auto', padding: '0 16px' }}>
      <div style={{ background: 'white', border: '1px solid #e7e5e4', borderRadius: 20, boxShadow: '0 8px 32px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e7e5e4' }}>
          <h2 style={{ margin: 0, fontFamily: '"Source Serif 4", serif', fontSize: 24 }}>Team</h2>
          <p style={{ margin: '6px 0 0', color: '#52525b', fontSize: 14.5 }}>
            New sign-ups start as staff. Make someone a reviewer so they can approve requests. You cannot change your own role.
          </p>
        </div>
        {error && <div role="alert" style={{ margin: '12px 24px 0', color: '#b91c1c', fontWeight: 600, fontSize: 14.5 }}>{error}</div>}
        {!users ? <div style={{ ...cell, color: '#71717a' }}>Loading…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: '#71717a', fontSize: 13 }}>
              <th style={cell}>Name</th><th style={cell}>Role</th><th style={cell}>Account</th><th style={cell}><span className="sr-only">Action</span></th>
            </tr></thead>
            <tbody>
              {users.map(u => {
                const fixed = u.source !== 'signed up' || u.name === me.name;
                return (
                  <tr key={u.name}>
                    <td style={cell}>
                      <div style={{ fontWeight: 700 }}>{u.display || u.name}{u.name === me.name ? ' (you)' : ''}</div>
                      {(u.display && u.display !== u.name) && <div style={{ fontSize: 13, color: '#71717a' }}>{u.name}{u.organization ? ` · ${u.organization}` : ''}</div>}
                    </td>
                    <td style={cell}>{u.role}</td>
                    <td style={{ ...cell, color: '#71717a' }}>{u.source === 'signed up' ? 'Signed up' : 'Demo / server config'}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>
                      {!fixed && (
                        <button disabled={busy === u.name} onClick={() => change(u.name, u.role === 'reviewer' ? 'staff' : 'reviewer')}
                          style={{ border: '1px solid #d4d4d8', background: 'white', borderRadius: 999, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>
                          {u.role === 'reviewer' ? 'Make staff' : 'Make reviewer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
