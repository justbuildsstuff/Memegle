// Memegle storage: bundled index (data/memes.json) + IndexedDB for uploads, edits and embeddings.
const DB_NAME = 'memegle';
const DB_VERSION = 1;
const SETTINGS_KEY = 'memegle.settings';
const HISTORY_KEY = 'memegle.history';

export const DEFAULT_SETTINGS = {
  theme: 'system',            // system | light | dark
  searchMode: 'keyword',      // keyword | vector
  provider: 'browser',        // browser | openai
  model: 'onnx-community/Florence-2-base-ft',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiKey: '',
  openaiModel: 'gpt-4o-mini',
  autoDescribe: true,
  uploadFolder: 'direct-uploads',
  resultsPerPage: 20,
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('uploads')) db.createObjectStore('uploads', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('overrides')) db.createObjectStore('overrides', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('embeddings')) db.createObjectStore('embeddings', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('IndexedDB timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export const idb = {
  getAll: (store) => tx(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
  put: (store, obj) => tx(store, 'readwrite', (s) => s.put(obj)),
  del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
};

// ---------- settings ----------
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
export function pushHistory(q) {
  q = (q || '').trim();
  if (!q) return;
  const h = loadHistory().filter((x) => x.toLowerCase() !== q.toLowerCase());
  h.unshift(q);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 30))); } catch { /* ignore */ }
}
export function clearHistory() { try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ } }

// ---------- library ----------
const objectUrls = new Map();

function urlFor(upload) {
  if (!objectUrls.has(upload.id)) objectUrls.set(upload.id, URL.createObjectURL(upload.blob));
  return objectUrls.get(upload.id);
}

export function titleFromFilename(name) {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Load bundled memes + user uploads + edits into one array. */
export async function loadLibrary() {
  let bundled = [];
  try {
    const res = await fetch('data/memes.json', { cache: 'no-cache' });
    if (res.ok) bundled = (await res.json()).memes || [];
  } catch (e) { console.warn('bundled index unavailable', e); }
  let uploads = []; let overrides = [];
  try {
    // IndexedDB can be blocked (private mode, storage disabled); never let that keep the app from rendering.
    [uploads, overrides] = await withTimeout(Promise.all([idb.getAll('uploads'), idb.getAll('overrides')]), 6000);
  } catch (e) { console.warn('IndexedDB unavailable, uploads disabled', e); }
  const ov = new Map(overrides.map((o) => [o.id, o]));
  const hidden = new Set(overrides.filter((o) => o.hidden).map((o) => o.id));

  const lib = [];
  for (const m of bundled) {
    if (hidden.has(m.id)) continue;
    const o = ov.get(m.id) || {};
    lib.push({
      ...m,
      url: encodeURI(m.path),
      title: titleFromFilename(m.filename),
      description: o.description ?? m.description ?? '',
      text: o.text ?? m.text ?? '',
      tags: o.tags ?? m.tags ?? [],
      edited: Boolean(o.description !== undefined || o.tags !== undefined),
      created: m.created || 0,
      source: 'bundled',
    });
  }
  for (const u of uploads) {
    lib.push({
      id: u.id,
      path: `${u.folder}/${u.filename}`,
      url: urlFor(u),
      filename: u.filename,
      title: titleFromFilename(u.filename),
      folder: u.folder,
      width: u.width,
      height: u.height,
      description: u.description || '',
      text: u.text || '',
      tags: u.tags || [],
      created: u.created,
      source: 'upload',
      blob: u.blob,
      mime: u.blob?.type,
    });
  }
  lib.sort((a, b) => (b.created || 0) - (a.created || 0));
  return lib;
}

/** Persist description/text/tags for any meme (upload or bundled override). */
export async function saveMemeFields(meme, fields) {
  if (meme.source === 'upload') {
    const u = await idb.get('uploads', meme.id);
    if (!u) return;
    Object.assign(u, fields);
    await idb.put('uploads', u);
  } else {
    const o = (await idb.get('overrides', meme.id)) || { id: meme.id };
    Object.assign(o, fields);
    await idb.put('overrides', o);
  }
  await idb.del('embeddings', meme.id); // text changed -> embedding stale
}

export async function resetOverride(meme) {
  await idb.del('overrides', meme.id);
  await idb.del('embeddings', meme.id);
}

export async function deleteMeme(meme) {
  if (meme.source === 'upload') {
    await idb.del('uploads', meme.id);
    if (objectUrls.has(meme.id)) { URL.revokeObjectURL(objectUrls.get(meme.id)); objectUrls.delete(meme.id); }
  } else {
    const o = (await idb.get('overrides', meme.id)) || { id: meme.id };
    o.hidden = true;
    await idb.put('overrides', o);
  }
  await idb.del('embeddings', meme.id);
}

function readImageSize(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

async function uniqueFilename(folder, name) {
  const uploads = await idb.getAll('uploads');
  const taken = new Set(uploads.filter((u) => u.folder === folder).map((u) => u.filename.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const m = name.match(/^(.*?)(\.[a-z0-9]+)?$/i);
  const base = m[1]; const ext = m[2] || '';
  for (let i = 1; i < 1000; i++) {
    const cand = `${base}_${i}${ext}`;
    if (!taken.has(cand.toLowerCase())) return cand;
  }
  return `${base}_${Date.now()}${ext}`;
}

export async function addUpload(file, folder) {
  const { width, height } = await readImageSize(file);
  const filename = await uniqueFilename(folder, file.name || `pasted_${Date.now()}.png`);
  const rec = {
    id: 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    filename,
    folder,
    blob: file,
    width,
    height,
    description: '',
    text: '',
    tags: [],
    created: Date.now(),
  };
  await idb.put('uploads', rec);
  return rec;
}

// ---------- embeddings cache ----------
export async function getEmbedding(id) { return idb.get('embeddings', id); }
export async function putEmbedding(id, hash, vec) { return idb.put('embeddings', { id, hash, vec: Array.from(vec) }); }

// ---------- export / import ----------
function blobToDataUrl(blob) {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
}
async function dataUrlToBlob(dataUrl) { return (await fetch(dataUrl)).blob(); }

export async function exportLibrary() {
  const uploads = await idb.getAll('uploads');
  const overrides = await idb.getAll('overrides');
  const out = { app: 'memegle', version: 1, exported: new Date().toISOString(), overrides, uploads: [] };
  for (const u of uploads) out.uploads.push({ ...u, blob: await blobToDataUrl(u.blob) });
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

export async function importLibrary(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (data.app !== 'memegle') throw new Error('Not a Memegle export');
  let n = 0;
  for (const o of data.overrides || []) { await idb.put('overrides', o); n++; }
  for (const u of data.uploads || []) {
    const blob = typeof u.blob === 'string' ? await dataUrlToBlob(u.blob) : u.blob;
    await idb.put('uploads', { ...u, blob });
    n++;
  }
  return n;
}

export async function clearLibrary() {
  await idb.clear('uploads');
  await idb.clear('overrides');
  await idb.clear('embeddings');
}

export async function libraryStats() {
  const uploads = await idb.getAll('uploads');
  const bytes = uploads.reduce((a, u) => a + (u.blob?.size || 0), 0);
  let quota = null;
  try { if (navigator.storage?.estimate) quota = await navigator.storage.estimate(); } catch { /* ignore */ }
  return { uploads: uploads.length, bytes, quota };
}
