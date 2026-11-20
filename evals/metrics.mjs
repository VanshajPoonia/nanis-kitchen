// Scoring for the speech evals. Pure functions so the test suite can pin them.

export function normalize(text) {
  return String(text)
    .normalize('NFC')
    .toLowerCase()
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function wer(ref, hyp) {
  const r = normalize(ref).split(' ').filter(Boolean);
  const h = normalize(hyp).split(' ').filter(Boolean);
  return r.length ? editDistance(r, h) / r.length : 0;
}

// Characters are code points, so a Devanagari vowel sign counts as its own character.
export function cer(ref, hyp) {
  const r = [...normalize(ref)];
  const h = [...normalize(hyp)];
  return r.length ? editDistance(r, h) / r.length : 0;
}

// Share of letters written in the expected script. Whisper sometimes writes Punjabi in Devanagari or Urdu.
export function scriptShare(text, script) {
  const letters = String(text).match(/[\p{L}\p{M}]/gu) || [];
  if (!letters.length) return 0;
  const inScript = new RegExp(`\\p{Script=${script}}`, 'u');
  return letters.filter((c) => inScript.test(c)).length / letters.length;
}

function charNgrams(text, n) {
  const chars = [...normalize(text).replace(/ /g, '')];
  const counts = new Map();
  for (let i = 0; i + n <= chars.length; i++) {
    const g = chars.slice(i, i + n).join('');
    counts.set(g, (counts.get(g) || 0) + 1);
  }
  return counts;
}

// chrF (Popović 2015): character n-gram F-score, n up to 6, recall weighted by beta = 2.
export function chrF(ref, hyp, maxN = 6, beta = 2) {
  let precision = 0;
  let recall = 0;
  let orders = 0;
  for (let n = 1; n <= maxN; n++) {
    const r = charNgrams(ref, n);
    const h = charNgrams(hyp, n);
    const rTotal = [...r.values()].reduce((a, b) => a + b, 0);
    const hTotal = [...h.values()].reduce((a, b) => a + b, 0);
    if (!rTotal || !hTotal) continue;
    let match = 0;
    for (const [g, c] of h) match += Math.min(c, r.get(g) || 0);
    precision += match / hTotal;
    recall += match / rTotal;
    orders++;
  }
  if (!orders) return 0;
  precision /= orders;
  recall /= orders;
  if (!precision && !recall) return 0;
  const b2 = beta * beta;
  return ((1 + b2) * precision * recall) / (b2 * precision + recall);
}
