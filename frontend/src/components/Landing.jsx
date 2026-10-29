import { useState, useEffect } from 'react';
import Icon from './Icon';

const STEPS = [
  { icon: 'book', title: 'Scan payer policy', detail: 'Aetna CPB 0236 · 3 passages cited', ms: 1300 },
  { icon: 'user', title: 'Analyze medical records', detail: 'Diagnoses and medications read from the record', ms: 1300 },
  { icon: 'file', title: 'Complete authorization form', detail: 'All required fields filled', ms: 1300 },
  { icon: 'pause', title: 'Waiting for reviewer approval', detail: 'Nothing is sent until a person approves', ms: 1900, review: true },
  { icon: 'send', title: 'Submit & track', detail: 'Confirmation number assigned', ms: 1400 },
];

const STATS = [
  { n: '94%', t: 'of physicians say prior authorization delays necessary care.', s: 'AMA survey, published 2024' },
  { n: '12 hrs', t: 'of physician and staff time each week, across an average of 43 requests.', s: 'AMA survey, published 2024' },
  { n: '80.7%', t: 'of appealed Medicare Advantage denials were overturned, yet only 11.5% of denials were appealed.', s: 'KFF, 2024 data' },
];

const TRUST = [
  { icon: 'book', title: 'Cited policy evidence', text: "Answers come from the payer's own published documents, and every passage keeps its source link." },
  { icon: 'pause', title: 'A person approves', text: 'The agent stops before submitting. Nothing goes out until a reviewer approves, and rejecting stops the request.' },
  { icon: 'user', title: 'De-identified data', text: 'Patient records come from the open MIMIC-IV demo. No real patient data is used.' },
  { icon: 'send', title: 'Honest about limits', text: 'Payer submission and decisions are simulated, and missing information is shown as missing, not guessed.' },
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
        <span style={{ marginLeft: 10, fontSize: 13.5, color: '#52525b', fontWeight: 600 }}>Example · Lumbar MRI · Aetna · M54.30</span>
      </div>
      <div style={{ padding: '10px 18px 18px' }}>
        {STEPS.map((s, k) => {
          const done = k < i && i <= STEPS.length || i > STEPS.length;
          const active = k === i && i < STEPS.length;
          const visible = k <= i || i >= STEPS.length;
          const amber = s.review && (active || done);
          return (
            <div key={k} style={{
              display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: k < STEPS.length - 1 ? '1px solid #f0eeec' : 'none',
              opacity: visible ? 1 : 0.5, transform: visible ? 'none' : 'translateY(6px)', transition: 'all .5s cubic-bezier(.22,1,.36,1)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, transition: 'all .4s',
                color: done ? (amber ? '#b45309' : '#15803d') : '#71717a',
                background: done ? (amber ? '#fef3c7' : '#dcfce7') : active ? (amber ? '#fef3c7' : '#ccfbf1') : '#f5f5f4',
                boxShadow: active ? `0 0 0 4px ${amber ? 'rgba(245,158,11,0.15)' : 'rgba(13,148,136,0.18)'}` : 'none',
                animation: active ? 'pulseRing 1.6s infinite' : 'none',
              }}><Icon name={done && !amber ? 'check' : s.icon} size={20} strokeWidth={done && !amber ? 3 : 2} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#18181b', fontWeight: 700, fontSize: 16 }}>{s.title}</div>
                <div style={{ color: amber ? '#92400e' : '#71717a', fontSize: 14, marginTop: 3 }}>{visible ? s.detail : ''}</div>
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
    <>
    <div className="lp-hero">
      <div className="lp-inner">
        <div className="lp-copy">
          <h1 className="lp-h1 fade-up-1">
            Prior authorizations,<br /><em>ready to review.</em>
          </h1>
          <p className="lp-sub fade-up-2">
            Tell MedBridge about the patient and the service. It checks the insurer's own rules, fills in the request, and shows you everything before anything is sent.
          </p>
          <div className="fade-up-3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="lp-primary" onClick={onStart}>Start a request <Icon name="arrow-right" size={18} /></button>
            <button className="lp-secondary" onClick={onChat}>Ask a coverage question</button>
          </div>
          <div className="lp-steps fade-up-4">
            {[['1', 'Enter the request'], ['2', "We check the insurer's policy"], ['3', 'You review and approve']].map(([n, t]) => (
              <div key={n} className="lp-step"><span>{n}</span>{t}</div>
            ))}
          </div>
          <p className="lp-note fade-up-4">Runs on your choice of model: Groq, Claude, or Claude on Amazon Bedrock.</p>
        </div>
        <div className="lp-demo-wrap fade-up-2"><AgentDemo /></div>
      </div>
    </div>

    <section style={S.section} aria-labelledby="why-h">
      <h2 id="why-h" className="serif" style={S.h2}>Prior authorization is slow, and denials are rarely fought</h2>
      <div style={S.statGrid}>
        {STATS.map(x => (
          <div key={x.n} className="lp-card lp-stat">
            <div className="serif lp-statnum">{x.n}</div>
            <div style={S.statTxt}>{x.t}</div>
            <div style={S.statSrc}>{x.s}</div>
          </div>
        ))}
      </div>
    </section>

    <section style={{ ...S.section, paddingTop: 8 }} aria-labelledby="trust-h">
      <h2 id="trust-h" className="serif" style={S.h2}>Built to be trusted</h2>
      <div style={S.trustGrid}>
        {TRUST.map(x => (
          <div key={x.title} className="lp-card lp-trust">
            <span style={S.badge}><Icon name={x.icon} size={22} /></span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#18181b' }}>{x.title}</div>
              <div style={{ color: '#52525b', fontSize: 15, lineHeight: 1.55, marginTop: 4 }}>{x.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section style={{ ...S.section, paddingTop: 0 }} aria-label="Get started">
      <div className="lp-cta">
        <h2 className="serif">See it on a real policy.</h2>
        <p>Start with the demo patient and watch each step, then approve it yourself.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="lp-primary" onClick={onStart}>Start a request <Icon name="arrow-right" size={18} /></button>
          <button className="lp-secondary" onClick={onChat}>Ask a coverage question</button>
        </div>
      </div>
      <p style={{ textAlign: 'center', color: '#71717a', fontSize: 13.5, margin: '24px 0 0' }}>
        Research prototype. Do not use with real patient data.
      </p>
    </section>
    </>
  );
}

const S = {
  section: { maxWidth: 1120, margin: '0 auto', padding: '56px 28px' },
  h2: { fontSize: 'clamp(26px,3.2vw,36px)', fontWeight: 700, color: '#18181b', margin: '0 0 28px', lineHeight: 1.15, textAlign: 'center' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 },
  statTxt: { fontSize: 16, color: '#3f3f46', lineHeight: 1.5, margin: '12px 0 14px' },
  statSrc: { display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#52525b', background: '#f5f5f4', borderRadius: 100, padding: '3px 10px' },
  trustGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', gap: 18 },
  badge: { width: 46, height: 46, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ccfbf1', color: '#0f766e' },
  demo: { borderRadius: 22, background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(255,255,255,0.6)',
    boxShadow: '0 30px 80px rgba(24,24,27,0.12), 0 2px 6px rgba(24,24,27,0.04)', overflow: 'hidden' },
  demoBar: { display: 'flex', alignItems: 'center', gap: 6, padding: '13px 18px', borderBottom: '1px solid #f0eeec', background: '#fafaf9' },
  dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  spinner: { width: 16, height: 16, borderRadius: '50%', border: '2px solid #ccfbf1', borderTopColor: '#0d9488', animation: 'spin .8s linear infinite' },
};
