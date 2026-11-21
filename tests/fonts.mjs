// The bundled Noto fonts: files match the manifest, the licence ships with them, and the book embeds only what it needs.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { bookLanguages, loadBookFonts, toPrintableHtml } from '../src/book.js';
import { check, section } from './check.mjs';

const readFont = (name) => new Uint8Array(readFileSync(new URL(`../assets/fonts/${name}`, import.meta.url)));
const manifest = JSON.parse(new TextDecoder().decode(readFont('fonts.json')));
const files = manifest.flatMap((m) => Object.values(m.files));

section('bundled fonts');
check('one font family per Indic script', manifest.map((m) => m.lang).join() === 'hi,pa,ta');
check('versions are pinned exactly', manifest.every((m) => /@\d+\.\d+\.\d+$/.test(m.package)));
check('every file matches its checksum', files.every((f) => createHash('sha256').update(readFont(f.file)).digest('hex') === f.sha256));
check('every file is woff2', files.every((f) => new TextDecoder().decode(readFont(f.file).slice(0, 4)) === 'wOF2'));
const total = files.reduce((n, f) => n + f.bytes, 0);
check('all six files come to under 170 KB', total < 170 * 1024, `${(total / 1024).toFixed(0)} KB`);
const ofl = new TextDecoder().decode(readFont('OFL.txt'));
check('the OFL licence ships with them', ofl.includes('SIL OPEN FONT LICENSE Version 1.1'));
check('with all three copyright notices', ['devanagari', 'gurmukhi', 'tamil'].every((s) => ofl.includes(`github.com/notofonts/${s}`)));

const recipe = (id, language, text) => ({ id, title: id, ingredients: [], steps: [], story: [], original: { language, text } });
const hindi = [recipe('a', 'hi', 'एक कटोरी दही')];
const all = [...hindi, recipe('b', 'pa', 'ਇੱਕ ਮੁੱਠੀ ਚੌਲ'), recipe('c', 'ta', 'ஒரு டம்ளர் அரிசி'), recipe('d', 'en', 'two cups')];

section('fonts inside the printed book');
check('knows which scripts a book uses', bookLanguages(all).join() === 'hi,pa,ta' && bookLanguages(hindi).join() === 'hi');
const hindiFonts = await loadBookFonts(bookLanguages(hindi), readFont);
const hindiBook = toPrintableHtml(hindi, 'Book', hindiFonts);
check('embeds regular and bold Devanagari', (hindiBook.match(/@font-face { font-family: 'Noto Serif Devanagari'/g) || []).length === 2);
check('leaves out scripts the book does not use', !hindiBook.includes("font-family: 'Noto Serif Tamil'; font-style"));
const data = hindiBook.match(/url\(data:font\/woff2;base64,([^)]+)\)/)[1];
check('the embedded font is the exact file', Buffer.from(data, 'base64').equals(Buffer.from(readFont(manifest[0].files[400].file))));
check('carries the OFL text', hindiBook.includes('SIL OPEN FONT LICENSE Version 1.1'));
check('a Hindi book stays under 170 KB', hindiBook.length < 170 * 1024, `${(hindiBook.length / 1024).toFixed(0)} KB`);
const allBook = toPrintableHtml(all, 'Book', await loadBookFonts(bookLanguages(all), readFont));
check('a three-script book embeds six fonts', (allBook.match(/@font-face/g) || []).length === 6);
check('a three-script book stays under 250 KB', allBook.length < 250 * 1024, `${(allBook.length / 1024).toFixed(0)} KB`);
const english = toPrintableHtml([recipe('e', 'en', '')], 'Book', await loadBookFonts([], readFont));
check('an English-only book embeds nothing', !english.includes('@font-face') && !english.includes('OPEN FONT LICENSE'));
