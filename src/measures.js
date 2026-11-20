// Kitchen measures as grandparents say them, in Hindi, Punjabi, Tamil and English,
// turned into cups, spoons and grams. Every number is rough on purpose: a katori is
// whatever bowl Nani had. The original words always stay next to the conversion.

export const CUP_ML = 240;

// ड़ can arrive as one code point or two, so every word is compared in NFC.
const nfc = (s) => s.normalize('NFC');
const nfcSet = (words) => new Set(words.map(nfc));

// `ml` for volumes, `grams` for weights. `exact` units are already standard, so only grams are added.
export const UNITS = [
  { key: 'pinch', label: 'pinch', ml: 0.3, words: ['chutki', 'chutkee', 'chuttki', 'चुटकी', 'ਚੁਟਕੀ', 'சிட்டிகை', 'chittikai', 'pinch', 'pinches'] },
  { key: 'fistful', label: 'fistful', ml: 60, words: ['mutthi', 'muthi', 'mutthee', 'muththi', 'मुट्ठी', 'मुठ्ठी', 'ਮੁੱਠੀ', 'ਮੁੱਠ', 'கைப்பிடி', 'kaippidi', 'handful', 'handfuls', 'fistful', 'fistfuls'] },
  { key: 'bowl', label: 'katori (small bowl)', ml: 150, words: ['katori', 'katoree', 'katoriyan', 'कटोरी', 'कटोरियां', 'ਕਟੋਰੀ', 'ਕੌਲੀ', 'kauli', 'கிண்ணம்', 'kinnam', 'bowl', 'bowls'] },
  { key: 'spoon', label: 'chammach (everyday spoon)', ml: 10, words: ['chammach', 'chamach', 'chammuch', 'chamcha', 'चम्मच', 'चमच', 'ਚਮਚ', 'ਚਮਚਾ', 'ਚਮਚੇ', 'கரண்டி', 'karandi', 'spoon', 'spoons', 'spoonful', 'spoonfuls'] },
  { key: 'teaspoon', label: 'teaspoon', ml: 5, exact: true, words: ['தேக்கரண்டி', 'thekkarandi', 'teaspoon', 'teaspoons', 'tsp'] },
  { key: 'tablespoon', label: 'tablespoon', ml: 15, exact: true, words: ['மேசைக்கரண்டி', 'mesaikarandi', 'tablespoon', 'tablespoons', 'tbsp'] },
  { key: 'glass', label: 'glass', ml: 250, words: ['glass', 'glasses', 'gilas', 'gilaas', 'गिलास', 'ग्लास', 'ਗਲਾਸ', 'ਗਿਲਾਸ'] },
  { key: 'tumbler', label: 'tumbler', ml: 200, words: ['tumbler', 'tumblers', 'டம்ளர்', 'dumbler'] },
  { key: 'cup', label: 'cup', ml: CUP_ML, exact: true, words: ['cup', 'cups', 'कप', 'ਕੱਪ', 'கப்'] },
  { key: 'paav', label: 'paav (quarter kilo)', grams: 250, words: ['paav', 'pav', 'paao', 'pao', 'पाव', 'पाओ', 'ਪਾਈਆ', 'paiya'] },
  { key: 'kilo', label: 'kilo', grams: 1000, words: ['kilo', 'kilos', 'kg', 'किलो', 'ਕਿੱਲੋ', 'ਕਿਲੋ', 'கிலோ'] },
];

