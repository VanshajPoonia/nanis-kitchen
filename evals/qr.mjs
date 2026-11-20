// Round-trips our QR codes through Apple's CoreImage decoder: every version from 1 to 15, all eight masks.
// Usage: node evals/qr.mjs <out.json>   (macOS, needs the `swift` command)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from '../src/qr.js';

const outPath = process.argv[2];
if (!outPath) {
  console.error('Usage: node evals/qr.mjs <out.json>');
  process.exit(1);
}

// 24-bit BMP, 6 px per module, 4-module white border.
function bmp(matrix, scale = 6) {
  const n = (matrix.length + 8) * scale;
  const rowBytes = Math.ceil((n * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + rowBytes * n);
  buf.fill(0xff, 54);
  buf.write('BM', 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(n, 18);
  buf.writeInt32LE(n, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(rowBytes * n, 34);
  for (let y = 0; y < n; y++) {
    const r = Math.floor(y / scale) - 4;
    for (let x = 0; x < n; x++) {
      const c = Math.floor(x / scale) - 4;
      const dark = matrix[r]?.[c] === true;
      if (dark) buf.fill(0, 54 + (n - 1 - y) * rowBytes + x * 3, 54 + (n - 1 - y) * rowBytes + x * 3 + 3);
    }
  }
  return buf;
}

// Links of the shape the book prints, padded to land in each version.
const CAPACITY = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412];
const cases = [];
CAPACITY.forEach((cap, i) => {
  const base = `https://example.com/family-book/#r${i + 1}-`;
  const text = (base + 'x'.repeat(Math.max(0, cap - base.length))).slice(0, cap);
  for (let mask = 0; mask < 8; mask++) cases.push({ version: i + 1, mask, text });
});
cases.push({ version: null, mask: null, text: 'https://example.com/नानी/#रसोई' });

const dir = mkdtempSync(join(tmpdir(), 'qr-eval-'));
const files = cases.map((c, i) => {
  const qr = encode(c.text, c.mask);
  c.gotVersion = qr.version;
  const file = join(dir, `${i}.bmp`);
  writeFileSync(file, bmp(qr.matrix));
  return file;
});
const decoded = execFileSync('swift', [fileURLToPath(new URL('./qr-decode.swift', import.meta.url)), ...files], { encoding: 'utf8' })
  .trim().split('\n').map((line) => JSON.parse(line));
rmSync(dir, { recursive: true });

const results = cases.map((c, i) => ({ version: c.gotVersion, mask: c.mask, bytes: Buffer.byteLength(c.text), ok: decoded[i] === c.text }));
const passed = results.filter((r) => r.ok).length;
writeFileSync(outPath, JSON.stringify({ date: new Date().toISOString().slice(0, 10), decoder: 'CoreImage CIDetector (macOS)', passed, total: results.length, results }, null, 2));
console.log(`${passed}/${results.length} decoded correctly`);
for (const r of results.filter((x) => !x.ok)) console.log(`  failed: version ${r.version}, mask ${r.mask}`);
process.exit(passed === results.length ? 0 : 1);
