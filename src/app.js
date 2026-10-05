import * as asr from './asr.js';
import { parseRecipe } from './recipe.js';
import * as ollama from './ollama.js';
import * as book from './book.js';

const $ = (id) => document.getElementById(id);

const state = {
  audioBuffer: null,
  decoded: null,
  recipe: null,
  recorder: null,
  recChunks: [],
  recTimer: null,
};

const SAMPLE_TRANSCRIPT = `Okay, so today I am going to make the aloo paratha the way my mother made it, not the way they sell it in the shops. You need about two cups of atta, that is the wheat flour, and a pinch of salt and some water, warm water, not cold. Also four potatoes, medium size, boiled. One green chilli, finely chopped. A small piece of ginger. Half a teaspoon of ajwain, and salt again for the filling, and ghee, plenty of ghee, do not be shy with it. First knead the dough with the water little by little until it is soft, softer than you think, and then cover it and let it rest for twenty minutes. Mash the potatoes while the dough is resting, there should be no lumps at all. Add the chilli and the ginger and the ajwain and the salt to the potatoes and mix it with your hand, not a spoon, your hand knows when it is right. Take a ball of dough and roll it a little, put a spoon of the filling inside, close it like a purse and press it flat. Roll it gently, if the filling comes out you were too greedy. Heat the tawa on medium, put the paratha on, and when you see small bubbles turn it. Now put ghee on both sides and press the edges with the spatula until it is golden. My mother used to say that a paratha made in a hurry tastes like a hurry. When I was a girl we had no gas, only the coal fire, and she would make fifteen of these before anyone woke up. Serve it hot with curd and pickle, never with a fork.`;

/* ---------- model loading ---------- */

