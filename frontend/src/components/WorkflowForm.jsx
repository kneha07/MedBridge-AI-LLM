import { cloneElement, useId, useState } from 'react';
import Icon from './Icon';
import MicButton from './MicButton';
import { voiceSupported } from './speech';

function Field({ label, required, action, children }) {
  const id = useId();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: '6px', minHeight: 22 }}>
        <label htmlFor={id} style={{ fontSize: '14px', fontWeight: '600', color: '#3f3f46' }}>
          {label}{required && <span aria-hidden="true" style={{ color: '#b91c1c', marginLeft: '3px' }}>*</span>}
        </label>
        {action}
      </div>
      {cloneElement(children, { id, 'aria-required': required || undefined })}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', required, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...rest} type={type} required={required} value={value} onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '11px 14px',
        border: `1.5px solid ${focused ? '#0d9488' : '#e7e5e4'}`,
        borderRadius: '10px', fontSize: '15.5px', color: '#18181b',
        background: focused ? '#fbfaf9' : '#fff',
        boxShadow: focused ? '0 0 0 3px rgba(13,148,136,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.2s',
      }}
    />
  );
}

function SelectField({ value, onChange, options, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...rest} value={value} onChange={onChange}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '11px 14px',
        border: `1.5px solid ${focused ? '#0d9488' : '#e7e5e4'}`,
        borderRadius: '10px', fontSize: '15.5px', color: '#18181b',
        background: focused ? '#fbfaf9' : '#fff',
        boxShadow: focused ? '0 0 0 3px rgba(13,148,136,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.2s', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
        paddingRight: '36px', cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

// Fields to hide from the form — handled internally
const HIDDEN_FIELDS = ['demo_scenario'];

export default function WorkflowForm({ vertical, onSubmit, onBack, loading }) {
  const initialForm = Object.fromEntries(vertical.form_fields.map(f => [f.key, f.options ? f.options[0] : '']));
  const [form, setForm] = useState(initialForm);
  const [denialDemo, setDenialDemo] = useState(false);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const dictate = (k) => (t) => setForm(f => ({ ...f, [k]: f[k] ? `${f[k]} ${t}` : t }));
  // Free-text fields only; IDs, codes and numbers are better typed.
  const canDictate = (f) => f.type === 'textarea' || /name|^requesting_physician$/i.test(f.key);
  const loadDemo = () => setForm({ ...initialForm, ...vertical.demo_data, demo_scenario: denialDemo ? 'Denial + Auto-Appeal' : 'Standard Approval' });

  const visibleFields = vertical.form_fields.filter(f => !HIDDEN_FIELDS.includes(f.key));

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalForm = {
      ...form,
      demo_scenario: denialDemo ? 'Denial + Auto-Appeal' : 'Standard Approval',
    };
    onSubmit(finalForm, 'groq');
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '36px 24px' }}>

      {/* Back */}
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#71717a', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '24px', padding: '0' }}
        onMouseEnter={e => e.currentTarget.style.color = '#18181b'}
        onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
      >
        ← Back to home
      </button>

      <div className="fade-up card" style={{ borderRadius: '24px', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(180deg,#f0fdfa,#ffffff)', borderBottom: '1px solid #e7e5e4', padding: '26px 36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ccfbf1', color: '#0f766e' }}>
                <Icon name="clipboard" size={24} />
              </span>
              <div>
                <h2 className="serif" style={{ margin: '0 0 4px', color: '#18181b', fontSize: 26, fontWeight: 700 }}>{vertical.name}</h2>
                <p style={{ margin: 0, color: '#52525b', fontSize: 14.5 }}>Fill this in once. MedBridge prepares it and shows you the result to approve.</p>
              </div>
            </div>
            <button type="button" onClick={loadDemo}
              style={{ background: 'white', border: '1px solid #d4d4d8', color: '#18181b', padding: '9px 18px', borderRadius: 100, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 1px 2px rgba(24,24,27,0.05)' }}>
              <Icon name="sparkle" size={16} /> Try Demo
            </button>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Simulated payer', 'MIMIC-IV demo data', 'Do not enter real patient data', ...(voiceSupported ? ['Dictation uses your browser speech service'] : [])].map(t => (
              <span key={t} style={{ fontSize: 12, fontWeight: 700, color: '#52525b', background: 'white', border: '1px solid #e7e5e4', borderRadius: 100, padding: '3px 10px' }}>{t}</span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '32px 36px' }}>

          {/* Dynamic fields */}
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {visibleFields.map(f => (
              <div key={f.key} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto' }}>
                <Field label={f.label} required={f.required} action={canDictate(f) ? <MicButton label={f.label} onText={dictate(f.key)} /> : null}>
                  {f.type === 'select' ? (
                    <SelectField value={form[f.key] || ''} onChange={upd(f.key)} options={f.options} />
                  ) : f.type === 'textarea' ? (
                    <textarea
                      required={f.required} rows={3}
                      value={form[f.key] || ''}
                      onChange={upd(f.key)}
                      placeholder={f.placeholder}
                      style={{
                        width: '100%', padding: '11px 14px',
                        border: '1.5px solid #e7e5e4', borderRadius: '10px',
                        fontSize: '15.5px', color: '#18181b', resize: 'vertical',
                        lineHeight: '1.6', transition: 'all 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#0d9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = '#e7e5e4'; e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
                    />
                  ) : (
                    <Input required={f.required} type={f.type} value={form[f.key] || ''} onChange={upd(f.key)} placeholder={f.placeholder} />
                  )}
                </Field>
              </div>
            ))}
          </div>

          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e7e5e4 20%, #e7e5e4 80%, transparent)', margin: '4px 0 28px' }} />

          {/* Denial demo toggle */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#3f3f46', marginBottom: '12px' }}>
              Scenario to demonstrate
            </div>
            <div className="scenario-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { v: false, label: 'Standard Approval',    sub: 'Auth submitted and approved',          icon: 'checkcircle', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
                { v: true,  label: 'Denial + Auto-Appeal', sub: 'Denied → MedBridge files appeal',      icon: 'bolt', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
              ].map(opt => (
                <label key={String(opt.v)} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px',
                  border: `2px solid ${denialDemo === opt.v ? opt.border : '#ece9e6'}`,
                  borderRadius: '14px', cursor: 'pointer',
                  background: denialDemo === opt.v ? opt.bg : 'white',
                  transition: 'all 0.2s',
                  boxShadow: denialDemo === opt.v ? `0 4px 16px ${opt.color}20` : '0 1px 4px rgba(0,0,0,0.04)',
                  transform: denialDemo === opt.v ? 'translateY(-1px)' : 'none',
                }}>
                  <input type="radio" name="denial_demo" checked={denialDemo === opt.v}
                    onChange={() => setDenialDemo(opt.v)} className="sr-only" />
                  <span style={{ color: opt.color, display: 'flex' }}><Icon name={opt.icon} size={26} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15.5px', fontWeight: '800', color: denialDemo === opt.v ? opt.color : '#27272a' }}>{opt.label}</div>
                    <div style={{ fontSize: '13.5px', color: '#52525b', marginTop: '2px' }}>{opt.sub}</div>
                  </div>
                  {denialDemo === opt.v && (
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'white', fontWeight: '800', flexShrink: 0 }}><Icon name="check" size={12} strokeWidth={3.5} /></div>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '16px',
              background: loading ? '#a1a1aa' : 'linear-gradient(180deg,#2a2a31,#0e0e12)',
              color: 'white', border: 'none', borderRadius: '14px',
              fontSize: '15px', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(24,24,27,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.25s', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(24,24,27,0.32)'; } }}
            onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(24,24,27,0.25)'; } }}
          >
            {!loading && <div className="shimmer-overlay" />}
            {loading ? (
              <><span style={{ width: '18px', height: '18px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Launching AI Agent…</>
            ) : (
              <span style={{ position: 'relative', zIndex: 1 }}>
                Prepare request for review →
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
