import { useState, useEffect } from 'react';

function useElapsed(startTime) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500);
    return () => clearInterval(t);
  }, [startTime]);
  return elapsed;
}

function MockPortalPanel({ step, insuranceProvider }) {
  if (!step || (step.status !== 'running' && step.status !== 'done')) return null;
  const providerColors = {
    'Aetna': '#7B2D8B', 'Blue Cross Blue Shield': '#003087', 'United Healthcare': '#002677',
    'Cigna': '#006FC0', 'Humana': '#00833E', 'Medicare': '#1F4E79', 'Medicaid': '#2E7D32',
  };
  const color = providerColors[insuranceProvider] || '#2a2a33';
  const isRunning = step.status === 'running';

  return (
    <div style={{
      marginTop: '12px',
      border: `1px solid ${color}30`,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: `0 4px 16px ${color}15`,
      animation: 'fadeUp 0.4s ease both',
    }}>
      {/* Portal header bar */}
      <div style={{
        background: color,
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => (
            <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
          ))}
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', flex: 1, textAlign: 'center' }}>
          {insuranceProvider} Provider Portal — EDI 278 Submission (simulated)
        </span>
      </div>

      {/* Portal body */}
      <div style={{ background: '#fafaf9', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isRunning ? '#f59e0b' : '#22c55e',
            boxShadow: isRunning ? '0 0 6px rgba(245,158,11,0.8)' : '0 0 6px rgba(34,197,94,0.8)',
            animation: isRunning ? 'pulse 1s infinite' : 'none',
          }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: isRunning ? '#92400e' : '#15803d' }}>
            {isRunning ? 'TRANSMITTING — EDI 278 in progress…' : 'RECEIVED — Authorization request accepted'}
          </span>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#52525b', lineHeight: 1.8 }}>
          <div style={{ color: '#71717a' }}>ISA*00* *00* *ZZ*MEDBRIDGE *ZZ*{(insuranceProvider || '').slice(0,8).toUpperCase().padEnd(8)} *{new Date().toISOString().slice(0,10).replace(/-/g,'')}*</div>
          <div>GS*HB*MEDBRIDGE*{(insuranceProvider || '').slice(0,6).toUpperCase()}*{Date.now()}*1*X*005010X279A1</div>
          <div style={{ color: step.status === 'done' ? '#15803d' : '#71717a' }}>
            {step.status === 'done' ? `✓ TA1 ACK — ${step.data?.confirmation_number || 'CONF-ACCEPTED'} — IK5*A~` : '⏳ Awaiting TA1 acknowledgement…'}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataChip({ label, value }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: '#fafaf9', border: '1px solid #e7e5e4',
      borderRadius: '8px', padding: '4px 11px', fontSize: '11px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <span style={{ color: '#71717a', fontWeight: '500' }}>{label}:</span>
      <span style={{ color: '#18181b', fontWeight: '800' }}>
        {typeof value === 'number' && value > 0 && value < 1
          ? `${Math.round(value * 100)}%`
          : String(value)}
      </span>
    </div>
  );
}

