// Several WhatsApp notes in a row become one memo for transcription and playback.
import { encodeWav, joinAudio } from '../src/wav.js';
import { check, section } from './check.mjs';

section('joined voice notes');
const joined = joinAudio([new Float32Array(10).fill(0.5), new Float32Array(5).fill(-0.5)], 10, 0.3);
check('joins notes with a short gap', joined.length === 18 && joined[10] === 0 && joined[13] === -0.5);
const wav = encodeWav(new Float32Array([0, 1, -1]), 16000);
const view = new DataView(wav.buffer);
check('writes a WAV header', new TextDecoder().decode(wav.slice(0, 4)) === 'RIFF' && view.getUint32(24, true) === 16000);
check('writes 16-bit samples', view.getInt16(46, true) === 32767 && view.getInt16(48, true) === -32768);
