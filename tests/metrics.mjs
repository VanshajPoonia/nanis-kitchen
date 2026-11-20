// The scores the speech eval reports, pinned so the numbers in the README mean what they say.
import { cer, chrF, normalize, scriptShare, wer } from '../evals/metrics.mjs';
import { check, section } from './check.mjs';

section('eval metrics');
check('normalize drops punctuation and the danda', normalize('Hello, दुनिया। ') === 'hello दुनिया');
check('WER of a perfect match is zero', wer('two cups of atta', 'Two cups of atta.') === 0);
check('WER counts a swapped word', wer('two cups of atta', 'two cups of rice') === 0.25);
check('CER counts characters', cer('abcd', 'abed') === 0.25);
check('script share', scriptShare('ab कख', 'Devanagari') === 0.5);
check('chrF is 1 for identical text', Math.abs(chrF('a pinch of salt', 'a pinch of salt') - 1) < 1e-9);
check('chrF is 0 for unrelated text', chrF('abc', 'xyz') === 0);
check('chrF is between for partial matches', chrF('a pinch of salt', 'a pinch of sugar') > 0.4 && chrF('a pinch of salt', 'a pinch of sugar') < 1);
