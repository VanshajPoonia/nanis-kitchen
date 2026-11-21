// The book lives in localStorage. No account, no sync, no one else's server.
import { recipeToMarkdown } from './recipe.js';
import { conversionNote, findMeasures, UNITS, volumeText } from './measures.js';
import { LANGUAGES } from './languages.js';
import { toSvg } from './qr.js';

const KEY = 'nanis-kitchen:book:v1';
const SETTINGS_KEY = 'nanis-kitchen:settings:v1';

export const DEFAULT_TITLE = "Nani's Kitchen";

// Notion Press paperback and hardcover trim sizes, in inches. Margins are wider than
// print-on-demand minimums so a 300-page book still reads easily near the spine.
export const TRIM_SIZES = {
  '5x8': { label: '5 × 8 in', width: 5, height: 8, inside: 0.75, outside: 0.5, top: 0.65, bottom: 0.75 },
  '5.5x8.5': { label: '5.5 × 8.5 in', width: 5.5, height: 8.5, inside: 0.75, outside: 0.5, top: 0.65, bottom: 0.75 },
  '6x9': { label: '6 × 9 in', width: 6, height: 9, inside: 0.8, outside: 0.55, top: 0.7, bottom: 0.8 },
  '8.5x8.5': { label: '8.5 × 8.5 in, square, Notion Press suggests it for cookbooks', width: 8.5, height: 8.5, inside: 0.85, outside: 0.6, top: 0.7, bottom: 0.8 },
  '8.5x11': { label: '8.5 × 11 in', width: 8.5, height: 11, inside: 0.85, outside: 0.6, top: 0.75, bottom: 0.85 },
};

export function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function save(recipes) {
  localStorage.setItem(KEY, JSON.stringify(recipes));
}

export function add(recipe) {
  const all = load();
  all.push({ ...recipe, id: crypto.randomUUID(), savedAt: new Date().toISOString() });
  save(all);
  return all;
}

export function remove(id) {
  const all = load().filter((r) => r.id !== id);
  save(all);
  return all;
}

function savedSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function loadSettings() {
  const saved = savedSettings();
  return { title: DEFAULT_TITLE, trim: '6x9', audioBase: '', site: '', embedFonts: true, ...saved, folder: saved.folder || randomFolder() };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function toMarkdown(recipes, title = DEFAULT_TITLE) {
  const parts = [`# ${title}`, '', `*${recipes.length} recipe${recipes.length === 1 ? '' : 's'}, transcribed at home.*`, ''];
  recipes.forEach((r) => {
    parts.push(recipeToMarkdown(r), '---', '');
  });
  return parts.join('\n');
}

/* ---------- voice links ---------- */

// No l, o, 0 or 1, so a folder name read off a screen is not misread. 16 letters is 80 random bits.
const FOLDER_LETTERS = 'abcdefghijkmnpqrstuvwxyz23456789';

export function randomFolder() {
  return `f-${[...crypto.getRandomValues(new Uint8Array(16))].map((b) => FOLDER_LETTERS[b % 32]).join('')}`;
}

export const PLACEHOLDER_SITE = 'recipes.your-domain.com';

// "recipes.example.org" plus a family folder becomes the address the QR codes point to.
export function siteAddress(site, folder) {
  const host = String(site || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  if (!host || /your-domain|your-project/.test(host)) throw new Error('Type your own site first, for example the address Cloudflare gave you.');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) throw new Error(`"${site}" does not look like a web address.`);
  return `https://${host}/${folder}/`;
}

export function addressHasFolder(base, folder) {
  return String(base || '').split('#')[0].replace(/\/?$/, '/').endsWith(`/${folder}/`);
}

// Short and stable, so the printed QR codes stay small. Imported recipes may have no id.
export function audioSlug(recipe, index = 0) {
  if (recipe.id) return recipe.id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
  const fromTitle = String(recipe.title || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  return `${fromTitle || 'recipe'}-${index + 1}`;
}

export function voiceUrl(base, recipe, index = 0) {
  const clean = String(base || '').trim();
  if (!clean) return '';
  return `${clean.split('#')[0].replace(/\/?$/, '/')}#${audioSlug(recipe, index)}`;
}

/* ---------- printable book ---------- */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const FONTS = `
  body { font-family: Georgia, 'Iowan Old Style', 'Noto Serif', serif; }
  :lang(hi) { font-family: 'Noto Serif Devanagari', 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'ITF Devanagari', 'Nirmala UI', 'Mangal', serif; }
  :lang(pa) { font-family: 'Noto Serif Gurmukhi', 'Noto Sans Gurmukhi', 'Mukta Mahee', 'Gurmukhi Sangam MN', 'Gurmukhi MN', 'Nirmala UI', 'Raavi', sans-serif; }
  :lang(ta) { font-family: 'Noto Serif Tamil', 'Noto Sans Tamil', 'Tamil Sangam MN', 'InaiMathi', 'Tamil MN', 'Nirmala UI', 'Latha', serif; }`;

function pageCss(trim) {
  const t = TRIM_SIZES[trim] || TRIM_SIZES['6x9'];
  // The inside margin sits by the spine: on the right of left-hand pages, the left of right-hand ones.
  return `
  @page { size: ${t.width}in ${t.height}in; margin: ${t.top}in ${t.outside}in ${t.bottom}in ${t.inside}in;
    @bottom-center { content: counter(page); font: 9pt Georgia, serif; color: #555; } }
  @page :left { margin-left: ${t.outside}in; margin-right: ${t.inside}in; }
  @page :right { margin-left: ${t.inside}in; margin-right: ${t.outside}in; }
  @page :first { @bottom-center { content: none; } }`;
}

const SCRIPT_LANG = [[/^[a-z]/, null], [/\p{Script=Devanagari}/u, 'hi'], [/\p{Script=Gurmukhi}/u, 'pa'], [/\p{Script=Tamil}/u, 'ta']];

// One example per script the book uses, so every family finds the word they grew up with.
function sayings(words, langs) {
  return SCRIPT_LANG.filter(([, lang]) => !lang || langs.includes(lang)).map(([re, lang]) => {
    const word = words.find((w) => re.test(w));
    if (!word) return '';
    return lang ? `<span lang="${lang}">${esc(word)}</span>` : esc(word);
  }).filter(Boolean).join(', ');
}

function measureGuide(langs) {
  const rows = UNITS.filter((u) => !u.exact && u.key !== 'kilo').map((u) => {
    const amount = u.ml ? volumeText(u.ml) : `${u.grams} g`;
    return `<tr><td>${esc(u.label)}</td><td>${sayings(u.words, langs)}</td><td>${esc(amount)}</td></tr>`;
  });
  return `<section class="guide">
  <h2>How to read the measures</h2>
  <p>Grandparents cook by hand and by eye. Where a recipe says a katori or a mutthi, this book keeps her words and adds a rough modern measure beside them. One cup is 240 ml. Grams depend on the ingredient, so treat them as a starting point and taste as you go.</p>
  <table><thead><tr><th>Measure</th><th>She might say</th><th>Roughly</th></tr></thead><tbody>${rows.join('')}</tbody></table>
</section>`;
}

function recipePage(r, index, { audioBase, withAudio }) {
  const lang = r.original?.language && LANGUAGES[r.original.language] ? r.original.language : null;
  const meta = [r.serves && `Serves ${esc(r.serves)}`, r.time && `About ${esc(r.time)}`, r.temperature && esc(r.temperature)].filter(Boolean).join(' &middot; ');
  const url = audioBase && withAudio.has(r.id) ? voiceUrl(audioBase, r, index) : '';
  const qr = url ? `<figure class="qr">${toSvg(url, { sizeMm: 22, label: `Voice recording of ${r.title}` })}<figcaption>Scan to hear her say it</figcaption></figure>` : '';
  const ingredients = r.ingredients.map((i) => {
    const note = conversionNote(i.text);
    return `<li>${esc(i.text)}${note ? ` <span class="conv">(${esc(note)})</span>` : ''}</li>`;
  }).join('');
  let original = '';
  if (lang && r.original.text) {
    const L = LANGUAGES[lang];
    const measures = findMeasures(r.original.text);
    const measureList = measures.length
      ? `<ul class="her-measures">${measures.map((m) => `<li><span lang="${lang}">${esc(m.words)}</span> <span class="conv">${esc(m.note)}</span></li>`).join('')}</ul>`
      : '';
    original = `<section class="original">
      <h3>In ${esc(L.name)} <span lang="${lang}">${esc(L.native)}</span></h3>
      <div lang="${lang}">${r.original.text.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${measureList}
    </section>`;
  }
  return `
  <article class="recipe">
    <header class="head">
      <div>
        <h2>${esc(r.title)}</h2>
        ${lang && r.titleOriginal ? `<p class="orig-title" lang="${lang}">${esc(r.titleOriginal)}</p>` : ''}
        ${meta ? `<p class="meta">${meta}</p>` : ''}
      </div>
      ${qr}
    </header>
    ${r.ingredients.length ? `<h3>Ingredients</h3><ul>${ingredients}</ul>` : ''}
    ${r.steps.length ? `<h3>Method</h3><ol>${r.steps.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>` : ''}
    ${r.story.length ? `<h3>In her words</h3>${r.story.map((s) => `<blockquote>${esc(s.text)}</blockquote>`).join('')}` : ''}
    ${original}
  </article>`;
}

/** Languages other than English that the book prints, so only their fonts are embedded. */
export function bookLanguages(recipes) {
  const langs = recipes.map((r) => r.original?.language).filter((l) => l && l !== 'en' && LANGUAGES[l]);
  return Object.keys(LANGUAGES).filter((l) => langs.includes(l));
}

/**
 * Reads the bundled fonts for the given languages. `readFile(name)` returns the bytes of
 * assets/fonts/<name>, by fetch in the browser or from disk in tests.
 */
export async function loadBookFonts(langs, readFile) {
  if (!langs.length) return { fonts: [], fontLicense: '' };
  const text = (bytes) => new TextDecoder().decode(bytes);
  const manifest = JSON.parse(text(await readFile('fonts.json')));
  const fonts = [];
  for (const entry of manifest.filter((m) => langs.includes(m.lang))) {
    for (const [weight, f] of Object.entries(entry.files)) {
      fonts.push({ family: entry.family, weight: Number(weight), bytes: await readFile(f.file) });
    }
  }
  return { fonts, fontLicense: text(await readFile('OFL.txt')) };
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Fonts travel inside the book, so every computer prints the same letters. `fonts` is
// [{ family, weight, bytes }] from assets/fonts, and the OFL text rides along as a comment.
function embeddedFonts(fonts, license) {
  if (!fonts?.length) return { css: '', note: '' };
  const css = fonts.map((f) => `
  @font-face { font-family: '${f.family}'; font-style: normal; font-weight: ${f.weight}; font-display: block;
    src: url(data:font/woff2;base64,${toBase64(f.bytes)}) format('woff2'); }`).join('');
  const families = [...new Set(fonts.map((f) => f.family))].join(', ');
  const note = `<!--\nFonts embedded in this book: ${families}, from Fontsource.\n${String(license || '').replace(/--/g, '- -')}\n-->`;
  return { css, note };
}

/**
 * A print-ready HTML book. Open it in Chrome and save as PDF: the page size comes from the
 * book, margins mirror for binding, and fonts that cover Devanagari, Gurmukhi and Tamil are named.
 */
export function toPrintableHtml(recipes, title = DEFAULT_TITLE, options = {}) {
  const { trim = '6x9', audioBase = '', withAudio = new Set(), fonts = [], fontLicense = '' } = options;
  const embedded = embeddedFonts(fonts, fontLicense);
  const t = TRIM_SIZES[trim] || TRIM_SIZES['6x9'];
  const anyOriginal = recipes.some((r) => r.original?.text);
  const anyMeasure = recipes.some((r) => r.ingredients.some((i) => conversionNote(i.text)) || findMeasures(r.original?.text || '').length);
  const pages = recipes.map((r, i) => recipePage(r, i, { audioBase, withAudio })).join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>${pageCss(trim)}${embedded.css}${FONTS}
  body { color: #241c17; line-height: 1.55; font-size: 10.5pt; margin: 0; }
  .title-page { break-after: page; text-align: center; padding-top: 30%; }
  .title-page h1 { font-size: 26pt; margin: 0 0 .4em; }
  .title-page .sub { color: #6b5b4e; font-style: italic; }
  .guide { break-after: page; }
  .guide table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
  .guide th, .guide td { text-align: left; padding: .3em .4em; border-bottom: .5pt solid #bbb; vertical-align: top; }
  .recipe { break-before: page; }
  .head { display: flex; justify-content: space-between; gap: 1em; align-items: flex-start; border-bottom: 1.5pt solid #d9cbbd; margin-bottom: .6em; }
  h2 { font-size: 17pt; margin: 0 0 .15em; line-height: 1.2; }
  .orig-title { font-size: 13pt; margin: 0 0 .2em; }
  h3 { font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; color: #8a4520; margin: 1.3em 0 .4em; break-after: avoid; }
  .original h3 span { text-transform: none; letter-spacing: 0; font-size: 10pt; }
  .meta { color: #6b5b4e; font-style: italic; margin: 0 0 .6em; }
  ul, ol { padding-left: 1.2em; margin: 0; }
  li { margin-bottom: .3em; break-inside: avoid; }
  .conv { color: #6b5b4e; font-size: .9em; white-space: nowrap; }
  blockquote { border-left: 2pt solid #d9a77f; margin: .6em 0; padding: .1em 0 .1em .9em; color: #4a3b30; font-style: italic; break-inside: avoid; }
  .original { margin-top: 1.4em; }
  .original p { margin: 0 0 .5em; line-height: 1.75; }
  .her-measures { list-style: none; padding: 0; font-size: 9.5pt; }
  .qr { margin: 0; text-align: center; flex: none; }
  .qr svg { display: block; }
  .qr figcaption { font-size: 7pt; color: #6b5b4e; max-width: 24mm; line-height: 1.3; }
  .screen-note { font: 14px/1.5 system-ui, sans-serif; background: #fdf0e6; border: 1px solid #e0b089; border-radius: 8px; padding: 12px 16px; margin: 16px; }
  @media screen {
    body { background: #ece6df; padding-bottom: 40px; }
    .title-page, .guide, .recipe { background: #fff; width: ${t.width}in; min-height: ${t.height}in; box-sizing: border-box; margin: 16px auto;
      padding: ${t.top}in ${t.outside}in ${t.bottom}in ${t.inside}in; box-shadow: 0 1px 4px rgba(0,0,0,.15); max-width: calc(100% - 32px); }
  }
  @media print { .screen-note { display: none; } }
</style></head><body>
<div class="screen-note">Print this page to make the PDF: choose <b>Save as PDF</b>, keep <b>Margins: Default</b>, and turn off <b>Headers and footers</b>. The page size (${esc(t.label)}) comes from the book. Nothing prints to the edge of the page, so no bleed is needed.</div>
<section class="title-page">
  <h1>${esc(title)}</h1>
  <p class="sub">${recipes.length} recipe${recipes.length === 1 ? '' : 's'}, in her own words${anyOriginal ? ' and her own language' : ''}.</p>
</section>
${anyMeasure ? measureGuide(bookLanguages(recipes)) : ''}
${pages}
${embedded.note}
</body></html>`;
}

/* ---------- hostable voice files ---------- */

const EXT = { 'audio/ogg': 'opus', 'audio/opus': 'opus', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/aac': 'aac' };

function extensionOf(part) {
  const fromName = String(part.name || '').match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return (fromName || EXT[String(part.type).split(';')[0]] || 'audio').toLowerCase();
}

/**
 * Everything needed to host the voices anywhere static: one player page plus the audio files.
 * The QR code for a recipe points at <base>/#<slug>, so any web host works and no server code is needed.
 * `audio` maps recipe id to [{ name, type, data: Uint8Array }].
 */
export function buildVoiceSite(recipes, audio, title = DEFAULT_TITLE, { folder = '' } = {}) {
  const files = [];
  const manifest = [];
  recipes.forEach((r, i) => {
    const parts = audio.get(r.id);
    if (!parts?.length) return;
    const slug = audioSlug(r, i);
    const paths = parts.map((p, n) => {
      const path = `audio/${slug}${parts.length > 1 ? `-${n + 1}` : ''}.${extensionOf(p)}`;
      files.push({ name: path, data: p.data });
      return path;
    });
    manifest.push({ slug, title: r.title, titleOriginal: r.titleOriginal || '', language: r.original?.language || 'en', parts: paths });
  });
  files.unshift({ name: 'index.html', data: playerPage(manifest, title) });
  if (!folder) return { files, count: manifest.length };
  // One folder per family, plus a Cloudflare Pages rule asking search engines to stay away.
  return {
    files: [{ name: '_headers', data: '/*\n  X-Robots-Tag: noindex, nofollow\n' }, ...files.map((f) => ({ ...f, name: `${folder}/${f.name}` }))],
    count: manifest.length,
  };
}

function playerPage(manifest, title) {
  const data = JSON.stringify(manifest).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
  :root { --bg: #fbf7f2; --ink: #2a211b; --muted: #8b7a6c; --accent: #b0562a; --line: #e9ded1; }
  @media (prefers-color-scheme: dark) { :root { --bg: #171310; --ink: #f0e7de; --muted: #a2907f; --accent: #e0905c; --line: #342a23; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 18px/1.5 Georgia, serif; }
  main { max-width: 32rem; margin: 0 auto; padding: 2rem 16px; }
  h1 { font-size: 1.1rem; color: var(--muted); font-weight: normal; margin: 0 0 1.5rem; }
  h2 { font-size: 1.8rem; margin: 0 0 .3rem; }
  .orig { font-size: 1.3rem; margin: 0 0 1.2rem; }
  audio { width: 100%; margin: .4rem 0; }
  a { color: var(--accent); }
  li { margin: .5rem 0; }
  .note { color: var(--muted); font-size: .9rem; }
</style></head><body><main>
<h1>${esc(title)}</h1>
<div id="view"></div>
</main>
<script>
const recipes = ${data};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const canOpus = document.createElement('audio').canPlayType('audio/ogg; codecs=opus') !== '';
function show() {
  const slug = location.hash.slice(1);
  const r = recipes.find((x) => x.slug === slug);
  const view = document.getElementById('view');
  if (!r) {
    view.innerHTML = '<ul>' + recipes.map((x) => '<li><a href="#' + x.slug + '">' + esc(x.title) + '</a></li>').join('') + '</ul>';
    return;
  }
  const players = r.parts.map((p) => '<audio controls preload="metadata" src="' + p + '"></audio>').join('');
  const oldPhone = !canOpus && r.parts.some((p) => p.endsWith('.opus'))
    ? '<p class="note">This phone may be too old to play WhatsApp voice notes. <a href="' + r.parts[0] + '" download>Download the recording</a> instead.</p>' : '';
  view.innerHTML = '<h2>' + esc(r.title) + '</h2>' + (r.titleOriginal ? '<p class="orig" lang="' + r.language + '">' + esc(r.titleOriginal) + '</p>' : '') + players + oldPhone + '<p class="note"><a href="#">All recipes</a></p>';
  const audios = [...view.querySelectorAll('audio')];
  audios.forEach((a, i) => a.addEventListener('ended', () => audios[i + 1]?.play()));
}
addEventListener('hashchange', show);
show();
</script>
</body></html>`;
}

export function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