function StepRow({ stepName, step, index, isLast, verticalColor, isDenied, insuranceProvider }) {
  const status = step?.status || 'pending';
  const isDenialStep = step?.data?.current_status === 'DENIED';
  const isAppealStep = stepName.toLowerCase().includes('appeal');

  const stepColors = ['#0891b2', '#0d9488', '#f59e0b', '#22c55e', '#0891b2', '#ef4444'];
  const color = isAppealStep ? '#f59e0b' : isDenialStep ? '#ef4444' : stepColors[index % stepColors.length];
  const gradient = `linear-gradient(135deg, ${color}, ${color}cc)`;

  const cardBg = isDenialStep
    ? { bg: '#fef2f2', border: '#fca5a5', shadow: '0 2px 8px rgba(239,68,68,0.15)' }
    : isAppealStep && status === 'done'
      ? { bg: '#fffbeb', border: '#fde68a', shadow: '0 2px 8px rgba(245,158,11,0.15)' }
      : {
          pending: { bg: 'white',   border: '#ece9e6',  shadow: '0 1px 4px rgba(0,0,0,0.04)' },
          running: { bg: '#fbfaf9', border: color,       shadow: `0 0 0 3px ${color}18, 0 6px 20px rgba(0,0,0,0.07)` },
          done:    { bg: '#f0fdf4', border: '#86efac',   shadow: '0 2px 8px rgba(34,197,94,0.1)' },
          error:   { bg: '#fef2f2', border: '#fca5a5',   shadow: '0 2px 8px rgba(239,68,68,0.1)' },
        }[status] || { bg: 'white', border: '#ece9e6', shadow: '0 1px 4px rgba(0,0,0,0.04)' };

  const statusColor = isDenialStep ? '#ef4444'
    : { pending: '#71717a', running: color, done: '#166534', error: '#ef4444' }[status];

  const stepIcons = ['🔍', '📋', '📝', '📤', '📡', '⚡'];
  const icon = isAppealStep ? '⚡' : stepIcons[index % stepIcons.length];

  const isSubmitStep = stepName.toLowerCase().includes('submit') || stepName.toLowerCase().includes('payer');

  return (
    <div style={{
      display: 'flex', gap: '18px', alignItems: 'flex-start',
      animation: step ? 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both' : undefined,
    }}>
      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px', flexShrink: 0 }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: status === 'pending' ? '#f5f5f4'
            : isDenialStep ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : status === 'done' && !isAppealStep ? 'linear-gradient(135deg, #22c55e, #16a34a)'
            : status === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px',
          boxShadow: status === 'running' ? `0 0 0 4px ${color}25, 0 4px 12px ${color}30`
            : status === 'done' && !isDenialStep ? '0 4px 12px rgba(34,197,94,0.35)'
            : '0 2px 6px rgba(0,0,0,0.08)',
          animation: status === 'running' ? 'pulseRing 2s infinite' : undefined,
          transition: 'all 0.4s', position: 'relative', overflow: 'hidden',
        }}>
          {status === 'running' && <div className="shimmer-overlay" />}
          <span style={{ position: 'relative', zIndex: 1, filter: status !== 'pending' ? 'brightness(0) invert(1)' : 'none' }}>
            {isDenialStep ? '✕' : status === 'done' && !isAppealStep ? '✓' : status === 'error' ? '✕' : icon}
          </span>
        </div>
        {!isLast && (
          <div style={{
            width: '2px', flexGrow: 1, minHeight: '22px', marginTop: '6px',
            background: status === 'done' && !isDenialStep
              ? 'linear-gradient(to bottom, #22c55e, #86efac44)'
              : isDenialStep
                ? 'linear-gradient(to bottom, #ef4444, #fca5a544)'
                : 'linear-gradient(to bottom, #e7e5e4, transparent)',
            transition: 'background 0.5s', borderRadius: '2px',
          }} />
        )}
      </div>

      {/* Card */}
      <div style={{
        flex: 1, background: cardBg.bg, border: `1.5px solid ${cardBg.border}`,
        borderRadius: '16px', padding: '16px 20px',
        marginBottom: isLast ? '0' : '12px', transition: 'all 0.3s', boxShadow: cardBg.shadow,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: '#18181b' }}>{stepName}</span>
          <div style={{
            fontSize: '10px', fontWeight: '800', letterSpacing: '0.8px',
            color: isDenialStep ? '#ef4444' : statusColor,
            background: `${isDenialStep ? '#ef4444' : statusColor}14`,
            border: `1px solid ${isDenialStep ? '#ef4444' : statusColor}30`,
            padding: '3px 11px', borderRadius: '100px',
            display: 'flex', alignItems: 'center', gap: '5px', textTransform: 'uppercase',
          }}>
            {status === 'running' && (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor, display: 'inline-block', animation: 'pulse 1s infinite' }} />
            )}
            {isDenialStep ? '⚠ Denied' : status === 'done' ? 'Done' : status === 'running' ? 'Running' : status === 'error' ? 'Error' : 'Queued'}
          </div>
        </div>

        {step?.message && (
          <p style={{ margin: step?.data ? '0 0 10px' : 0, fontSize: '13px', fontWeight: '600', color: isDenialStep ? '#dc2626' : statusColor }}>
            {step.message}
          </p>
        )}

        {step?.data && Object.keys(step.data).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {Object.entries(step.data)
              .filter(([k]) => !['notes', 'appeal_letter_preview', 'supporting_evidence_attached', 'next_step'].includes(k))
              .slice(0, 5)
              .map(([k, v]) => (
                <DataChip key={k}
                  label={k === 'completeness_score' ? 'Completeness' : k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  value={k === 'completeness_score' && typeof v === 'number' ? `${Math.round(v * 100)}%` : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}
                />
              ))}
          </div>
        )}

        {/* Appeal letter preview */}
        {isAppealStep && step?.data?.appeal_letter_preview && step.status === 'done' && (
          <div style={{
            marginTop: '12px', background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: '10px', padding: '12px 14px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#92400e', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
              📄 Appeal Letter Preview
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#78350f', lineHeight: 1.7, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {step.data.appeal_letter_preview}
            </p>
            {step.data.supporting_evidence_attached && (
              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {step.data.supporting_evidence_attached.map(e => (
                  <span key={e} style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '6px', padding: '2px 8px', fontWeight: '600' }}>
                    📎 {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mock payer portal */}
        {isSubmitStep && (
          <MockPortalPanel step={step} insuranceProvider={insuranceProvider} />
        )}
      </div>
    </div>
  );
}

export default function AgentProgress({ steps, status, workflowId, vertical, startTime }) {
  const elapsed = useElapsed(startTime);

  const stepMap = {};
  steps.forEach(s => {
    if (!stepMap[s.tool_name] || s.status === 'done') stepMap[s.tool_name] = s;
  });

  const allStepNames = steps.length > 0 ? [...new Set(steps.map(s => s.tool_name))] : [];
  const expectedSteps = allStepNames.length > 0 ? allStepNames : Array(5).fill(null).map((_, i) => `Step ${i + 1}`);

  const doneCount = Object.values(stepMap).filter(s => s.status === 'done').length;
  const totalSteps = Math.max(expectedSteps.length, 5);
  const progress = Math.round((doneCount / totalSteps) * 100);
  const isComplete = ['submitted', 'approved', 'denied', 'needs_info', 'rejected'].includes(status);
  const failed = status === 'needs_info' || status === 'rejected';
  const hasDenial = steps.some(s => s.data?.current_status === 'DENIED');
  const hasAppeal = steps.some(s => s.tool_name?.toLowerCase().includes('appeal') && s.status === 'done');
  const verticalColor = vertical?.color || '#0d9488';

  const insuranceProvider = vertical?.id === 'healthcare'
    ? steps.find(s => s.data?.payer_portal)?.data?.payer_portal?.split(' ')[0] || 'Aetna'
    : null;

  const formatTime = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>

      {/* Denial detected banner */}
      {hasDenial && !hasAppeal && (
        <div className="fade-up" style={{
          background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
          border: '1.5px solid #fca5a5',
          borderRadius: '16px', padding: '14px 20px',
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 4px 16px rgba(239,68,68,0.12)',
          animation: 'fadeUp 0.5s ease both',
        }}>
          <span style={{ fontSize: '22px' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: '800', color: '#dc2626', fontSize: '14px' }}>Denial Detected — Drafting Appeal Automatically</div>
            <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px' }}>MedBridge is generating a clinical appeal with supporting evidence…</div>
          </div>
          <div style={{ marginLeft: 'auto', width: '20px', height: '20px', border: '2.5px solid #ef4444', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        </div>
      )}

      {hasAppeal && (
        <div className="fade-up" style={{
          background: 'linear-gradient(135deg, #fffbeb, #fef9c3)',
          border: '1.5px solid #fde68a',
          borderRadius: '16px', padding: '14px 20px',
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 4px 16px rgba(245,158,11,0.15)',
        }}>
          <span style={{ fontSize: '22px' }}>⚡</span>
          <div>
            <div style={{ fontWeight: '800', color: '#92400e', fontSize: '14px' }}>Appeal Drafted — Ready for Physician Co-signature</div>
            <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>Clinical evidence attached · Will auto-submit within 24h after physician co-signature</div>
          </div>
          <div style={{ marginLeft: 'auto', background: '#f59e0b', color: 'white', fontSize: '11px', fontWeight: '800', padding: '5px 12px', borderRadius: '100px' }}>APPEAL READY</div>
        </div>
      )}

      {/* Progress header */}
      <div className="fade-up card" style={{ padding: '28px 32px', marginBottom: '28px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>

        {isComplete && (
          <div style={{ position: 'absolute', inset: 0, background: hasDenial && hasAppeal ? 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.07), transparent 70%)' : 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.07), transparent 70%)', pointerEvents: 'none' }} />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              {isComplete ? (
                <span className="pop-in" aria-hidden="true" style={{ fontSize: '26px' }}>{failed ? '⚠️' : hasDenial && hasAppeal ? '⚡' : '✅'}</span>
              ) : (
                status === 'awaiting_approval'
                  ? <span aria-hidden="true" style={{ fontSize: '24px' }}>✋</span>
                  : <div style={{
                  width: '24px', height: '24px',
                  border: `3px solid ${verticalColor}`,
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.75s linear infinite',
                  flexShrink: 0,
                  boxShadow: `0 0 10px ${verticalColor}50`,
                }} />
              )}
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#18181b', letterSpacing: '-0.4px' }}>
                {isComplete
                  ? failed ? (status === 'rejected' ? 'Not submitted' : 'Stopped before finishing') : hasDenial && hasAppeal ? 'Denied — Appeal Filed Automatically' : 'Workflow complete'
                  : hasDenial ? 'Denial Detected — Drafting Appeal…' : status === 'awaiting_approval' ? 'Waiting for your approval' : 'AI Agent Processing…'}
              </h2>
            </div>
            <p style={{ margin: 0, color: '#71717a', fontSize: '13px', fontWeight: '500' }}>
              ID: {workflowId?.slice(0, 8).toUpperCase()} · {doneCount} of {totalSteps} steps complete
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '40px', fontWeight: '900', lineHeight: 1,
              background: isComplete && hasDenial
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : isComplete
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : `linear-gradient(135deg, ${verticalColor}, #0d9488)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              transition: 'all 0.4s', letterSpacing: '-2px',
            }}>
              {progress}%
            </div>
            {startTime && (
              <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px', fontWeight: '600', fontFamily: 'monospace' }}>
                ⏱ {formatTime(elapsed)}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ height: '10px', background: '#f5f5f4', borderRadius: '100px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: isComplete && hasDenial
                ? 'linear-gradient(90deg, #ef4444, #f59e0b)'
                : isComplete
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : `linear-gradient(90deg, ${verticalColor}, #0d9488, #0891b2)`,
              borderRadius: '100px',
              transition: 'width 0.7s cubic-bezier(0.34,1.3,0.64,1)',
              position: 'relative', overflow: 'hidden',
              boxShadow: isComplete ? '0 2px 8px rgba(34,197,94,0.4)' : `0 2px 8px ${verticalColor}60`,
            }}>
              {!isComplete && <div className="shimmer-overlay" />}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', padding: '0 2px' }}>
            {Array(totalSteps).fill(null).map((_, i) => {
              const name = expectedSteps[i];
              const s = name ? stepMap[name] : null;
              const done = s?.status === 'done';
              const running = s?.status === 'running';
              return (
                <div key={i} title={name || `Step ${i + 1}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: done ? '#22c55e' : running ? verticalColor : '#e7e5e4',
                    transition: 'all 0.35s',
                    boxShadow: running ? `0 0 0 3px ${verticalColor}30` : done ? '0 0 0 2px rgba(34,197,94,0.2)' : 'none',
                    transform: running ? 'scale(1.3)' : 'scale(1)',
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div>
        {expectedSteps.map((name, i) => (
          <StepRow
            key={name}
            stepName={name}
            step={stepMap[name]}
            index={i}
            isLast={i === expectedSteps.length - 1}
            verticalColor={verticalColor}
            isDenied={hasDenial}
            insuranceProvider={insuranceProvider}
          />
        ))}
      </div>

    </div>
  );
}
