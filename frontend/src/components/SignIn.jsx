import { useState } from 'react';
import { API } from '../api';
import Icon from './Icon';
import Logo from './Logo';

const PATHS = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  building: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 10h5a1 1 0 0 1 1 1v10M3 21h18M8 8h2M8 12h2M8 16h2" /></>,
};
const Glyph = ({ name }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>
);

// 0 to 4: longer, mixed case, digits and symbols all count.
function strength(pw) {
  if (!pw) return 0;
  let n = (pw.length >= 8) + (pw.length >= 12) + (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) + (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw));
  if (pw.length < 8) n = Math.min(n, 1);
  return Math.max(1, n);
}
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const STEPS = [['Scan payer policy', 'with sources'], ['Analyze medical records', 'MIMIC-IV'], ['Complete authorization form', '100%']];

export default function SignIn({ onSignedIn, expired, demoAccounts = [], minPassword = 8 }) {
  const [creating, setCreating] = useState(window.location.hash === '#create');  // /#create opens the sign-up form
  const [username, setUsername] = useState('');   // sign in: email (or demo name)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');     // the password, or the PIN for a demo account
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = () => { setCreating(!creating); setError(''); setShow(false); setPassword(''); setConfirm(''); };

  const submit = async (e) => {
    e.preventDefault();
    if (creating && password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API}/api/auth/${creating ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creating ? { full_name: fullName, email, organization, password } : { username, password }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))).detail;
        throw new Error(typeof detail === 'string' ? detail : res.status === 401 ? 'Wrong name or password.' : 'Could not reach the server.');
      }
      const data = await res.json();
      onSignedIn({ token: data.token, name: data.name, display: data.display || data.name, role: data.role });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const score = strength(password);
  return (
    <div className="auth-page">
      <aside className="auth-hero" aria-label="MedBridge">
        <div className="auth-hero-brand"><Logo size={42} />MedBridge</div>
        <div>
          <h2 className="auth-headline">Prior authorizations,<br /><em>ready to review.</em></h2>
          <p className="auth-tagline">Prepared by AI. Approved by a person.</p>
        </div>
        <div className="auth-demo-card" aria-hidden="true">
          <div className="auth-demo-head"><span>New request</span><span className="auth-live">LIVE</span></div>
          {STEPS.map(([label, note]) => (
            <div className="auth-step" key={label}><span className="auth-tick"><Icon name="check" size={14} strokeWidth={3} /></span>{label}<small>{note}</small></div>
          ))}
          <div className="auth-step wait"><span className="auth-tick"><Icon name="pause" size={14} strokeWidth={3} /></span>Waiting for reviewer approval</div>
        </div>
        <div className="auth-hero-foot">Research prototype · simulated payer</div>
      </aside>

      <main id="main" className="auth-pane">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Logo size={48} />MedBridge</div>

          <div className="auth-head">
            <h1>{creating ? 'Create your account' : 'Welcome back'}</h1>
            <p>{creating ? 'It takes less than a minute.' : 'Sign in to continue.'}</p>
          </div>

          {expired && !creating && <div className="auth-msg warn" role="status"><Icon name="clock" size={17} />Your session ended. Please sign in again.</div>}

          <form className="auth-form" onSubmit={submit}>
            {creating ? (
              <>
                <label className="auth-field">Full name
                  <span className="auth-input-wrap"><Icon name="user" size={18} />
                    <input className="auth-input" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" maxLength={60} autoFocus required />
                  </span>
                </label>
                <label className="auth-field">Work email
                  <span className="auth-input-wrap"><Glyph name="mail" />
                    <input className="auth-input" value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={120} required />
                  </span>
                </label>
                <label className="auth-field"><span>Organization <span className="auth-optional">(optional)</span></span>
                  <span className="auth-input-wrap"><Glyph name="building" />
                    <input className="auth-input" value={organization} onChange={e => setOrganization(e.target.value)} autoComplete="organization" maxLength={80} />
                  </span>
                </label>
              </>
            ) : (
              <label className="auth-field">Email or name
                <span className="auth-input-wrap"><Icon name="user" size={18} />
                  <input className="auth-input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
                </span>
              </label>
            )}

            <label className="auth-field">{creating ? 'Password' : 'Password or PIN'}
              <span className="auth-input-wrap"><Glyph name="lock" />
                <input className="auth-input has-toggle" value={password} onChange={e => setPassword(e.target.value)} type={show ? 'text' : 'password'}
                  autoComplete={creating ? 'new-password' : 'current-password'} required minLength={creating ? minPassword : undefined} />
                <button type="button" className="auth-toggle" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
              </span>
              {creating && (
                <span className="auth-meter" role="status" aria-label={password ? `Password strength: ${STRENGTH_LABEL[score]}` : `At least ${minPassword} characters`}>
                  {[1, 2, 3, 4].map(n => <i key={n} className={score >= n ? `on-${score}` : ''} />)}
                  <span>{password ? STRENGTH_LABEL[score] : `${minPassword}+ chars`}</span>
                </span>
              )}
            </label>

            {creating && (
              <label className="auth-field">Confirm password
                <span className="auth-input-wrap"><Glyph name="lock" />
                  <input className="auth-input" value={confirm} onChange={e => setConfirm(e.target.value)} type={show ? 'text' : 'password'} autoComplete="new-password" required />
                </span>
                {confirm && <span className={`auth-match ${confirm === password ? '' : 'bad'}`}>{confirm === password ? 'Passwords match' : 'Passwords do not match yet'}</span>}
              </label>
            )}

            {error && <div className="auth-msg error" role="alert"><Icon name="alert" size={17} />{error}</div>}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? <><span className="auth-spinner" aria-hidden="true" />Please wait…</>
                : <>{creating ? 'Create account' : 'Sign in'}<Icon name="arrow-right" size={18} /></>}
            </button>
          </form>

          <p className="auth-switch">
            {creating ? 'Already have an account? ' : 'New to MedBridge? '}
            <button type="button" className="auth-link" onClick={switchMode}>{creating ? 'Sign in' : 'Create an account'}</button>
          </p>

          {!creating && demoAccounts.length > 0 && (
            <>
              <div className="auth-or">or use a demo account</div>
              <div className="auth-chips">
                {demoAccounts.map(a => (
                  <button key={a.name} type="button" className="auth-chip"
                    onClick={() => { setUsername(a.name); setPassword(a.pin); setError(''); }}>
                    <span className={`auth-avatar ${a.role}`} aria-hidden="true">{a.name[0].toUpperCase()}</span>
                    <span><b>{a.name}</b><small>{a.role === 'reviewer' ? 'Can approve' : 'Prepares requests'}</small></span>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="auth-foot">No real patient data. Prototype only.</p>
        </div>
      </main>
    </div>
  );
}
