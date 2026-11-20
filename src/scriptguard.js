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
  Cyrillic: [[0xd0], [0xd1], [0xd2], [0xd3]],
  Hebrew: [[0xd7]],
  Devanagari: [[0xe0, 0xa4], [0xe0, 0xa5]],
  Bengali: [[0xe0, 0xa6], [0xe0, 0xa7]],
  Gurmukhi: [[0xe0, 0xa8], [0xe0, 0xa9]],
  Gujarati: [[0xe0, 0xaa], [0xe0, 0xab]],
  Oriya: [[0xe0, 0xac], [0xe0, 0xad]],
  Tamil: [[0xe0, 0xae], [0xe0, 0xaf]],
  Telugu: [[0xe0, 0xb0], [0xe0, 0xb1]],
  Kannada: [[0xe0, 0xb2], [0xe0, 0xb3]],
  Malayalam: [[0xe0, 0xb4], [0xe0, 0xb5]],
  Sinhala: [[0xe0, 0xb6], [0xe0, 0xb7]],
  Thai: [[0xe0, 0xb8], [0xe0, 0xb9]],
  CJK: [[0xe3], [0xe4], [0xe5], [0xe6], [0xe7], [0xe8], [0xe9]],
  Hangul: [[0xea], [0xeb], [0xec], [0xed]],
};
const NON_LATIN = Object.keys(SCRIPT_BYTES);
const allBut = (keep) => NON_LATIN.filter((s) => s !== keep);

// Scripts to block for each spoken language, and for the English pass of a bilingual book.
// English letters stay allowed, since grandparents mix in words like "cooker" and "gas".
export const BLOCK = {
  hi: allBut('Devanagari'),
  pa: allBut('Gurmukhi'),
  ta: allBut('Tamil'),
  en: [],
  translate: NON_LATIN,
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
