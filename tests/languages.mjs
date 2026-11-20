// Script detection and the script guard. The vocab strings are real Whisper tokens.
import { dominantScript, isMultilingualModel } from '../src/languages.js';
import { BLOCK, blockedTokenIds, tokenBytes } from '../src/scriptguard.js';
import { check, section } from './check.mjs';

section('scripts');
check('Hindi text is Devanagari', dominantScript('एक कटोरी दही लो') === 'Devanagari');
check('Punjabi in Urdu letters is spotted', dominantScript('اک کٹوری دہی') === 'Arabic');
check('Gurmukhi', dominantScript('ਇੱਕ ਮੁੱਠੀ ਚੌਲ') === 'Gurmukhi');
check('Tamil wins over a few English words', dominantScript('ஒரு டம்ளர் அரிசி rice') === 'Tamil');
check('no letters, no script', dominantScript('12 / 3') === null);
check('.en models are English only', !isMultilingualModel('Xenova/whisper-base.en') && isMultilingualModel('Xenova/whisper-small'));

section('script guard');
// Whisper stores bytes as printable characters: "Ġ" is a space, "à¤¤" is त (e0 a4 a4).
check('maps a space token to its byte', tokenBytes('Ġ').join() === '32');
check('maps a Devanagari token to UTF-8', tokenBytes('à¤¤').map((b) => b.toString(16)).join(' ') === 'e0 a4 a4');
const vocab = ['<|hi|>', 'Ø±', 'à¤¤', 'hello', 'ĠÙħ', 'à¨¸', 'à®¤'];
check('blocks Urdu-script tokens for Hindi', blockedTokenIds(vocab, BLOCK.hi).join() === '1,4');
check('blocks Urdu and Devanagari for Punjabi', blockedTokenIds(vocab, BLOCK.pa).join() === '1,2,4');
check('blocks every Indic script for the English pass', blockedTokenIds(vocab, BLOCK.translate).join() === '1,2,4,5,6');
check('never blocks special tokens', !blockedTokenIds(['<|ar|>Ø±'], ['Arabic']).length);
check('nothing to block, nothing blocked', blockedTokenIds(vocab, []).length === 0);
