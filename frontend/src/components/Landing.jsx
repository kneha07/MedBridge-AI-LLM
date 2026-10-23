import { useState, useEffect } from 'react';

const STEPS = [
  { icon: '📚', title: 'Scan payer policy', detail: 'Aetna CPB 0236 · 3 passages cited', ms: 1300 },
  { icon: '🩺', title: 'Analyze medical records', detail: 'Diagnoses and medications read from the record', ms: 1300 },
  { icon: '📝', title: 'Complete authorization form', detail: 'All required fields filled', ms: 1300 },
  { icon: '✋', title: 'Waiting for reviewer approval', detail: 'Nothing is sent until a person approves', ms: 1900, review: true },
  { icon: '📤', title: 'Submit & track', detail: 'Confirmation number assigned', ms: 1400 },
];

function AgentDemo() {
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [i, setI] = useState(reduce ? STEPS.length : 0);
  useEffect(() => {
    if (reduce) return undefined;
    const t = setTimeout(() => setI(n => (n + 1) % (STEPS.length + 2)), i >= STEPS.length ? 1800 : STEPS[i].ms);
    return () => clearTimeout(t);
  }, [i, reduce]);

  return (
    <div style={S.demo} role="img" aria-label="Preview of the workflow: the agent scans the payer policy, analyzes the medical record, completes the form, then waits for a reviewer to approve before submitting and tracking.">
      <div style={S.demoBar}>
        <span style={{ ...S.dot, background: '#ef4444' }} /><span style={{ ...S.dot, background: '#f59e0b' }} /><span style={{ ...S.dot, background: '#22c55e' }} />
        <span style={{ marginLeft: 10, fontSize: 13.5, color: '#cbd5e1', fontWeight: 600 }}>Example · Lumbar MRI · Aetna · M54.30</span>
      </div>
      <div style={{ padding: '10px 18px 18px' }}>
        {STEPS.map((s, k) => {
          const done = k < i && i <= STEPS.length || i > STEPS.length;
          const active = k === i && i < STEPS.length;
          const visible = k <= i || i >= STEPS.length;
          const amber = s.review && (active || done);
          return (
            <div key={k} style={{
              display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: k < STEPS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              opacity: visible ? 1 : 0.5, transform: visible ? 'none' : 'translateY(6px)', transition: 'all .5s cubic-bezier(.22,1,.36,1)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, transition: 'all .4s',
                color: done ? (amber ? '#fbbf24' : '#4ade80') : '#cbd5e1',
                background: done ? (amber ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.18)') : active ? (amber ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.25)') : 'rgba(255,255,255,0.05)',
                boxShadow: active ? `0 0 0 4px ${amber ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.18)'}` : 'none',
                animation: active ? 'pulseRing 1.6s infinite' : 'none',
              }}>{done && !amber ? '✓' : s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 16 }}>{s.title}</div>
                <div style={{ color: amber ? '#fcd34d' : '#cbd5e1', fontSize: 14, marginTop: 3 }}>{visible ? s.detail : ''}</div>
              </div>
              {active && !s.review && <span style={S.spinner} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Landing({ onStart, onChat }) {
  return (
    <div style={S.hero}>
      <div className="drift" style={S.glow1} aria-hidden="true" /><div className="drift" style={{ ...S.glow2, animationDelay: '-7s' }} aria-hidden="true" />
      <div style={S.inner}>
        <div style={S.copy}>
          <div className="fade-up" style={S.pill}><span aria-hidden="true" style={{ marginRight: 2 }}>🏆</span>1st place · AI Agents Hackathon · solo build</div>
          <h1 className="fade-up-1" style={S.h1}>
            Prior authorizations,<br /><span className="gradient-text">ready to review.</span>
          </h1>
          <p className="fade-up-2" style={S.sub}>
            Tell MedBridge about the patient and the service. It checks the insurer's own rules, fills in the request, and shows you everything before anything is sent.
          </p>
          <div className="fade-up-3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button style={S.primary} onClick={onStart}>Start a request <span style={{ marginLeft: 6 }}>→</span></button>
            <button style={S.secondary} onClick={onChat}>Ask a coverage question</button>
          </div>
          <div className="fade-up-4" style={S.proof}>
            {[['1', 'Enter the request'], ['2', "We check the insurer's policy"], ['3', 'You review and approve']].map(([n, t]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#cbd5e1', fontSize: 13.5, fontWeight: 600 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#4ade80', background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.35)' }}>{n}</span>{t}
              </div>
            ))}
          </div>
          <p className="fade-up-4" style={{ margin: '26px 0 0', color: '#94a3b8', fontSize: 14 }}>
            Runs on your choice of model: Groq, Claude, or Claude on Amazon Bedrock.
          </p>
        </div>
        <div className="fade-up-2" style={{ flex: '1 1 380px', minWidth: 300, maxWidth: 460 }}><AgentDemo /></div>
      </div>
    </div>
  );
}

const S = {
  hero: { position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 130px)', display: 'flex', alignItems: 'center', margin: '16px 0 0',
    background: 'linear-gradient(135deg,#060e1a 0%,#0a1628 45%,#0f2240 100%)' },
  glow1: { position: 'absolute', top: -120, left: '8%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.16),transparent 70%)' },
  glow2: { position: 'absolute', bottom: -160, right: '6%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.18),transparent 70%)' },
  inner: { position: 'relative', zIndex: 1, maxWidth: 1120, margin: '0 auto', padding: '56px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 48, flexWrap: 'wrap', width: '100%' },
  copy: { flex: '1 1 600px', minWidth: 300 },
  pill: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, marginBottom: 24, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
    color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' },
  pillDot: { width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.9)', animation: 'pulse 2s infinite' },
  h1: { margin: '0 0 18px', fontSize: 'clamp(34px,4.4vw,52px)', lineHeight: 1.05, fontWeight: 900, letterSpacing: '-1.6px', color: 'white' },
  sub: { margin: '0 0 32px', fontSize: 18, lineHeight: 1.6, color: '#94a3b8', maxWidth: 520 },
  primary: { padding: '15px 28px', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 800, color: 'white',
    background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 12px 32px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.25)', transition: 'transform .2s, box-shadow .2s' },
  secondary: { padding: '15px 24px', borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#e2e8f0',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' },
  proof: { display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginTop: 40 },
  demo: { borderRadius: 22, background: 'rgba(15,34,64,0.75)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(18px)',
    boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)', overflow: 'hidden' },
  demoBar: { display: 'flex', alignItems: 'center', gap: 6, padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' },
  dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  spinner: { width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(96,165,250,0.25)', borderTopColor: '#60a5fa', animation: 'spin .8s linear infinite' },
};
