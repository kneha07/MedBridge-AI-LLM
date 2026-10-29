import { useState, useEffect, useRef } from 'react';
import DemoHeader from './components/DemoHeader';
import WorkflowForm from './components/WorkflowForm';
import ChatPanel from './components/ChatPanel';
import Landing from './components/Landing';
import Icon from './components/Icon';
import ProgressView from './components/ProgressView';
import { HistoryPanel } from './components/ReviewPanels';
import SignIn from './components/SignIn';
import TeamPanel from './components/TeamPanel';
import { API, apiFetch, getSession, setSession, setUnauthorizedHandler } from './api';
const TERMINAL = new Set(['submitted', 'approved', 'denied', 'needs_info', 'rejected']);

const TITLES = { home: 'MedBridge — Prior Authorization Assistant', workflow: 'New request — MedBridge', chat: 'Ask a question — MedBridge', history: 'Past requests — MedBridge', team: 'Team — MedBridge' };

export default function App() {
  const [view, setView]             = useState('select');   // select | form | progress | result
  const [verticals, setVerticals]   = useState([]);
  const [vertical, setVertical]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [workflowId, setWorkflowId] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [mode, setMode] = useState('home');             // home | workflow | chat | history
  const [history, setHistory]   = useState([]);
  const [authOn, setAuthOn]     = useState(null);        // null while the server is being asked
  const [user, setUser]         = useState(getSession());
  const [expired, setExpired]   = useState(false);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [minPassword, setMinPassword] = useState(8);
  const pollRef = useRef(null);
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = TITLES[mode];
    if (firstRender.current) { firstRender.current = false; return; }
    mainRef.current?.focus({ preventScroll: true });
  }, [mode, view]);

  useEffect(() => {
    fetch(`${API}/api/auth/config`).then(r => r.json()).then(c => { setAuthOn(!!c.enabled); setDemoAccounts(c.demo_accounts || []); if (c.min_password) setMinPassword(c.min_password); }).catch(() => setAuthOn(false));
    setUnauthorizedHandler(() => { setSession(null); setUser(null); setExpired(true); });
  }, []);

  const signedIn = authOn === false || (authOn && user);

  useEffect(() => {
    if (signedIn) apiFetch('/api/verticals').then(r => r.json()).then(setVerticals).catch(() => {});
  }, [signedIn]);

  const signOut = () => { stopPolling(); setSession(null); setUser(null); setExpired(false); setView('select'); setVertical(null); setWorkflowId(null); setWorkflowData(null); setMode('home'); };

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const startPolling = (id) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/workflow/${id}/status`);
        if (!res.ok) return;
        const data = await res.json();
        setWorkflowData(data);
        if (TERMINAL.has(data.status)) { stopPolling(); setView('result'); }
      } catch {}
    }, 1500);
  };

  useEffect(() => () => stopPolling(), []);

  // Only one workflow exists, so open its form as soon as the server's list has loaded.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mode === 'workflow' && view === 'select' && verticals.length) { setVertical(verticals[0]); setView('form'); }
  }, [mode, view, verticals]);

  const handleSubmit = async (formData, aiProvider) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical_id: vertical.id, ai_provider: aiProvider, form_data: formData })
      });
      if (!res.ok) throw new Error('Submission failed');
      const data = await res.json();
      setWorkflowId(data.workflow_id);
      setView('progress');
      startPolling(data.workflow_id);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    stopPolling();
    try { await apiFetch('/api/demo/reset', { method: 'POST' }); } catch {}
    setView('select'); setVertical(null); setWorkflowId(null); setWorkflowData(null);
    setMode('home');
  };

  const loadHistory = () => apiFetch('/api/workflow/history/all').then(r => r.json()).then(setHistory).catch(() => {});

  useEffect(() => { if (mode === 'history') loadHistory(); }, [mode]);

  const handleDecision = async (approved, reviewer, note) => {
    const res = await apiFetch(`/api/workflow/${workflowId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, reviewer, note }),
    });
    if (!res.ok) return (await res.json().catch(() => ({}))).detail || `The server refused this (HTTP ${res.status}).`;
    return null;
  };

  const openFromHistory = async (id) => {
    const res = await apiFetch(`/api/workflow/${id}/status`);
    if (!res.ok) return;
    const data = await res.json();
    const v = verticals.find(x => x.id === data.vertical_id) || verticals[0] || null;
    setVertical(v); setWorkflowId(id); setWorkflowData(data);
    setMode('workflow');
    if (TERMINAL.has(data.status)) { setView('result'); } else { setView('progress'); startPolling(id); }
  };

  const startRequest = () => {
    setMode('workflow');
    if (view === 'select' && verticals.length) { setVertical(verticals[0]); setView('form'); }
  };

  const handleBack = () => { setView('select'); setVertical(null); setMode('home'); };

  if (authOn === null) return null;
  if (authOn && !user) return <SignIn expired={expired} demoAccounts={demoAccounts} minPassword={minPassword} onSignedIn={(u) => { setSession(u); setUser(u); setExpired(false); }} />;

  return (
    <div style={{ minHeight: '100vh' }}>
      <a href="#main" className="skip-link">Skip to main content</a>
      <DemoHeader user={authOn ? user : null} onSignOut={signOut} onHome={() => setMode('home')} onReset={mode === 'workflow' && view !== 'select' ? handleReset : null} vertical={mode === 'workflow' ? vertical : null} />

      <nav style={{ display: 'flex', justifyContent: 'center', padding: '16px 12px 0' }} aria-label="Main">
        <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'white', border: '1px solid #e7e5e4', borderRadius: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          {[['home', 'home', 'Home'], ['workflow', 'clipboard', 'New request'], ['chat', 'message', 'Ask a question'], ['history', 'clock', 'Past requests'], ...(authOn && user?.role === 'reviewer' ? [['team', 'user', 'Team']] : [])].map(([id, icon, label]) => (
            <button key={id} className="nav-tab" onClick={() => (id === 'workflow' ? startRequest() : setMode(id))} aria-current={mode === id ? 'page' : undefined} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              color: mode === id ? 'white' : '#71717a',
              background: mode === id ? 'linear-gradient(135deg,#17171d,#2a2a33)' : 'transparent',
              boxShadow: mode === id ? '0 4px 12px rgba(15,34,64,0.25)' : 'none',
            }}><Icon name={icon} size={17} />{label}</button>
          ))}
        </div>
      </nav>

      <main id="main" ref={mainRef} tabIndex={-1} key={mode + (mode === 'workflow' ? view : '')} className="view-enter">
        {mode !== 'home' && <h1 className="sr-only">{{ workflow: 'New prior authorization request', chat: 'Ask a coverage question', history: 'Past requests', team: 'Team' }[mode]}</h1>}
      {mode === 'home' && <Landing onStart={startRequest} onChat={() => setMode('chat')} />}
      {mode === 'chat' && <ChatPanel />}
      {mode === 'team' && user && <TeamPanel me={user} />}
      {mode === 'history' && <HistoryPanel items={history} onOpen={openFromHistory} />}

      {mode === 'workflow' && <>

      {/* ── VERTICAL SELECTOR ── */}
      {view === 'select' && (
        <div role="status" style={{ textAlign: 'center', padding: '80px 24px', color: '#52525b', fontSize: 15 }}>
          {verticals.length ? 'Opening the request form…' : 'Connecting to the server… If this stays, check that the backend is running.'}
        </div>
      )}

      {/* ── FORM ── */}
      {view === 'form' && vertical && (
        <WorkflowForm
          vertical={vertical}
          onSubmit={handleSubmit}
          onBack={handleBack}
          loading={loading}
        />
      )}

        {/* ── PROGRESS / RESULT ── */}
        {(view === 'progress' || view === 'result') && (
          <ProgressView workflowData={workflowData} onDecide={handleDecision} onStartNew={handleReset} user={authOn ? user : null} />
        )}
      </>}
      </main>
    </div>
  );
}
