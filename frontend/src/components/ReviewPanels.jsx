import { useState } from 'react';
import Icon from './Icon';
import CitationDrawer from './CitationDrawer';

// Status meanings stay fixed everywhere: green = on file, amber = check it, grey = not available. Icon + label, never color alone.
const CHECK = {
  ok: { fg: '#166534', bg: '#dcfce7', bd: '#86efac', icon: 'checkcircle', label: 'On file' },
  check: { fg: '#92400e', bg: '#fef3c7', bd: '#fcd34d', icon: 'alert', label: 'Check' },
  unknown: { fg: '#52525b', bg: '#f5f5f4', bd: '#d4d4d8', icon: 'search', label: 'Not available' },
};

function Check({ state, title, detail }) {
  const c = CHECK[state];
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: c.bg, border: `1px solid ${c.bd}` }}>
      <span style={{ color: c.fg, marginTop: 1 }}><Icon name={c.icon} size={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#18181b', fontSize: 15 }}>{title}</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: c.fg }}>{c.label}</span>
        </div>
        {detail && <div style={{ color: '#3f3f46', fontSize: 14, marginTop: 3, lineHeight: 1.45 }}>{detail}</div>}
      </div>
    </div>
  );
}

const card = { margin: '0 0 24px' };
const panel = { background: 'white', borderRadius: 20, border: '1px solid #e7e5e4', boxShadow: '0 8px 32px rgba(15,23,42,0.08)', overflow: 'hidden' };

