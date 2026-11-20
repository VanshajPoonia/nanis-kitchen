// Runs the same Whisper models and settings the app uses, on the clips from prep.mjs.
// Usage: node evals/asr.mjs <data-dir> <out.json> [model,model]
// GUARD=1 applies the app's script guard. LANGS=pa,hi limits the languages.
// Needs transformers.js in Node: npm i --no-save @huggingface/transformers@3.7.5
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES } from '../src/languages.js';
import { BLOCK, blockedTokenIds } from '../src/scriptguard.js';
import { cer, chrF, scriptShare, wer } from './metrics.mjs';

const [dir, outPath, modelArg] = process.argv.slice(2);
if (!dir || !outPath) {
  console.error('Usage: node evals/asr.mjs <data-dir> <out.json> [model,model]');
  process.exit(1);
}
const models = (modelArg || 'Xenova/whisper-base,Xenova/whisper-small').split(',');
const { pipeline, env } = await import(process.env.TRANSFORMERS_JS || '@huggingface/transformers');
if (process.env.MODEL_CACHE) env.cacheDir = process.env.MODEL_CACHE;

const langs = process.env.LANGS ? process.env.LANGS.split(',') : null;
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).filter((c) => !langs || langs.includes(c.lang));
const guarded = process.env.GUARD === '1';

// ffmpeg hands back 16 kHz mono float samples for both the FLEURS wavs and the Opus voice notes.
function load(file) {
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', join(dir, file), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function summarize(rows) {
  const summary = [];
  for (const model of models) {
    for (const source of ['fleurs', 'synthetic']) {
      for (const lang of Object.keys(LANGUAGES)) {
        const group = rows.filter((r) => r.model === model && r.source === source && r.lang === lang);
        if (!group.length) continue;
        summary.push({
          model, source, lang, clips: group.length,
          cer: mean(group.map((r) => r.cer)),
          wer: mean(group.map((r) => r.wer)),
          script: mean(group.map((r) => r.script)),
          chrf: mean(group.map((r) => r.chrf)),
          rtf: mean(group.map((r) => r.rtf)),
        });
      }
    }
  }
  return summary;
}

// Saved after every clip, and picked up again on a rerun, so a crash loses one clip, not the run.
const rows = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')).rows.filter((r) => r.guarded === guarded) : [];
const save = () => writeFileSync(outPath, JSON.stringify({ date: new Date().toISOString().slice(0, 10), guarded, summary: summarize(rows), rows }, null, 2));
for (const model of models) {
  if (manifest.every((clip) => rows.some((r) => r.model === model && r.id === clip.id))) continue;
  // q8 is what the app loads on CPU / WASM.
  const asr = await pipeline('automatic-speech-recognition', model, { dtype: 'q8' });
  const guard = (key) => (guarded && BLOCK[key].length ? { bad_words_ids: blockedTokenIds(asr.tokenizer.model.vocab, BLOCK[key]).map((id) => [id]) } : {});
  for (const clip of manifest) {
    if (rows.some((r) => r.model === model && r.id === clip.id)) continue;
    const audio = load(clip.file);
    const opts = { language: LANGUAGES[clip.lang].whisper, chunk_length_s: 30, stride_length_s: 5, return_timestamps: true };
    const t0 = performance.now();
    const native = (await asr(audio, { ...opts, task: 'transcribe', ...guard(clip.lang) })).text.trim();
    const t1 = performance.now();
    const english = (await asr(audio, { ...opts, task: 'translate', ...guard('translate') })).text.trim();
    const row = {
      model, guarded, id: clip.id, source: clip.source, lang: clip.lang,
      seconds: audio.length / 16000,
      cer: cer(clip.ref, native),
      wer: wer(clip.ref, native),
      script: scriptShare(native, LANGUAGES[clip.lang].script),
      chrf: chrF(clip.en, english),
      rtf: (t1 - t0) / 1000 / (audio.length / 16000),
      native, english,
    };
    rows.push(row);
    save();
    console.log(`${model.split('/')[1]} ${clip.id} cer=${row.cer.toFixed(2)} script=${row.script.toFixed(2)} chrF=${row.chrf.toFixed(2)}`);
  }
  await asr.dispose();
}

save();
const summary = summarize(rows);
console.table(summary.map((s) => ({ ...s, model: s.model.split('/')[1], cer: s.cer.toFixed(3), wer: s.wer.toFixed(3), script: s.script.toFixed(3), chrf: s.chrf.toFixed(3), rtf: s.rtf.toFixed(2) })));
