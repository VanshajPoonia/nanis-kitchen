// Rough measures in four languages and three scripts. Numbers are rough, so tests pin the wording.
import { conversionNote, findMeasures, friendlyNumber, gramsText, volumeText } from '../src/measures.js';
import { check, section } from './check.mjs';

const one = (text) => findMeasures(text)[0] || {};

section('number formatting');
check('quarter cup as a fraction', volumeText(60) === '¼ cup', volumeText(60));
check('small amounts in teaspoons', volumeText(5) === '1 tsp', volumeText(5));
check('middling amounts in tablespoons', volumeText(30) === '2 tbsp', volumeText(30));
check('a pinch is under an eighth of a teaspoon', volumeText(0.3) === 'under ⅛ tsp');
check('plural cups', volumeText(500) === '2 cups', volumeText(500));
check('mixed numbers', friendlyNumber(1.5) === '1½' && friendlyNumber(2.25) === '2¼');
check('grams round sensibly', gramsText(0.36) === '0.4 g' && gramsText(47) === '45 g' && gramsText(243) === '240 g');

section('Hindi in Roman letters');
const mutthi = one('ek mutthi chawal');
check('ek mutthi is a fistful', mutthi.unit === 'fistful' && mutthi.quantity === 1);
check('keeps the original words', mutthi.words === 'ek mutthi', `got "${mutthi.words}"`);
check('knows chawal is rice and gives grams', mutthi.ingredient === 'rice' && mutthi.note === 'about ¼ cup, 50 g', mutthi.note);
check('chutki bhar needs no number', one('chutki bhar namak').note === 'under ⅛ tsp, 0.4 g', one('chutki bhar namak').note);
check('do katori dahi', one('do katori dahi').note === 'about 1¼ cups, 310 g', one('do katori dahi').note);
check('dedh glass paani', one('dedh glass paani').note === 'about 1½ cups, 380 g', one('dedh glass paani').note);
check('paav is a quarter kilo', one('ek paav aloo').note === 'about 250 g', one('ek paav aloo').note);
check('aadha kilo is 500 g', one('aadha kilo pyaaz').note === 'about 500 g', one('aadha kilo pyaaz').note);
check('chhota chammach is a teaspoon', one('ek chhota chammach jeera').note === 'about 1 tsp, 3 g', one('ek chhota chammach jeera').note);
check('bada chammach is a tablespoon', one('do bade chammach besan').note === 'about 2 tbsp, 11 g', one('do bade chammach besan').note);
check('sava do is two and a quarter', one('sava do katori atta').quantity === 2.25);
check('paune do is one and three quarters', one('paune do glass doodh').quantity === 1.75);
check('ingredient before the measure', one('dahi ek katori').ingredient === 'curd');

section('Hindi in Devanagari');
const dev = findMeasures('एक कटोरी दही लो और उसमें दो बड़े चम्मच बेसन डालो। एक चुटकी हल्दी डालो।');
check('finds all three measures', dev.length === 3, `got ${dev.length}`);
check('keeps the Devanagari words', dev[0].words === 'एक कटोरी', dev[0].words);
check('बड़े चम्मच is a tablespoon', dev[1].ml === 30 && dev[1].ingredient === 'besan');
check('एक चुटकी हल्दी is a pinch of spice', dev[2].unit === 'pinch' && dev[2].ingredient === 'spice');
check('पाव भर with no number', one('पाव भर आलू').note === 'about 250 g');
check('Devanagari digits', one('२ कटोरी चावल').quantity === 2);
check('डेढ़ is one and a half', one('डेढ़ गिलास पानी').quantity === 1.5);

section('Punjabi in Gurmukhi');
const pa = one('ਇੱਕ ਮੁੱਠੀ ਚੌਲ');
check('ਇੱਕ ਮੁੱਠੀ is a fistful of rice', pa.unit === 'fistful' && pa.ingredient === 'rice');
check('ਅੱਧਾ ਚਮਚ ਲੂਣ is half a spoon of salt', one('ਅੱਧਾ ਚਮਚ ਲੂਣ').note === 'about 1 tsp, 6 g', one('ਅੱਧਾ ਚਮਚ ਲੂਣ').note);
check('ਦੋ ਗਲਾਸ ਦੁੱਧ', one('ਦੋ ਗਲਾਸ ਦੁੱਧ').note === 'about 2 cups, 520 g', one('ਦੋ ਗਲਾਸ ਦੁੱਧ').note);
check('ਕੌਲੀ is a katori', one('ਇੱਕ ਕੌਲੀ ਦਹੀਂ').unit === 'bowl');
check('ਚੁਟਕੀ ਭਰ needs no number', one('ਚੁਟਕੀ ਭਰ ਹਲਦੀ').unit === 'pinch');
check('Gurmukhi digits', one('੩ ਕਟੋਰੀ ਆਟਾ').quantity === 3);

section('Tamil');
const ta = findMeasures('ஒரு டம்ளர் அரிசி மற்றும் அரை டம்ளர் பாசிப்பருப்பு எடுத்துக்கொள்ளுங்கள். ஒரு சிட்டிகை உப்பு சேர்க்கவும்.');
check('finds tumbler, tumbler and pinch', ta.map((m) => m.unit).join() === 'tumbler,tumbler,pinch', ta.map((m) => m.unit).join());
check('அரை is a half', ta[1].quantity === 0.5 && ta[1].ingredient === 'dal');
check('ஒரு கைப்பிடி is a fistful', one('ஒரு கைப்பிடி முந்திரி').unit === 'fistful');
check('word endings still match', one('இரண்டு கரண்டியில் எண்ணெய்').unit === 'spoon');
check('கால் கிலோ is a quarter kilo', one('கால் கிலோ வெங்காயம்').note === 'about 250 g');
check('கிண்ணம் is a katori', one('ஒரு கிண்ணம் தயிர்').unit === 'bowl');

section('English, as Whisper translates it');
check('a handful of rice', one('a handful of rice').note === 'about ¼ cup, 50 g');
check('half a teaspoon only adds grams', one('Half a teaspoon of ajwain').note === 'about 1.3 g', one('Half a teaspoon of ajwain').note);
check('one and a half cups', one('one and a half cups of atta').quantity === 1.5);
check('two cups of atta in grams', one('about two cups of atta').note === 'about 240 g');
check('exact unit with no known ingredient says nothing', conversionNote('two cups of something') === '');

section('things that are not measures');
check('pav bhaji is food', findMeasures('pav bhaji with butter').length === 0);
check('a unit with no quantity', findMeasures('put it in a bowl').length === 0);
check('"do not" is not two of anything', findMeasures('do not be shy with it').length === 0);
check('empty text', findMeasures('').length === 0);
