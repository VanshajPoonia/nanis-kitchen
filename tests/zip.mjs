// Fixtures were zipped with the system `zip -9`, so the reader is tested on real deflate output.
import { readFileSync } from 'node:fs';
import { crc32, listEntries, readEntry, writeZip } from '../src/zip.js';
import { check, section } from './check.mjs';

const fixture = (name) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const opus = fixture('voice-note.opus');

section('zip reader');
const ios = fixture('whatsapp-ios.zip');
const entries = listEntries(ios);
check('lists every file in the zip', entries.length === 4, `got ${entries.length}`);
check('sees deflate as the method', entries.every((e) => e.method === 8));
const chat = new TextDecoder().decode(await readEntry(ios, entries.find((e) => e.name === '_chat.txt')));
check('inflates the chat text', chat.includes('how do you make kadhi'));
const note = await readEntry(ios, entries.find((e) => e.name.endsWith('.opus')));
check('inflates audio byte for byte', note.length === opus.length && note.every((b, i) => b === opus[i]));
check('crc32 matches the known value', crc32(new TextEncoder().encode('123456789')) === 0xcbf43926);
let threw = '';
try { listEntries(new Uint8Array(100)); } catch (err) { threw = err.message; }
check('rejects a file that is not a zip', threw.includes('Not a zip'));

section('zip writer');
const written = writeZip([{ name: 'index.html', data: '<p>hi</p>' }, { name: 'audio/nani.opus', data: opus }], new Date(2026, 10, 20, 10, 30));
const back = listEntries(written);
check('round-trips the file names', back.map((e) => e.name).join() === 'index.html,audio/nani.opus');
const html = new TextDecoder().decode(await readEntry(written, back[0]));
check('round-trips text', html === '<p>hi</p>');
const audio = await readEntry(written, back[1]);
check('round-trips binary', audio.length === opus.length && audio.every((b, i) => b === opus[i]));
let damaged = '';
const broken = written.slice();
broken[42] ^= 0xff; // inside the first file's data, which starts at 30 + name length
try { await readEntry(broken, listEntries(broken)[0]); } catch (err) { damaged = err.message; }
check('notices a damaged file', damaged.includes('damaged'));
