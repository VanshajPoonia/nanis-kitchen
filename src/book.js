// The book lives in localStorage. No account, no sync, no one else's server.
import { recipeToMarkdown } from './recipe.js';

const KEY = 'nanis-kitchen:book:v1';

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

export function toMarkdown(recipes, title = "Nani's Kitchen") {
  const parts = [`# ${title}`, '', `*${recipes.length} recipe${recipes.length === 1 ? '' : 's'}, transcribed at home.*`, ''];
  recipes.forEach((r) => {
    parts.push(recipeToMarkdown(r), '---', '');
  });
  return parts.join('\n');
}

export function toPrintableHtml(recipes, title = "Nani's Kitchen") {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const pages = recipes.map((r) => `
    <article class="recipe">
      <h2>${esc(r.title)}</h2>
      <p class="meta">${[r.serves && `Serves ${esc(r.serves)}`, r.time && `About ${esc(r.time)}`, r.temperature && esc(r.temperature)].filter(Boolean).join(' &middot; ')}</p>
      ${r.ingredients.length ? `<h3>Ingredients</h3><ul>${r.ingredients.map((i) => `<li>${esc(i.text)}</li>`).join('')}</ul>` : ''}
      ${r.steps.length ? `<h3>Method</h3><ol>${r.steps.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>` : ''}
      ${r.story.length ? `<h3>In her words</h3>${r.story.map((s) => `<blockquote>${esc(s.text)}</blockquote>`).join('')}` : ''}
    </article>`).join('\n');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { margin: 22mm; }
  body { font-family: Georgia, 'Iowan Old Style', serif; max-width: 42rem; margin: 0 auto; padding: 3rem 1.5rem; color: #241c17; line-height: 1.65; }
  h1 { font-size: 2.6rem; text-align: center; margin-bottom: .2rem; }
  .sub { text-align: center; color: #8a7a6d; font-style: italic; margin-bottom: 4rem; }
  .recipe { page-break-after: always; margin-bottom: 4rem; }
  .recipe:last-child { page-break-after: auto; }
  h2 { font-size: 1.9rem; border-bottom: 2px solid #e5d9cc; padding-bottom: .4rem; }
  h3 { font-size: .8rem; letter-spacing: .14em; text-transform: uppercase; color: #a8572c; margin-top: 2rem; }
  .meta { color: #8a7a6d; font-style: italic; }
  ul, ol { padding-left: 1.3rem; }
  li { margin-bottom: .45rem; }
  blockquote { border-left: 3px solid #e0b089; margin: 1rem 0; padding: .3rem 0 .3rem 1.2rem; color: #5c4a3d; font-style: italic; }
</style></head><body>
<h1>${esc(title)}</h1>
<p class="sub">Transcribed from her own voice, on a laptop, with nothing sent anywhere.</p>
${pages}
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