// Grams per millilitre, rough. Flour is spooned, not packed.
export const INGREDIENTS = [
  { key: 'besan', density: 0.38, words: ['besan', 'बेसन', 'ਵੇਸਣ', 'ਬੇਸਣ', 'கடலை', 'kadalai'] },
  { key: 'maida', density: 0.52, words: ['maida', 'मैदा', 'ਮੈਦਾ', 'மைதா'] },
  { key: 'atta', density: 0.5, words: ['atta', 'aata', 'आटा', 'आटे', 'ਆਟਾ', 'ਆਟੇ', 'மாவு', 'maavu', 'flour'] },
  { key: 'sooji', density: 0.7, words: ['sooji', 'suji', 'rava', 'rawa', 'सूजी', 'रवा', 'ਸੂਜੀ', 'ரவை', 'ravai', 'semolina'] },
  { key: 'rice', density: 0.8, words: ['chawal', 'chaawal', 'चावल', 'ਚੌਲ', 'ਚਾਵਲ', 'அரிசி', 'arisi', 'rice'] },
  { key: 'dal', density: 0.8, words: ['dal', 'daal', 'दाल', 'ਦਾਲ', 'பருப்பு', 'பாசிப்பருப்பு', 'paruppu', 'lentils', 'moong', 'masoor', 'toor'] },
  { key: 'sugar', density: 0.83, words: ['chini', 'cheeni', 'shakkar', 'चीनी', 'शक्कर', 'ਖੰਡ', 'ਚੀਨੀ', 'சர்க்கரை', 'sakkarai', 'sugar'] },
  { key: 'salt', density: 1.2, words: ['namak', 'नमक', 'ਲੂਣ', 'ਨਮਕ', 'உப்பு', 'uppu', 'salt'] },
  { key: 'water', density: 1, words: ['paani', 'pani', 'पानी', 'ਪਾਣੀ', 'தண்ணீர்', 'thanneer', 'water'] },
  { key: 'milk', density: 1.03, words: ['doodh', 'dudh', 'दूध', 'ਦੁੱਧ', 'பால்', 'paal', 'milk'] },
  { key: 'curd', density: 1.03, words: ['dahi', 'दही', 'ਦਹੀਂ', 'ਦਹੀ', 'தயிர்', 'thayir', 'curd', 'yogurt', 'yoghurt'] },
  { key: 'oil', density: 0.92, words: ['tel', 'तेल', 'ਤੇਲ', 'எண்ணெய்', 'ennai', 'oil'] },
  { key: 'ghee', density: 0.91, words: ['ghee', 'ghi', 'घी', 'ਘਿਓ', 'ਘੀ', 'நெய்', 'nei'] },
  { key: 'spice', density: 0.5, words: ['haldi', 'हल्दी', 'ਹਲਦੀ', 'மஞ்சள்', 'turmeric', 'jeera', 'जीरा', 'ਜੀਰਾ', 'சீரகம்', 'cumin', 'ajwain', 'अजवाइन', 'masala', 'मसाला', 'ਮਸਾਲਾ', 'dhaniya', 'धनिया'] },
];

const NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, quarter: 0.25,
  ek: 1, ik: 1, ikk: 1, do: 2, teen: 3, tin: 3, tinn: 3, char: 4, chaar: 4, paanch: 5, panch: 5, panj: 5, chhe: 6,
  aadha: 0.5, adha: 0.5, aadhi: 0.5, adhi: 0.5, aadhe: 0.5, addha: 0.5, paun: 0.75, pauna: 0.75,
  sava: 1.25, dedh: 1.5, derh: 1.5, dhai: 2.5, dhaai: 2.5, adhai: 2.5,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'आधा': 0.5, 'आधी': 0.5, 'आधे': 0.5,
  'पौन': 0.75, 'पौना': 0.75, 'सवा': 1.25, 'डेढ़': 1.5, 'डेढ': 1.5, 'ढाई': 2.5,
  'ਇੱਕ': 1, 'ਇਕ': 1, 'ਦੋ': 2, 'ਤਿੰਨ': 3, 'ਚਾਰ': 4, 'ਪੰਜ': 5, 'ਛੇ': 6, 'ਅੱਧਾ': 0.5, 'ਅੱਧੀ': 0.5, 'ਅੱਧੇ': 0.5,
  'ਪੌਣਾ': 0.75, 'ਸਵਾ': 1.25, 'ਡੇਢ': 1.5, 'ਢਾਈ': 2.5,
  'ஒரு': 1, 'ஒன்று': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'மூணு': 3, 'நான்கு': 4, 'நாலு': 4,
  'ஐந்து': 5, 'அஞ்சு': 5, 'அரை': 0.5, 'கால்': 0.25, 'முக்கால்': 0.75, 'ஒன்றரை': 1.5,
  oru: 1, onnu: 1, rendu: 2, irandu: 2, moonu: 3, naalu: 4, anju: 5, arai: 0.5, kaal: 0.25, mukkal: 0.75,
};
// "sava do" is two and a quarter, "paune do" is one and three quarters.
const PLUS_QUARTER = nfcSet(['sava', 'सवा', 'ਸਵਾ']);
const MINUS_QUARTER = nfcSet(['paune', 'पौने', 'ਪੌਣੇ']);
const SMALL = nfcSet(['chhota', 'chota', 'chhoti', 'choti', 'छोटा', 'छोटी', 'छोटे', 'ਛੋਟਾ', 'ਛੋਟੀ', 'சின்ன', 'small', 'little']);
const BIG = nfcSet(['bada', 'bara', 'badi', 'bari', 'bade', 'बड़ा', 'बड़ी', 'बड़े', 'ਵੱਡਾ', 'ਵੱਡੀ', 'பெரிய', 'big', 'large', 'heaped']);
const FULL = nfcSet(['bhar', 'bhara', 'bhari', 'भर', 'भरा', 'ਭਰ', 'ਭਰਿਆ', 'full']);
const FILLER = nfcSet(['of', 'ka', 'ki', 'ke', 'का', 'की', 'के', 'da', 'di', 'de', 'ਦਾ', 'ਦੀ', 'ਦੇ', 'level', 'about', 'roughly', 'nearly']);

