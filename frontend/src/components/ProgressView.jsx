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

function Step({ name, step, stopped, first, last }) {
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
          <div style={{ fontSize: 16, fontWeight: 700, color: state === 'waiting' ? '#52525b' : '#18181b' }}>{name}</div>
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
            <dl style={{ margin: '8px 0 0', display: 'grid', gridTemplateColumns: 'minmax(150px, 220px) 1fr', gap: '6px 16px', fontSize: 14 }}>
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

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 56px' }}>
      <div role="status" aria-live="polite" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24 }}>
        <span style={{ color, display: 'flex', paddingTop: 5 }}><Icon name={icon} size={30} /></span>
        <div>
          <h2 style={{ fontFamily: "'Source Serif 4', Georgia, serif", margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.4px', color }}>{title}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 16, color: '#3f3f46', lineHeight: 1.5 }}>{sub || workflowData?.result}</p>
        </div>
      </div>

      {status === 'awaiting_approval' && <ApprovalCard workflow={workflowData} onDecide={onDecide} user={user} />}

      {status === 'submitted' && (
        <section aria-label="Submission summary" style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: '#52525b', fontWeight: 600 }}>Confirmation number <span style={{ color: '#92400e' }}>(simulated)</span></div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'ui-monospace, monospace', letterSpacing: 1, color: '#18181b', margin: '4px 0 14px' }}>{confirmation || '—'}</div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 15, color: '#3f3f46' }}>
            <span><strong>Patient</strong> {f.patient_name}</span>
            <span><strong>Payer</strong> {f.insurance_provider}</span>
            <span><strong>Service</strong> {f.treatment_type}</span>
          </div>
        </section>
      )}

      <section aria-label="Steps" style={{ background: 'white', border: '1px solid #e7e5e4', borderRadius: 16, padding: '4px 24px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {names.map((n, i) => <Step key={n} name={n} step={byName[n]} stopped={stopped} first={i === 0} last={i === names.length - 1} />)}
        </ol>
      </section>

      <AuditTrail audit={workflowData?.audit} />

      {['submitted', 'rejected', 'needs_info'].includes(status) && (
        <div style={{ marginTop: 28 }}>
          <button onClick={onStartNew} className="lift" style={{ padding: '14px 28px', borderRadius: 12, border: 'none', background: '#17171d', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            Start a new request
          </button>
        </div>
      )}
    </div>
  );
}
