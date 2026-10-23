import { useState } from 'react';

const card = { margin: '0 0 24px' };
const panel = { background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,0.08)', overflow: 'hidden' };

export function ApprovalCard({ workflow, onDecide }) {
  const [note, setNote] = useState('');
  const [reviewer, setReviewer] = useState('Dr. Sarah Chen');
  const [busy, setBusy] = useState(false);
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
        </div>
        <div style={{ padding: '8px 24px 4px' }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid #f1f5f9', fontSize: 15.5 }}>
              <div style={{ width: 190, color: '#64748b', fontWeight: 600, flexShrink: 0 }}>{k}</div>
              <div style={{ color: '#0f172a', fontWeight: 500 }}>{String(v)}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 24px 22px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={reviewer} onChange={e => setReviewer(e.target.value)} aria-label="Reviewer name" placeholder="Reviewer"
              style={{ flex: '0 0 200px', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 12, fontSize: 15 }} />
            <input value={note} onChange={e => setNote(e.target.value)} aria-label="Reviewer note" placeholder="Optional note"
              style={{ flex: 1, minWidth: 200, padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 12, fontSize: 15 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button disabled={busy} onClick={() => decide(false)} style={{ padding: '13px 24px', borderRadius: 12, border: '1px solid #fca5a5', background: 'white', color: '#b91c1c', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Reject</button>
            <button disabled={busy} onClick={() => decide(true)} style={{ padding: '13px 28px', borderRadius: 12, border: 'none', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', background: '#15803d', boxShadow: '0 6px 16px rgba(21,128,61,0.3)' }}>Approve &amp; submit</button>
          </div>
        </div>
      </div>
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
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
        Audit trail <span style={{ fontWeight: 500, color: '#475569', fontSize: 14 }}>({audit.length} events — who did what, and when)</span>
      </summary>
      <div style={{ marginTop: 12 }}>
        {audit.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '8px 0', fontSize: 14.5, alignItems: 'baseline', borderTop: i ? '1px solid #f1f5f9' : 'none', flexWrap: 'wrap' }}>
            <span style={{ color: '#475569', fontVariantNumeric: 'tabular-nums', width: 90, flexShrink: 0 }}>{new Date(a.ts + 'Z').toLocaleTimeString()}</span>
            <span style={{ fontWeight: 700, color: '#0f172a', width: 130, flexShrink: 0 }}>{a.actor}</span>
            <span style={{ color: '#334155', flex: 1, minWidth: 180 }}>{ACTION_LABELS[a.action] || a.action}{a.note ? ` — ${a.note}` : ''}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

const STATUS_STYLE = {
  submitted: ['#166534', '#dcfce7', 'Submitted'], awaiting_approval: ['#92400e', '#fef3c7', 'Needs review'],
  processing: ['#1d4ed8', '#dbeafe', 'Processing'], pending: ['#475569', '#f1f5f9', 'Pending'],
  rejected: ['#991b1b', '#fee2e2', 'Rejected'], needs_info: ['#991b1b', '#fee2e2', 'Failed'], denied: ['#991b1b', '#fee2e2', 'Denied'], approved: ['#166534', '#dcfce7', 'Approved'],
};

export function HistoryPanel({ items, onOpen }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>
      <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px', color: '#0f172a', margin: '0 0 6px' }}>Past requests</h2>
      <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>Saved on the server, so requests survive a refresh or restart.</p>
      {items.length === 0 && (
        <div style={{ ...panel, padding: 40, textAlign: 'center', color: '#64748b' }}>No requests yet. Start one from the Prior Auth Agent tab.</div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((h, i) => {
          const [fg, bg, label] = STATUS_STYLE[h.status] || STATUS_STYLE.pending;
          return (
            <button key={h.workflow_id} onClick={() => onOpen(h.workflow_id)} className="fade-up" style={{ ...panel, animationDelay: `${i * 40}ms`, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{h.summary}</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{[h.insurance, h.treatment].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ color: '#64748b', fontSize: 12.5 }}>{new Date(h.created_at + 'Z').toLocaleString()}</div>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', padding: '4px 11px', borderRadius: 100, color: fg, background: bg }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
