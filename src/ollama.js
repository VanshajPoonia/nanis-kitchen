// Optional second brain. If Ollama is running locally, any open-weight model it has
// can do the structuring instead of the rule parser. Swap gpt-oss for qwen for llama
// and the app does not change. That swap is the whole point of open weights.
const BASE = 'http://localhost:11434';

export async function detect() {
  try {
    const res = await fetch(`${BASE}/api/tags`, { signal: AbortSignal.timeout(1200) });
    if (!res.ok) return { available: false, models: [] };
    const data = await res.json();
    return { available: true, models: (data.models || []).map((m) => m.name) };
  } catch {
    return { available: false, models: [] };
  }
}

const SYSTEM = `You convert a spoken recipe transcript into JSON. The speaker is an elderly home cook; keep their voice.
Return ONLY a JSON object with keys: title (string), serves (string|null), time (string|null), temperature (string|null),
ingredients (array of strings), steps (array of strings), story (array of strings).
"story" holds personal asides and memories, verbatim, not instructions. Never invent an ingredient or a step
that is not in the transcript. If a quantity is vague ("a little", "to taste"), keep it vague.`;

export async function structure(transcript, model) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: transcript },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.message.content);
  return {
    title: parsed.title || 'Untitled recipe',
    serves: parsed.serves || null,
    time: parsed.time || null,
    temperature: parsed.temperature || null,
    ingredients: toLines(parsed.ingredients),
    steps: toLines(parsed.steps),
    story: toLines(parsed.story),
    source: `ollama:${model}`,
  };
}

function toLines(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(Boolean).map((text) => ({ text: String(text).trim(), time: null }));
}
