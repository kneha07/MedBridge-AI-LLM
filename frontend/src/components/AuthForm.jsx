import { useState } from 'react';

const DEMO_DATA = {
  patient_name: 'Margaret R. Thompson',
  patient_dob: '1968-04-15',
  patient_id: 'PT-2024-83741',
  insurance_provider: 'Aetna',
  insurance_id: 'AET-9284736501',
  treatment_type: 'MRI',
  diagnosis_code: 'M72.5',
  treatment_description: 'Lumbar spine MRI without contrast to evaluate radiculopathy and rule out disc herniation following 8 weeks of conservative treatment failure.',
  requesting_physician: 'Dr. Sarah Chen',
  physician_npi: '1234567890',
  urgency: 'routine',
  ai_provider: 'groq'
};

const INSURANCE_PROVIDERS = [
  'Aetna', 'Blue Cross Blue Shield', 'United Healthcare', 'Cigna', 'Humana', 'Medicare', 'Medicaid'
];
const TREATMENT_TYPES = [
  'MRI', 'CT Scan', 'Physical Therapy', 'Surgery', 'Specialist Referral', 'Lab Tests', 'Medication'
];

const AI_STEPS = [
  { icon: '🔍', label: 'Scan policy requirements', color: '#8b5cf6' },
  { icon: '📋', label: 'Analyze medical records', color: '#3b82f6' },
  { icon: '📝', label: 'Auto-fill auth form', color: '#f59e0b' },
  { icon: '📤', label: 'Submit to insurer', color: '#22c55e' },
  { icon: '🔔', label: 'Track until decision', color: '#06b6d4' },
];

function SectionTitle({ number, title, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
      <div style={{
        width: '26px', height: '26px',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #1a3a5c, #1e4d7b)',
        color: 'white',
        fontSize: '11px', fontWeight: '800',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(26,58,92,0.3)',
      }}>{number}</div>
      <span style={{
        fontSize: '11px', fontWeight: '700', color: '#475569',
        textTransform: 'uppercase', letterSpacing: '1.1px'
      }}>
        {icon && <span style={{ marginRight: '5px' }}>{icon}</span>}
        {title}
      </span>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '11px', fontWeight: '700',
        color: '#64748b', marginBottom: '7px',
        letterSpacing: '0.6px', textTransform: 'uppercase',
      }}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: '3px' }} aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', required, ariaLabel }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} required={required}
      value={value} onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      aria-required={required}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '11px 14px',
        border: `1.5px solid ${focused ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: '10px',
        fontSize: '14px', color: '#0f172a',
        background: focused ? '#fafbff' : '#fff',
        boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.12), 0 2px 8px rgba(0,0,0,0.04)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.2s',
      }}
    />
  );
}

function Select({ value, onChange, children, ariaLabel }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value} onChange={onChange}
      aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '11px 14px',
        border: `1.5px solid ${focused ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: '10px',
        fontSize: '14px', color: '#0f172a',
        background: focused ? '#fafbff' : '#fff',
        boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.2s',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: '36px',
        cursor: 'pointer',
      }}
    >
      {children}
    </select>
  );
}

