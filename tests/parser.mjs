// The parser has no model in it, so this runs instantly and offline.
import { parseRecipe, recipeToMarkdown } from '../src/recipe.js';
import { check, section } from './check.mjs';

const TRANSCRIPT = `Okay, so today I am going to make the aloo paratha the way my mother made it, not the way they sell it in the shops. You need about two cups of atta, that is the wheat flour, and a pinch of salt and some water, warm water, not cold. Also four potatoes, medium size, boiled. One green chilli, finely chopped. A small piece of ginger. Half a teaspoon of ajwain, and salt again for the filling, and ghee, plenty of ghee, do not be shy with it. First knead the dough with the water little by little until it is soft, softer than you think, and then cover it and let it rest for twenty minutes. Mash the potatoes while the dough is resting, there should be no lumps at all. Add the chilli and the ginger and the ajwain and the salt to the potatoes and mix it with your hand, not a spoon, your hand knows when it is right. Take a ball of dough and roll it a little, put a spoon of the filling inside, close it like a purse and press it flat. Heat the tawa on medium, put the paratha on, and when you see small bubbles turn it. My mother used to say that a paratha made in a hurry tastes like a hurry. When I was a girl we had no gas, only the coal fire, and she would make fifteen of these before anyone woke up. Serve it hot with curd and pickle, never with a fork.`;

const r = parseRecipe(TRANSCRIPT, []);
const ing = r.ingredients.map((i) => i.text.toLowerCase());
const steps = r.steps.map((s) => s.text.toLowerCase());
const story = r.story.map((s) => s.text.toLowerCase());

section('title & metadata');
check('strips the announcement from the title', r.title === 'Aloo Paratha', `got "${r.title}"`);
check('picks up the resting time', r.time === 'twenty minutes', `got "${r.time}"`);

section('ingredients');
check('spoken quantity with a unit', ing.some((i) => i.includes('two cups') && i.includes('atta')));
check('vague quantity kept vague', ing.some((i) => i.includes('pinch') && i.includes('salt')));
check('bare count with no unit', ing.some((i) => i.includes('four potatoes')));
check('singular bare count', ing.some((i) => i.includes('green chilli')));
check('descriptors stay attached, not split off', !ing.some((i) => i.trim() === 'boiled' || i.trim() === 'medium size'));
check('no ingredient line is a lone conjunction', !ing.some((i) => /^(and|then|so|now)$/.test(i.trim())));

section('method');
check('imperative sentences become steps', steps.some((s) => s.startsWith('first knead')));
check('splits "and then" into a separate step', steps.some((s) => s.startsWith('then cover')));
check('no step is a lone conjunction', !steps.some((s) => /^(and|then|so|now)\.?$/.test(s.trim())));
check('final serving line is a step', steps.some((s) => s.includes('serve it hot')));

section('memories');
check('keeps the mother aside', story.some((s) => s.includes('tastes like a hurry')));
check('keeps the coal fire memory', story.some((s) => s.includes('coal fire')));
check('memories are not duplicated as steps', !steps.some((s) => s.includes('coal fire')));

section('export');
const md = recipeToMarkdown(r);
check('markdown has all three sections', md.includes('### Ingredients') && md.includes('### Method') && md.includes('### In her words'));
