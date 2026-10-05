// Whisper, running in this tab. Open weights, no network after the first load.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5';

// Let the Hub cache the weights in the browser's Cache Storage so round two is offline.
env.allowLocalModels = false;
env.useBrowserCache = true;

const SAMPLE_RATE = 16000;

let transcriber = null;
let loadedKey = '';

export function isLoaded(modelId, device) {
  return transcriber !== null && loadedKey === `${modelId}|${device}`;
}

async function pickDevice(requested) {
  if (requested !== 'auto') return requested;
  if (!('gpu' in navigator)) return 'wasm';
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

// WebGPU wants per-module dtypes for the encoder/decoder split; WASM is happy with q8.
function dtypeFor(device) {
  return device === 'webgpu'
    ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
    : 'q8';
}

export async function loadModel(modelId, requestedDevice, onProgress) {
  const device = await pickDevice(requestedDevice);
  const key = `${modelId}|${device}`;
  if (transcriber && loadedKey === key) return { device, reused: true };

  transcriber = await pipeline('automatic-speech-recognition', modelId, {
    device,
    dtype: dtypeFor(device),
    progress_callback: onProgress,
  });
  loadedKey = key;
  return { device, reused: false };
}

// Browsers hand back whatever sample rate they like; Whisper wants 16 kHz mono.
export async function decodeAudio(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  let ctx;
  try {
    ctx = new Ctx({ sampleRate: SAMPLE_RATE });
  } catch {
    ctx = new Ctx();
  }
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  let samples;
  if (decoded.numberOfChannels === 1) {
    samples = decoded.getChannelData(0);
  } else {
    const left = decoded.getChannelData(0);
    const right = decoded.getChannelData(1);
    samples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) samples[i] = (left[i] + right[i]) / 2;
  }
  const resampled = decoded.sampleRate === SAMPLE_RATE
    ? samples
    : resample(samples, decoded.sampleRate, SAMPLE_RATE);
  ctx.close();
  return { audio: resampled, duration: resampled.length / SAMPLE_RATE };
}

function resample(input, from, to) {
  const ratio = from / to;
  const out = new Float32Array(Math.round(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = pos - lo;
    out[i] = input[lo] * (1 - frac) + input[hi] * frac;
  }
  return out;
}

export async function transcribe(audio, { onChunk } = {}) {
  if (!transcriber) throw new Error('Load a model first.');
  const result = await transcriber(audio, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    callback_function: onChunk ? (beams) => {
      const best = beams?.[0]?.output_token_ids;
      if (!best) return;
      onChunk(transcriber.tokenizer.decode(best, { skip_special_tokens: true }));
    } : undefined,
  });
  return {
    text: (result.text || '').trim(),
    // [{ text, timestamp: [start, end] }] — this is what lets a step replay her voice.
    chunks: (result.chunks || []).map((c) => ({
      text: (c.text || '').trim(),
      start: c.timestamp?.[0] ?? null,
      end: c.timestamp?.[1] ?? null,
    })),
  };
}
