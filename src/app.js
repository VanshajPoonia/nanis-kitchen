import * as asr from './asr.js';
import { parseRecipe } from './recipe.js';
import * as ollama from './ollama.js';
import * as book from './book.js';
import * as voices from './audiostore.js';
import { openExport } from './whatsapp.js';
import { writeZip } from './zip.js';
import { encodeWav, joinAudio } from './wav.js';
import { conversionNote, findMeasures } from './measures.js';
import { LANGUAGES, dominantScript, isMultilingualModel } from './languages.js';

const $ = (id) => document.getElementById(id);

const state = {
  decoded: null,
  recipe: null,
  recorder: null,
  recChunks: [],
  recTimer: null,
  chunks: [],
  // The voice notes behind the current memo, kept so the book can link to them.
  parts: [],
  whatsapp: null,
};

const SAMPLE_TRANSCRIPT = `Okay, so today I am going to make the aloo paratha the way my mother made it, not the way they sell it in the shops. You need about two cups of atta, that is the wheat flour, and a pinch of salt and some water, warm water, not cold. Also four potatoes, medium size, boiled. One green chilli, finely chopped. A small piece of ginger. Half a teaspoon of ajwain, and salt again for the filling, and ghee, plenty of ghee, do not be shy with it. First knead the dough with the water little by little until it is soft, softer than you think, and then cover it and let it rest for twenty minutes. Mash the potatoes while the dough is resting, there should be no lumps at all. Add the chilli and the ginger and the ajwain and the salt to the potatoes and mix it with your hand, not a spoon, your hand knows when it is right. Take a ball of dough and roll it a little, put a spoon of the filling inside, close it like a purse and press it flat. Roll it gently, if the filling comes out you were too greedy. Heat the tawa on medium, put the paratha on, and when you see small bubbles turn it. Now put ghee on both sides and press the edges with the spatula until it is golden. My mother used to say that a paratha made in a hurry tastes like a hurry. When I was a girl we had no gas, only the coal fire, and she would make fifteen of these before anyone woke up. Serve it hot with curd and pickle, never with a fork.`;

const SCRIPT_NAMES = { Arabic: 'Urdu (Arabic) script', Devanagari: 'Devanagari', Gurmukhi: 'Gurmukhi', Tamil: 'Tamil script', Latin: 'English letters' };

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- language and model ---------- */

function setEngine(stateName, text) {
  $('engineBadge').dataset.state = stateName;
  $('engineText').textContent = text;
}

function language() {
  return $('langSelect').value;
}

function refreshLanguage() {
  const lang = language();
  const L = LANGUAGES[lang];
  $('bilingualWrap').hidden = lang === 'en';
  const hint = $('langHint');
  if (lang === 'en') {
    hint.hidden = true;
  } else {
    if (!isMultilingualModel($('modelSelect').value)) $('modelSelect').value = 'Xenova/whisper-small';
    hint.hidden = false;
    hint.textContent = lang === 'pa'
      ? `${L.name} is Whisper's weakest language of the four. Expect to fix the ${L.native} text by hand. The English version is usually easier to correct.`
      : `${L.name} needs a multilingual model. whisper-small writes ${L.native} far better than whisper-base, so it is picked for you.`;
  }
  refreshTranscribeBtn();
}

$('langSelect').addEventListener('change', refreshLanguage);
$('modelSelect').addEventListener('change', refreshTranscribeBtn);

$('loadBtn').addEventListener('click', async () => {
  const modelId = $('modelSelect').value;
  const device = $('deviceSelect').value;
  $('loadBtn').disabled = true;
  $('progressWrap').hidden = false;
  setEngine('loading', 'Downloading weights…');

  try {
    const { device: used, reused } = await asr.loadModel(modelId, device, (p) => {
      if (p.status === 'progress' && p.total) {
        const pct = Math.round((p.loaded / p.total) * 100);
        $('progressBar').style.width = `${pct}%`;
        $('progressText').textContent = `${p.file} — ${pct}%`;
      } else if (p.status === 'ready') {
        $('progressBar').style.width = '100%';
      }
    });
    $('progressText').textContent = reused ? 'Already loaded.' : 'Cached in this browser. Offline from here.';
    setEngine('ready', `${modelId.split('/')[1]} on ${used.toUpperCase()}`);
  } catch (err) {
    setEngine('error', 'Load failed');
    $('progressText').textContent = err.message;
  } finally {
    $('loadBtn').disabled = false;
    refreshTranscribeBtn();
  }
});

