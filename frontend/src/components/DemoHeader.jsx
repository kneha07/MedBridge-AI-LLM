import { useState, useEffect } from 'react';

import Logo from './Logo';
import Icon from './Icon';

export default function DemoHeader({ onReset, onHome, vertical, user, onSignOut }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      role="banner"
      style={{
        background: scrolled
          ? 'rgba(14,14,18,0.96)'
          : 'rgba(14,14,18,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        color: 'white',
        padding: '0 28px',
        height: '74px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 200,
        borderBottom: `1px solid ${scrolled ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: scrolled ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.25)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Logo + wordmark */}
      <button type="button" onClick={onHome} aria-label="MedBridge, go to home page"
        style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'white', textAlign: 'left' }}>
        <Logo size={46} />
        <span style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: '27px', fontWeight: 900, letterSpacing: '-0.9px', lineHeight: 1, color: '#ffffff' }}>
            Med<span style={{ color: '#5eead4' }}>Bridge</span>
          </span>
          <span style={{ display: 'block', fontSize: '11px', color: '#a1a1aa', letterSpacing: '1.3px', textTransform: 'uppercase', marginTop: '5px', fontWeight: 700 }}>
            {vertical ? vertical.name : 'Prior authorization assistant'}
          </span>
        </span>
      </button>

      {/* Center */}
      <div className="header-tagline" style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: '10px',
        fontSize: '13px',
      }}>
        <span style={{ color: '#2dd4bf', fontWeight: '800' }}>Draft</span>
        <span style={{ color: '#52525b' }}>·</span>
        <span style={{ color: '#a1a1aa', fontWeight: '700' }}>Review</span>
        <span style={{ color: '#52525b' }}>·</span>
        <span style={{ color: '#a1a1aa', fontWeight: '700' }}>Submit</span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          role="status"
          aria-label="Live demo active"
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: 'rgba(45,212,191,0.1)',
            border: '1px solid rgba(45,212,191,0.3)',
            padding: '6px 14px',
            borderRadius: '100px',
            boxShadow: '0 0 12px rgba(45,212,191,0.15)',
          }}
        >
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#2dd4bf',
            display: 'inline-block',
            boxShadow: '0 0 8px rgba(45,212,191,0.8)',
            animation: 'pulse 2s infinite'
          }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#2dd4bf', letterSpacing: '1px' }}>
            LIVE DEMO
          </span>
        </div>

        {user && (
          <div className="user-chip">
            <span className={`user-avatar ${user.role}`} aria-hidden="true">{(user.display || user.name)[0].toUpperCase()}</span>
            <span className="user-meta">
              <span className="user-name">{user.display || user.name}</span>
              <span className="user-role">{user.role}</span>
            </span>
            <button type="button" className="user-signout" onClick={onSignOut} aria-label={`Sign out ${user.display || user.name}`} title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
            </button>
          </div>
        )}

        {onReset && (
          <button
            onClick={onReset}
            aria-label="Start a new request"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.13)',
              color: 'rgba(255,255,255,0.75)',
              padding: '7px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.2s',
              letterSpacing: '0.3px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.13)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
            }}
          >
            <Icon name="arrow-left" size={15} /> New request
          </button>
        )}
      </div>
    </header>
  );
}
