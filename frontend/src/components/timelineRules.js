// Duration rule and therapy coverage for PatientTimeline and the review checklist.

export const DAY = 86400000;
export const toT = (d) => new Date(d + 'T00:00:00Z').getTime();
export const fmt = (t, o = { month: 'short', day: 'numeric', year: 'numeric' }) => new Date(t).toLocaleDateString(undefined, { timeZone: 'UTC', ...o });
export const weeks = (ms) => Math.round((ms / (7 * DAY)) * 10) / 10;

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twelve: 12 };

// The payer's duration rule, read from the retrieved passages (never hard-coded): the first sentence that gives a
// number of weeks and talks about conservative therapy, treatment or improvement.
export function requiredWeeks(passages = []) {
  const re = /(\d{1,2}|one|two|three|four|five|six|eight|ten|twelve)\s*(?:\(\d+\)\s*)?[- ]?weeks?\b/i;
  for (const p of passages) {
    for (const sentence of p.passage.split(/(?<=[.;])\s+/)) {
      const m = sentence.match(re);
      if (m && /conservative|therap|treatment|improve/i.test(sentence)) {
        const n = WORDS[m[1].toLowerCase()] ?? Number(m[1]);
        if (n > 0 && n <= 52) return { weeks: n, quote: sentence.trim().slice(0, 240), source: p.source };
      }
    }
  }
  return null;
}

// Weeks covered by therapy with a recorded end (union of intervals). Open-ended prescriptions are left out:
// "no stop date" in the record is not evidence the patient kept taking the drug.
export function documented(tl) {
  const iv = [...tl.therapy.map(t => [toT(t.start), toT(t.end)]),
    ...tl.medications.filter(m => m.end).map(m => [toT(m.start), toT(m.end)])].sort((a, b) => a[0] - b[0]);
  let total = 0, cur = null;
  for (const [s, e] of iv) {
    if (!cur || s > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [s, e]; } else cur[1] = Math.max(cur[1], e);
  }
  if (cur) total += cur[1] - cur[0];
  return { weeks: weeks(total), start: iv[0]?.[0] };
}

export function therapyCheck(tl, rule) {
  if (!tl) return null;
  const doc = documented(tl);
  if (!rule) return { state: 'unknown', weeks: doc.weeks, detail: `${doc.weeks} weeks of conservative therapy with recorded dates. No duration rule was found in the retrieved policy passages.` };
  const met = doc.weeks >= rule.weeks;
  return {
    state: met ? 'ok' : 'check', weeks: doc.weeks,
    detail: `${doc.weeks} weeks with recorded dates; the cited policy asks for ${rule.weeks}. ${met ? 'Duration looks met; confirm the response to treatment in the notes.' : 'Shorter than the policy asks. Look for therapy not in this record.'}`,
  };
}
