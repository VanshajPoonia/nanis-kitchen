// Known values from the QR spec tables. evals/qr.mjs also round-trips codes through a real decoder.
import { encode, formatBits, pickVersion, rsDivisor, rsRemainder, toSvg, versionBits } from '../src/qr.js';
import { check, section } from './check.mjs';

section('Reed-Solomon');
// "HELLO WORLD" at 1-M, the worked example used by most QR tutorials.
const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
const ecc = rsRemainder(data, rsDivisor(10));
check('error correction codewords match the worked example', ecc.join() === '196,35,39,119,235,215,231,226,93,23', ecc.join());

section('format and version information');
const FORMAT_M = ['101010000010010', '101000100100101', '101111001111100', '101101101001011',
  '100010111111001', '100000011001110', '100111110010111', '100101010100000'];
check('format bits for level M, all eight masks', FORMAT_M.every((s, m) => formatBits(m).toString(2).padStart(15, '0') === s));
const VERSION = { 7: '000111110010010100', 8: '001000010110111100', 9: '001001101010011001', 10: '001010010011010011' };
check('version bits for versions 7 to 10', Object.entries(VERSION).every(([v, s]) => versionBits(+v).toString(2).padStart(18, '0') === s));

section('capacity');
// Byte-mode capacity at level M from the spec's table, versions 1 to 10.
const CAPACITY = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
check('fits exactly at each capacity', CAPACITY.every((cap, i) => pickVersion(cap) === i + 1));
check('moves up a version one byte later', CAPACITY.every((cap, i) => pickVersion(cap + 1) === i + 2));
let tooLong = '';
try { pickVersion(5000); } catch (err) { tooLong = err.message; }
check('refuses links that cannot fit', tooLong.includes('too long'));

section('layout');
const link = 'https://example.com/nani/#3f9a2c1e';
const qr = encode(link);
const m = qr.matrix;
const size = m.length;
check('a 34-byte link is version 3', qr.version === 3 && size === 29, `v${qr.version}, ${size}`);
const finderRow = (r, c) => m[r].slice(c, c + 7).map((d) => (d ? 1 : 0)).join('');
check('finder patterns in three corners',
  finderRow(0, 0) === '1111111' && finderRow(2, 0) === '1011101' && finderRow(0, size - 7) === '1111111' && finderRow(size - 1, 0) === '1111111');
check('timing pattern alternates', m[6].slice(8, size - 8).every((d, i) => d === (i % 2 === 0)));
check('dark module is set', m[size - 8][8] === true);
check('same text, same code', encode(link).matrix.flat().join() === m.flat().join());
check('a forced mask is used', encode(link, 5).mask === 5);

section('svg');
const svg = toSvg(link, { sizeMm: 22, label: 'Hear "Nani" <say> it' });
check('sized in millimetres for print', svg.includes('width="22mm"'));
check('has a quiet zone of four modules', svg.includes(`viewBox="0 0 ${size + 8} ${size + 8}"`));
check('escapes the label', svg.includes('aria-label="Hear &quot;Nani&quot; &lt;say&gt; it"'));
