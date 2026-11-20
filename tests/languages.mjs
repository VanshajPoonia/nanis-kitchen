// Script detection, used to warn when Whisper writes her language in the wrong script.
import { dominantScript, isMultilingualModel } from '../src/languages.js';
import { check, section } from './check.mjs';

section('scripts');
check('Hindi text is Devanagari', dominantScript('एक कटोरी दही लो') === 'Devanagari');
check('Punjabi in Urdu letters is spotted', dominantScript('اک کٹوری دہی') === 'Arabic');
check('Gurmukhi', dominantScript('ਇੱਕ ਮੁੱਠੀ ਚੌਲ') === 'Gurmukhi');
check('Tamil wins over a few English words', dominantScript('ஒரு டம்ளர் அரிசி rice') === 'Tamil');
check('no letters, no script', dominantScript('12 / 3') === null);
check('.en models are English only', !isMultilingualModel('Xenova/whisper-base.en') && isMultilingualModel('Xenova/whisper-small'));