function setEngine(stateName, text) {
  $('engineBadge').dataset.state = stateName;
  $('engineText').textContent = text;
}

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
    refreshTranscribeBtn();
  } catch (err) {
    setEngine('error', 'Load failed');
    $('progressText').textContent = err.message;
  } finally {
    $('loadBtn').disabled = false;
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

async function handleFile(file) {
  $('asrStat').textContent = 'Decoding audio…';
  const buf = await file.arrayBuffer();
  const player = $('player');
  player.src = URL.createObjectURL(file);
  player.hidden = false;
  try {
    state.decoded = await asr.decodeAudio(buf);
    $('asrStat').textContent = `${file.name} — ${state.decoded.duration.toFixed(1)}s ready`;
    refreshTranscribeBtn();
  } catch (err) {
    $('asrStat').textContent = `Could not decode that file: ${err.message}`;
  }
}

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
      await handleFile(new File([blob], 'memo.webm', { type: rec.mimeType }));
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
  $('transcriptBox').value = SAMPLE_TRANSCRIPT;
  $('asrStat').textContent = 'Loaded a sample transcript so you can try the structuring without a mic.';
  $('transcriptPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function refreshTranscribeBtn() {
  $('transcribeBtn').disabled = !(state.decoded && $('engineBadge').dataset.state === 'ready');
}

/* ---------- transcription ---------- */

$('transcribeBtn').addEventListener('click', async () => {
  $('transcribeBtn').disabled = true;
  $('transcriptPanel').hidden = false;
  $('transcriptBox').value = '';
  $('asrStat').textContent = 'Listening…';
  const t0 = performance.now();
  try {
    const result = await asr.transcribe(state.decoded.audio, {
      onChunk: (partial) => { $('transcriptBox').value = partial; },
    });
    state.chunks = result.chunks;
    $('transcriptBox').value = result.text;
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const rtf = (state.decoded.duration / parseFloat(secs)).toFixed(1);
    $('asrStat').textContent = `Done in ${secs}s (${rtf}x realtime), entirely on this machine.`;
  } catch (err) {
    $('asrStat').textContent = `Transcription failed: ${err.message}`;
  } finally {
    $('transcribeBtn').disabled = false;
  }
});

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
  if (!transcript) { $('structureStat').textContent = 'Nothing to structure yet.'; return; }
  $('structureBtn').disabled = true;
  try {
    if ($('structurerSelect').value === 'ollama') {
      $('structureStat').textContent = 'Asking the local model…';
      state.recipe = await ollama.structure(transcript, $('ollamaModel').value);
    } else {
      state.recipe = parseRecipe(transcript, state.chunks || []);
    }
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

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function playBtn(time) {
  if (time === null || time === undefined) return '';
  return `<button class="playat" data-t="${time}" title="Hear her say it">▶</button>`;
}

function renderCard(r) {
  const meta = [r.serves && `Serves ${r.serves}`, r.time && `About ${r.time}`, r.temperature].filter(Boolean);
  $('cardMount').innerHTML = `
    <div class="card">
      <input class="cardtitle" id="editTitle" value="${esc(r.title)}" />
      ${meta.length ? `<p class="meta">${esc(meta.join(' · '))}</p>` : ''}
      ${r.ingredients.length ? `<h3>Ingredients</h3><ul class="ing">${r.ingredients.map((i) => `<li>${playBtn(i.time)}${esc(i.text)}</li>`).join('')}</ul>` : '<p class="empty">No quantities were spoken. That is normal; add them by hand after saving.</p>'}
      ${r.steps.length ? `<h3>Method</h3><ol class="steps">${r.steps.map((s) => `<li>${playBtn(s.time)}${esc(s.text)}</li>`).join('')}</ol>` : ''}
      ${r.story.length ? `<h3>In her words</h3>${r.story.map((s) => `<blockquote>${playBtn(s.time)}${esc(s.text)}</blockquote>`).join('')}` : ''}
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

$('saveBtn').addEventListener('click', () => {
  if (!state.recipe) return;
  const titleInput = $('editTitle');
  if (titleInput) state.recipe.title = titleInput.value.trim() || state.recipe.title;
  book.add(state.recipe);
  renderBook();
  $('cardPanel').hidden = true;
  $('bookPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('redoBtn').addEventListener('click', () => {
  state.recipe = null;
  state.decoded = null;
  state.chunks = [];
  $('cardPanel').hidden = true;
  $('transcriptPanel').hidden = true;
  $('transcriptBox').value = '';
  $('player').hidden = true;
  $('asrStat').textContent = '';
  refreshTranscribeBtn();
});

/* ---------- the book ---------- */

function renderBook() {
  const all = book.load();
  $('bookCount').textContent = all.length;
  if (!all.length) {
    $('bookMount').innerHTML = '<p class="empty">Empty. Record one memo and it will not be.</p>';
    return;
  }
  $('bookMount').innerHTML = all.map((r) => `
    <div class="bookitem">
      <div>
        <strong>${esc(r.title)}</strong>
        <span class="sub">${r.ingredients.length} ingredients · ${r.steps.length} steps${r.story.length ? ` · ${r.story.length} memories` : ''}</span>
      </div>
      <button class="del" data-id="${r.id}" title="Remove">×</button>
    </div>`).join('');
  $('bookMount').querySelectorAll('.del').forEach((b) => {
    b.addEventListener('click', () => { book.remove(b.dataset.id); renderBook(); });
  });
}

$('exportMdBtn').addEventListener('click', () => book.download("nanis-kitchen.md", book.toMarkdown(book.load()), 'text/markdown'));
$('exportHtmlBtn').addEventListener('click', () => book.download("nanis-kitchen.html", book.toPrintableHtml(book.load()), 'text/html'));
$('exportJsonBtn').addEventListener('click', () => book.download("nanis-kitchen.json", JSON.stringify(book.load(), null, 2), 'application/json'));
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
$('clearBtn').addEventListener('click', () => {
  if (!book.load().length) return;
  if (!clearArmed) {
    clearArmed = true;
    $('clearBtn').textContent = 'Tap again to delete everything';
    setTimeout(() => { clearArmed = false; $('clearBtn').textContent = 'Clear book'; }, 4000);
    return;
  }
  book.save([]);
  clearArmed = false;
  $('clearBtn').textContent = 'Clear book';
  renderBook();
});

renderBook();
setEngine('idle', 'Model not loaded');