const DIGITS = { '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9,
  '੦': 0, '੧': 1, '੨': 2, '੩': 3, '੪': 4, '੫': 5, '੬': 6, '੭': 7, '੮': 8, '੯': 9,
  '௦': 0, '௧': 1, '௨': 2, '௩': 3, '௪': 4, '௫': 5, '௬': 6, '௭': 7, '௮': 8, '௯': 9 };

const TAMIL = /^\p{Script=Tamil}/u;
for (const list of [UNITS, INGREDIENTS]) for (const item of list) item.words = item.words.map(nfc);
const NUMBER_OF = new Map(Object.entries(NUMBERS).map(([k, v]) => [nfc(k), v]));

function tokenize(text) {
  const tokens = [];
  for (const m of nfc(String(text)).matchAll(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}./]*/gu)) {
    tokens.push({ word: m[0].replace(/[./]+$/, '').toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

function numberOf(word) {
  const ascii = word.replace(/[०-९੦-੯௦-௯]/g, (d) => DIGITS[d]);
  if (/^\d+(\.\d+)?$/.test(ascii)) return parseFloat(ascii);
  if (/^\d+\/\d+$/.test(ascii)) {
    const [a, b] = ascii.split('/').map(Number);
    return b ? a / b : null;
  }
  return NUMBER_OF.get(word) ?? null;
}

// Tamil glues endings onto words ("கரண்டியில்"), so Tamil words match by prefix.
function matches(word, list) {
  return list.some((w) => w === word || (TAMIL.test(w) && word.startsWith(w)));
}

function unitAt(tokens, i) {
  return UNITS.find((u) => matches(tokens[i].word, u.words)) || null;
}

function ingredientNear(tokens, from, to) {
  for (let i = from; i < to && i < tokens.length; i++) {
    if (i < 0) continue;
    const found = INGREDIENTS.find((g) => matches(tokens[i].word, g.words));
    if (found) return found;
  }
  return null;
}

// Reads the quantity in the few words before a unit: "one and a half", "half a", "sava do", "do bade".
function quantityBefore(tokens, unitIndex) {
  let i = unitIndex - 1;
  let size = null;
  while (i >= 0 && (SMALL.has(tokens[i].word) || BIG.has(tokens[i].word))) {
    size = SMALL.has(tokens[i].word) ? 'small' : 'big';
    i--;
  }
  if (i < 0) return { quantity: null, first: unitIndex, size };
  const n = numberOf(tokens[i].word);
  if (n === null) return { quantity: null, first: unitIndex, size };
  let quantity = n;
  let first = i;
  const w = (k) => tokens[k]?.word;
  if (w(i) === 'half' && (w(i + 1) === 'a' || w(i + 1) === 'an')) quantity = 0.5;
  if ((w(i) === 'a' || w(i) === 'an') && w(i - 1) === 'half') { quantity = 0.5; first = i - 1; }
  if (w(i) === 'half' && w(i - 1) === 'a' && w(i - 2) === 'and' && numberOf(w(i - 3) || '') !== null) {
    quantity = numberOf(w(i - 3)) + 0.5;
    first = i - 3;
  }
  if (Number.isInteger(n) && n >= 1 && i > 0) {
    if (PLUS_QUARTER.has(w(i - 1))) { quantity = n + 0.25; first = i - 1; }
    if (MINUS_QUARTER.has(w(i - 1))) { quantity = n - 0.25; first = i - 1; }
  }
  return { quantity, first, size };
}

const FRACTIONS = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];

export function friendlyNumber(x) {
  const whole = Math.floor(x);
  const frac = x - whole;
  // Eighths only matter below one: "2⅛ cups" of a guessed glass is false precision.
  const choices = whole >= 1 ? FRACTIONS.filter((f) => f[1] !== '⅛') : FRACTIONS;
  let best = choices[0];
  for (const f of choices) if (Math.abs(frac - f[0]) < Math.abs(frac - best[0])) best = f;
  const w = whole + (best[0] === 1 ? 1 : 0);
  const text = `${w || ''}${best[1]}`;
  return text || '0';
}

export function volumeText(ml) {
  if (ml < 0.625) return 'under ⅛ tsp';
  if (ml < 15) return `${friendlyNumber(ml / 5)} tsp`;
  if (ml < 60) return `${friendlyNumber(ml / 15)} tbsp`;
  const cups = friendlyNumber(ml / CUP_ML);
  return `${cups} ${cups === '1' || /^[⅛¼⅓½⅔¾]$/.test(cups) ? 'cup' : 'cups'}`;
}

export function gramsText(g) {
  if (g < 2) return `${Math.max(0.1, Math.round(g * 10) / 10)} g`;
  if (g < 20) return `${Math.round(g)} g`;
  if (g < 100) return `${Math.round(g / 5) * 5} g`;
  return `${Math.round(g / 10) * 10} g`;
}

/**
 * Every measure in a line of text, with its conversion. Needs a quantity word before the unit,
 * or "bhar" after it, so "pav bhaji" and "a glass bowl" are not mistaken for measures.
 */
export function findMeasures(text) {
  const tokens = tokenize(text);
  const found = [];
  for (let i = 0; i < tokens.length; i++) {
    const unit = unitAt(tokens, i);
    if (!unit) continue;
    let { quantity, first, size } = quantityBefore(tokens, i);
    let last = i;
    if (FULL.has(tokens[i + 1]?.word)) {
      quantity ??= 1;
      last = i + 1;
    }
    if (quantity === null) continue;

    let ml = unit.ml ? unit.ml * quantity : null;
    if (unit.key === 'spoon' && size) ml = (size === 'small' ? 5 : 15) * quantity;
    let after = last + 1;
    while (FILLER.has(tokens[after]?.word)) after++;
    const ingredient = ingredientNear(tokens, after, after + 3) || ingredientNear(tokens, first - 3, first);
    const grams = unit.grams ? unit.grams * quantity : ml !== null && ingredient ? ml * ingredient.density : null;
    const volume = unit.grams && ingredient ? (unit.grams * quantity) / ingredient.density : ml;

    const parts = [];
    if (!unit.exact && volume !== null) parts.push(volumeText(volume));
    if (grams !== null && !(unit.key === 'kilo' && Number.isInteger(quantity))) parts.push(gramsText(grams));
    // "a bowl" is only a measure when something goes in it: "put it in a bowl" is not.
    const articleOnly = ['a', 'an'].includes(tokens[first].word) && first === i - 1;
    if (!parts.length || (articleOnly && !ingredient)) continue;
    const note = parts.join(', ');
    found.push({
      words: nfc(String(text)).slice(tokens[first].start, tokens[last].end),
      quantity,
      unit: unit.key,
      ingredient: ingredient?.key || null,
      ml: volume,
      grams,
      note: note.startsWith('under') ? note : `about ${note}`,
    });
    i = last;
  }
  return found;
}

/** The conversions for one line, ready to print beside it, or '' when there is nothing to convert. */
export function conversionNote(line) {
  return findMeasures(line).map((m) => m.note).join('; ');
}
