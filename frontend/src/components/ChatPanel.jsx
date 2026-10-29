import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import CitationDrawer from './CitationDrawer';
import Logo from './Logo';
import { apiFetch } from '../api';


const SUGGESTIONS = [
  { icon: 'search', text: 'Does Aetna need conservative therapy before a lumbar MRI, and are there exceptions?' },
  { icon: 'file', text: 'What documents are required for an Aetna MRI prior authorization?' },
  { icon: 'scale', text: 'How long does Cigna usually take to approve an MRI?' },
  { icon: 'edit', text: 'My MRI request was denied for lack of conservative treatment. What should the appeal cite?' },
];

const TOOL_LABELS = { search_policy: 'Searched policy documents', get_payer_requirements: 'Looked up payer requirements' };

// Replace 【Title】 markers with [n] chips that map to the citation list; minimal **bold** / bullet rendering.
function renderReply(text, citations) {
  const idx = (title) => {
    const i = citations.findIndex(c => title.includes(c.title) || c.title.includes(title));
    return i >= 0 ? i + 1 : null;
  };
  const clean = text
    .replace(new RegExp('[\\u202f\\u00a0]', 'g'), ' ')
    .replace(/【([^】]+)】/g, (_, t) => { const n = idx(t); return n ? ` [${n}]` : ''; });
  return clean.split('\n').map((line, i) => {
    const bullet = /^\s*[*\-•]\s+/.test(line);
    const body = line.replace(/^\s*[*\-•]\s+/, '');
    const parts = body.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((p, j) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={j}>{p.slice(2, -2)}</strong>;
      if (/^\[\d+\]$/.test(p)) return <span key={j} style={styles.cite}>{p.slice(1, -1)}</span>;
      return p;
    });
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    return bullet
      ? <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}><span style={{ color: '#0d9488' }}>•</span><span>{parts}</span></div>
      : <div key={i} style={{ margin: '3px 0' }}>{parts}</div>;
  });
}

