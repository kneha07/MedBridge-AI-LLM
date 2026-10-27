import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

// Slide-in panel that shows the exact policy passage behind a citation.
export default function CitationDrawer({ cite, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!cite) return undefined;
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [cite, onClose]);
  if (!cite) return null;
  const isUrl = /^https?:/.test(cite.url || '');
  // Portal to <body>: transformed/filtered ancestors would otherwise trap position: fixed.
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(24,24,27,0.35)', backdropFilter: 'blur(2px)' }} />
      <aside role="dialog" aria-modal="true" aria-label={`Source: ${cite.title}`} className="drawer-in"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(480px, 100%)', background: 'white', boxShadow: '-24px 0 60px rgba(24,24,27,0.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #e7e5e4', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ccfbf1', color: '#0f766e' }}><Icon name="book" size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#71717a' }}>Policy source</div>
            <h2 className="serif" style={{ margin: '2px 0 0', fontSize: 21, fontWeight: 700, color: '#18181b', lineHeight: 1.25 }}>{cite.title}</h2>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close source" style={{ border: '1px solid #e7e5e4', background: 'white', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', color: '#3f3f46', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#71717a', marginBottom: 8 }}>Passage retrieved from this source</div>
          <blockquote style={{ margin: 0, padding: '14px 16px', background: '#f0fdfa', borderLeft: '3px solid #0d9488', borderRadius: '0 12px 12px 0', color: '#27272a', fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {cite.passage || 'The passage text was not saved for this source.'}
          </blockquote>
          {cite.synthetic && <p style={{ margin: '14px 0 0', fontSize: 13.5, color: '#92400e' }}>This source is demo data, not an official payer document.</p>}
        </div>
        {isUrl && (
          <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #e7e5e4' }}>
            <a href={cite.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 100, background: 'linear-gradient(180deg,#2a2a31,#0e0e12)', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              Open the full document <Icon name="arrow-right" size={15} />
            </a>
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
}
