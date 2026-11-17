import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { API, apiFetch } from '../api';

// Upload a FHIR R4 patient bundle (or pick a sample). The server keeps the record in memory for two hours and hands
// back an "upload-..." patient ID that the agent looks up like any other.

export default function PatientUpload({ onLoaded, onClear }) {
  const [samples, setSamples] = useState([]);
  const [state, setState] = useState({ status: 'idle' }); // idle | reading | done | error
  const [drag, setDrag] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    apiFetch('/api/patient-records/samples').then(r => (r.ok ? r.json() : [])).then(setSamples).catch(() => setSamples([]));
  }, []);

  const send = async (file, label) => {
    setState({ status: 'reading', label });
    try {
      const body = new FormData();
      body.append('file', file, file.name || 'bundle.json');
      const res = await apiFetch('/api/patient-records/upload', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'The file could not be read.');
      setState({ status: 'done', label, ...data });
      onLoaded(data);
    } catch (e) {
      setState({ status: 'error', label, error: e.message === 'Failed to fetch' ? 'The server could not be reached.' : e.message });
    }
  };

  const loadSample = async (s) => {
    setState({ status: 'reading', label: s.label });
    try {
      const blob = await (await fetch(`${API}/api/patient-records/samples/${s.file}`)).blob();
      send(new File([blob], s.file, { type: 'application/json' }), s.label);
    } catch {
      setState({ status: 'error', label: s.label, error: 'The sample could not be loaded.' });
    }
  };

  const pick = (files) => { const f = files?.[0]; if (f) send(f, f.name); };
  const clear = () => { setState({ status: 'idle' }); if (input.current) input.current.value = ''; onClear(); };

  if (state.status === 'done') return <Loaded state={state} onClear={clear} />;

  return (
    <div>
      <div
        role="button" tabIndex={0} aria-label="Upload a FHIR patient bundle"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
        className="upload-zone" data-drag={drag || undefined} data-busy={state.status === 'reading' || undefined}
      >
        <span className="upload-icon"><Icon name={state.status === 'reading' ? 'clock' : 'file'} size={22} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#18181b', fontSize: 15.5 }}>
            {state.status === 'reading' ? `Reading ${state.label}…` : 'Drop a FHIR patient bundle here, or choose a file'}
          </div>
          <div style={{ color: '#71717a', fontSize: 13.5, marginTop: 2 }}>
            FHIR R4 Bundle (.json), up to 25 MB. Synthetic data only: the record is kept in server memory for 2 hours and not saved.
          </div>
        </div>
        <input ref={input} type="file" accept=".json,application/json,application/fhir+json" hidden onChange={(e) => pick(e.target.files)} />
      </div>
      {state.status === 'error' && (
        <div role="alert" style={{ marginTop: 8, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontWeight: 600 }}>
          {state.label}: {state.error}
        </div>
      )}
      {samples.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#71717a', marginBottom: 6 }}>Or try a sample patient</div>
          <div className="sample-grid">
            {samples.map(s => (
              <div key={s.file} className="sample-card">
                <button type="button" onClick={() => loadSample(s)} disabled={state.status === 'reading'} className="sample-use">
                  <strong>{s.label}</strong>
                  <span>{s.description}</span>
                </button>
                <a href={`${API}/api/patient-records/samples/${s.file}`} download={s.file} className="sample-dl" title="Download the FHIR file">.json</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Loaded({ state, onClear }) {
  const s = state.summary;
  const facts = [
    [s.back_pain_visits, 'back-pain visits'], [s.therapy_sessions, 'therapy sessions'],
    [s.medications, 'pain prescriptions'], [s.prior_imaging || 'No', 'spine imaging'],
  ];
  return (
    <div className="fade-up" style={{ border: '1px solid #99f6e4', background: 'linear-gradient(135deg,#f0fdfa,#ffffff)', borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="upload-icon" style={{ background: '#ccfbf1', color: '#0f766e' }}><Icon name="checkcircle" size={22} /></span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 800, color: '#18181b', fontSize: 16 }}>{s.name}</div>
          <div style={{ color: '#52525b', fontSize: 13.5 }}>
            {s.gender === 'F' ? 'Female' : s.gender === 'M' ? 'Male' : 'Gender not recorded'} · {s.age} y · born {s.birth_date} · {s.diagnoses} diagnoses
          </div>
        </div>
        <button type="button" onClick={onClear} style={{ background: 'white', border: '1px solid #d4d4d8', borderRadius: 100, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="x" size={14} /> Remove
        </button>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '12px 0 4px' }}>
        {facts.map(([v, l]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
            <strong style={{ fontSize: 19, color: '#0f766e', fontVariantNumeric: 'tabular-nums' }}>{v}</strong>
            <span style={{ fontSize: 12.5, color: '#71717a' }}>{l}</span>
          </span>
        ))}
      </div>
      {s.back_pain_diagnoses.length > 0
        ? <div style={{ fontSize: 13.5, color: '#3f3f46', marginTop: 6 }}>
            Back-pain diagnosis: <strong>{s.back_pain_diagnoses[0].title.replace(/ \(finding\)| \(disorder\)/, '')}</strong> (ICD-10 {s.back_pain_diagnoses[0].icd10}, since {s.back_pain_diagnoses[0].onset}). The patient fields and diagnosis code below were filled from the file.
          </div>
        : <div style={{ fontSize: 13.5, color: '#92400e', marginTop: 6 }}>No back-pain diagnosis in this file. The patient fields were filled; enter the diagnosis code yourself.</div>}
    </div>
  );
}
