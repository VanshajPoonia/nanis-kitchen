// A small zip reader and writer. The central directory gives names and sizes,
// and the browser's own DecompressionStream inflates, so no library is needed.

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function findEndRecord(view) {
  // The end record sits in the last 22 bytes plus an optional comment of up to 64 KB.
  const stop = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= stop; i--) {
    if (view.getUint32(i, true) === EOCD) return i;
  }
  throw new Error('Not a zip file. WhatsApp exports end in .zip.');
}

// Sizes and offsets that overflow 32 bits move into the ZIP64 extra field, in this order.
function readZip64Extra(view, start, length, entry) {
  let p = start;
  const end = start + length;
  while (p + 4 <= end) {
    const id = view.getUint16(p, true);
    const size = view.getUint16(p + 2, true);
    if (id === 0x0001) {
      let q = p + 4;
      for (const key of ['size', 'compressedSize', 'offset']) {
        if (entry[key] === 0xffffffff) {
          entry[key] = Number(view.getBigUint64(q, true));
          q += 8;
        }
      }
    }
    p += 4 + size;
  }
}

export function listEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndRecord(view);
  let count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (offset === 0xffffffff || count === 0xffff) {
    const locator = end - 20;
    if (locator < 0 || view.getUint32(locator, true) !== ZIP64_LOCATOR) throw new Error('Broken zip: missing ZIP64 record.');
    const record = Number(view.getBigUint64(locator + 8, true));
    if (view.getUint32(record, true) !== ZIP64_EOCD) throw new Error('Broken zip: bad ZIP64 record.');
    count = Number(view.getBigUint64(record + 32, true));
    offset = Number(view.getBigUint64(record + 48, true));
  }

  const decoder = new TextDecoder();
  const entries = [];
  let p = offset;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== CENTRAL) throw new Error('Broken zip: bad central directory.');
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const entry = {
      name: decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength)),
      method: view.getUint16(p + 10, true),
      crc: view.getUint32(p + 16, true),
      compressedSize: view.getUint32(p + 20, true),
      size: view.getUint32(p + 24, true),
      offset: view.getUint32(p + 42, true),
    };
    readZip64Extra(view, p + 46 + nameLength, extraLength, entry);
    if (!entry.name.endsWith('/')) entries.push(entry);
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readEntry(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== LOCAL) throw new Error(`Broken zip: bad header for ${entry.name}.`);
  // The local header's own extra field can differ from the central one, so read its length here.
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const raw = bytes.subarray(start, start + entry.compressedSize);
  let data;
  if (entry.method === 0) data = raw.slice();
  else if (entry.method === 8) data = await inflate(raw);
  else throw new Error(`${entry.name} uses zip method ${entry.method}, which this reader does not support.`);
  if (crc32(data) !== entry.crc) throw new Error(`${entry.name} is damaged (checksum mismatch).`);
  return data;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

// Stored, not deflated: the payload is mostly Opus and m4a, which are already compressed.
export function writeZip(files, date = new Date()) {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(date);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, CENTRAL, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  if (offset > 0xfffffffe) throw new Error('That is more than 4 GB of audio. Export fewer recipes at a time.');
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, EOCD, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
