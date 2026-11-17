import { useState } from 'react';
import { ApprovalCard, AuditTrail } from './ReviewPanels';
import Icon from './Icon';

const STEP_ORDER = ['Scanning Insurance Policy', 'Analyzing Medical Records', 'Completing Authorization Form',
  'Submitting to Payer Portal', 'Tracking Authorization', 'Drafting Appeal Letter'];

const LABELS = {
  policy_sources: 'Policy sources', prior_auth_required: 'Prior authorization required', payer_portal: 'Payer portal',
  submission_method: 'Submission method', patient_found: 'Patient record found', source: 'Data source', age: 'Age',
  gender: 'Gender', requested_diagnosis_on_record: 'Requested diagnosis on record', form_id: 'Form ID',
  completeness_score: 'Form completeness', required_fields: 'Required fields', submission_id: 'Submission ID',
  confirmation_number: 'Confirmation number (simulated)', transmission: 'Payer response (simulated)',
  current_status: 'Status', real_time_tracking: 'Tracking', estimated_decision_date: 'Estimated decision date',
  next_action: 'Next action', alert_configured: 'Alerts', denial_reason: 'Denial reason', denial_code: 'Denial code',
  appeal_deadline: 'Appeal deadline', appeal_rights: 'Appeal rights', appeal_id: 'Appeal ID', status: 'Status',
  policy_citations: 'Policy cited',
};
const HIDE = new Set(['appeal_letter_preview', 'supporting_evidence_attached', 'next_step', 'notes', 'auto_appeal_available', 'policy_passages', 'fhir_bundle', 'fhir_claim_response']);

const label = (k) => LABELS[k] || k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const fmt = (k, v) => (k === 'completeness_score' && typeof v === 'number') ? `${Math.round(v * 100)}%`
  : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? v.join('; ') : String(v);

function StepIcon({ state }) {
  const base = { width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 };
  if (state === 'done') return <span aria-hidden="true" style={{ ...base, background: '#16a34a', color: 'white' }}><Icon name="check" size={16} strokeWidth={3} /></span>;
  if (state === 'running') return <span aria-hidden="true" style={{ ...base, border: '3px solid #bbf7d0', borderTopColor: '#16a34a', animation: 'spin .8s linear infinite' }} />;
  return <span aria-hidden="true" style={{ ...base, background: '#e7e5e4', color: '#52525b' }} />;
}

