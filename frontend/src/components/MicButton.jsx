import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { SpeechRecognitionImpl as SR } from './speech';

// Dictate into a text field with the browser's speech recognition. Renders nothing where unsupported.
export default function MicButton({ onText, label }) {
  const [on, setOn] = useState(false);
  const rec = useRef(null);
  useEffect(() => () => rec.current?.abort(), []);
  if (!SR) return null;

  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map(x => x[0].transcript).join(' ').trim();
      if (text) onText(text);
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };

  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={`${on ? 'Stop dictating' : 'Dictate'} ${label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 100, cursor: 'pointer',
        fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
        border: `1px solid ${on ? '#fca5a5' : '#e7e5e4'}`, background: on ? '#fef2f2' : 'white', color: on ? '#b91c1c' : '#3f3f46',
      }}>
      {on ? <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1.2s infinite' }} /> : <Icon name="mic" size={13} />}
      {on ? 'Listening… tap to stop' : 'Dictate'}
    </button>
  );
}
