import { cloneElement, useId, useState } from 'react';
import Icon from './Icon';

function Field({ label, required, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
        {label}{required && <span aria-hidden="true" style={{ color: '#b91c1c', marginLeft: '3px' }}>*</span>}
      </label>
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
        border: `1.5px solid ${focused ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: '10px', fontSize: '15.5px', color: '#0f172a',
        background: focused ? '#fafbff' : '#fff',
        boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
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
        border: `1.5px solid ${focused ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: '10px', fontSize: '15.5px', color: '#0f172a',
        background: focused ? '#fafbff' : '#fff',
        boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
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
  const loadDemo = () => setForm({ ...initialForm, ...vertical.demo_data, demo_scenario: denialDemo ? 'Denial + Auto-Appeal' : 'Standard Approval' });

  const colorMap = {
    '#22c55e': { glow: 'rgba(34,197,94,0.5)', shadow: 'rgba(34,197,94,0.2)' },
    '#8b5cf6': { glow: 'rgba(139,92,246,0.5)', shadow: 'rgba(139,92,246,0.2)' },
    '#f59e0b': { glow: 'rgba(245,158,11,0.5)', shadow: 'rgba(245,158,11,0.2)' },
  };
  const palette = colorMap[vertical.color] || { glow: 'rgba(59,130,246,0.5)', shadow: 'rgba(59,130,246,0.2)' };

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
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '24px', padding: '0' }}
        onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
      >
        ← Back to home
      </button>

      <div className="fade-up card" style={{ borderRadius: '24px', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0e2d4a 100%)',
          padding: '28px 36px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '160px', height: '160px', borderRadius: '50%', background: `radial-gradient(circle, ${vertical.color}25, transparent 70%)` }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: `${vertical.color}25`, border: `1.5px solid ${vertical.color}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                boxShadow: `0 0 20px ${palette.shadow}`,
              }}><Icon name="clipboard" size={24} color={vertical.color} /></div>
              <div>
                <h2 style={{ margin: '0 0 5px', color: 'white', fontSize: '20px', fontWeight: '900', letterSpacing: '-0.4px' }}>{vertical.name}</h2>
                <p style={{ margin: 0, color: '#7dd3fc', fontSize: '13px' }}>Fill this in once. MedBridge prepares it and shows you the result to approve.</p>
              </div>
            </div>
            <button
              type="button" onClick={loadDemo}
              style={{
                background: `${vertical.color}20`, border: `1.5px solid ${vertical.color}50`,
                color: vertical.color, padding: '9px 18px', borderRadius: '12px',
                cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.2s',
                boxShadow: `0 0 16px ${palette.shadow}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${vertical.color}35`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${vertical.color}20`; e.currentTarget.style.transform = 'none'; }}
            >
              <Icon name="sparkle" size={16} /> Try Demo
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '32px 36px' }}>

          {/* Dynamic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {visibleFields.map(f => (
              <div key={f.key} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto' }}>
                <Field label={f.label} required={f.required}>
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
                        border: '1.5px solid #e2e8f0', borderRadius: '10px',
                        fontSize: '15.5px', color: '#0f172a', resize: 'vertical',
                        lineHeight: '1.6', transition: 'all 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
                    />
                  ) : (
                    <Input required={f.required} type={f.type} value={form[f.key] || ''} onChange={upd(f.key)} placeholder={f.placeholder} />
                  )}
                </Field>
              </div>
            ))}
          </div>

          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e2e8f0 20%, #e2e8f0 80%, transparent)', margin: '4px 0 28px' }} />

          {/* Denial demo toggle */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '12px' }}>
              Scenario to demonstrate
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { v: false, label: 'Standard Approval',    sub: 'Auth submitted and approved',          icon: 'checkcircle', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
                { v: true,  label: 'Denial + Auto-Appeal', sub: 'Denied → MedBridge files appeal',      icon: 'bolt', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
              ].map(opt => (
                <label key={String(opt.v)} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px',
                  border: `2px solid ${denialDemo === opt.v ? opt.border : '#e8edf3'}`,
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
                    <div style={{ fontSize: '15.5px', fontWeight: '800', color: denialDemo === opt.v ? opt.color : '#1e293b' }}>{opt.label}</div>
                    <div style={{ fontSize: '13.5px', color: '#475569', marginTop: '2px' }}>{opt.sub}</div>
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
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0a1628, #1a3a5c 60%, #2563eb)',
              color: 'white', border: 'none', borderRadius: '14px',
              fontSize: '15px', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(26,58,92,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.25s', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(26,58,92,0.5)'; } }}
            onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,58,92,0.4)'; } }}
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