function Step({ name, step, stopped, first, last, refused = 0 }) {
  const state = step ? (step.status === 'done' ? 'done' : 'running') : 'waiting';
  const rows = step?.data ? Object.entries(step.data).filter(([k]) => !HIDE.has(k)) : [];
  const letter = step?.data?.appeal_letter_preview;
  const fhir = step?.data?.fhir_bundle || step?.data?.fhir_claim_response;
  const text = step ? step.message : stopped ? 'Not run' : 'Waiting';
  return (
    <li style={{ position: 'relative', display: 'flex', gap: 14, padding: '16px 0 ' + (last ? '16px' : '20px') }}>
      {!last && <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: first ? 44 : 44, bottom: -16, width: 2, borderRadius: 2, background: state === 'done' ? '#34d399' : '#e7e5e4', transition: 'background .4s' }} />}
      <StepIcon state={state} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: state === 'waiting' ? '#52525b' : '#18181b' }}>
            {name}
            {refused > 0 && <span className="guard-step-flag" title="The guard refused this step when the model called it too early">refused {refused > 1 ? `${refused}×` : 'once'} as too early</span>}
          </div>
          {state === 'done' && step.timestamp && (
            <time style={{ fontSize: 12.5, color: '#71717a', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{new Date(step.timestamp + 'Z').toLocaleTimeString()}</time>
          )}
        </div>
        <div style={{ fontSize: 14.5, color: state === 'done' ? '#166534' : '#52525b', marginTop: 2 }}>{text}</div>
        {letter && (
          <div style={{ marginTop: 12, padding: '14px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, fontSize: 14.5, lineHeight: 1.6, color: '#27272a', whiteSpace: 'pre-wrap' }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Draft appeal letter (needs physician review before it is sent)</strong>
            {letter}
            {step.data.supporting_evidence_attached && (
              <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>
                {step.data.supporting_evidence_attached.map(e => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
        {fhir && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0f766e' }}>
              {step.data.fhir_bundle ? 'FHIR request message' : 'FHIR response message'} (simulated, not sent)
            </summary>
            <pre tabIndex={0} aria-label="FHIR JSON" style={{ margin: '8px 0 0', padding: '12px 14px', background: '#18181b', color: '#e7e5e4', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, maxHeight: 320, overflow: 'auto' }}>
              {JSON.stringify(fhir, null, 2)}
            </pre>
          </details>
        )}
        {rows.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0f766e' }}>Details</summary>
            <dl className="kv-grid" style={{ margin: '8px 0 0', display: 'grid', gridTemplateColumns: 'minmax(150px, 220px) 1fr', gap: '6px 16px', fontSize: 14 }}>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt style={{ color: '#52525b' }}>{label(k)}</dt>
                  <dd style={{ margin: 0, color: '#18181b', fontWeight: 500, overflowWrap: 'anywhere' }}>{fmt(k, v)}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </li>
  );
}

// What the server-side SequenceGuard enforced in this run (workflow.guard; absent on older requests).
const EVENT = {
  refused: { icon: 'x', fg: '#92400e', bg: '#fffbeb', bd: '#fde68a', title: (e) => `Refused: ${e.tool}`, text: (e) => `${e.reason}${e.next ? ` The model was told to run ${e.next} next.` : ''}` },
  nudged: { icon: 'arrow-right', fg: '#0f766e', bg: '#f0fdfa', bd: '#99f6e4', title: () => 'Model stopped early, asked to finish', text: (e) => `Still required: ${e.missing.join(', ')}.` },
  incomplete: { icon: 'alert', fg: '#991b1b', bg: '#fef2f2', bd: '#fecaca', title: () => 'Run ended with steps missing', text: (e) => `Not run: ${e.missing.join(', ')}.` },
};

function GuardPanel({ guard, byName, denied }) {
  const events = guard.events || [];
  return (
    <section aria-label="Step order enforcement" className="guard-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="guard-badge"><Icon name="scale" size={15} /></span>
        <strong style={{ fontSize: 15, color: '#18181b' }}>Step order enforced in code</strong>
        <span style={{ fontSize: 13, color: '#71717a' }}>A call made too early is refused, not run. Submit runs once, only after approval.</span>
      </div>
      <ol className="guard-chain">
        {guard.order.map((n, i) => {
          const s = byName[n]?.status;
          return (
            <li key={n} data-state={s === 'done' ? 'done' : s ? 'running' : undefined}>
              <span>{i + 1}</span>{n}{n === 'Submitting to Payer Portal' && <em>needs approval</em>}
            </li>
          );
        })}
        <li data-state={byName['Drafting Appeal Letter']?.status === 'done' ? 'done' : undefined} data-optional={!denied || undefined}>
          <span>+</span>Drafting Appeal Letter<em>only after a denial</em>
        </li>
      </ol>
      {events.length === 0
        ? <div className="guard-ok"><Icon name="checkcircle" size={16} /> No out-of-order calls in this run.</div>
        : <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 6 }}>
            {events.map((e, i) => {
              const k = EVENT[e.kind] || EVENT.incomplete;
              return (
                <li key={i} className="fade-up" style={{ display: 'flex', gap: 10, padding: '9px 12px', borderRadius: 12, background: k.bg, border: `1px solid ${k.bd}`, animationDelay: `${i * 60}ms` }}>
                  <span style={{ color: k.fg, paddingTop: 1 }}><Icon name={k.icon} size={16} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: '#27272a', lineHeight: 1.45 }}>
                    <strong style={{ color: k.fg }}>{k.title(e)}</strong> {k.text(e)}
                  </span>
                  {e.ts && <time style={{ fontSize: 12, color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>{new Date(e.ts + 'Z').toLocaleTimeString()}</time>}
                </li>
              );
            })}
          </ul>}
    </section>
  );
}

const HEAD = {
  pending: ['clock', 'Preparing your request', 'MedBridge is checking the insurer\'s policy and the patient record.', '#18181b'],
  processing: ['clock', 'Preparing your request', 'MedBridge is checking the insurer\'s policy and the patient record.', '#18181b'],
  awaiting_approval: ['pause', 'Your review is needed', 'Nothing is sent to the payer until you approve.', '#92400e'],
  submitted: ['checkcircle', 'Request submitted', 'Approved by a reviewer and sent. The payer\'s response is simulated in this prototype.', '#166534'],
  rejected: ['x', 'Not submitted', 'You rejected this request, so nothing was sent.', '#3f3f46'],
  needs_info: ['alert', 'Stopped before finishing', null, '#991b1b'],
};

export default function ProgressView({ workflowData, onDecide, onStartNew, user }) {
  const status = workflowData?.status || 'pending';
  const [icon, title, sub, color] = HEAD[status] || HEAD.pending;
  const steps = workflowData?.steps || [];
  const byName = Object.fromEntries(steps.map(s => [s.tool_name, s]));
  const names = STEP_ORDER.filter(n => byName[n] || (n !== 'Drafting Appeal Letter'));
  const stopped = status === 'needs_info' || status === 'rejected';
  const confirmation = byName['Submitting to Payer Portal']?.data?.confirmation_number;
  const f = workflowData?.form_data || {};
  const [copied, setCopied] = useState(false);
  const doneCount = names.filter(n => byName[n]?.status === 'done').length;
  const pct = status === 'submitted' ? 100 : Math.round((doneCount / names.length) * 100);
  const tone = stopped ? 'grey' : status === 'awaiting_approval' ? 'amber' : status === 'submitted' ? 'green' : 'teal';
  const barLabel = status === 'submitted' ? 'All steps done' : stopped ? `Stopped after ${doneCount} of ${names.length} steps` : status === 'awaiting_approval' ? `${doneCount} of ${names.length} steps done, waiting for you` : `${doneCount} of ${names.length} steps done`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(confirmation); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked: the number is still on screen */ }
  };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 56px' }}>
      <div role="status" aria-live="polite" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24 }}>
        <span style={{ color, display: 'flex', paddingTop: 5 }}><Icon name={icon} size={30} /></span>
        <div>
          <h2 style={{ fontFamily: "'Source Serif 4', Georgia, serif", margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.4px', color }}>{title}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 16, color: '#3f3f46', lineHeight: 1.5 }}>{sub || workflowData?.result}</p>
        </div>
      </div>

      <div className="pv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={barLabel}>
        <div className="pv-bar-label"><span>{barLabel}</span><span>{pct}%</span></div>
        <div className={`pv-bar ${tone}`}><i style={{ width: `${pct}%` }} /></div>
      </div>

      {status === 'awaiting_approval' && <ApprovalCard workflow={workflowData} onDecide={onDecide} user={user} />}

      {status === 'submitted' && (
        <section aria-label="Submission summary" className="pv-confirm">
          <div style={{ fontSize: 14, color: '#52525b', fontWeight: 600 }}>Confirmation number <span style={{ color: '#92400e' }}>(simulated)</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '4px 0 14px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'ui-monospace, monospace', letterSpacing: 1, color: '#18181b' }}>{confirmation || '—'}</div>
            {confirmation && <button type="button" className="pv-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>}
          </div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 15, color: '#3f3f46' }}>
            <span><strong>Patient</strong> {f.patient_name}</span>
            <span><strong>Payer</strong> {f.insurance_provider}</span>
            <span><strong>Service</strong> {f.treatment_type}</span>
          </div>
        </section>
      )}

      {workflowData?.guard?.order?.length > 0 && (
        <GuardPanel guard={workflowData.guard} byName={byName} denied={steps.some(s => s.data?.current_status === 'DENIED')} />
      )}

      <section aria-label="Steps" className="pv-steps">
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {names.map((n, i) => <Step key={n} name={n} step={byName[n]} stopped={stopped} first={i === 0} last={i === names.length - 1}
            refused={(workflowData?.guard?.events || []).filter(e => e.kind === 'refused' && e.tool === n).length} />)}
        </ol>
      </section>

      <AuditTrail audit={workflowData?.audit} />

      {['submitted', 'rejected', 'needs_info'].includes(status) && (
        <div style={{ marginTop: 28 }}>
          <button onClick={onStartNew} className="lift pv-new">
            Start a new request
          </button>
        </div>
      )}
    </div>
  );
}
