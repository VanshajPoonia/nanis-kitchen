// Writes a three-language sample book for checking print layout and fonts in a real browser.
// Usage: node evals/sample-book.mjs <out.html> [trim]
import { writeFileSync } from 'node:fs';
import { toPrintableHtml } from '../src/book.js';
import { parseRecipe } from '../src/recipe.js';

const [outPath, trim = '6x9'] = process.argv.slice(2);
if (!outPath) {
  console.error('Usage: node evals/sample-book.mjs <out.html> [trim]');
  process.exit(1);
}

const recipe = (id, english, language, original, titleOriginal) => ({
  ...parseRecipe(english, []), id, titleOriginal, original: { language, text: original },
});

const recipes = [
  recipe('a1b2c3d4-hi', 'Today I will teach you how to make kadhi. Take a bowl of curd and two big spoons of besan. A pinch of turmeric and half a spoon of salt. Then add two glasses of water and whisk it well. Simmer it for twenty minutes. My mother always made it on Sundays.',
    'hi', 'आज मैं तुम्हें कढ़ी बनाना सिखाती हूँ। एक कटोरी दही लो और उसमें दो बड़े चम्मच बेसन डालो। एक चुटकी हल्दी और आधा चम्मच नमक मिलाओ। फिर दो गिलास पानी डालकर अच्छे से फेंट लो।', 'कढ़ी'),
  recipe('e5f6a7b8-pa', 'Today I am going to make saag. One fistful of rice flour, and two glasses of milk. Half a spoon of salt. Cook the greens slowly for an hour. When I was a girl we cooked it on a wood fire.',
    'pa', 'ਅੱਜ ਮੈਂ ਸਾਗ ਬਣਾਉਣ ਲੱਗੀ ਹਾਂ। ਇੱਕ ਮੁੱਠੀ ਚੌਲਾਂ ਦਾ ਆਟਾ ਅਤੇ ਦੋ ਗਲਾਸ ਦੁੱਧ। ਅੱਧਾ ਚਮਚ ਲੂਣ। ਸਾਗ ਨੂੰ ਹੌਲੀ ਅੱਗ ਤੇ ਇੱਕ ਘੰਟਾ ਪਕਾਓ।', 'ਸਾਗ'),
  recipe('c9d0e1f2-ta', 'Today I will tell you how to make pongal. Take one tumbler of rice and half a tumbler of moong dal. Add a pinch of salt. Fry a handful of cashews in ghee.',
    'ta', 'இன்று பொங்கல் செய்வது எப்படி என்று சொல்கிறேன். ஒரு டம்ளர் அரிசி மற்றும் அரை டம்ளர் பாசிப்பருப்பு எடுத்துக்கொள்ளுங்கள். ஒரு சிட்டிகை உப்பு சேர்க்கவும். ஒரு கைப்பிடி முந்திரியை நெய்யில் வறுக்கவும்.', 'பொங்கல்'),
];

const html = toPrintableHtml(recipes, "Nani's Kitchen", {
  trim,
  audioBase: 'https://example.com/nanis-kitchen/',
  withAudio: new Set(recipes.map((r) => r.id)),
});
writeFileSync(outPath, html);
console.log(`Wrote ${recipes.length} recipes at ${trim} to ${outPath}`);
