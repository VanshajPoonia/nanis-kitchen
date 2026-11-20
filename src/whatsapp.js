// Reads a WhatsApp "Export chat" file. iPhone and Android write different formats:
//   iPhone:  [12/03/24, 7:45:10 PM] Nani: ‎<attached: 00000003-AUDIO-2024-03-12-19-45-10.opus>
//   Android: 12/03/24, 7:45 pm - Nani: PTT-20240312-WA0003.opus (file attached)
import { listEntries, readEntry } from './zip.js';

const AUDIO_EXT = /\.(opus|ogg|m4a|aac|mp3|wav|amr|webm)$/i;
const HEADER_IOS = /^\[(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),?\s+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\s*([ap]\.?\s?m\.?)?\]\s+([^:]+?):\s?(.*)$/i;
const HEADER_ANDROID = /^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),?\s+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\s*([ap]\.?\s?m\.?)?\s+-\s+(?:([^:]+?):\s?)?(.*)$/i;
const ATTACHED_IOS = /<attached:\s*([^>]+)>/i;
const ATTACHED_ANDROID = /^(\S+\.\w{2,4})\s+\(file attached\)$/i;
const OMITTED = /^(?:<media omitted>|audio omitted|image omitted|video omitted|sticker omitted|document omitted|gif omitted)$/i;

// Direction marks and narrow spaces sneak into exports and break plain regexes.
function clean(line) {
  return line.replace(/[‎‏‪-‮⁦-⁩﻿]/g, '').replace(/[  ]/g, ' ');
}

function parseHeader(line) {
  const ios = line.match(HEADER_IOS);
  if (ios) return { a: +ios[1], b: +ios[2], year: +ios[3], time: ios[4], ampm: ios[5], sender: ios[6].trim(), text: ios[7] };
  const android = line.match(HEADER_ANDROID);
  if (android) return { a: +android[1], b: +android[2], year: +android[3], time: android[4], ampm: android[5], sender: android[6]?.trim() || null, text: android[7] };
  return null;
}

function to24h(time, ampm) {
  const [h, m, s = '00'] = time.split(/[:.]/);
  let hour = +h;
  if (ampm) {
    const pm = /^p/i.test(ampm);
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  return `${String(hour).padStart(2, '0')}:${m}:${s}`;
}

function attachmentOf(text) {
  const ios = text.match(ATTACHED_IOS);
  if (ios) return ios[1].trim();
  const android = text.trim().match(ATTACHED_ANDROID);
  return android ? android[1] : null;
}

/**
 * Parse an exported chat into messages. Day and month order is guessed from the whole chat:
 * any first number above 12 means day first, any second number above 12 means month first.
 * India writes day first, so that is the tie-break.
 */
export function parseChat(text) {
  const raw = [];
  for (const line of String(text).split(/\r?\n/).map(clean)) {
    const head = parseHeader(line);
    if (head) raw.push(head);
    else if (raw.length) raw[raw.length - 1].text += `\n${line}`;
  }
  const dayFirst = raw.some((m) => m.a > 12 && m.a <= 31) || !raw.some((m) => m.b > 12);
  let mediaOmitted = 0;
  const messages = raw.map((m) => {
    const yearFirst = m.a > 31;
    const day = yearFirst ? m.year : dayFirst ? m.a : m.b;
    const month = yearFirst ? m.b : dayFirst ? m.b : m.a;
    const rawYear = yearFirst ? m.a : m.year;
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const body = m.text.trim();
    if (OMITTED.test(body)) mediaOmitted++;
    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      time: to24h(m.time, m.ampm),
      sender: m.sender,
      text: body,
      attachment: attachmentOf(body),
    };
  });
  return { messages, mediaOmitted };
}

/**
 * Voice notes and other audio, each with the text messages just before it.
 * Families often ask "how do you make kadhi?" right before Nani answers with a voice note.
 */
export function voiceNotes(messages) {
  const notes = [];
  messages.forEach((m, i) => {
    if (!m.attachment || !AUDIO_EXT.test(m.attachment)) return;
    const context = [];
    for (let j = i - 1; j >= 0 && context.length < 2; j--) {
      const prev = messages[j];
      if (prev.date !== m.date) break;
      if (prev.sender && !prev.attachment && !OMITTED.test(prev.text)) context.unshift(`${prev.sender}: ${prev.text}`);
    }
    notes.push({ file: m.attachment, sender: m.sender, date: m.date, time: m.time, context });
  });
  return notes;
}

export function isAudioName(name) {
  return AUDIO_EXT.test(name);
}

/**
 * Open an exported .zip: find the chat text, list the voice notes it mentions, and
 * keep any audio the chat does not mention too, so nothing in the zip is silently dropped.
 */
export async function openExport(bytes) {
  const entries = listEntries(bytes);
  const base = (name) => name.split('/').pop();
  const chatEntry = entries.find((e) => base(e.name) === '_chat.txt')
    || entries.find((e) => /\.txt$/i.test(e.name) && !base(e.name).startsWith('.'));
  const audio = new Map(entries.filter((e) => isAudioName(e.name) && !base(e.name).startsWith('.')).map((e) => [base(e.name), e]));

  let notes = [];
  let mediaOmitted = 0;
  if (chatEntry) {
    const parsed = parseChat(new TextDecoder().decode(await readEntry(bytes, chatEntry)));
    mediaOmitted = parsed.mediaOmitted;
    notes = voiceNotes(parsed.messages);
  }
  const mentioned = new Set(notes.map((n) => n.file));
  for (const name of audio.keys()) {
    if (!mentioned.has(name)) notes.push({ file: name, sender: null, date: null, time: null, context: [] });
  }
  return {
    hasChat: Boolean(chatEntry),
    mediaOmitted,
    notes: notes.map((n) => ({ ...n, entry: audio.get(n.file) || null })),
    read: (entry) => readEntry(bytes, entry),
  };
}
