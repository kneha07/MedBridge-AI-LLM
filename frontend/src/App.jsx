import { useState, useEffect, useRef } from 'react';
import DemoHeader from './components/DemoHeader';
import WorkflowForm from './components/WorkflowForm';
import ChatPanel from './components/ChatPanel';
import Landing from './components/Landing';
import ProgressView from './components/ProgressView';
import { HistoryPanel } from './components/ReviewPanels';

const API = 'http://localhost:8000';
const TERMINAL = new Set(['submitted', 'approved', 'denied', 'needs_info', 'rejected']);

const TITLES = { home: 'MedBridge — Prior Authorization Assistant', workflow: 'New request — MedBridge', chat: 'Ask a question — MedBridge', history: 'Past requests — MedBridge' };

export default function App() {
  const [view, setView]             = useState('select');   // select | form | progress | result
  const [verticals, setVerticals]   = useState([]);
  const [vertical, setVertical]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [workflowId, setWorkflowId] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [mode, setMode] = useState('home');             // home | workflow | chat | history
  const [history, setHistory]   = useState([]);
  const pollRef = useRef(null);
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = TITLES[mode];
    if (firstRender.current) { firstRender.current = false; return; }
    mainRef.current?.focus({ preventScroll: true });
  }, [mode, view]);

  useEffect(() => {
    fetch(`${API}/api/verticals`).then(r => r.json()).then(setVerticals).catch(() => {});
  }, []);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const startPolling = (id) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/workflow/${id}/status`);
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
      const res = await fetch(`${API}/api/workflow/submit`, {
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
    try { await fetch(`${API}/api/demo/reset`, { method: 'POST' }); } catch {}
    setView('select'); setVertical(null); setWorkflowId(null); setWorkflowData(null);
    setMode('home');
  };

  const loadHistory = () => fetch(`${API}/api/workflow/history/all`).then(r => r.json()).then(setHistory).catch(() => {});

  useEffect(() => { if (mode === 'history') loadHistory(); }, [mode]);

  const handleDecision = async (approved, reviewer, note) => {
    await fetch(`${API}/api/workflow/${workflowId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, reviewer, note }),
    });
  };

  const openFromHistory = async (id) => {
    const res = await fetch(`${API}/api/workflow/${id}/status`);
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

  return (
    <div style={{ minHeight: '100vh' }}>
      <a href="#main" className="skip-link">Skip to main content</a>
      <DemoHeader onHome={() => setMode('home')} onReset={mode === 'workflow' && view !== 'select' ? handleReset : null} vertical={mode === 'workflow' ? vertical : null} />

      <nav style={{ display: 'flex', justifyContent: 'center', padding: '16px 12px 0' }} aria-label="Main">
        <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          {[['home', '🏠  Home'], ['workflow', '📋  New request'], ['chat', '💬  Ask a question'], ['history', '🕘  Past requests']].map(([id, label]) => (
            <button key={id} className="nav-tab" onClick={() => (id === 'workflow' ? startRequest() : setMode(id))} aria-current={mode === id ? 'page' : undefined} style={{
              border: 'none', cursor: 'pointer', padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              color: mode === id ? 'white' : '#64748b',
              background: mode === id ? 'linear-gradient(135deg,#0f2240,#1a3a5c)' : 'transparent',
              boxShadow: mode === id ? '0 4px 12px rgba(15,34,64,0.25)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      </nav>

      <main id="main" ref={mainRef} tabIndex={-1} key={mode + (mode === 'workflow' ? view : '')} className="view-enter">
        {mode !== 'home' && <h1 className="sr-only">{{ workflow: 'New prior authorization request', chat: 'Ask a coverage question', history: 'Past requests' }[mode]}</h1>}
      {mode === 'home' && <Landing onStart={startRequest} onChat={() => setMode('chat')} />}
      {mode === 'chat' && <ChatPanel />}
      {mode === 'history' && <HistoryPanel items={history} onOpen={openFromHistory} />}

      {mode === 'workflow' && <>

      {/* ── VERTICAL SELECTOR ── */}
      {view === 'select' && (
        <div role="status" style={{ textAlign: 'center', padding: '80px 24px', color: '#475569', fontSize: 15 }}>
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
          <ProgressView workflowData={workflowData} onDecide={handleDecision} onStartNew={handleReset} />
        )}
      </>}
      </main>
    </div>
  );
}