/* ---------- audio input ---------- */

const dropZone = $('dropZone');
dropZone.addEventListener('click', () => $('fileInput').click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
$('fileInput').addEventListener('change', (e) => e.target.files[0] && handleFile(e.target.files[0]));

function isZip(file) {
  return /\.zip$/i.test(file.name) || /zip/.test(file.type);
}

function decodeHelp(err, name) {
  const opus = /\.(opus|ogg)$/i.test(name);
  return opus
    ? `Could not decode ${name}. WhatsApp voice notes need Chrome, Edge, Firefox, or Safari 18.4 or newer. (${err.message})`
    : `Could not decode that file: ${err.message}`;
}

async function handleFile(file) {
  if (isZip(file)) return handleWhatsApp(file);
  $('waPanel').hidden = true;
  $('asrStat').textContent = 'Decoding audio…';
  const buf = await file.arrayBuffer();
  const player = $('player');
  player.src = URL.createObjectURL(file);
  player.hidden = false;
  try {
    state.decoded = await asr.decodeAudio(buf);
    state.parts = [{ name: file.name, type: file.type || 'audio/ogg', data: file }];
    $('asrStat').textContent = `${file.name} — ${state.decoded.duration.toFixed(1)}s ready`;
  } catch (err) {
    state.decoded = null;
    $('asrStat').textContent = decodeHelp(err, file.name);
  }
  refreshTranscribeBtn();
}

/* ---------- WhatsApp chat export ---------- */

async function handleWhatsApp(file) {
  $('asrStat').textContent = 'Opening the chat export…';
  try {
    const exp = await openExport(new Uint8Array(await file.arrayBuffer()));
    state.whatsapp = exp;
    const notes = exp.notes.filter((n) => n.entry);
    if (!notes.length) {
      $('waPanel').hidden = true;
      $('asrStat').textContent = exp.mediaOmitted
        ? 'This chat was exported without media. Export it again and choose Attach media.'
        : 'No voice notes in this zip.';
      return;
    }
    const counts = new Map();
    notes.forEach((n) => counts.set(n.sender || '', (counts.get(n.sender || '') || 0) + 1));
    const senders = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    $('waSender').innerHTML = `<option value="*">Everyone (${notes.length})</option>`
      + senders.map(([s, c]) => `<option value="${esc(s)}">${esc(s || 'Not named in the chat')} (${c})</option>`).join('');
    $('waSender').value = senders[0][0];
    $('waPanel').hidden = false;
    renderWhatsApp();
    $('asrStat').textContent = `${notes.length} voice note${notes.length === 1 ? '' : 's'} found${exp.hasChat ? '' : ', but no chat text, so senders are unknown'}.`;
  } catch (err) {
    $('waPanel').hidden = true;
    $('asrStat').textContent = `Could not open that zip: ${err.message}`;
  }
}

function renderWhatsApp() {
  const sender = $('waSender').value;
  const notes = state.whatsapp.notes.filter((n) => n.entry && (sender === '*' || (n.sender || '') === sender));
  $('waList').innerHTML = notes.map((n) => {
    const i = state.whatsapp.notes.indexOf(n);
    const when = n.date ? `${n.date} ${n.time.slice(0, 5)}` : 'No date';
    return `<div class="wanote">
      <input type="checkbox" id="wa${i}" data-i="${i}" />
      <label for="wa${i}">
        <strong>${esc(when)}</strong> <span class="sub">${esc(n.sender || 'Not in the chat text')}</span>
        ${n.context.map((c) => `<span class="ctx">${esc(c)}</span>`).join('')}
      </label>
      <button class="playat" data-i="${i}" title="Listen">▶</button>
    </div>`;
  }).join('');
  $('waStat').textContent = '';
  $('waList').querySelectorAll('input').forEach((box) => box.addEventListener('change', () => {
    $('waUseBtn').disabled = !$('waList').querySelector('input:checked');
  }));
  $('waList').querySelectorAll('.playat').forEach((b) => b.addEventListener('click', async () => {
    const note = state.whatsapp.notes[+b.dataset.i];
    const bytes = await state.whatsapp.read(note.entry);
    const player = $('player');
    player.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/ogg' }));
    player.hidden = false;
    player.play();
  }));
  $('waUseBtn').disabled = true;
}

$('waSender').addEventListener('change', renderWhatsApp);

$('waUseBtn').addEventListener('click', async () => {
  const picked = [...$('waList').querySelectorAll('input:checked')].map((box) => state.whatsapp.notes[+box.dataset.i]);
  if (!picked.length) return;
  $('waUseBtn').disabled = true;
  $('asrStat').textContent = `Decoding ${picked.length} voice note${picked.length === 1 ? '' : 's'}…`;
  try {
    const parts = [];
    const decoded = [];
    for (const note of picked) {
      const bytes = await state.whatsapp.read(note.entry);
      parts.push({ name: note.file, type: 'audio/ogg', data: new Blob([bytes], { type: 'audio/ogg' }) });
      decoded.push((await asr.decodeAudio(bytes.buffer)).audio);
    }
    const audio = joinAudio(decoded, 16000);
    state.decoded = { audio, duration: audio.length / 16000 };
    state.parts = parts;
    const player = $('player');
    player.src = picked.length === 1
      ? URL.createObjectURL(parts[0].data)
      : URL.createObjectURL(new Blob([encodeWav(audio, 16000)], { type: 'audio/wav' }));
    player.hidden = false;
    const first = picked[0];
    $('asrStat').textContent = `${picked.length} note${picked.length === 1 ? '' : 's'} from ${first.sender || 'the chat'}, ${state.decoded.duration.toFixed(1)}s ready`;
  } catch (err) {
    state.decoded = null;
    $('asrStat').textContent = decodeHelp(err, picked[0].file);
  } finally {
    $('waUseBtn').disabled = false;
    refreshTranscribeBtn();
  }
});

/* ---------- recording ---------- */

$('recBtn').addEventListener('click', async () => {
  if (state.recorder && state.recorder.state === 'recording') {
    state.recorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recChunks = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && state.recChunks.push(e.data);
    rec.onstop = async () => {
      clearInterval(state.recTimer);
      stream.getTracks().forEach((t) => t.stop());
      $('recBtn').textContent = '● Record here';
      $('recBtn').classList.remove('recording');
      const blob = new Blob(state.recChunks, { type: rec.mimeType });
      const ext = /mp4/.test(rec.mimeType) ? 'm4a' : 'webm';
      await handleFile(new File([blob], `memo.${ext}`, { type: rec.mimeType }));
    };
    rec.start();
    state.recorder = rec;
    $('recBtn').textContent = '■ Stop';
    $('recBtn').classList.add('recording');
    const t0 = Date.now();
    state.recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      $('recTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
  } catch (err) {
    $('asrStat').textContent = `Microphone unavailable: ${err.message}`;
  }
});

$('demoBtn').addEventListener('click', () => {
  $('transcriptPanel').hidden = false;
  $('originalWrap').hidden = true;
  $('originalBox').value = '';
  $('transcriptBox').value = SAMPLE_TRANSCRIPT;
  state.parts = [];
  state.chunks = [];
  $('asrStat').textContent = 'Loaded a sample transcript so you can try the structuring without a mic.';
  $('transcriptPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function refreshTranscribeBtn() {
  const ready = state.decoded && $('engineBadge').dataset.state === 'ready';
  const needsMultilingual = language() !== 'en' && !isMultilingualModel(asr.loadedModelId());
  $('transcribeBtn').disabled = !ready || needsMultilingual;
  if (ready && needsMultilingual) $('asrStat').textContent = `Load a multilingual model for ${LANGUAGES[language()].name}.`;
}

/* ---------- transcription ---------- */

$('transcribeBtn').addEventListener('click', async () => {
  const lang = language();
  const L = LANGUAGES[lang];
  const bilingual = lang !== 'en' && $('bilingualBox').checked;
  $('transcribeBtn').disabled = true;
  $('transcriptPanel').hidden = false;
  $('originalWrap').hidden = lang === 'en';
  $('originalBox').value = '';
  $('originalBox').lang = lang;
  $('originalLabel').textContent = `In ${L.name} (${L.native})`;
  $('scriptWarn').hidden = true;
  $('transcriptBox').value = '';
  $('transcriptBox').placeholder = lang !== 'en' && !bilingual ? 'Type an English version here if you want one in the book.' : '';
  $('asrStat').textContent = 'Listening…';
  const t0 = performance.now();
  try {
    if (lang === 'en') {
      const result = await asr.transcribe(state.decoded.audio, { onChunk: (p) => { $('transcriptBox').value = p; } });
      state.chunks = result.chunks;
      $('transcriptBox').value = result.text;
    } else {
      $('asrStat').textContent = `Listening in ${L.name}…`;
      const native = await asr.transcribe(state.decoded.audio, { language: lang, onChunk: (p) => { $('originalBox').value = p; } });
      $('originalBox').value = native.text;
      warnScript(native.text, lang);
      state.chunks = [];
      if (bilingual) {
        $('asrStat').textContent = 'Now writing it in English…';
        const english = await asr.transcribe(state.decoded.audio, { language: lang, task: 'translate', onChunk: (p) => { $('transcriptBox').value = p; } });
        $('transcriptBox').value = english.text;
        state.chunks = english.chunks;
      }
    }
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const rtf = (state.decoded.duration / parseFloat(secs)).toFixed(1);
    $('asrStat').textContent = `Done in ${secs}s (${rtf}x realtime), entirely on this machine.`;
  } catch (err) {
    $('asrStat').textContent = `Transcription failed: ${err.message}`;
  } finally {
    $('transcribeBtn').disabled = false;
  }
});

function warnScript(text, lang) {
  const expected = LANGUAGES[lang].script;
  const got = dominantScript(text);
  const warn = $('scriptWarn');
  warn.hidden = !got || got === expected;
  if (!warn.hidden) {
    warn.textContent = `Whisper wrote this in ${SCRIPT_NAMES[got] || got}, not ${SCRIPT_NAMES[expected]}. Fix it by hand, or keep only the English version.`;
  }
}

/* ---------- structuring ---------- */

$('structurerSelect').addEventListener('change', async (e) => {
  const sel = $('ollamaModel');
  if (e.target.value !== 'ollama') { sel.hidden = true; return; }
  $('structureStat').textContent = 'Looking for Ollama on localhost:11434…';
  const { available, models } = await ollama.detect();
  if (!available || !models.length) {
    $('structureStat').textContent = 'No Ollama found. Run `OLLAMA_ORIGINS=* ollama serve` and pull a model, or stay on the built-in parser.';
    e.target.value = 'rules';
    sel.hidden = true;
    return;
  }
  sel.innerHTML = models.map((m) => `<option value="${m}">${m}</option>`).join('');
  sel.hidden = false;
  $('structureStat').textContent = `${models.length} local model${models.length === 1 ? '' : 's'} available.`;
});

$('structureBtn').addEventListener('click', async () => {
  const transcript = $('transcriptBox').value.trim();
  const original = $('originalWrap').hidden ? '' : $('originalBox').value.trim();
  if (!transcript && !original) { $('structureStat').textContent = 'Nothing to structure yet.'; return; }
  $('structureBtn').disabled = true;
  try {
    if (!transcript) {
      state.recipe = parseRecipe('', []);
      state.recipe.title = 'Untitled recipe';
    } else if ($('structurerSelect').value === 'ollama') {
      $('structureStat').textContent = 'Asking the local model…';
      state.recipe = await ollama.structure(transcript, $('ollamaModel').value);
    } else {
      state.recipe = parseRecipe(transcript, state.chunks || []);
    }
    if (original) state.recipe.original = { language: $('originalBox').lang || language(), text: original };
    $('structureStat').textContent = `Structured by ${state.recipe.source}.`;
    renderCard(state.recipe);
    $('cardPanel').hidden = false;
    $('cardPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    $('structureStat').textContent = `Structuring failed: ${err.message}`;
  } finally {
    $('structureBtn').disabled = false;
  }
});

/* ---------- recipe card ---------- */

function playBtn(time) {
  if (time === null || time === undefined) return '';
  return `<button class="playat" data-t="${time}" title="Hear her say it">▶</button>`;
}

function convSpan(text) {
  const note = conversionNote(text);
  return note ? ` <span class="conv">${esc(note)}</span>` : '';
}

function originalSection(r) {
  const lang = r.original?.language;
  if (!lang || !LANGUAGES[lang] || !r.original.text) return '';
  const L = LANGUAGES[lang];
  const measures = findMeasures(r.original.text);
  return `<h3>In ${esc(L.name)} <span lang="${lang}">${esc(L.native)}</span></h3>
    <p class="original" lang="${lang}">${esc(r.original.text)}</p>
    ${measures.length ? `<ul class="ing">${measures.map((m) => `<li><span lang="${lang}">${esc(m.words)}</span> <span class="conv">${esc(m.note)}</span></li>`).join('')}</ul>` : ''}`;
}

function renderCard(r) {
  const meta = [r.serves && `Serves ${r.serves}`, r.time && `About ${r.time}`, r.temperature].filter(Boolean);
  const lang = r.original?.language;
  $('cardMount').innerHTML = `
    <div class="card">
      <input class="cardtitle" id="editTitle" value="${esc(r.title)}" aria-label="Recipe title" />
      ${lang ? `<input class="cardsub" id="editTitleOriginal" lang="${lang}" value="${esc(r.titleOriginal || '')}" placeholder="Title in ${esc(LANGUAGES[lang].native)} (optional)" aria-label="Title in ${esc(LANGUAGES[lang].name)}" />` : ''}
      ${meta.length ? `<p class="meta">${esc(meta.join(' · '))}</p>` : ''}
      ${r.ingredients.length ? `<h3>Ingredients</h3><ul class="ing">${r.ingredients.map((i) => `<li>${playBtn(i.time)}${esc(i.text)}${convSpan(i.text)}</li>`).join('')}</ul>` : '<p class="empty">No quantities were spoken. That is normal; add them by hand after saving.</p>'}
      ${r.steps.length ? `<h3>Method</h3><ol class="steps">${r.steps.map((s) => `<li>${playBtn(s.time)}${esc(s.text)}</li>`).join('')}</ol>` : ''}
      ${r.story.length ? `<h3>In her words</h3>${r.story.map((s) => `<blockquote>${playBtn(s.time)}${esc(s.text)}</blockquote>`).join('')}` : ''}
      ${originalSection(r)}
    </div>`;
  $('cardMount').querySelectorAll('.playat').forEach((b) => {
    b.addEventListener('click', () => {
      const player = $('player');
      if (!player.src) return;
      player.currentTime = parseFloat(b.dataset.t);
      player.play();
    });
  });
}

$('saveBtn').addEventListener('click', async () => {
  if (!state.recipe) return;
  const titleInput = $('editTitle');
  if (titleInput) state.recipe.title = titleInput.value.trim() || state.recipe.title;
  const originalTitle = $('editTitleOriginal');
  if (originalTitle?.value.trim()) state.recipe.titleOriginal = originalTitle.value.trim();
  const all = book.add(state.recipe);
  if (state.parts.length) {
    try {
      await voices.putAudio(all[all.length - 1].id, state.parts);
    } catch (err) {
      $('structureStat').textContent = `Saved the recipe, but this browser would not keep the voice note: ${err.message}`;
    }
  }
  await renderBook();
  $('cardPanel').hidden = true;
  $('bookPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('redoBtn').addEventListener('click', () => {
  state.recipe = null;
  state.decoded = null;
  state.chunks = [];
  state.parts = [];
  $('cardPanel').hidden = true;
  $('transcriptPanel').hidden = true;
  $('transcriptBox').value = '';
  $('originalBox').value = '';
  $('originalWrap').hidden = true;
  $('player').hidden = true;
  $('asrStat').textContent = '';
  refreshTranscribeBtn();
});

/* ---------- the book ---------- */

// Voice notes sit on top of the recipe text, so a storage failure is shown, not fatal.
function reportVoiceError(err) {
  $('voicesStat').textContent = `This browser would not keep the voice notes: ${err.message}`;
}

async function voiceIds() {
  try {
    return new Set(await voices.audioIds());
  } catch (err) {
    reportVoiceError(err);
    return new Set();
  }
}

async function renderBook() {
  const all = book.load();
  $('bookCount').textContent = all.length;
  if (!all.length) {
    $('bookMount').innerHTML = '<p class="empty">Empty. Record one memo and it will not be.</p>';
    return;
  }
  const withVoice = await voiceIds();
  $('bookMount').innerHTML = all.map((r) => `
    <div class="bookitem">
      <div>
        <strong>${esc(r.title)}</strong>${r.titleOriginal ? ` <span lang="${esc(r.original?.language || '')}">${esc(r.titleOriginal)}</span>` : ''}
        <span class="sub">${r.ingredients.length} ingredients · ${r.steps.length} steps${r.story.length ? ` · ${r.story.length} memories` : ''}${r.original?.language ? ` · ${esc(LANGUAGES[r.original.language]?.name || '')}` : ''}${withVoice.has(r.id) ? ' · voice saved' : ''}</span>
      </div>
      <button class="del" data-id="${r.id}" title="Remove">×</button>
    </div>`).join('');
  $('bookMount').querySelectorAll('.del').forEach((b) => {
    b.addEventListener('click', async () => {
      book.remove(b.dataset.id);
      await voices.removeAudio(b.dataset.id).catch(reportVoiceError);
      renderBook();
    });
  });
}

function settings() {
  return { title: $('bookTitle').value.trim() || book.DEFAULT_TITLE, trim: $('trimSelect').value, audioBase: $('audioBase').value.trim() };
}

function fileStem() {
  const stem = settings().title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return stem || 'nanis-kitchen';
}

function initSettings() {
  const s = book.loadSettings();
  $('trimSelect').innerHTML = Object.entries(book.TRIM_SIZES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join('');
  $('bookTitle').value = s.title;
  $('trimSelect').value = s.trim;
  $('audioBase').value = s.audioBase;
  for (const id of ['bookTitle', 'trimSelect', 'audioBase']) {
    $(id).addEventListener('change', () => book.saveSettings(settings()));
  }
}

$('exportMdBtn').addEventListener('click', () => book.download(`${fileStem()}.md`, book.toMarkdown(book.load(), settings().title), 'text/markdown'));
$('exportHtmlBtn').addEventListener('click', async () => {
  const s = settings();
  const html = book.toPrintableHtml(book.load(), s.title, { trim: s.trim, audioBase: s.audioBase, withAudio: await voiceIds() });
  book.download(`${fileStem()}.html`, html, 'text/html');
});
$('exportJsonBtn').addEventListener('click', () => book.download(`${fileStem()}.json`, JSON.stringify(book.load(), null, 2), 'application/json'));

$('exportVoicesBtn').addEventListener('click', async () => {
  const recipes = book.load();
  const audio = new Map();
  try {
    for (const r of recipes) {
      const parts = await voices.getAudio(r.id);
      if (!parts?.length) continue;
      audio.set(r.id, await Promise.all(parts.map(async (p) => ({ ...p, data: new Uint8Array(await p.data.arrayBuffer()) }))));
    }
  } catch (err) {
    reportVoiceError(err);
    return;
  }
  if (!audio.size) {
    $('voicesStat').textContent = 'No saved voice notes yet. Recipes made from a memo or WhatsApp note keep theirs.';
    return;
  }
  const site = book.buildVoiceSite(recipes, audio, settings().title);
  book.download(`${fileStem()}-voices.zip`, writeZip(site.files), 'application/zip');
  $('voicesStat').textContent = `${site.count} recording${site.count === 1 ? '' : 's'} plus a player page. Unzip, upload the folder, then paste its address above.`;
});

$('importBtn').addEventListener('click', () => $('importInput').click());
$('importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (!Array.isArray(incoming)) throw new Error('Expected a JSON array.');
    book.save([...book.load(), ...incoming]);
    renderBook();
  } catch (err) {
    $('bookMount').insertAdjacentHTML('afterbegin', `<p class="empty">Import failed: ${esc(err.message)}</p>`);
  }
});
// Two taps instead of a modal: confirm dialogs block the page and lose the undo window.
let clearArmed = false;
$('clearBtn').addEventListener('click', async () => {
  if (!book.load().length) return;
  if (!clearArmed) {
    clearArmed = true;
    $('clearBtn').textContent = 'Tap again to delete everything';
    setTimeout(() => { clearArmed = false; $('clearBtn').textContent = 'Clear book'; }, 4000);
    return;
  }
  book.save([]);
  await voices.clearAudio().catch(reportVoiceError);
  clearArmed = false;
  $('clearBtn').textContent = 'Clear book';
  renderBook();
});

initSettings();
renderBook();
refreshLanguage();
setEngine('idle', 'Model not loaded');
