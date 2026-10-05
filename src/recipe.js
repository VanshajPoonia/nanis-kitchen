// Spoken recipes are not written recipes. Nobody says "250 g all-purpose flour".
// They say "about two cups of maida, maybe a little more if the dough feels dry".
// This parser is tuned for that, and it keeps the asides instead of deleting them.

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100,
  half: 0.5, quarter: 0.25, third: 0.333,
};

const UNITS = [
  'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
  'gram', 'grams', 'g', 'kg', 'kilo', 'kilos', 'kilogram', 'kilograms',
  'ml', 'millilitre', 'millilitres', 'litre', 'litres', 'liter', 'liters', 'l',
  'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs',
  'pinch', 'pinches', 'handful', 'handfuls', 'clove', 'cloves', 'slice', 'slices',
  'piece', 'pieces', 'inch', 'inches', 'can', 'cans', 'packet', 'packets',
  'bunch', 'bunches', 'stick', 'sticks', 'drop', 'drops', 'dash', 'sprig', 'sprigs',
];

const STEP_VERBS = [
  'heat', 'add', 'stir', 'fry', 'saute', 'sauté', 'boil', 'mix', 'pour', 'cover',
  'simmer', 'knead', 'roast', 'grind', 'soak', 'garnish', 'serve', 'cook', 'bake',
  'chop', 'slice', 'dice', 'peel', 'wash', 'rinse', 'drain', 'whisk', 'beat', 'fold',
  'sprinkle', 'season', 'marinate', 'rest', 'cool', 'chill', 'freeze', 'flip', 'turn',
  'remove', 'transfer', 'blend', 'mash', 'squeeze', 'melt', 'temper', 'roll', 'shape',
  'put', 'take', 'keep', 'let', 'leave', 'bring', 'reduce', 'strain', 'spread', 'top',
];

// Lines that are memory, not method. These are the reason the book is worth keeping.
const STORY_MARKERS = [
  'my mother', 'my mom', 'my mum', 'your grandfather', 'your grandmother', 'my grandmother',
  'when i was', 'back then', 'in those days', 'we used to', 'i remember', 'your nana',
  'your nani', 'your dadi', 'every sunday', 'every year', 'at the village', 'in the village',
  'she always', 'he always', 'that is how', 'the secret is', 'the trick is', 'never forget',
  'i learned', 'i learnt', 'my father', 'we had no', 'we did not have', "we didn't have",
];

