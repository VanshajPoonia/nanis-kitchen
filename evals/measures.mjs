// How many of a memo's measures survive Whisper: units found in the reference text versus
// units found in what Whisper wrote, in her script and in English. Reads asr.mjs results.
// Usage: node evals/measures.mjs <results.json> [model]
import { readFileSync } from 'node:fs';
import { findMeasures } from '../src/measures.js';

const [path, model = 'Xenova/whisper-small'] = process.argv.slice(2);
if (!path) {
  console.error('Usage: node evals/measures.mjs <results.json> [model]');
  process.exit(1);
}

const synthetic = JSON.parse(readFileSync(new URL('./synthetic.json', import.meta.url), 'utf8'));
const { rows } = JSON.parse(readFileSync(path, 'utf8'));

// Count units that appear in both lists, so two katoris need two hits.
function overlap(expected, got) {
  const pool = [...got];
  let hits = 0;
  for (const unit of expected) {
    const i = pool.indexOf(unit);
    if (i >= 0) { hits++; pool.splice(i, 1); }
  }
  return hits;
}

let total = 0;
let native = 0;
let english = 0;
for (const clip of synthetic) {
  const row = rows.find((r) => r.model === model && r.id === `synthetic-${clip.id}`);
  if (!row) continue;
  const expected = findMeasures(clip.text).map((m) => m.unit);
  const inNative = overlap(expected, findMeasures(row.native).map((m) => m.unit));
  // English swaps katori for "bowl" and bada chammach for "tbsp", so compare by count only.
  const inEnglish = Math.min(expected.length, findMeasures(row.english).length);
  total += expected.length;
  native += inNative;
  english += inEnglish;
  console.log(`${clip.id}: ${expected.length} measures, ${inNative} found in her script, ${inEnglish} in English`);
}
console.log(`total: ${native}/${total} in her script, ${english}/${total} in English`);
