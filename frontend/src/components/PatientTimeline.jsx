import { useEffect, useMemo, useRef, useState } from 'react';

// Conservative-therapy timeline for the review screen. Built from the analyze_medical_records "timeline" payload
// (Synthea outpatient records only; MIMIC admissions have no outpatient history to draw).

import { DAY, toT, fmt, weeks, documented } from './timelineRules';

const LANES = [
  { key: 'visits', label: 'Back-pain visits' },
  { key: 'therapy', label: 'Therapy' },
  { key: 'meds', label: 'Medications' },
  { key: 'imaging', label: 'Spine imaging' },
];
const C = { visit: '#52525b', pt: '#0f766e', med: '#b45309', opioid: '#b91c1c', img: '#7c3aed', rule: '#16a34a', grid: '#e7e5e4', text: '#52525b' };

export default function PatientTimeline({ timeline: tl, rule, source }) {
  const wrap = useRef(null);
  const [w, setW] = useState(720);
  const [all, setAll] = useState(false);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const end = toT(tl.as_of);
    const dates = [tl.first_back_pain_diagnosis_date, ...tl.visits, ...tl.therapy.map(t => t.start), ...tl.medications.map(m => m.start),
      ...tl.imaging.map(i => i.date)].filter(Boolean).map(toT);
    const first = Math.min(...dates, end);
    const capped = end - first > 3 * 365 * DAY;
    const start = (all || !capped ? first : end - 3 * 365 * DAY) - 14 * DAY;
    return { start, end: end + 7 * DAY, capped, doc: documented(tl) };
  }, [tl, all]);

  const narrow = w < 560;
  const left = narrow ? 92 : 128, right = 16, top = 30, laneH = 34;
  const H = top + LANES.length * laneH + 34;
  const x = (t) => left + ((Math.max(t, data.start) - data.start) / (data.end - data.start)) * (w - left - right);
  const laneY = (i) => top + i * laneH + laneH / 2;

  // month or year ticks, depending on span
  const ticks = [];
  const spanDays = (data.end - data.start) / DAY;
  const step = spanDays > 900 ? 12 : spanDays > 400 ? 3 : spanDays > 120 ? 1 : 0.5;
  const d0 = new Date(data.start);
  const m0 = d0.getUTCMonth() + 1;  // first whole month; yearly ticks on 1 January, quarterly on Jan/Apr/Jul/Oct
  let tk = step >= 12 ? Date.UTC(d0.getUTCFullYear() + 1, 0, 1)
    : step === 3 ? Date.UTC(d0.getUTCFullYear(), Math.ceil(m0 / 3) * 3, 1) : Date.UTC(d0.getUTCFullYear(), m0, 1);
  while (tk < data.end) {
    ticks.push(tk);
    const d = new Date(tk);
    tk = step >= 1 ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + step, 1) : tk + 15 * DAY;
  }
  const tickFmt = step >= 12 ? { year: 'numeric' } : { month: 'short', ...(spanDays > 300 ? { year: '2-digit' } : {}) };

  const show = (e, text) => {
    const r = e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect();
    setHover({ x: e.clientX - r.left, y: e.clientY - r.top, text });
  };
  const hov = (text) => ({ onMouseMove: (e) => show(e, text), onMouseLeave: () => setHover(null), style: { cursor: 'default' } });

  const ruleStart = data.doc.start;
  const meds = tl.medications.filter(m => toT(m.end || tl.as_of) >= data.start);

  return (
    <div className="fade-up" style={{ border: '1px solid #e7e5e4', borderRadius: 16, padding: '14px 16px 10px', background: 'linear-gradient(180deg,#ffffff,#fafaf9)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 2 }}>
        <div style={{ fontWeight: 800, color: '#18181b', fontSize: 16 }}>Conservative therapy timeline</div>
        <div style={{ fontSize: 13, color: '#71717a' }}>{source || 'Synthetic outpatient record'} · as of {fmt(toT(tl.as_of))}</div>
        {data.capped && (
          <button type="button" onClick={() => setAll(a => !a)} style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: '#0f766e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {all ? 'Last 3 years' : 'Whole history'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '8px 0 4px' }}>
        <Stat value={`${data.doc.weeks} wks`} label="therapy with recorded dates" color={C.pt} />
        {rule && <Stat value={`${rule.weeks} wks`} label="asked for by the cited policy" color={C.rule} />}
        <Stat value={tl.visits.length} label="back-pain visits" color={C.visit} />
        <Stat value={tl.imaging.length || 'None'} label="prior spine imaging" color={C.img} />
      </div>

      <div ref={wrap} style={{ position: 'relative' }}>
        <svg width={w} height={H} role="img" aria-label={`Timeline: ${data.doc.weeks} weeks of conservative therapy${rule ? `, policy asks for ${rule.weeks}` : ''}`} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="tl-open" x1="0" x2="1">
              <stop offset="0" stopColor={C.med} stopOpacity="0.55" /><stop offset="1" stopColor={C.med} stopOpacity="0" />
            </linearGradient>
            <pattern id="tl-rule" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={C.rule} fillOpacity="0.08" /><line x1="0" y1="0" x2="0" y2="6" stroke={C.rule} strokeOpacity="0.25" strokeWidth="2" />
            </pattern>
          </defs>

          {ticks.map(t => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 26} stroke={C.grid} />
              <text x={x(t)} y={H - 10} fontSize="11" fill={C.text} textAnchor="middle">{fmt(t, tickFmt)}</text>
            </g>
          ))}
          {LANES.map((l, i) => (
            <g key={l.key}>
              <rect x={left} y={laneY(i) - laneH / 2 + 3} width={w - left - right} height={laneH - 6} rx="6" fill={i % 2 ? '#fafaf9' : '#f5f5f4'} opacity="0.6" />
              <text x={left - 10} y={laneY(i) + 4} fontSize={narrow ? 11 : 12.5} fontWeight="600" fill="#3f3f46" textAnchor="end">{l.label}</text>
            </g>
          ))}

          {rule && ruleStart && ruleStart >= data.start && (
            <g {...hov(`Policy (${rule.source}): "${rule.quote}"`)}>
              <rect x={x(ruleStart)} y={top - 4} width={Math.max(2, x(ruleStart + rule.weeks * 7 * DAY) - x(ruleStart))} height={LANES.length * laneH + 2} fill="url(#tl-rule)" rx="4" />
              <line x1={x(ruleStart + rule.weeks * 7 * DAY)} x2={x(ruleStart + rule.weeks * 7 * DAY)} y1={top - 12} y2={H - 26} stroke={C.rule} strokeWidth="2" strokeDasharray="4 3" />
              <text x={x(ruleStart + rule.weeks * 7 * DAY) + 4} y={top - 14} fontSize="11.5" fontWeight="800" fill={C.rule}>Policy: {rule.weeks} wks</text>
            </g>
          )}

          {tl.first_back_pain_diagnosis_date && toT(tl.first_back_pain_diagnosis_date) >= data.start && (
            <g {...hov(`First back-pain diagnosis: ${fmt(toT(tl.first_back_pain_diagnosis_date))}`)}>
              <line x1={x(toT(tl.first_back_pain_diagnosis_date))} x2={x(toT(tl.first_back_pain_diagnosis_date))} y1={top - 4} y2={H - 26} stroke="#18181b" strokeWidth="1.5" />
              <circle cx={x(toT(tl.first_back_pain_diagnosis_date))} cy={top - 4} r="4" fill="#18181b" />
              {!rule && <text x={x(toT(tl.first_back_pain_diagnosis_date)) + 6} y={top - 10} fontSize="11.5" fontWeight="700" fill="#18181b">Diagnosis</text>}
            </g>
          )}

          {tl.visits.filter(v => toT(v) >= data.start).map((v, i) => (
            <circle key={i} cx={x(toT(v))} cy={laneY(0)} r="5" fill="white" stroke={C.visit} strokeWidth="2" {...hov(`Back-pain visit · ${fmt(toT(v))}`)} />
          ))}

          {tl.therapy.map((t, i) => (
            <g key={i}>
              <rect x={x(toT(t.start))} y={laneY(1) - 7} width={Math.max(4, x(toT(t.end)) - x(toT(t.start)))} height="14" rx="7" fill={C.pt} fillOpacity="0.18" stroke={C.pt} strokeOpacity="0.5"
                {...hov(`${cap(t.type)} · ${t.sessions} sessions · ${fmt(toT(t.start))} – ${fmt(toT(t.end))} (${weeks(toT(t.end) - toT(t.start))} wks)`)} />
              {(t.session_dates || []).map(s => <circle key={s} cx={x(toT(s))} cy={laneY(1)} r="3.2" fill={C.pt} pointerEvents="none" />)}
            </g>
          ))}

          {meds.map((m, i) => {
            const s = x(toT(m.start)), e = x(toT(m.end || tl.as_of)), color = m.opioid ? C.opioid : C.med;
            const y = laneY(2) - 6 + (i % 2) * 6;
            if (m.stop_date_unknown) {  // uploaded FHIR: prescribed on this date, stop date not in the file
              const same = meds.filter(o => o.stop_date_unknown && o.start === m.start);
              if (same[0] !== m) return null;  // one mark per date; the tooltip lists them all
              return <circle key={i} cx={s} cy={laneY(2)} r="4.5" fill="white" stroke={same.some(o => o.opioid) ? C.opioid : color} strokeWidth="2"
                {...hov(`Prescribed ${fmt(toT(m.start))}: ${same.map(o => o.name + (o.opioid ? ' (opioid)' : '')).join('; ')} · stop date not in the file`)} />;
            }
            return (
              <rect key={i} x={s} y={y} width={Math.max(4, e - s)} height="6" rx="3" fill={m.end ? color : 'url(#tl-open)'} stroke={m.end ? 'none' : color} strokeDasharray={m.end ? undefined : '3 3'} strokeOpacity="0.6"
                {...hov(`${m.name}${m.opioid ? ' (opioid)' : ''} · ${fmt(toT(m.start))} – ${m.end ? fmt(toT(m.end)) : 'no stop date on record'}`)} />
            );
          })}

          {tl.imaging.filter(im => toT(im.date) >= data.start).map((im, i) => {
            const cx = x(toT(im.date)), cy = laneY(3);
            return <path key={i} d={`M${cx} ${cy - 7} L${cx + 7} ${cy} L${cx} ${cy + 7} L${cx - 7} ${cy} Z`} fill={C.img} {...hov(`${im.modality} · ${im.body_site} · ${fmt(toT(im.date))}`)} />;
          })}
          {!tl.imaging.length && <text x={left + 10} y={laneY(3) + 4} fontSize="12" fill="#a1a1aa" fontStyle="italic">{source?.startsWith('Uploaded') ? 'None in the file' : 'None in record (Synthea does not model lumbar imaging)'}</text>}
        </svg>
        {hover && (
          <div role="tooltip" style={{ position: 'absolute', left: Math.min(hover.x + 12, w - 260), top: hover.y + 14, maxWidth: 260, background: '#18181b', color: 'white', fontSize: 12.5, lineHeight: 1.4, padding: '7px 10px', borderRadius: 8, pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 2 }}>
            {hover.text}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#52525b', padding: '2px 0 4px' }}>
        <Key swatch={<span style={{ width: 9, height: 9, borderRadius: '50%', border: `2px solid ${C.visit}` }} />} text="Visit" />
        <Key swatch={<span style={{ width: 16, height: 8, borderRadius: 4, background: `${C.pt}33`, border: `1px solid ${C.pt}88` }} />} text="Therapy (dots = sessions)" />
        <Key swatch={<span style={{ width: 16, height: 5, borderRadius: 3, background: C.med }} />} text="Medication" />
        <Key swatch={<span style={{ width: 16, height: 5, borderRadius: 3, background: C.opioid }} />} text="Opioid" />
        <Key swatch={<span style={{ width: 16, height: 5, borderRadius: 3, background: `linear-gradient(90deg,${C.med}88,transparent)`, outline: `1px dashed ${C.med}99` }} />} text="Still active (not counted)" />
        {meds.some(m => m.stop_date_unknown) && <Key swatch={<span style={{ width: 9, height: 9, borderRadius: '50%', border: `2px solid ${C.med}` }} />} text="Prescribed, stop date not in file" />}
        {rule && <Key swatch={<span style={{ width: 16, height: 9, background: `${C.rule}22`, borderRight: `2px dashed ${C.rule}` }} />} text="Policy duration" />}
      </div>
    </div>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Stat({ value, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 12.5, color: '#71717a' }}>{label}</span>
    </div>
  );
}

function Key({ swatch, text }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{swatch}{text}</span>;
}
