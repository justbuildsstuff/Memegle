// Memegle AI: in-browser image-to-text (Florence-2 via Transformers.js), sentence embeddings
// for vector search, and an OpenAI-compatible vision provider. Everything is lazy-loaded.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3';
const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';

export const CAPTION_MODELS = [
  { id: 'onnx-community/Florence-2-base-ft', label: 'Florence-2 base (230M, default)', size: '~250 MB' },
  { id: 'onnx-community/Florence-2-large-ft', label: 'Florence-2 large (770M)', size: '~800 MB' },
];

let tfPromise = null;
let embedderPromise = null;
const captioners = new Map();

export function hasWebGPU() { return typeof navigator !== 'undefined' && 'gpu' in navigator; }

export async function loadTransformers() {
  if (!tfPromise) {
    tfPromise = import(/* webpackIgnore: true */ TRANSFORMERS_URL).then((mod) => {
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
      return mod;
    });
  }
  return tfPromise;
}

function progressAdapter(onProgress) {
  const files = new Map();
  return (p) => {
    if (!onProgress) return;
    if (p.status === 'progress' && p.file) files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
    if (p.status === 'done' && p.file && files.has(p.file)) { const f = files.get(p.file); f.loaded = f.total; }
    let loaded = 0; let total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    onProgress({ status: p.status, file: p.file, loaded, total, pct: total ? Math.round(100 * loaded / total) : 0 });
  };
}

// ---------- embeddings ----------
export async function getEmbedder(onProgress) {
  if (!embedderPromise) {
    embedderPromise = loadTransformers().then(({ pipeline }) =>
      pipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8', progress_callback: progressAdapter(onProgress) }));
    embedderPromise.catch(() => { embedderPromise = null; });
  }
  return embedderPromise;
}

export async function embed(texts, onProgress) {
  const extractor = await getEmbedder(onProgress);
  const out = await extractor(texts, { pooling: 'mean', normalize: true });
  const [n, dim] = out.dims;
  const vecs = [];
  for (let i = 0; i < n; i++) vecs.push(Array.from(out.data.slice(i * dim, (i + 1) * dim)));
  return vecs;
}

// ---------- captioning (browser) ----------
export async function getCaptioner(modelId, onProgress) {
  if (!captioners.has(modelId)) {
    const p = (async () => {
      const { Florence2ForConditionalGeneration, AutoProcessor, AutoTokenizer } = await loadTransformers();
      const webgpu = hasWebGPU();
      const opts = {
        progress_callback: progressAdapter(onProgress),
        device: webgpu ? 'webgpu' : 'wasm',
        dtype: webgpu
          ? { embed_tokens: 'fp16', vision_encoder: 'fp16', encoder_model: 'q4', decoder_model_merged: 'q4' }
          : { embed_tokens: 'q8', vision_encoder: 'q8', encoder_model: 'q8', decoder_model_merged: 'q8' },
      };
      let model;
      try {
        model = await Florence2ForConditionalGeneration.from_pretrained(modelId, opts);
      } catch (e) {
        if (!webgpu) throw e;
        console.warn('WebGPU load failed, falling back to wasm', e);
        model = await Florence2ForConditionalGeneration.from_pretrained(modelId, {
          ...opts, device: 'wasm', dtype: { embed_tokens: 'q8', vision_encoder: 'q8', encoder_model: 'q8', decoder_model_merged: 'q8' },
        });
      }
      const processor = await AutoProcessor.from_pretrained(modelId);
      const tokenizer = await AutoTokenizer.from_pretrained(modelId);
      return { model, processor, tokenizer };
    })();
    p.catch(() => captioners.delete(modelId));
    captioners.set(modelId, p);
  }
  return captioners.get(modelId);
}

async function florenceTask(cap, image, task, maxTokens) {
  const { model, processor, tokenizer } = cap;
  const visionInputs = await processor(image);
  const prompts = processor.construct_prompts(task);
  const textInputs = tokenizer(prompts);
  const ids = await model.generate({ ...textInputs, ...visionInputs, max_new_tokens: maxTokens });
  const text = tokenizer.batch_decode(ids, { skip_special_tokens: false })[0];
  const parsed = processor.post_process_generation(text, task, image.size);
  const v = parsed[task];
  return (typeof v === 'string' ? v : JSON.stringify(v)).replace(/<[^>]+>/g, '').trim();
}

export async function describeInBrowser(blobOrUrl, modelId, onProgress) {
  const cap = await getCaptioner(modelId, onProgress);
  const { RawImage } = await loadTransformers();
  const image = typeof blobOrUrl === 'string' ? await RawImage.fromURL(blobOrUrl) : await RawImage.fromBlob(blobOrUrl);
  onProgress?.({ status: 'generating', pct: 100 });
  const description = await florenceTask(cap, image, '<MORE_DETAILED_CAPTION>', 128);
  let text = '';
  try { text = await florenceTask(cap, image, '<OCR>', 96); } catch (e) { console.warn('OCR failed', e); }
  return { description, text };
}

// ---------- captioning (OpenAI-compatible API) ----------
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob);
  });
}

export async function describeWithApi(blobOrUrl, { baseUrl, apiKey, model }) {
  if (!apiKey) throw new Error('No API key set in Settings');
  let imageUrl = blobOrUrl;
  if (typeof blobOrUrl !== 'string') imageUrl = await blobToDataUrl(blobOrUrl);
  else if (!/^https?:|^data:/.test(blobOrUrl)) imageUrl = await blobToDataUrl(await (await fetch(blobOrUrl)).blob());
  const body = {
    model,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this meme for a search index. First a detailed description of the scene, characters, expressions and the joke (max 80 words). Then on a new line starting with "TEXT:" transcribe all text visible in the image verbatim.' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }],
  };
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const m = content.match(/TEXT:\s*([\s\S]*)$/i);
  return { description: (m ? content.slice(0, m.index) : content).trim(), text: m ? m[1].trim() : '' };
}

export async function describe(meme, settings, onProgress) {
  const src = meme.blob || meme.url;
  if (settings.provider === 'openai') {
    return describeWithApi(src, { baseUrl: settings.openaiBaseUrl, apiKey: settings.openaiKey, model: settings.openaiModel });
  }
  return describeInBrowser(src, settings.model, onProgress);
}

export async function isModelCached(modelId) {
  try {
    if (!('caches' in window)) return false;
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    return keys.some((k) => k.url.includes(modelId) && k.url.includes('onnx'));
  } catch { return false; }
}