export function ApprovalCard({ workflow, onDecide }) {
  const [note, setNote] = useState('');
  const [reviewer, setReviewer] = useState('Dr. Sarah Chen');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const f = workflow?.form_data || {};
  const stepData = (name) => workflow?.steps?.find(s => s.tool_name === name && s.status === 'done')?.data || {};
  const policy = stepData('Scanning Insurance Policy');
  const records = stepData('Analyzing Medical Records');
  const form = stepData('Completing Authorization Form');

  const rows = [
    ['Patient', f.patient_name], ['Payer', f.insurance_provider], ['Service', `${f.treatment_type} — ${f.diagnosis_code}`],
    ['Requesting physician', f.requesting_physician],
    ['Form completeness', form.completeness_score != null ? `${Math.round(form.completeness_score * 100)}%` : null],
    ['Patient record found', records.patient_found == null ? null : (records.patient_found ? 'Yes (MIMIC-IV demo)' : 'No')],
    ['Requested diagnosis on record', records.requested_diagnosis_on_record == null ? null : (records.requested_diagnosis_on_record ? 'Yes' : 'No')],
    ['Policy sources', policy.policy_sources],
  ].filter(r => r[1] != null && r[1] !== '');

  const passages = policy.policy_passages || [];
  const sources = (policy.policy_sources || '').split(';').map(x => x.trim()).filter(Boolean);
  const pct = form.completeness_score != null ? Math.round(form.completeness_score * 100) : null;
  const checks = [
    ['Policy evidence', sources.length ? 'ok' : 'unknown',
      sources.length ? `${sources.length} source${sources.length > 1 ? 's' : ''} cited from the payer's own documents.` : 'No policy passages were retrieved for this payer. Check the payer rules directly.'],
    ['Patient record', records.patient_found == null ? 'unknown' : records.patient_found ? 'ok' : 'check',
      records.patient_found == null ? 'The record lookup did not report a result.' : records.patient_found ? 'Found in the MIMIC-IV demo data.' : 'No matching record. Do not rely on the clinical summary.'],
    ['Requested diagnosis', records.requested_diagnosis_on_record == null ? 'unknown' : records.requested_diagnosis_on_record ? 'ok' : 'check',
      records.requested_diagnosis_on_record == null ? 'Not reported.' : records.requested_diagnosis_on_record ? `${f.diagnosis_code} appears in the patient's record.` : `${f.diagnosis_code} does not appear in the record. Confirm before approving.`],
    ['Form completeness', pct == null ? 'unknown' : pct >= 90 ? 'ok' : 'check', pct == null ? 'Not reported.' : `${pct}% of required fields filled.`],
  ];
  const needsLook = checks.filter(c => c[1] === 'check').length;

  const decide = async (approved) => { setBusy(true); await onDecide(approved, reviewer, note); setBusy(false); };

  return (
    <div style={card} className="fade-up">
      <div style={{ ...panel, border: '1px solid #fcd34d', boxShadow: '0 12px 40px rgba(245,158,11,0.18)' }}>
        <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
          <div>
            <div style={{ fontWeight: 800, color: '#92400e', fontSize: 18 }}>Human review required before submission</div>
            <div style={{ fontSize: 15, color: '#92400e' }}>Check the details below, then approve or reject.</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100, background: 'white', color: '#92400e', border: '1px solid #fcd34d', whiteSpace: 'nowrap' }}>Simulated · demo data</span>
        </div>
        <div style={{ padding: '18px 24px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, color: '#18181b', fontSize: 16 }}>Review checklist</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: needsLook ? '#92400e' : '#166534' }}>
              {needsLook ? `${needsLook} item${needsLook > 1 ? 's' : ''} to check first` : 'Nothing flagged. Still read the details.'}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {checks.map(([t, st, d]) => <Check key={t} state={st} title={t} detail={d} />)}
          </div>
          {sources.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#71717a', marginBottom: 6 }}>Policy sources</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sources.map(x => {
                  const p = passages.find(q => q.source === x);
                  const chip = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' };
                  return p
                    ? <button key={x} type="button" onClick={() => setOpen({ title: x, url: p.url, passage: p.passage })} style={{ ...chip, cursor: 'pointer' }} title="Show the passage">
                        <Icon name="book" size={13} />{x}<Icon name="arrow-right" size={12} />
                      </button>
                    : <span key={x} style={chip}><Icon name="book" size={13} />{x}</span>;
                })}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 24px 4px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#71717a', margin: '8px 0 2px' }}>Request</div>
          {rows.filter(r => r[0] !== 'Policy sources').map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid #f5f5f4', fontSize: 15 }}>
              <div style={{ width: 190, color: '#71717a', fontWeight: 600, flexShrink: 0 }}>{k}</div>
              <div style={{ color: '#18181b', fontWeight: 500 }}>{String(v)}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 24px 22px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={reviewer} onChange={e => setReviewer(e.target.value)} aria-label="Reviewer name" placeholder="Reviewer"
              style={{ flex: '0 0 200px', padding: '12px 14px', border: '1px solid #d4d4d8', borderRadius: 12, fontSize: 15 }} />
            <input value={note} onChange={e => setNote(e.target.value)} aria-label="Reviewer note" placeholder="Optional note"
              style={{ flex: 1, minWidth: 200, padding: '12px 14px', border: '1px solid #d4d4d8', borderRadius: 12, fontSize: 15 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button disabled={busy} onClick={() => decide(false)} style={{ padding: '13px 24px', borderRadius: 12, border: '1px solid #fca5a5', background: 'white', color: '#b91c1c', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Reject</button>
            <button disabled={busy} onClick={() => decide(true)} style={{ padding: '13px 28px', borderRadius: 12, border: 'none', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', background: '#15803d', boxShadow: '0 6px 16px rgba(21,128,61,0.3)' }}>Approve &amp; submit</button>
          </div>
        </div>
      </div>
      <CitationDrawer cite={open} onClose={() => setOpen(null)} />
    </div>
  );
}

const ACTION_LABELS = {
  created: 'Request created', started: 'Agent started', approval_requested: 'Review requested',
  approved: 'Approved', rejected_by_reviewer: 'Rejected', completed: 'Completed', rejected: 'Stopped (rejected)', error: 'Error',
};

export function AuditTrail({ audit }) {
  if (!audit?.length) return null;
  return (
    <details style={{ ...panel, marginTop: 24, padding: '16px 24px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16, color: '#18181b' }}>
        Audit trail <span style={{ fontWeight: 500, color: '#52525b', fontSize: 14 }}>({audit.length} events — who did what, and when)</span>
      </summary>
      <div style={{ marginTop: 12 }}>
        {audit.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '8px 0', fontSize: 14.5, alignItems: 'baseline', borderTop: i ? '1px solid #f5f5f4' : 'none', flexWrap: 'wrap' }}>
            <span style={{ color: '#52525b', fontVariantNumeric: 'tabular-nums', width: 90, flexShrink: 0 }}>{new Date(a.ts + 'Z').toLocaleTimeString()}</span>
            <span style={{ fontWeight: 700, color: '#18181b', width: 130, flexShrink: 0 }}>{a.actor}</span>
            <span style={{ color: '#3f3f46', flex: 1, minWidth: 180 }}>{ACTION_LABELS[a.action] || a.action}{a.note ? ` — ${a.note}` : ''}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

const STATUS_STYLE = {
  submitted: ['#166534', '#dcfce7', 'Submitted'], awaiting_approval: ['#92400e', '#fef3c7', 'Needs review'],
  processing: ['#0f766e', '#dbeafe', 'Processing'], pending: ['#52525b', '#f5f5f4', 'Pending'],
  rejected: ['#991b1b', '#fee2e2', 'Rejected'], needs_info: ['#991b1b', '#fee2e2', 'Failed'], denied: ['#991b1b', '#fee2e2', 'Denied'], approved: ['#166534', '#dcfce7', 'Approved'],
};

export function HistoryPanel({ items, onOpen }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>
      <h2 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px', color: '#18181b', margin: '0 0 6px' }}>Past requests</h2>
      <p style={{ color: '#71717a', fontSize: 14, margin: '0 0 20px' }}>Saved on the server, so requests survive a refresh or restart.</p>
      {items.length === 0 && (
        <div style={{ ...panel, padding: 40, textAlign: 'center', color: '#71717a' }}>No requests yet. Start one from the Prior Auth Agent tab.</div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((h, i) => {
          const [fg, bg, label] = STATUS_STYLE[h.status] || STATUS_STYLE.pending;
          return (
            <button key={h.workflow_id} onClick={() => onOpen(h.workflow_id)} className="fade-up" style={{ ...panel, animationDelay: `${i * 40}ms`, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#18181b', fontSize: 15 }}>{h.summary}</div>
                <div style={{ color: '#71717a', fontSize: 13, marginTop: 2 }}>{[h.insurance, h.treatment].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ color: '#71717a', fontSize: 12.5 }}>{new Date(h.created_at + 'Z').toLocaleString()}</div>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', padding: '4px 11px', borderRadius: 100, color: fg, background: bg }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
