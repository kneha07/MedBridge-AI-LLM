export default function ResultCard({ workflowData, vertical, onStartNew }) {
  const steps = workflowData?.steps || [];
  const stepMap = {};
  steps.forEach(s => { if (!stepMap[s.tool_name] || s.status === 'done') stepMap[s.tool_name] = s; });

  const result = workflowData?.result || '';
  const isError = result.startsWith('Error');
  const paragraphs = result.split('\n').filter(p => p.trim());
  const aiProvider = workflowData?.ai_provider || 'groq';
  const formData = workflowData?.form_data || {};

  const primaryName = formData.patient_name || formData.client_name || formData.applicant_name || 'N/A';
  const doneSteps = steps.filter(s => s.status === 'done');
  const confirmationData = doneSteps.find(s => s.data?.confirmation_number)?.data;
  const denialStep = doneSteps.find(s => s.data?.current_status === 'DENIED');
  const appealStep = doneSteps.find(s => s.data?.appeal_id);
  const isDenied = !!denialStep;
  const hasAppeal = !!appealStep;
  const completedStepNames = [...new Set(doneSteps.map(s => s.tool_name))];
  const verticalColor = vertical?.color || '#22c55e';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px 56px' }}>

      {/* ── Denial + Appeal banner (when applicable) ── */}
      {isDenied && hasAppeal && (
        <div className="pop-in" style={{ marginBottom: '16px' }}>
          {/* Denial */}
          <div style={{
            background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
            borderRadius: '20px 20px 0 0', padding: '20px 28px',
            display: 'flex', alignItems: 'center', gap: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{ fontSize: '28px' }}>⚠️</span>
            <div>
              <div style={{ color: 'white', fontWeight: '900', fontSize: '16px', marginBottom: '3px' }}>Authorization Denied</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
                {denialStep?.data?.denial_reason || 'Denial code CO-50 — Not medically necessary'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '6px 14px', fontSize: '11px', fontWeight: '800', color: 'white', letterSpacing: '0.8px' }}>
              DENIED
            </div>
          </div>

          {/* Arrow connector */}
          <div style={{ textAlign: 'center', background: '#18181b', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: '12px', color: '#5eead4', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>⚡ MedBridge Auto-Appeal Triggered</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Appeal success */}
          <div style={{
            background: 'linear-gradient(135deg, #78350f, #92400e)',
            borderRadius: '0 0 20px 20px', padding: '20px 28px',
            display: 'flex', alignItems: 'center', gap: '16px',
            boxShadow: '0 16px 48px rgba(245,158,11,0.3)',
          }}>
            <span style={{ fontSize: '28px' }}>⚡</span>
            <div>
              <div style={{ color: '#fef3c7', fontWeight: '900', fontSize: '16px', marginBottom: '3px' }}>Appeal Drafted — Awaiting Physician Co-signature</div>
              <div style={{ color: 'rgba(254,243,199,0.7)', fontSize: '13px' }}>
                {appealStep?.data?.appeal_id} · Clinical evidence attached · Auto-submits within 24h after co-signature
              </div>
            </div>
            <div style={{ marginLeft: 'auto', background: '#f59e0b', borderRadius: '10px', padding: '6px 14px', fontSize: '11px', fontWeight: '800', color: 'white', letterSpacing: '0.8px' }}>
              APPEAL READY
            </div>
          </div>
        </div>
      )}

      {/* ── Standard success banner ── */}
      {!isDenied && (
        <div className="pop-in" style={{
          borderRadius: '24px', overflow: 'hidden', marginBottom: '24px',
          background: 'linear-gradient(135deg, #15803d 0%, #16a34a 40%, #14532d 100%)',
          boxShadow: '0 16px 48px rgba(22,163,74,0.4), 0 4px 16px rgba(22,163,74,0.2)',
          position: 'relative',
        }}>
          {[
            { size: 220, top: -70, right: -50, opacity: 0.1 },
            { size: 120, bottom: -50, right: 100, opacity: 0.07 },
          ].map((c, i) => (
            <div key={i} style={{
              position: 'absolute', borderRadius: '50%',
              width: c.size, height: c.size,
              background: 'radial-gradient(circle, white, transparent 70%)',
              top: c.top, bottom: c.bottom, right: c.right, opacity: c.opacity,
            }} />
          ))}
          <div style={{ position: 'relative', zIndex: 1, padding: '32px 36px', display: 'flex', alignItems: 'center', gap: '22px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '20px',
              background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            }}>{vertical?.icon || '✅'}</div>
            <div>
              <h2 style={{ fontFamily: "'Source Serif 4', Georgia, serif", margin: '0 0 7px', color: 'white', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.4px' }}>
                {vertical?.name || 'Workflow'} Complete
              </h2>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '14px', lineHeight: 1.5 }}>
                Approved by a reviewer and submitted. The payer's response is simulated in this prototype.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation number ── */}
      {confirmationData?.confirmation_number && (
        <div className="fade-up card" style={{ padding: '24px 28px', marginBottom: '16px', borderRadius: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 0% 50%, ${verticalColor}08, transparent 60%)`, pointerEvents: 'none' }} />
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#71717a', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '10px' }}>
            📋 Confirmation Number
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '28px', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '1.5px', color: '#18181b' }}>
              {confirmationData.confirmation_number}
            </span>
            <span style={{
              fontSize: '11px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
              color: '#92400e', border: '1.5px solid #fcd34d',
              padding: '5px 14px', borderRadius: '100px', fontWeight: '800',
              boxShadow: '0 2px 8px rgba(34,197,94,0.15)',
            }}>Simulated</span>
          </div>
        </div>
      )}

      {/* ── Appeal letter (when denied) ── */}
      {hasAppeal && appealStep?.data?.appeal_letter_preview && (
        <div className="fade-up" style={{
          background: 'linear-gradient(135deg, #fffbeb, #fef9c3)',
          border: '1.5px solid #fde68a', borderRadius: '20px',
          padding: '24px 28px', marginBottom: '16px',
          boxShadow: '0 8px 24px rgba(245,158,11,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #fde68a' }}>
            <span style={{ fontSize: '20px' }}>📄</span>
            <div>
              <div style={{ fontWeight: '800', color: '#92400e', fontSize: '14px' }}>Auto-Generated Appeal Letter</div>
              <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>Ready for physician review · {appealStep.data.appeal_id}</div>
            </div>
          </div>
          <div style={{
            background: 'white', border: '1px solid #fde68a', borderRadius: '12px',
            padding: '16px', fontFamily: 'monospace', fontSize: '12px',
            color: '#78350f', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: '12px',
          }}>
            {appealStep.data.appeal_letter_preview}
          </div>
          {appealStep.data.supporting_evidence_attached && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#92400e', fontWeight: '600', marginRight: '4px' }}>Attached:</span>
              {appealStep.data.supporting_evidence_attached.map(e => (
                <span key={e} style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '6px', padding: '3px 10px', fontWeight: '600' }}>
                  📎 {e}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Detail grid ── */}
      <div className="result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        {[
          { label: 'Patient / Client', value: primaryName, icon: '👤', color: '#0891b2', sub: workflowData?.vertical_id },
          { label: 'Status', value: isDenied && hasAppeal ? 'Appeal Filed' : workflowData?.status === 'submitted' ? 'Submitted' : 'Complete', icon: isDenied ? '⚡' : '🟢', color: isDenied ? '#f59e0b' : '#22c55e', sub: isDenied ? 'Awaiting appeal decision' : 'Active monitoring' },
        ].map(({ label, value, icon, color, sub }) => (
          <div key={label} className="fade-up" style={{
            background: 'white', borderRadius: '16px', padding: '20px 22px',
            border: '1px solid #ece9e6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'default',
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>{icon}</div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#71717a', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{label}</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#18181b', marginBottom: sub ? '4px' : 0 }}>{value}</div>
            {sub && <div style={{ fontSize: '11px', color: '#71717a', fontWeight: '500', textTransform: 'capitalize' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── AI Summary ── */}
      {result && (
        <div className="fade-up-2 card" style={{ padding: '24px 26px', marginBottom: '16px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f5f5f4' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: aiProvider === 'groq' ? 'linear-gradient(135deg, #ea580c, #c2410c)' : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0,
              boxShadow: aiProvider === 'groq' ? '0 4px 12px rgba(234,88,12,0.35)' : '0 4px 12px rgba(124,58,237,0.35)',
            }}>🤖</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#18181b' }}>MedBridge AI Summary</div>
              <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
                Written by the AI agent from its tool results
              </div>
            </div>
          </div>
          <div style={{
            fontSize: '14px', lineHeight: '1.75', color: isError ? '#dc2626' : '#374151',
            background: isError ? '#fef2f2' : 'transparent',
            padding: isError ? '12px 16px' : '0',
            borderRadius: isError ? '10px' : '0',
            border: isError ? '1px solid #fca5a5' : 'none',
          }}>
            {paragraphs.map((p, i) => (
              <p key={i} style={{ margin: i < paragraphs.length - 1 ? '0 0 12px' : 0 }}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── What MedBridge handled ── */}
      {completedStepNames.length > 0 && (
        <div className="fade-up-3" style={{
          borderRadius: '20px', marginBottom: '20px',
          background: 'linear-gradient(135deg, #0e0e12 0%, #2a2a33 60%, #1e3a8a 100%)',
          boxShadow: '0 12px 36px rgba(10,22,40,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
          position: 'relative', overflow: 'hidden', padding: '28px 32px', color: 'white',
        }}>
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${verticalColor}20, transparent 70%)` }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '11px', color: '#5eead4', marginBottom: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
              ✓ What MedBridge prepared
            </div>
            <div className="result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {completedStepNames.map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', color: name.toLowerCase().includes('appeal') ? '#f59e0b' : verticalColor }}>✓</span>
                  <span style={{ fontSize: '12px', color: '#d4d4d8', fontWeight: '500' }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <button
        onClick={onStartNew}
        aria-label="Start a new request"
        style={{
          width: '100%', padding: '16px',
          background: 'white', color: '#2a2a33',
          border: '2px solid #e7e5e4', borderRadius: '16px',
          fontSize: '15px', fontWeight: '800', cursor: 'pointer',
          transition: 'all 0.25s', letterSpacing: '0.1px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #0e0e12, #2a2a33)';
          e.currentTarget.style.color = 'white';
          e.currentTarget.style.borderColor = '#0e0e12';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(10,22,40,0.3)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'white';
          e.currentTarget.style.color = '#2a2a33';
          e.currentTarget.style.borderColor = '#e7e5e4';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
          e.currentTarget.style.transform = 'none';
        }}
      >
        <span style={{ fontSize: '16px' }}>+</span> Start another request
      </button>
    </div>
  );
}
