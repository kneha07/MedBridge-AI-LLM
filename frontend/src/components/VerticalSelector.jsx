export default function VerticalSelector({ verticals, onSelect }) {
  const healthcare = verticals.find(v => v.id === 'healthcare');
  const others = verticals.filter(v => v.id !== 'healthcare');

  return (
    <div style={{ minHeight: 'calc(100vh - 66px)', display: 'flex', flexDirection: 'column' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(150deg, #060e1a 0%, #0a1628 35%, #0f2240 70%, #0a1f38 100%)',
        padding: '80px 24px 100px',
        textAlign: 'center', color: 'white',
        position: 'relative', overflow: 'hidden', flex: '0 0 auto',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div style={{ position: 'absolute', top: '5%',  left: '8%',  width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.07), transparent 70%)' }} />
        <div style={{ position: 'absolute', top: '-5%', right: '5%', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.09), transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-5%', left: '45%', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.07), transparent 70%)' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '720px', margin: '0 auto' }}>
          {/* Badge */}
          <div className="fade-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            padding: '7px 18px', borderRadius: '100px', marginBottom: '28px',
            boxShadow: '0 0 20px rgba(34,197,94,0.15)',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.8)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#22c55e', letterSpacing: '1.3px', textTransform: 'uppercase' }}>
              AI Agent · Research Prototype
            </span>
          </div>

          {/* Headline */}
          <h1 className="fade-up-1" style={{
            margin: '0 0 20px',
            fontSize: 'clamp(38px, 5vw, 60px)',
            fontWeight: '900', lineHeight: 1.05,
            letterSpacing: '-2.5px', color: 'white',
          }}>
            The Agent Layer for{' '}
            <span style={{
              background: 'linear-gradient(135deg, #22c55e, #60a5fa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Healthcare Admin</span>
          </h1>

          <p className="fade-up-2" style={{
            margin: '0 auto 20px', maxWidth: '540px',
            fontSize: '17px', color: '#7dd3fc',
            lineHeight: 1.65, fontWeight: '400',
          }}>
            MedBridge sits on top of your existing EHR and payer systems — operating them autonomously so your staff doesn't have to.
          </p>

          {/* Real stat */}
          <div className="fade-up-2" style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            padding: '10px 22px', borderRadius: '14px', marginBottom: '40px',
          }}>
            <span style={{ fontSize: '18px' }}>📊</span>
            <span style={{ fontSize: '13px', color: '#fca5a5', lineHeight: 1.5 }}>
              Prior authorization is still{' '}
              <strong style={{ color: '#f87171' }}>manual and slow</strong>
              {' '}— this agent drafts it, a human approves it
            </span>
          </div>

          {/* Value props */}
          <div className="fade-up-3" style={{
            display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '20px', maxWidth: '640px', margin: '0 auto',
            overflow: 'hidden', backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>
            {[
              { icon: '⚡', label: 'Minutes, not days',   color: '#22c55e' },
              { icon: '🔗', label: 'Cited payer policies', color: '#60a5fa' },
              { icon: '🔒', label: 'Human review step', color: '#f59e0b' },
              { icon: '⚖️',  label: 'Auto-appeal denials', color: '#a78bfa' },
            ].map(({ icon, label, color }, i, arr) => (
              <div key={label} style={{
                flex: '1 1 0', minWidth: '130px', padding: '20px 16px',
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', marginBottom: '7px' }}>{icon}</div>
                <div style={{ fontSize: '12px', color, fontWeight: '700' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{
        flex: 1, maxWidth: '1100px', margin: '-48px auto 0',
        padding: '0 24px 64px', position: 'relative', zIndex: 2, width: '100%',
      }}>
        <p className="fade-up" style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '24px', marginTop: '0' }}>
          Choose a workflow to automate
        </p>

        {/* Healthcare — hero card full width */}
        {healthcare && (
          <HeroCard vertical={healthcare} onSelect={onSelect} />
        )}

        {/* Skeletons if no verticals yet */}
        {verticals.length === 0 && (
          <div style={{ height: '300px', borderRadius: '24px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', animation: 'pulse 1.5s infinite' }} />
        )}

        {/* Coming soon — healthcare workflows */}
        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {[
            { icon: '🔄', name: 'Step Therapy Exceptions', desc: 'Automate step therapy override requests when first-line treatment fails' },
            { icon: '📋', name: 'Specialist Referrals',    desc: 'Streamline referral submissions and insurance approvals end-to-end' },
            { icon: '💊', name: 'Medication Appeals',      desc: 'Dispute formulary denials and non-covered drug decisions automatically' },
          ].map(v => (
            <div key={v.name} className="card fade-up" style={{
              padding: '28px 32px', borderRadius: '24px',
              opacity: 0.55, cursor: 'default', borderStyle: 'dashed',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '14px' }}>{v.icon}</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', marginBottom: '6px' }}>{v.name}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.55 }}>{v.desc}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '5px 12px', borderRadius: '100px' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Coming Soon</span>
              </div>
            </div>
          ))}
        </div>

        {/* Integration logos */}
        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#cbd5e1', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '16px' }}>
            Production integration targets (simulated in this prototype)
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {['Aetna NaviNet', 'BCBS Availity', 'Epic EHR', 'UHC Portal', 'CoverMyMeds', 'Waystar'].map(name => (
              <div key={name} style={{
                background: 'white', border: '1px solid #e2e8f0',
                borderRadius: '10px', padding: '8px 16px',
                fontSize: '12px', fontWeight: '700', color: '#475569',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                🔗 {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroCard({ vertical, onSelect }) {
  const palette = { light: '#f0fdf4', border: '#86efac', glow: 'rgba(34,197,94,0.18)' };

  return (
    <button
      onClick={() => onSelect(vertical)}
      className="card fade-up"
      style={{
        display: 'block', width: '100%', borderRadius: '24px', textAlign: 'left',
        cursor: 'pointer', border: '1.5px solid #86efac',
        background: 'white', padding: '0', overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '0 8px 32px rgba(34,197,94,0.12)',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 20px 56px ${palette.glow}, 0 4px 16px rgba(0,0,0,0.06)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(34,197,94,0.12)';
      }}
      aria-label={`Select ${vertical.name} workflow`}
    >
      {/* Top accent */}
      <div style={{ height: '4px', background: `linear-gradient(90deg, ${vertical.color}, ${vertical.color}88)` }} />

      <div style={{ padding: '32px 36px', display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left */}
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '18px',
              background: palette.light, border: `1.5px solid ${palette.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', boxShadow: `0 4px 16px ${palette.glow}`,
            }}>{vertical.icon}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.4px' }}>{vertical.name}</span>
                <span style={{
                  fontSize: '10px', fontWeight: '800', color: '#16a34a',
                  background: '#dcfce7', border: '1px solid #86efac',
                  padding: '3px 10px', borderRadius: '100px', letterSpacing: '0.8px', textTransform: 'uppercase',
                }}>⭐ Most Popular</span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>{vertical.description}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {['Scans payer policy', 'Analyzes medical records', 'Auto-fills PA form', 'Simulated EDI 278 submission', 'Detects & appeals denials'].map(f => (
              <span key={f} style={{
                fontSize: '12px', background: '#f0fdf4', color: '#15803d',
                border: '1px solid #bbf7d0', borderRadius: '8px', padding: '4px 12px', fontWeight: '600',
              }}>✓ {f}</span>
            ))}
          </div>
        </div>

        {/* Right — stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '0 0 auto', minWidth: '200px' }}>
          {[
            { label: 'With MedBridge', value: 'Minutes', sub: 'fully automated end-to-end', color: '#22c55e' },
            { label: 'Denial auto-appeal', value: 'Automatic', sub: 'clinical evidence included', color: '#8b5cf6' },
            { label: 'Payer integrations', value: 'EDI 278', sub: 'Aetna, BCBS, UHC, Cigna', color: '#3b82f6' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{
              background: '#f8fafc', borderRadius: '12px', padding: '12px 16px',
              border: '1px solid #e8edf3',
            }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color, marginBottom: '2px' }}>{value}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{sub}</div>
            </div>
          ))}

          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: vertical.color, color: 'white',
            padding: '12px 24px', borderRadius: '12px',
            fontSize: '14px', fontWeight: '800',
            boxShadow: `0 4px 16px ${palette.glow}`,
          }}>
            Launch Workflow →
          </div>
        </div>
      </div>
    </button>
  );
}

function VerticalCard({ vertical, onSelect, delay }) {
  const colorMap = {
    '#22c55e': { light: '#f0fdf4', border: '#86efac', glow: 'rgba(34,197,94,0.15)' },
    '#8b5cf6': { light: '#f5f3ff', border: '#c4b5fd', glow: 'rgba(139,92,246,0.15)' },
    '#f59e0b': { light: '#fffbeb', border: '#fde68a', glow: 'rgba(245,158,11,0.15)' },
    '#3b82f6': { light: '#eff6ff', border: '#bfdbfe', glow: 'rgba(59,130,246,0.15)' },
  };
  const palette = colorMap[vertical.color] || colorMap['#3b82f6'];

  return (
    <button
      onClick={() => onSelect(vertical)}
      className="card fade-up"
      style={{
        padding: '32px', borderRadius: '24px', textAlign: 'left',
        cursor: 'pointer', border: '1px solid #e8edf3',
        background: 'white', width: '100%',
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
        animationDelay: `${delay}s`, position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = vertical.color + '60';
        e.currentTarget.style.boxShadow = `0 16px 48px ${palette.glow}, 0 4px 16px rgba(0,0,0,0.06)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = '#e8edf3';
        e.currentTarget.style.boxShadow = 'var(--card-shadow)';
      }}
      aria-label={`Select ${vertical.name} workflow`}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${vertical.color}, ${vertical.color}88)`, borderRadius: '24px 24px 0 0' }} />
      <div style={{
        width: '56px', height: '56px', borderRadius: '16px',
        background: palette.light, border: `1.5px solid ${palette.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '26px', marginBottom: '18px', boxShadow: `0 4px 12px ${palette.glow}`,
      }}>{vertical.icon}</div>
      <div style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.3px' }}>{vertical.name}</div>
      <div style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>{vertical.description}</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        background: palette.light, border: `1.5px solid ${palette.border}`,
        color: vertical.color, padding: '8px 18px', borderRadius: '100px',
        fontSize: '13px', fontWeight: '700', boxShadow: `0 2px 8px ${palette.glow}`,
      }}>Start Workflow →</div>
    </button>
  );
}
