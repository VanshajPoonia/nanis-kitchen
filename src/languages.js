// The languages the book can be spoken in. `script` is the Unicode script name Whisper should write in.
export const LANGUAGES = {
  en: { name: 'English', native: 'English', whisper: 'english', script: 'Latin' },
  hi: { name: 'Hindi', native: 'हिन्दी', whisper: 'hindi', script: 'Devanagari' },
  pa: { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', whisper: 'punjabi', script: 'Gurmukhi' },
  ta: { name: 'Tamil', native: 'தமிழ்', whisper: 'tamil', script: 'Tamil' },
};

const SCRIPTS = ['Devanagari', 'Gurmukhi', 'Tamil', 'Arabic', 'Latin'];

// The script most letters are in, so the app can warn when Punjabi comes back in Devanagari or Urdu.
export function dominantScript(text) {
  const letters = String(text).match(/\p{L}/gu) || [];
  let best = null;
  let bestCount = 0;
  for (const script of SCRIPTS) {
    const re = new RegExp(`\\p{Script=${script}}`, 'u');
    const count = letters.filter((c) => re.test(c)).length;
    if (count > bestCount) {
      best = script;
      bestCount = count;
    }
  }
  return best;
}

export function isMultilingualModel(modelId) {
  return !modelId.endsWith('.en');
}
