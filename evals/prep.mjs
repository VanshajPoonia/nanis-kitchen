// Builds the eval clips: real read speech from FLEURS, plus synthetic recipe memos.
// Usage: node evals/prep.mjs <data-dir> [clips-per-language]
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const perLang = Number(process.argv[3] || 10);
if (!dir) {
  console.error('Usage: node evals/prep.mjs <data-dir> [clips-per-language]');
  process.exit(1);
}

const FLEURS = 'https://huggingface.co/datasets/google/fleurs/resolve/main/data';
const CONFIGS = { hi: 'hi_in', pa: 'pa_in', ta: 'ta_in' };
const manifest = [];

function readTsv(path) {
  return readFileSync(path, 'utf8').trim().split('\n').map((line) => line.split('\t'));
}

mkdirSync(join(dir, 'en_us'), { recursive: true });
const enTsv = join(dir, 'en_us', 'test.tsv');
if (!existsSync(enTsv)) execFileSync('curl', ['-sL', `${FLEURS}/en_us/test.tsv`, '-o', enTsv]);
const english = new Map(readTsv(enTsv).map((row) => [row[0], row[2]]));

for (const [lang, config] of Object.entries(CONFIGS)) {
  const out = join(dir, config);
  mkdirSync(out, { recursive: true });
  const tsv = join(out, 'test.tsv');
  if (!existsSync(tsv)) execFileSync('curl', ['-sL', `${FLEURS}/${config}/test.tsv`, '-o', tsv]);
  // The test tarball is 250 to 500 MB. The first 12 MB holds about 20 clips, which is plenty.
  if (!readdirSync(out, { recursive: true }).some((f) => String(f).endsWith('.wav'))) {
    execSync(`curl -sL "${FLEURS}/${config}/audio/test.tar.gz" | head -c 12000000 | tar -xzf - -C "${out}" 2>/dev/null || true`);
  }
  const byFile = new Map(readTsv(tsv).map((row) => [row[1], row]));
  const wavs = readdirSync(out, { recursive: true }).map(String).filter((f) => f.endsWith('.wav')).sort();
  let taken = 0;
  for (const wav of wavs) {
    const row = byFile.get(wav.split('/').pop());
    if (!row || !english.has(row[0])) continue;
    manifest.push({ id: `fleurs-${config}-${row[0]}-${taken}`, source: 'fleurs', lang, file: join(config, wav), ref: row[2], en: english.get(row[0]) });
    if (++taken >= perLang) break;
  }
}

// macOS ships Hindi (Lekha) and Tamil (Vani) voices. There is no Punjabi voice, so Punjabi is FLEURS only.
const synthetic = JSON.parse(readFileSync(new URL('./synthetic.json', import.meta.url), 'utf8'));
let haveSay = true;
try { execFileSync('which', ['say']); } catch { haveSay = false; }
if (haveSay) {
  mkdirSync(join(dir, 'synthetic'), { recursive: true });
  for (const clip of synthetic) {
    const aiff = join(dir, 'synthetic', `${clip.id}.aiff`);
    const opus = join(dir, 'synthetic', `${clip.id}.opus`);
    // 16 kbps mono Opus in Ogg, the same shape as a WhatsApp voice note.
    if (!existsSync(opus)) {
      execFileSync('say', ['-v', clip.voice, '-o', aiff, clip.text]);
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', aiff, '-ac', '1', '-ar', '16000', '-c:a', 'libopus', '-b:a', '16k', opus]);
    }
    manifest.push({ id: `synthetic-${clip.id}`, source: 'synthetic', lang: clip.lang, file: join('synthetic', `${clip.id}.opus`), ref: clip.text, en: clip.en });
  }
} else {
  console.warn('No `say` command, skipping the synthetic clips.');
}

writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${manifest.length} clips to ${join(dir, 'manifest.json')}`);
