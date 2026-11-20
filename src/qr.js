// QR codes for the "hear her voice" links in the book. Byte mode at error correction level M,
// which survives about 15% damage: enough for a kitchen book with a turmeric thumbprint on it.
// Follows the ISO/IEC 18004 steps: encode, add Reed-Solomon codewords, place, pick the best mask.

// Indexed by version. Level M only.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const LEVEL_M_BITS = 0b00;

function rawDataModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

export function dataCapacity(ver) {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver];
}

/* ---------- Reed-Solomon over GF(256), polynomial 0x11d ---------- */

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

export function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

export function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
  }
  return result;
}

/* ---------- data codewords ---------- */

export function pickVersion(byteLength) {
  for (let ver = 1; ver <= 40; ver++) {
    const countBits = ver < 10 ? 8 : 16;
    if (4 + countBits + byteLength * 8 <= dataCapacity(ver) * 8) return ver;
  }
  throw new Error('That link is too long for a QR code. Use a shorter base URL.');
}

function dataCodewords(bytes, ver) {
  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacityBits = dataCapacity(ver) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < dataCapacity(ver); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

// Split into blocks, add each block's error correction, then interleave column by column.
export function withErrorCorrection(data, ver) {
  const blocks = BLOCKS[ver];
  const eccLength = ECC_PER_BLOCK[ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const shortBlocks = blocks - (rawCodewords % blocks);
  const shortLength = Math.floor(rawCodewords / blocks) - eccLength;
  const divisor = rsDivisor(eccLength);
  const dataBlocks = [];
  const eccBlocks = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const length = shortLength + (i < shortBlocks ? 0 : 1);
    const block = data.slice(k, k + length);
    k += length;
    dataBlocks.push(block);
    eccBlocks.push(rsRemainder(block, divisor));
  }
  const out = [];
  for (let i = 0; i <= shortLength; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < eccLength; i++) for (const b of eccBlocks) out.push(b[i]);
  return out;
}

/* ---------- format and version bits ---------- */

export function formatBits(mask) {
  const data = (LEVEL_M_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

export function versionBits(ver) {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}

function alignmentPositions(ver) {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 10; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

/* ---------- the matrix ---------- */

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function makeGrid(ver) {
  const size = ver * 4 + 17;
  const dark = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, on) => { dark[r][c] = on; fixed[r][c] = true; };

  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [r0, c0] of [[3, 3], [3, size - 4], [size - 4, 3]]) {
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        const dist = Math.max(Math.abs(dr), Math.abs(dc));
        if (r >= 0 && r < size && c >= 0 && c < size) set(r, c, dist !== 2 && dist !== 4);
      }
    }
  }
  const align = alignmentPositions(ver);
  align.forEach((r, i) => align.forEach((c, j) => {
    const nearFinder = (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0);
    if (nearFinder) return;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }));
  // Reserve the format areas now so data skips them. The real bits go in after masking.
  placeFormat(set, size, 0);
  if (ver >= 7) {
    const bits = versionBits(ver);
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, on);
      set(b, a, on);
    }
  }
  return { size, dark, fixed, set };
}

function placeFormat(set, size, mask) {
  const bits = formatBits(mask);
  const bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(i, 8, bit(i));
  set(7, 8, bit(6));
  set(8, 8, bit(7));
  set(8, 7, bit(8));
  for (let i = 9; i < 15; i++) set(8, 14 - i, bit(i));
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) set(size - 15 + i, 8, bit(i));
  set(size - 8, 8, true);
}

// Two columns at a time from the right, snaking up then down, skipping the vertical timing line.
function placeData(grid, codewords) {
  const { size, dark, fixed } = grid;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (fixed[r][c]) continue;
        dark[r][c] = i < codewords.length * 8 && ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
}

function applyMask(grid, mask) {
  const { size, dark, fixed } = grid;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fixed[r][c] && MASKS[mask](r, c)) dark[r][c] = !dark[r][c];
}

// The spec's four penalty rules. Any mask decodes; the lowest score just scans most reliably.
export function penalty(dark) {
  const size = dark.length;
  let score = 0;
  const lines = [...dark, ...dark[0].map((_, c) => dark.map((row) => row[c]))];
  const finderLike = [[1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) { run++; continue; }
      if (run >= 5) score += run - 2;
      run = 1;
    }
    for (let i = 0; i + 11 <= size; i++) {
      for (const pattern of finderLike) if (pattern.every((v, k) => line[i + k] === (v === 1))) score += 40;
    }
  }
  for (let r = 0; r + 1 < size; r++) {
    for (let c = 0; c + 1 < size; c++) {
      const v = dark[r][c];
      if (dark[r][c + 1] === v && dark[r + 1][c] === v && dark[r + 1][c + 1] === v) score += 3;
    }
  }
  const darkCount = dark.flat().filter(Boolean).length;
  score += Math.floor(Math.abs((darkCount * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

/** Encode text as a QR code. Returns rows of booleans, true for dark. */
export function encode(text, forceMask = null) {
  const bytes = [...new TextEncoder().encode(text)];
  const ver = pickVersion(bytes.length);
  const codewords = withErrorCorrection(dataCodewords(bytes, ver), ver);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== null && mask !== forceMask) continue;
    const grid = makeGrid(ver);
    placeData(grid, codewords);
    applyMask(grid, mask);
    placeFormat(grid.set, grid.size, mask);
    const score = penalty(grid.dark);
    if (!best || score < best.score) best = { score, matrix: grid.dark, version: ver, mask };
  }
  return best;
}

/** An SVG with a four-module quiet zone, sized in millimetres for print. */
export function toSvg(text, { sizeMm = 24, label = 'QR code' } = {}) {
  const { matrix } = encode(text);
  const n = matrix.length + 8;
  let path = '';
  matrix.forEach((row, r) => row.forEach((on, c) => { if (on) path += `M${c + 4} ${r + 4}h1v1h-1z`; }));
  const safeLabel = String(label).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${sizeMm}mm" height="${sizeMm}mm" shape-rendering="crispEdges" role="img" aria-label="${safeLabel}"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