function Sources({ citations, tools }) {
  const [open, setOpen] = useState(null);
  if (!citations.length && !tools.length) return null;
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e7e5e4' }}>
      {tools.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: citations.length ? 8 : 0 }}>
          {[...new Set(tools)].map(t => (
            <span key={t} style={{ ...styles.toolChip, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="search" size={13} />{TOOL_LABELS[t] || t}</span>
          ))}
        </div>
      )}
      {citations.map((c, i) => {
        const isUrl = /^https?:/.test(c.url || '');
        const inner = (
          <>
            <span style={styles.cite}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
            <span style={{ ...styles.badge, ...(c.synthetic ? styles.badgeDemo : styles.badgeReal) }}>
              {c.synthetic ? 'demo data' : 'official'}
            </span>
            <span style={{ color: '#52525b', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}><span className="sr-only">relevance </span>{Math.round(c.score * 100)}%</span>
          </>
        );
        if (c.passage) return <button key={i} type="button" onClick={() => setOpen(c)} style={{ ...styles.source, width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>{inner}</button>;
        return isUrl
          ? <a key={i} href={c.url} target="_blank" rel="noreferrer" style={styles.source}>{inner}</a>
          : <div key={i} style={styles.source}>{inner}</div>;
      })}
      <CitationDrawer cite={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export default function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    const history = [...messages, { role: 'user', content: q }];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);
      const data = await res.json();
      setMessages([...history, { role: 'assistant', content: data.reply, citations: data.citations, tools: data.tools_used }]);
    } catch (e) {
      setMessages([...history, { role: 'assistant', error: true, content: e.message || 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const empty = messages.length === 0;

  return (
    <div style={styles.wrap}>
      <div style={styles.thread} role="log" aria-live="polite" aria-label="Conversation">
        {empty && (
          <div className="fade-up" style={{ textAlign: 'center', padding: '36px 0 8px' }}>
            <div className="float" style={{ display: 'flex', justifyContent: 'center' }}><Logo size={68} /></div>
            <h2 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 28, fontWeight: 900, letterSpacing: '-0.6px', color: '#18181b', margin: '18px 0 8px' }}>
              Ask about prior authorization
            </h2>
            <p style={{ color: '#71717a', fontSize: 15, maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.6 }}>
              Answers are retrieved from payer policy documents and cited. If the sources don't cover it, I'll say so.
            </p>
            <div style={styles.grid}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className={`fade-up-${i + 1}`} style={styles.suggest} onClick={() => send(s.text)}>
                  <span style={{ color: '#0f766e', display: 'flex', paddingTop: 2 }}><Icon name={s.icon} size={22} /></span>
                  <span style={{ textAlign: 'left' }}>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="slide-in" style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>
            {m.role === 'assistant' && <Logo size={36} />}
            <div style={m.role === 'user' ? styles.userBubble : { ...styles.botBubble, ...(m.error ? styles.errorBubble : {}) }}>
              <span className="sr-only">{m.role === 'user' ? 'You asked: ' : 'MedBridge answered: '}</span>
              {m.role === 'user' ? m.content : renderReply(m.content, m.citations || [])}
              {m.role === 'assistant' && !m.error && <Sources citations={m.citations || []} tools={m.tools || []} />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="fade-in" style={{ display: 'flex', gap: 10 }}>
            <Logo size={36} />
            <div style={{ ...styles.botBubble, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={styles.dots}><i /><i /><i /></span>
              <span role="status" style={{ color: '#52525b', fontSize: 13 }}>Searching policies…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={styles.composerWrap}>
        <form style={styles.composer} onSubmit={e => { e.preventDefault(); send(); }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about coverage criteria, required documents, or appeals…"
            aria-label="Message"
            style={styles.input}
            disabled={loading}
          />
          {!empty && (
            <button type="button" onClick={() => setMessages([])} style={styles.clear} aria-label="Clear conversation">Clear</button>
          )}
          <button type="submit" disabled={loading || !input.trim()} style={{ ...styles.send, opacity: loading || !input.trim() ? 0.45 : 1 }} aria-label="Send message">
            ↑
          </button>
        </form>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#52525b', marginTop: 8 }}>
          Informational only — not medical or legal advice. Appeals require physician review.
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 820, margin: '0 auto', padding: '0 20px', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 130px)' },
  thread: { flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: '24px 0 150px' },
  hero: { width: 64, height: 64, margin: '0 auto', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
    background: 'linear-gradient(180deg,#2a2a31,#0e0e12)', boxShadow: '0 12px 32px rgba(24,24,27,0.28), inset 0 1px 0 rgba(255,255,255,0.3)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12, textAlign: 'left' },
  suggest: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '16px 18px', background: 'white', border: '1px solid #e7e5e4', borderRadius: 16,
    cursor: 'pointer', fontSize: 14, color: '#3f3f46', lineHeight: 1.5, fontWeight: 500, boxShadow: '0 1px 2px rgba(15,23,42,0.04)', transition: 'all .2s' },
  avatar: { width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
    background: 'linear-gradient(180deg,#2a2a31,#0e0e12)', boxShadow: '0 4px 12px rgba(24,24,27,0.28)' },
  userBubble: { maxWidth: '78%', padding: '12px 16px', borderRadius: '18px 18px 4px 18px', color: 'white', fontSize: 14.5, lineHeight: 1.55,
    background: 'linear-gradient(135deg,#0f766e,#0d9488)', boxShadow: '0 6px 18px rgba(13,148,136,0.28)' },
  botBubble: { maxWidth: '86%', padding: '14px 18px', borderRadius: '18px 18px 18px 4px', background: 'white', color: '#27272a', fontSize: 14.5, lineHeight: 1.6,
    border: '1px solid #e7e5e4', boxShadow: '0 4px 16px rgba(15,23,42,0.06)' },
  errorBubble: { background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' },
  cite: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 6, fontSize: 10.5, fontWeight: 800,
    color: '#0f766e', background: '#dbeafe', verticalAlign: 'middle', margin: '0 1px' },
  toolChip: { fontSize: 11, fontWeight: 600, color: '#52525b', background: '#f5f5f4', padding: '3px 10px', borderRadius: 100 },
  source: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', margin: '4px 0', borderRadius: 10, background: '#fafaf9', border: '1px solid #eef2f7',
    fontSize: 12.5, color: '#3f3f46', textDecoration: 'none' },
  badge: { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 100 },
  badgeReal: { color: '#166534', background: '#dcfce7' },
  badgeDemo: { color: '#92400e', background: '#fef3c7' },
  dots: { display: 'inline-flex', gap: 4 },
  composerWrap: { position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 20px 16px', background: 'linear-gradient(to top,#f0f4f8 70%,transparent)' },
  composer: { maxWidth: 780, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'white', borderRadius: 18,
    border: '1px solid #e7e5e4', boxShadow: '0 12px 40px rgba(15,23,42,0.12)' },
  input: { flex: 1, border: 'none', background: 'transparent', padding: '10px 12px', fontSize: 14.5, color: '#18181b' },
  clear: { border: 'none', background: 'transparent', color: '#71717a', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '8px 10px', borderRadius: 10 },
  send: { width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', color: 'white', fontSize: 18, fontWeight: 800,
    background: 'linear-gradient(180deg,#2a2a31,#0e0e12)', boxShadow: '0 6px 16px rgba(24,24,27,0.28)', transition: 'transform .15s, opacity .2s' },
};