const TITLE_PATTERNS = [
  /(?:recipe for|how to make|i(?:'m| am) going to make|today (?:i|we)(?:'m| am| are| will)? ?(?:making|make)|this is (?:my|our|the)|let me tell you how to make|making)\s+([a-z0-9' -]{3,60})/i,
];

const TIME_RE = /(\d+|\b(?:one|two|three|four|five|six|seven|eight|ten|fifteen|twenty|thirty|forty|forty-five|sixty)\b)\s*(?:to\s*\d+\s*)?(minute|minutes|min|mins|hour|hours|hr|hrs|second|seconds)\b/i;
const SERVES_RE = /\b(?:serves|feeds|enough for|makes)\s+(?:about\s+)?(\d+|[a-z]+)\b/i;
const TEMP_RE = /(\d{2,3})\s*(?:degrees?|°)\s*(c|celsius|f|fahrenheit)?/i;

function wordToNumber(token) {
  const t = token.toLowerCase().replace(/[^a-z0-9./-]/g, '');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split('/').map(Number);
    return b ? a / b : null;
  }
  return NUMBER_WORDS[t] ?? null;
}

// "knead it and then cover it and let it rest" is two instructions wearing one sentence.
// Mark the connective, keep the word, split on the mark. One pass, so no stray "and" fragments.
function splitSentences(text) {
  const marked = text
    .replace(/\s+/g, ' ')
    .replace(/(?:,\s*)?\s(?:and\s+then|then|next|after\s+that)\s+(?=[a-z])/gi,
      (m) => ' ||' + m.trim().replace(/^,?\s*(?:and\s+)?/i, '') + ' ');
  return marked
    .split(/(?<=[.!?])\s+|\s*\|\|\s*/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length > 1);
}

const VAGUE_RE = /\b(?:some|a little|a bit of|plenty of|as needed|to taste|a few|enough)\b/i;
// "four potatoes" has no unit but is plainly a shopping line.
const BARE_COUNT_RE = /^(?:also\s+|and\s+|plus\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|half|a|an)\s+[a-z]/i;

function hasQuantity(sentence) {
  const words = sentence.toLowerCase().split(/[^a-z0-9/.]+/);
  for (let i = 0; i < words.length; i++) {
    if (!UNITS.includes(words[i])) continue;
    // a unit is only a quantity if something number-ish sits near it
    for (let back = 1; back <= 3; back++) {
      const n = wordToNumber(words[i - back] || '');
      if (n !== null) return true;
    }
  }
  if (VAGUE_RE.test(sentence)) return true;
  // Bare counts only count in short lines; long ones are usually method.
  return BARE_COUNT_RE.test(sentence.trim()) && words.filter(Boolean).length <= 10;
}

function startsWithStepVerb(sentence) {
  const cleaned = sentence.toLowerCase().replace(/^(?:and |then |now |next |after that,? |so |ok |okay |first,? |second,? |finally,? )+/g, '');
  const first = cleaned.split(/[^a-zé]+/)[0];
  return STEP_VERBS.includes(first);
}

function isStory(sentence) {
  const s = sentence.toLowerCase();
  return STORY_MARKERS.some((m) => s.includes(m));
}

function titleCase(s) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function extractTitle(text) {
  for (const re of TITLE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      let t = m[1].trim()
        .replace(/\b(?:today|now|for you|okay|ok|so|and|the way|like this)\b.*$/i, '')
        .replace(/[.,;:]+$/, '')
        .trim();
      t = t.replace(/^(?:the|a|an|my|our)\s+/i, '').trim();
      if (t.length >= 3) return titleCase(t);
    }
  }
  const first = splitSentences(text)[0] || '';
  const noun = first.split(/\s+/).slice(0, 6).join(' ').replace(/[.,;:]+$/, '');
  return titleCase(noun || 'Untitled recipe');
}

// Ingredient lines read better split out of the surrounding chatter.
function cleanIngredient(sentence) {
  return sentence
    .replace(/^(?:so |ok(?:ay)?,? |now |then |and |first (?:you|we)(?:'ll| will)? (?:need|take) |you(?:'ll| will)? need |we need |take |i use |i take |put in )+/i, '')
    .replace(/\s*(?:,|\.|and)\s*$/i, '')
    .replace(/^you need\s+/i, '')
    .trim();
}

const QTY_START_RE = /^(?:also\s+|plus\s+)?(?:\d|a\b|an\b|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b|twelve\b|half\b|quarter\b|some\b|a few\b|a little\b|plenty\b|enough\b)/i;

const DESCRIPTORS = new Set(['medium', 'large', 'small', 'size', 'sized', 'fresh', 'dried', 'warm', 'cold',
  'hot', 'ripe', 'fine', 'coarse', 'thin', 'thick', 'good', 'quality', 'optional', 'preferably', 'roughly', 'finely']);

// A short fragment after a comma is a new ingredient unless it is only describing
// the one before it: "four potatoes, medium size, boiled" is one potato line.
function isDescriptorOnly(part) {
  const words = part.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  return words.every((w) => DESCRIPTORS.has(w) || /(?:ed|ly)$/.test(w) || w === 'or' || w === 'to');
}

function headNoun(part) {
  const words = part.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
  return words[words.length - 1] || '';
}

// "two cups of atta, that is the wheat flour, and a pinch of salt" is ONE ingredient
// with an aside, plus one more ingredient. Fragments that do not open with a quantity
// are qualifiers, and they belong on the line above instead of inventing a new one.
function splitIngredientRun(sentence) {
  const raw = sentence
    .split(/,\s*(?:and\s+)?|\s+and\s+(?=(?:a|an|one|two|three|four|five|six|some|half|quarter|plenty|\d))/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);

  const out = [];
  for (const part of raw) {
    const prev = out[out.length - 1];
    const wordCount = part.split(/\s+/).length;
    const isNew = QTY_START_RE.test(part)
      || /\b(?:cup|tablespoon|teaspoon|tbsp|tsp|gram|kg|ml|pinch|handful|clove)s?\b/i.test(part)
      || (wordCount <= 3 && !isDescriptorOnly(part) && !/\b(?:that|this|not|is|are|be|it|you|do)\b/i.test(part));
    // "ghee" then "plenty of ghee" is emphasis, not a second ingredient.
    const repeatsPrev = prev && headNoun(part) && headNoun(part) === headNoun(prev);
    if (!prev || (isNew && !repeatsPrev)) {
      out.push(part);
    } else if (repeatsPrev && part.length > prev.length) {
      out[out.length - 1] = part;
    } else {
      out[out.length - 1] = `${prev}, ${part}`;
    }
  }
  return out;
}

