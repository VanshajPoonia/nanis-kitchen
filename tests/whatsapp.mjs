// WhatsApp exports from both phones, built as small fixtures with real deflate.
import { readFileSync } from 'node:fs';
import { listEntries, readEntry, writeZip } from '../src/zip.js';
import { openExport, parseChat, voiceNotes } from '../src/whatsapp.js';
import { check, section } from './check.mjs';

const fixture = (name) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const opus = fixture('voice-note.opus');
const ios = fixture('whatsapp-ios.zip');
const chat = new TextDecoder().decode(await readEntry(ios, listEntries(ios).find((e) => e.name === '_chat.txt')));

section('whatsapp chat, iPhone format');
const parsed = parseChat(chat);
check('reads every message, joining multi-line ones', parsed.messages.length === 6, `got ${parsed.messages.length}`);
check('keeps the second line of a message', parsed.messages[4].text === 'Thank you!!\nWill try tomorrow');
check('strips the invisible direction mark', parsed.messages[2].attachment === '00000003-AUDIO-2024-03-12-19-45-10.opus');
check('turns 7:45 PM into 24-hour time', parsed.messages[2].time === '19:45:10');
check('reads 13/03 as day first', parsed.messages[5].date === '2024-03-13');
check('counts omitted media', parsed.mediaOmitted === 1);
const notes = voiceNotes(parsed.messages);
check('finds both voice notes', notes.length === 2);
check('voice note knows who sent it', notes.every((n) => n.sender === 'Nani'));
check('keeps the question asked just before', notes[0].context.includes('Riya: Nani, how do you make kadhi?'));

section('WhatsApp system notices');
check('the iPhone encryption notice is a notice, not Nani', parsed.messages[0].system && parsed.messages[0].sender === null);
check('a real message is not a notice', !parsed.messages[1].system && parsed.messages[1].sender === 'Riya');
check('context is only the question, not the notice', notes[0].context.length === 1 && notes[0].context[0] === 'Riya: Nani, how do you make kadhi?', JSON.stringify(notes[0].context));
const noticeChat = parseChat([
  '12/03/24, 7:40 pm - Riya joined using this group\'s invite link',
  '12/03/24, 7:41 pm - Nani: This message was deleted',
  '12/03/24, 7:42 pm - Nani: Missed voice call',
  '[12/03/24, 7:43:00 PM] Family: \u200eNani changed their phone number to a new number. Tap to message or add the new number.',
  '12/03/24, 7:44 pm - Nani: Your security code with Riya changed. Tap to learn more.',
  '12/03/24, 7:45 pm - Riya: Nani, kadhi kaise banate hain?',
  '12/03/24, 7:46 pm - Nani: PTT-20240312-WA0003.opus (file attached)',
].join('\n'));
check('Android and iPhone notices are all flagged', noticeChat.messages.slice(0, 5).every((m) => m.system && m.sender === null));
check('notices never reach the context', voiceNotes(noticeChat.messages)[0].context.join() === 'Riya: Nani, kadhi kaise banate hain?');
check('a note is never a notice', !noticeChat.messages[6].system && noticeChat.messages[6].sender === 'Nani');

section('whatsapp chat, Android format');
const android = fixture('whatsapp-android.zip');
const exp = await openExport(android);
check('finds the chat file by its Android name', exp.hasChat);
check('finds the PTT voice note', exp.notes.length === 1 && exp.notes[0].file === 'PTT-20240312-WA0003.opus');
check('reads lowercase pm', exp.notes[0].time === '19:45:00');
check('counts <Media omitted>', exp.mediaOmitted === 1);
const bytes = await exp.read(exp.notes[0].entry);
check('hands back the audio bytes', bytes.length === opus.length);

section('whatsapp export, odd cases');
const iosExport = await openExport(ios);
check('keeps audio the chat never mentions', iosExport.notes.some((n) => n.file.startsWith('00000009') && n.sender === null));
check('links every note to its zip entry', iosExport.notes.every((n) => n.entry));
const us = parseChat('3/14/24, 8:05 AM - Nani: PTT-20240314-WA0001.opus (file attached)\n3/1/24, 9:00 AM - Nani: hello');
check('switches to month first when the day is above 12', us.messages[0].date === '2024-03-14');
const iso = parseChat('[2024-03-12, 19:45:10] Nani: hello');
check('reads year-first dates', iso.messages[0].date === '2024-03-12');
const noMedia = await openExport(writeZip([{ name: '_chat.txt', data: '12/03/24, 7:45 pm - Nani: <Media omitted>' }]));
check('flags a chat exported without media', noMedia.notes.length === 0 && noMedia.mediaOmitted === 1);
