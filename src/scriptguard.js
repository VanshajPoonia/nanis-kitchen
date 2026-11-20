// Whisper's smaller models often write Hindi in Urdu script, and Punjabi in Urdu or Devanagari.
// Blocking every vocab token that carries the wrong script's bytes makes the model use the right one.

// Whisper's vocab is byte-level BPE: each byte is stored as one printable character (the GPT-2 table).
const BYTE_OF_CHAR = (() => {
  const printable = [];
  for (let b = 0x21; b <= 0x7e; b++) printable.push(b);
  for (let b = 0xa1; b <= 0xac; b++) printable.push(b);
  for (let b = 0xae; b <= 0xff; b++) printable.push(b);
  const map = new Map(printable.map((b) => [String.fromCharCode(b), b]));
  let shifted = 0;
  for (let b = 0; b < 256; b++) {
    if (!printable.includes(b)) map.set(String.fromCharCode(256 + shifted++), b);
  }
  return map;
})();

// UTF-8 prefixes that only occur inside each script's main Unicode block.
const SCRIPT_BYTES = {
  Arabic: [[0xd8], [0xd9], [0xda], [0xdb]],
  Devanagari: [[0xe0, 0xa4], [0xe0, 0xa5]],
  Gurmukhi: [[0xe0, 0xa8], [0xe0, 0xa9]],
  Tamil: [[0xe0, 0xae], [0xe0, 0xaf]],
};

// Scripts to block for each spoken language, and for the English pass of a bilingual book.
export const BLOCK = {
  hi: ['Arabic'],
  pa: ['Arabic', 'Devanagari'],
  ta: [],
  en: [],
  translate: ['Arabic', 'Devanagari', 'Gurmukhi', 'Tamil'],
};

export function tokenBytes(token) {
  const bytes = [];
  for (const ch of token) {
    const b = BYTE_OF_CHAR.get(ch);
    if (b === undefined) return null;
    bytes.push(b);
  }
  return bytes;
}

function contains(bytes, seq) {
  for (let i = 0; i + seq.length <= bytes.length; i++) {
    if (seq.every((b, k) => bytes[i + k] === b)) return true;
  }
  return false;
}

/** Token ids whose bytes include any of the given scripts. Special tokens like <|hi|> are never blocked. */
export function blockedTokenIds(vocab, scripts) {
  if (!scripts.length) return [];
  const prefixes = scripts.flatMap((s) => SCRIPT_BYTES[s]);
  const ids = [];
  vocab.forEach((token, id) => {
    if (!token || token.startsWith('<|')) return;
    const bytes = tokenBytes(token);
    if (bytes && prefixes.some((p) => contains(bytes, p))) ids.push(id);
  });
  return ids;
}