function cleanStep(sentence) {
  const s = sentence
    .replace(/^(?:so |ok(?:ay)?,? |right,? |um,? |uh,? |you know,? )+/i, '')
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Turn a Whisper transcript into a structured recipe.
 * `chunks` (optional) carry timestamps so each line can replay her voice.
 */
export function parseRecipe(text, chunks = []) {
  const sentences = splitSentences(text);
  const ingredients = [];
  const steps = [];
  const story = [];
  let seenFirstStep = false;

  for (const sentence of sentences) {
    if (isStory(sentence)) {
      story.push({ text: sentence.trim(), time: findTime(sentence, chunks) });
      continue;
    }
    const quantity = hasQuantity(sentence);
    const stepish = startsWithStepVerb(sentence);

    // Before the first real instruction, a quantity almost always means a shopping line.
    if (quantity && (!seenFirstStep || !stepish)) {
      for (const part of splitIngredientRun(sentence)) {
        const cleaned = cleanIngredient(part);
        if (cleaned.length > 1) ingredients.push({ text: cleaned, time: findTime(part, chunks) });
      }
      continue;
    }
    if (stepish) {
      seenFirstStep = true;
      steps.push({ text: cleanStep(sentence), time: findTime(sentence, chunks) });
      continue;
    }
    // Leftovers after cooking has started are usually asides about the method.
    if (seenFirstStep) steps.push({ text: cleanStep(sentence), time: findTime(sentence, chunks) });
    else story.push({ text: sentence.trim(), time: findTime(sentence, chunks) });
  }

  const timeMatch = text.match(TIME_RE);
  const servesMatch = text.match(SERVES_RE);
  const tempMatch = text.match(TEMP_RE);

  return {
    title: extractTitle(text),
    serves: servesMatch ? normalizeServes(servesMatch[1]) : null,
    time: timeMatch ? `${timeMatch[1]} ${timeMatch[2]}` : null,
    temperature: tempMatch ? `${tempMatch[1]}°${(tempMatch[2] || 'C')[0].toUpperCase()}` : null,
    ingredients: dedupe(ingredients),
    steps,
    story,
    source: 'built-in parser',
  };
}

function normalizeServes(raw) {
  const n = wordToNumber(raw);
  return n ? String(n) : raw;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => {
    const k = i.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Map a sentence back to the moment in the audio where it was said.
function findTime(sentence, chunks) {
  if (!chunks?.length) return null;
  const needle = sentence.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 24).trim();
  if (needle.length < 6) return null;
  for (const c of chunks) {
    const hay = (c.text || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
    if (hay.includes(needle.slice(0, 14))) return c.start;
  }
  return null;
}

export function recipeToMarkdown(r) {
  const lines = [`## ${r.title}`, ''];
  const meta = [r.serves && `Serves ${r.serves}`, r.time && `About ${r.time}`, r.temperature && r.temperature].filter(Boolean);
  if (meta.length) lines.push(`*${meta.join(' · ')}*`, '');
  if (r.ingredients.length) {
    lines.push('### Ingredients', '');
    r.ingredients.forEach((i) => lines.push(`- ${i.text}`));
    lines.push('');
  }
  if (r.steps.length) {
    lines.push('### Method', '');
    r.steps.forEach((s, n) => lines.push(`${n + 1}. ${s.text}`));
    lines.push('');
  }
  if (r.story.length) {
    lines.push('### In her words', '');
    r.story.forEach((s) => lines.push(`> ${s.text}`, ''));
  }
  return lines.join('\n');
}
