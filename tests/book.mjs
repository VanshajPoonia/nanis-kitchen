// The printed book and the hostable voice files are plain strings and bytes, so they test without a browser.
import { addressHasFolder, audioSlug, buildVoiceSite, randomFolder, siteAddress, toMarkdown, toPrintableHtml, voiceUrl } from '../src/book.js';
import { check, section } from './check.mjs';

const hindi = {
  id: '3f9a2c1e-1111-4222-8333-944455556666',
  title: 'Kadhi',
  titleOriginal: 'कढ़ी',
  serves: '4', time: null, temperature: null,
  ingredients: [{ text: 'a bowl of curd', time: 1 }, { text: 'ek mutthi chawal', time: 2 }],
  steps: [{ text: 'Whisk it well.', time: 3 }],
  story: [{ text: 'My mother made it every Sunday.', time: 4 }],
  original: { language: 'hi', text: 'एक कटोरी दही लो और उसमें दो बड़े चम्मच बेसन डालो।' },
};
const english = { id: 'aaaabbbb-0000', title: 'Aloo <Paratha>', serves: null, time: null, temperature: null, ingredients: [{ text: 'four potatoes' }], steps: [], story: [] };

section('printable book');
const plain = toPrintableHtml([english]);
check('keeps the default title', plain.includes("<title>Nani's Kitchen</title>"));
check('defaults to a 6 x 9 inch page', plain.includes('size: 6in 9in'));
check('mirrors margins for binding', plain.includes('@page :left') && plain.includes('@page :right'));
check('numbers the pages', plain.includes('counter(page)'));
check('escapes recipe titles', plain.includes('Aloo &lt;Paratha&gt;') && !plain.includes('<Paratha>'));
check('no QR code without a voice link', !plain.includes('<svg'));
check('no measure guide when nothing needs converting', !plain.includes('How to read the measures'));

const square = toPrintableHtml([hindi], 'Dadi ki Rasoi', { trim: '8.5x8.5' });
check('uses the chosen trim size', square.includes('size: 8.5in 8.5in'));
check('uses the chosen title', square.includes('<h1>Dadi ki Rasoi</h1>'));
check('names fonts for all three scripts', ['Devanagari', 'Gurmukhi', 'Tamil'].every((s) => square.includes(`'Noto Serif ${s}'`)));
check('prints the original language section', square.includes('<div lang="hi"><p>एक कटोरी दही'));
check('prints the title in her script', square.includes('<p class="orig-title" lang="hi">कढ़ी</p>'));
check('converts measures beside ingredients', square.includes('ek mutthi chawal <span class="conv">(about ¼ cup, 50 g)</span>'));
check('lists her measures with conversions', square.includes('<span lang="hi">एक कटोरी</span> <span class="conv">about ⅔ cup, 150 g</span>'));
check('adds the measure guide', square.includes('How to read the measures') && square.includes('<span lang="pa">ਮੁੱਠੀ</span>'));

const withQr = toPrintableHtml([hindi, english], undefined, { audioBase: 'https://family.example.com/nani', withAudio: new Set([hindi.id]) });
check('QR code on a recipe with a voice note', withQr.split('<svg').length === 2);
check('QR caption tells people what it does', withQr.includes('Scan to hear her say it'));

section('voice links');
check('slug is short and stable', audioSlug(hindi) === '3f9a2c1e');
check('slug for an imported recipe with no id', audioSlug({ title: 'Gajar Halwa!' }, 2) === 'gajar-halwa-3');
check('link is base plus slug', voiceUrl('https://family.example.com/nani', hindi) === 'https://family.example.com/nani/#3f9a2c1e');
check('trailing slash and old hash are handled', voiceUrl('https://x.org/book/#old', hindi) === 'https://x.org/book/#3f9a2c1e');
check('no base, no link', voiceUrl('  ', hindi) === '');

section('voice files to host');
const opus = new Uint8Array([79, 103, 103, 83]);
const audio = new Map([[hindi.id, [{ name: 'PTT-20240312-WA0003.opus', type: 'audio/ogg', data: opus }, { name: 'memo.m4a', type: 'audio/mp4', data: opus }]]]);
const site = buildVoiceSite([{ ...hindi, title: 'Kadhi </script><b>' }, english], audio, 'Our book');
const names = site.files.map((f) => f.name);
check('player page first, then audio', names.join() === 'index.html,audio/3f9a2c1e-1.opus,audio/3f9a2c1e-2.m4a', names.join());
check('skips recipes with no voice', site.count === 1);
const page = site.files[0].data;
check('player page is not indexed by search engines', page.includes('noindex'));
check('recipe data cannot close the script tag', !page.includes('Kadhi </script>'));
const script = page.slice(page.lastIndexOf('<script>') + 8, page.lastIndexOf('</script>'));
let syntax = '';
try { new Function(script); } catch (err) { syntax = err.message; }
check('player script is valid JavaScript', syntax === '', syntax);

section('where the voices live');
const folder = randomFolder();
check('family folder is long and random', /^f-[a-z2-9]{16}$/.test(folder) && folder !== randomFolder(), folder);
check('site plus folder makes the address', siteAddress('Recipes.Example.org', 'f-abc') === 'https://recipes.example.org/f-abc/');
check('a pasted https address and path are trimmed', siteAddress('https://my-book.pages.dev/old/', 'f-abc') === 'https://my-book.pages.dev/f-abc/');
let placeholder = '';
try { siteAddress('recipes.your-domain.com', 'f-abc'); } catch (err) { placeholder = err.message; }
check('the placeholder is never used as a real site', placeholder.includes('your own site'));
let junk = '';
try { siteAddress('my grandma', 'f-abc'); } catch (err) { junk = err.message; }
check('rejects text that is not a web address', junk.includes('does not look like'));
check('knows when the address ends in the family folder', addressHasFolder('https://x.org/f-abc', 'f-abc') && !addressHasFolder('https://x.org/', 'f-abc'));
const nested = buildVoiceSite([hindi], audio, 'Our book', { folder: 'f-abc' });
const nestedNames = nested.files.map((f) => f.name);
check('voice files sit inside the family folder', nestedNames.join() === '_headers,f-abc/index.html,f-abc/audio/3f9a2c1e-1.opus,f-abc/audio/3f9a2c1e-2.m4a', nestedNames.join());
check('the site asks search engines not to index it', nested.files[0].data.includes('X-Robots-Tag: noindex'));
check('the QR link reaches the player inside the folder', voiceUrl(siteAddress('recipes.example.org', 'f-abc'), hindi) === 'https://recipes.example.org/f-abc/#3f9a2c1e');

section('markdown');
const md = toMarkdown([hindi]);
check('adds conversions in brackets', md.includes('- ek mutthi chawal (about ¼ cup, 50 g)'));
check('adds the original language', md.includes('### In Hindi (हिन्दी)') && md.includes('**कढ़ी**'));