export default function AuthForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    patient_name: '', patient_dob: '', patient_id: '',
    insurance_provider: 'Aetna', insurance_id: '',
    treatment_type: 'MRI', diagnosis_code: '', treatment_description: '',
    requesting_physician: '', physician_npi: '', urgency: 'routine',
    ai_provider: 'groq'
  });

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '36px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '28px', alignItems: 'start' }}>

        {/* ── Main form card ── */}
        <div className="fade-up card" style={{ borderRadius: '24px', overflow: 'hidden' }}>

          {/* Card header with gradient */}
          <div style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0e2d4a 100%)',
            padding: '28px 36px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Decorative orbs */}
            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)' }} />
            <div style={{ position: 'absolute', bottom: '-20px', left: '40%', width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.1), transparent 70%)' }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 6px', color: 'white', fontSize: '20px', fontWeight: '900', letterSpacing: '-0.4px' }}>
                  Prior Authorization Request
                </h2>
                <p style={{ margin: 0, color: '#7dd3fc', fontSize: '13px', fontWeight: '400' }}>
                  Fill once — AI handles everything else
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm(DEMO_DATA)}
                aria-label="Load demo data"
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  border: '1.5px solid rgba(34,197,94,0.4)',
                  color: '#22c55e',
                  padding: '9px 18px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 0 16px rgba(34,197,94,0.2)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(34,197,94,0.25)';
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(34,197,94,0.35)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(34,197,94,0.15)';
                  e.currentTarget.style.boxShadow = '0 0 16px rgba(34,197,94,0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '15px' }}>✨</span> Try Demo
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
            style={{ padding: '32px 36px' }}
            aria-label="Prior authorization form"
          >

            {/* 1. Patient */}
            <section aria-labelledby="section-patient" style={{ marginBottom: '32px', paddingBottom: '28px', borderBottom: '1px solid #f1f5f9' }}>
              <SectionTitle number="1" title="Patient Information" icon="👤" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Field label="Full Name" required>
                  <Input required value={form.patient_name} onChange={upd('patient_name')} placeholder="e.g. Margaret R. Thompson" ariaLabel="Patient full name" />
                </Field>
                <Field label="Date of Birth" required>
                  <Input required type="date" value={form.patient_dob} onChange={upd('patient_dob')} ariaLabel="Patient date of birth" />
                </Field>
                <Field label="Patient ID / MRN" required>
                  <Input required value={form.patient_id} onChange={upd('patient_id')} placeholder="e.g. PT-2024-83741" ariaLabel="Patient ID or MRN" />
                </Field>
              </div>
            </section>

            {/* 2. Insurance */}
            <section aria-labelledby="section-insurance" style={{ marginBottom: '32px', paddingBottom: '28px', borderBottom: '1px solid #f1f5f9' }}>
              <SectionTitle number="2" title="Insurance Details" icon="🛡️" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Field label="Insurance Provider">
                  <Select value={form.insurance_provider} onChange={upd('insurance_provider')} ariaLabel="Insurance provider">
                    {INSURANCE_PROVIDERS.map(p => <option key={p}>{p}</option>)}
                  </Select>
                </Field>
                <Field label="Member ID" required>
                  <Input required value={form.insurance_id} onChange={upd('insurance_id')} placeholder="e.g. AET-9284736501" ariaLabel="Insurance member ID" />
                </Field>
              </div>
            </section>

            {/* 3. Treatment */}
            <section aria-labelledby="section-treatment" style={{ marginBottom: '32px', paddingBottom: '28px', borderBottom: '1px solid #f1f5f9' }}>
              <SectionTitle number="3" title="Treatment Request" icon="🏥" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <Field label="Treatment Type">
                  <Select value={form.treatment_type} onChange={upd('treatment_type')} ariaLabel="Treatment type">
                    {TREATMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Diagnosis Code (ICD-10)" required>
                  <Input required value={form.diagnosis_code} onChange={upd('diagnosis_code')} placeholder="e.g. M72.5" ariaLabel="ICD-10 diagnosis code" />
                </Field>
              </div>
              <Field label="Clinical Justification" required>
                <textarea
                  required rows={3}
                  value={form.treatment_description}
                  onChange={upd('treatment_description')}
                  placeholder="Describe the clinical rationale for this authorization..."
                  aria-label="Clinical justification"
                  aria-required="true"
                  style={{
                    width: '100%', padding: '11px 14px',
                    border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    fontSize: '14px', color: '#0f172a', resize: 'vertical',
                    lineHeight: '1.6', transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
                />
              </Field>
            </section>

            {/* 4. Physician */}
            <section aria-labelledby="section-physician" style={{ marginBottom: '32px', paddingBottom: '28px', borderBottom: '1px solid #f1f5f9' }}>
              <SectionTitle number="4" title="Requesting Physician" icon="👨‍⚕️" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Field label="Physician Name" required>
                  <Input required value={form.requesting_physician} onChange={upd('requesting_physician')} placeholder="e.g. Dr. Sarah Chen" ariaLabel="Physician name" />
                </Field>
                <Field label="NPI Number" required>
                  <Input required value={form.physician_npi} onChange={upd('physician_npi')} placeholder="10-digit NPI" ariaLabel="National Provider Identifier" />
                </Field>
              </div>
            </section>

            {/* 5. Urgency */}
            <section aria-labelledby="section-urgency" style={{ marginBottom: '28px' }}>
              <SectionTitle number="5" title="Urgency Level" icon="⏱️" />
              <div role="radiogroup" aria-label="Urgency level" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { v: 'routine',   label: 'Routine',   desc: '3–5 business days', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: '🔵' },
                  { v: 'urgent',    label: 'Urgent',    desc: '24–72 hours',        color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '🟡' },
                  { v: 'emergency', label: 'Emergency', desc: 'Immediate review',   color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', icon: '🔴' }
                ].map(opt => (
                  <label
                    key={opt.v}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '16px 12px',
                      border: `2px solid ${form.urgency === opt.v ? opt.color : '#e8edf3'}`,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      background: form.urgency === opt.v ? opt.bg : 'white',
                      transition: 'all 0.2s',
                      userSelect: 'none',
                      boxShadow: form.urgency === opt.v ? `0 4px 16px ${opt.color}22` : '0 1px 4px rgba(0,0,0,0.04)',
                      transform: form.urgency === opt.v ? 'translateY(-1px)' : 'none',
                    }}
                    onMouseEnter={e => { if (form.urgency !== opt.v) e.currentTarget.style.borderColor = opt.color + '80'; }}
                    onMouseLeave={e => { if (form.urgency !== opt.v) e.currentTarget.style.borderColor = '#e8edf3'; }}
                  >
                    <input type="radio" name="urgency" value={opt.v}
                      checked={form.urgency === opt.v}
                      onChange={upd('urgency')}
                      style={{ display: 'none' }}
                      aria-label={`${opt.label} - ${opt.desc}`}
                    />
                    <span style={{ fontSize: '20px', marginBottom: '6px' }}>{opt.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: form.urgency === opt.v ? opt.color : '#475569' }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', textAlign: 'center' }}>
                      {opt.desc}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* 6. AI Engine */}
            <section aria-labelledby="section-ai" style={{ marginBottom: '28px' }}>
              <SectionTitle number="6" title="AI Engine" icon="🤖" />
              <div role="radiogroup" aria-label="AI engine selection" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { v: 'claude', label: 'MedBridge Standard', sub: 'High accuracy · Deep clinical reasoning', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', logo: '🔵' },
                  { v: 'groq',   label: 'MedBridge Turbo',   sub: 'Ultra-fast · Instant results',            color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', logo: '🟠' },
                ].map(opt => (
                  <label
                    key={opt.v}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '16px 18px',
                      border: `2px solid ${form.ai_provider === opt.v ? opt.color : '#e8edf3'}`,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      background: form.ai_provider === opt.v ? opt.bg : 'white',
                      transition: 'all 0.2s',
                      userSelect: 'none',
                      boxShadow: form.ai_provider === opt.v ? `0 4px 16px ${opt.color}20` : '0 1px 4px rgba(0,0,0,0.04)',
                      transform: form.ai_provider === opt.v ? 'translateY(-1px)' : 'none',
                    }}
                    onMouseEnter={e => { if (form.ai_provider !== opt.v) e.currentTarget.style.borderColor = opt.color + '60'; }}
                    onMouseLeave={e => { if (form.ai_provider !== opt.v) e.currentTarget.style.borderColor = '#e8edf3'; }}
                  >
                    <input type="radio" name="ai_provider" value={opt.v}
                      checked={form.ai_provider === opt.v}
                      onChange={upd('ai_provider')}
                      style={{ display: 'none' }}
                      aria-label={`${opt.label} - ${opt.sub}`}
                    />
                    <span style={{ fontSize: '26px' }}>{opt.logo}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: form.ai_provider === opt.v ? opt.color : '#1e293b' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{opt.sub}</div>
                    </div>
                    {form.ai_provider === opt.v && (
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', color: 'white', fontWeight: '800',
                        boxShadow: `0 2px 8px ${opt.color}50`,
                        flexShrink: 0,
                      }}>✓</div>
                    )}
                  </label>
                ))}
              </div>
            </section>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              aria-label={loading ? 'Submitting authorization...' : 'Submit prior authorization'}
              aria-busy={loading}
              style={{
                width: '100%', padding: '16px',
                background: loading
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #1a3a5c 0%, #1e4d7b 60%, #2563eb 100%)',
                backgroundSize: '200% 200%',
                color: 'white', border: 'none',
                borderRadius: '14px', fontSize: '15px', fontWeight: '800',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 8px 24px rgba(26,58,92,0.4), 0 2px 8px rgba(37,99,235,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'all 0.25s', letterSpacing: '0.2px',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(26,58,92,0.5), 0 4px 12px rgba(37,99,235,0.3)';
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,58,92,0.4), 0 2px 8px rgba(37,99,235,0.2)';
                }
              }}
            >
              {!loading && (
                <div className="shimmer-overlay" style={{ borderRadius: '14px' }} />
              )}
              {loading ? (
                <>
                  <span style={{
                    width: '18px', height: '18px',
                    border: '2.5px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Launching AI Agent…
                </>
              ) : (
                <span style={{ position: 'relative', zIndex: 1 }}>
                  ⚡ Submit via {form.ai_provider === 'groq' ? 'MedBridge Turbo' : 'MedBridge Standard'} — AI Handles the Rest
                </span>
              )}
            </button>
          </form>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* What happens next */}
          <div className="fade-up-1 card" style={{ padding: '24px', borderRadius: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '18px' }}>
              What happens next
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {AI_STEPS.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '38px', height: '38px',
                      borderRadius: '12px',
                      background: `linear-gradient(135deg, ${step.color}20, ${step.color}10)`,
                      border: `1.5px solid ${step.color}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '17px', flexShrink: 0,
                    }}>
                      {step.icon}
                    </div>
                    {i < AI_STEPS.length - 1 && (
                      <div style={{
                        width: '2px', height: '22px',
                        background: 'linear-gradient(to bottom, #e2e8f0, transparent)',
                        margin: '4px 0'
                      }} />
                    )}
                  </div>
                  <div style={{ paddingTop: '9px', paddingBottom: i < AI_STEPS.length - 1 ? '0' : '0' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{step.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="fade-up-2" style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%)',
            borderRadius: '20px',
            padding: '24px',
            color: 'white',
            boxShadow: '0 8px 32px rgba(10,22,40,0.4), inset 0 1px 0 rgba(255,255,255,0.07)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)' }} />
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#7dd3fc', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '18px' }}>
              MedBridge Impact
            </div>
            {[
              { icon: '⚡', label: 'Minutes, not weeks',     color: '#22c55e' },
              { icon: '🤖', label: 'Zero manual steps',      color: '#60a5fa' },
              { icon: '🔒', label: 'HIPAA compliant',        color: '#f59e0b' },
              { icon: '📋', label: 'CMS compliant 2026',     color: '#a78bfa' },
            ].map(({ icon, label, color }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '11px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: '16px' }}>{icon}</span>
                <span style={{ fontSize: '13px', color, fontWeight: '700' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Security badge */}
          <div className="fade-up-3 card" style={{
            padding: '18px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f0fdf4, #f8fafc)',
            border: '1.5px solid #d1fae5',
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', flexShrink: 0,
                boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
              }}>🔒</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#15803d', marginBottom: '4px' }}>HIPAA Compliant</div>
                <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.55' }}>
                  All data encrypted in transit and at rest. PHI never stored beyond session.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
