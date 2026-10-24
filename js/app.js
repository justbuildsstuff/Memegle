// Memegle - Google for memes. Vanilla JS SPA with hash routing; works from any static host.
import {
  loadLibrary, loadSettings, saveSettings, loadHistory, pushHistory, clearHistory, saveMemeFields, resetOverride,
  deleteMeme, addUpload, getEmbedding, putEmbedding, exportLibrary, importLibrary, clearLibrary, libraryStats, DEFAULT_SETTINGS, idb,
} from './store.js';
import {
  buildIndex, search, didYouMean, suggestions, highlight, rankByVector, embeddingText, hashText, tokenize,
} from './search.js';
import { describe, embed, getCaptioner, CAPTION_MODELS, hasWebGPU, isModelCached } from './ai.js';

// ------------------------------------------------------------------ icons
const I = {
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path fill="#4285f4" d="m12 15c1.66 0 3-1.31 3-2.97v-7.02c0-1.66-1.34-3.01-3-3.01s-3 1.34-3 3.01v7.02c0 1.66 1.34 2.97 3 2.97z"/><path fill="#34a853" d="m11 18.08h2v3.92h-2z"/><path fill="#fbbc05" d="m7.05 16.87c-1.27-1.33-2.05-2.83-2.05-4.87h2c0 1.45 0.56 2.42 1.47 3.38v0.32l-1.15 1.18z"/><path fill="#ea4335" d="m12 16.93a4.97 5.25 0 0 1 -3.54 -1.55l-1.41 1.49c1.26 1.34 3.02 2.13 4.95 2.13 3.87 0 6.99-2.92 6.99-7h-1.99c0 2.92-2.24 4.93-5 4.93z"/></svg>',
  lens: '<svg viewBox="0 0 192 192"><rect fill="none" height="192" width="192"/><g><circle fill="#34a853" cx="144.07" cy="144" r="16"/><circle fill="#4285f4" cx="96.07" cy="104" r="24"/><path fill="#ea4335" d="M24,135.2c0,18.11,14.69,32.8,32.8,32.8H96v-16l-40.1-0.1c-8.8,0-15.9-8.19-15.9-17.9v-18H24V135.2z"/><path fill="#fbbc05" d="M168,72.8c0-18.11-14.69-32.8-32.8-32.8H116l20,16c8.8,0,16,8.29,16,18v30h16V72.8z"/><path fill="#4285f4" d="M112,24l-32,0L68,40H56.8C38.69,40,24,54.69,24,72.8V92h16V74c0-9.71,7.2-18,16-18h80L112,24z"/></g></svg>',
  clear: '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  apps: '<svg viewBox="0 0 24 24"><path d="M6 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 12c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4-8c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm-4 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  history: '<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
  select: '<svg viewBox="0 0 24 24"><path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2zM7 17h10V7H7v10zm2-8h6v6H9V9z"/></svg>',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const logoHtml = (cls = '') => `<a class="logo ${cls}" href="#/" aria-label="Memegle home">${'Memegle'.split('').map((c) => `<span>${c}</span>`).join('')}</a>`;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ------------------------------------------------------------------ state
const state = {
  lib: [],
  index: null,
  settings: loadSettings(),
  route: { name: 'home', params: {} },
  vectors: new Map(),
  vectorHash: new Map(),
  selected: new Set(),
  queue: [],
  queueRunning: false,
  jobStatus: '',
  limit: 0,
  lastResults: null,
};

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

async function reload() {
  state.lib = await loadLibrary();
  state.index = buildIndex(state.lib);
}

function memeById(id) { return state.lib.find((m) => m.id === id); }
function allTags() {
  const c = new Map();
  for (const m of state.lib) for (const t of m.tags || []) c.set(t, (c.get(t) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function allFolders() {
  const c = new Map();
  for (const m of state.lib) c.set(m.folder, (c.get(m.folder) || 0) + 1);
  return [...c.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// ------------------------------------------------------------------ router
function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [rawPath, qs = ''] = hash.split('?');
  const path = rawPath.split('#')[0]; // allow #/settings#about anchors
  const params = Object.fromEntries(new URLSearchParams(qs.split('#')[0]));
  const seg = path.split('/').filter(Boolean);
  if (!seg.length) return { name: 'home', params };
  if (seg[0] === 'meme' && seg[1]) return { name: 'search', params: { tab: 'images', id: decodeURIComponent(seg[1]), ...params } };
  return { name: seg[0], params };
}
function go(name, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) qs.set(k, v);
  const s = qs.toString();
  location.hash = `#/${name === 'home' ? '' : name}${s ? '?' + s : ''}`;
}
function searchUrl(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) qs.set(k, v);
  return `#/search?${qs.toString()}`;
}

// ------------------------------------------------------------------ search box component
function searchBox({ value = '', autofocus = false, compact = false } = {}) {
  const wrap = document.createElement('form');
  wrap.className = 'searchbox';
  wrap.setAttribute('role', 'search');
  wrap.innerHTML = `
    <div class="searchbox-inner">
      <span class="sb-icon">${I.search}</span>
      <input type="text" name="q" autocomplete="off" spellcheck="false" aria-label="Search memes" title="Search" value="${esc(value)}" ${autofocus ? 'autofocus' : ''}>
      <button type="button" class="sb-btn sb-clear ${value ? '' : 'hidden'}" title="Clear" aria-label="Clear">${I.clear}</button>
      <span class="sb-divider ${value ? '' : 'hidden'}"></span>
      <button type="button" class="sb-btn sb-mic" title="Search by voice" aria-label="Search by voice">${I.mic}</button>
      <button type="button" class="sb-btn sb-lens" title="Search by image (Memegle Lens)" aria-label="Search by image">${I.lens}</button>
      ${compact ? `<button type="submit" class="sb-btn sb-go" title="Search" aria-label="Search"><span class="sb-icon" style="fill:var(--blue)">${I.search}</span></button>` : ''}
    </div>
    <div class="suggest" role="listbox"></div>`;
  const input = $('input', wrap);
  const sug = $('.suggest', wrap);
  let items = [];
  let active = -1;

  const renderSug = () => {
    items = suggestions(state.index, state.lib, input.value, loadHistory());
    wrap.classList.toggle('has-suggest', items.length > 0);
    sug.innerHTML = items.map((it, i) => `
      <div class="suggest-item ${i === active ? 'active' : ''}" data-i="${i}" role="option">
        ${it.kind === 'history' ? I.history : it.kind === 'tag' ? I.tag : it.kind === 'meme' ? `<img src="${esc(it.meme.url)}" alt="">` : I.search}
        <span>${esc(it.text)}</span>
        <span class="kind">${it.kind === 'history' ? 'Recent' : it.kind === 'tag' ? 'Tag' : it.kind === 'meme' ? 'Meme' : ''}</span>
      </div>`).join('');
  };
  const submit = (q) => {
    q = (q ?? input.value).trim();
    wrap.classList.remove('focus');
    input.blur();
    const p = state.route.name === 'search' ? { ...state.route.params } : {};
    delete p.id; delete p.sel;
    if (q) pushHistory(q);
    go('search', { ...p, q });
  };
  input.addEventListener('focus', () => { wrap.classList.add('focus'); active = -1; });
  input.addEventListener('click', () => { wrap.classList.add('focus'); renderSug(); });
  input.addEventListener('input', () => {
    active = -1; renderSug();
    $('.sb-clear', wrap).classList.toggle('hidden', !input.value);
    $('.sb-divider', wrap).classList.toggle('hidden', !input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; renderSug(); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; renderSug(); }
    else if (e.key === 'Escape') { wrap.classList.remove('focus'); input.blur(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
  });
  const pick = (it) => {
    if (it.kind === 'meme') { pushHistory(it.text); go('search', { q: it.text, tab: 'images', id: it.meme.id }); return; }
    if (it.kind === 'tag') { go('search', { tab: 'images', tags: it.text }); return; }
    submit(it.text);
  };
  sug.addEventListener('mousedown', (e) => {
    const el = e.target.closest('.suggest-item');
    if (!el) return;
    e.preventDefault();
    pick(items[+el.dataset.i]);
  });
  wrap.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  $('.sb-clear', wrap).addEventListener('click', () => { input.value = ''; input.focus(); input.dispatchEvent(new Event('input')); });
  $('.sb-lens', wrap).addEventListener('click', () => $('#lens-input').click());
  $('.sb-mic', wrap).addEventListener('click', () => voiceSearch(input, submit));
  return wrap;
}

function voiceSearch(input, submit) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice search is not supported in this browser'); return; }
  const rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  toast('Listening...', 6000);
  rec.onresult = (e) => {
    const t = [...e.results].map((r) => r[0].transcript).join(' ');
    input.value = t;
    if (e.results[e.results.length - 1].isFinal) { submit(t); }
  };
  rec.onerror = () => toast('Voice search failed');
  rec.start();
}

function topRight() {
  return `
    <div class="right">
      <a class="link" href="#/search?tab=images" title="Browse all memes">Images</a>
      <a class="link" href="#/upload">Upload</a>
      <button class="icon-btn" data-action="settings" title="Settings" aria-label="Settings">${I.settings}</button>
      <button class="icon-btn" data-action="apps" title="Memegle apps" aria-label="Memegle apps">${I.apps}</button>
      <button class="avatar" data-action="settings" title="Local library (this browser)">M</button>
    </div>`;
}
function appsMenu() {
  return `
    <div class="apps-menu hidden" id="apps-menu">
      <a href="#/search?tab=images">${I.image}<span>Images</span></a>
      <a href="#/upload">${I.upload}<span>Upload</span></a>
      <a href="#/tags">${I.tag}<span>Tags</span></a>
      <a href="#/folders">${I.folder}<span>Folders</span></a>
      <a href="#/settings">${I.settings}<span>Settings</span></a>
      <a href="#/search?tab=images&mode=vector">${I.sparkle}<span>Vector</span></a>
    </div>`;
}

// ------------------------------------------------------------------ views
function renderHome(app) {
  app.innerHTML = `
    <header class="home-top">${topRight()}${appsMenu()}</header>
    <main class="home">
      <div class="logo-wrap">${logoHtml()}</div>
      <div id="sb"></div>
      <div class="buttons">
        <button class="gbtn" data-action="home-search">Memegle Search</button>
        <button class="gbtn" data-action="lucky">I'm Feeling Memey</button>
      </div>
      <p class="offered">Memegle: Google for memes. ${state.lib.length} memes indexed in this browser. <a href="#/upload">Add your own</a></p>
    </main>
    <footer class="home-footer">
      <div class="country">Your library stays in this browser</div>
      <div class="links">
        <div><a href="#/settings#about">About</a><a href="#/settings#how">How Search works</a><a href="https://github.com/justbuildsstuff/Memegle" target="_blank" rel="noopener">Source</a></div>
        <div><a href="#/settings#privacy">Privacy</a><a href="#/tags">Tags</a><a href="#/settings">Settings</a></div>
      </div>
    </footer>`;
  const sb = searchBox({ autofocus: window.innerWidth > 640 });
  $('#sb', app).replaceWith(sb);
  $('[data-action=home-search]', app).addEventListener('click', () => sb.requestSubmit());
}

function currentQueryParams() {
  const p = state.route.params;
  return {
    q: p.q || '',
    tab: p.tab || 'all',
    tags: p.tags ? p.tags.split('|').filter(Boolean) : [],
    folder: p.folder || '',
    mode: p.mode || state.settings.searchMode,
    sort: p.sort || 'relevance',
    id: p.id || '',
    sel: p.sel === '1',
    tools: p.tools === '1',
  };
}

async function runSearch(qp) {
  if (qp.mode === 'vector' && qp.q.trim()) {
    try {
      await ensureVectors();
      const [qv] = await embed([qp.q]);
      const r = rankByVector(state.lib, state.vectors, qv, { tags: qp.tags, folder: qp.folder });
      return { ...r, tokens: tokenize(qp.q), vector: true };
    } catch (e) {
      console.error(e);
      toast('Vector search unavailable (' + (e.message || e) + '). Using keyword search.');
    }
  }
  return search(state.index, qp.q, { tags: qp.tags, folder: qp.folder, sort: qp.sort });
}

let vectorBusy = null;
async function ensureVectors(onProgress) {
  if (vectorBusy) return vectorBusy;
  vectorBusy = (async () => {
    const todo = [];
    for (const m of state.lib) {
      const text = embeddingText(m);
      const h = hashText(text);
      if (state.vectorHash.get(m.id) === h && state.vectors.has(m.id)) continue;
      const cached = await getEmbedding(m.id);
      if (cached && cached.hash === h) { state.vectors.set(m.id, cached.vec); state.vectorHash.set(m.id, h); continue; }
      todo.push({ m, text, h });
    }
    if (!todo.length) return;
    setJob(`Embedding ${todo.length} memes for vector search...`);
    for (let i = 0; i < todo.length; i += 16) {
      const batch = todo.slice(i, i + 16);
      const vecs = await embed(batch.map((b) => b.text), (p) => { if (p.status === 'progress') setJob(`Loading embedding model ${p.pct}%`); });
      for (let j = 0; j < batch.length; j++) {
        const vec = vecs[j];
        state.vectors.set(batch[j].m.id, vec);
        state.vectorHash.set(batch[j].m.id, batch[j].h);
        await putEmbedding(batch[j].m.id, batch[j].h, vec);
      }
      setJob(`Embedding ${Math.min(i + 16, todo.length)}/${todo.length}`);
      onProgress?.(i + batch.length, todo.length);
    }
    setJob('');
  })();
  try { await vectorBusy; } finally { vectorBusy = null; }
}

function setJob(text) {
  state.jobStatus = text;
  const el = $('#job-status');
  if (el) { el.textContent = text; el.classList.toggle('hidden', !text); }
}

async function renderResults(app, isStale) {
  const qp = currentQueryParams();
  let res = await runSearch(qp);
  if (isStale()) return; // route changed while searching
  let corrected = null;
  if (qp.q && !res.results.length && !res.vector && !state.route.params.exact) {
    const dym = didYouMean(state.index, qp.q);
    if (dym) {
      const res2 = search(state.index, dym, { tags: qp.tags, folder: qp.folder, sort: qp.sort });
      if (res2.results.length) { corrected = dym; res = res2; }
    }
  }
  state.lastResults = res;
  if (!qp.sel) state.selected.clear();
  const total = res.results.length;
  const limit = state.limit || state.settings.resultsPerPage;
  const shown = res.results.slice(0, limit);

  const tabs = [
    ['all', 'All', I.search], ['images', 'Images', I.image], ['tags', 'Tags', I.tag], ['folders', 'Folders', I.folder],
  ];
  const tagList = allTags();
  const folders = allFolders();

  app.innerHTML = `
    <header class="results-top">
      <div class="results-bar">
        ${logoHtml()}
        <div id="sb"></div>
        ${topRight()}
      </div>
      <nav class="tabs">
        ${tabs.map(([k, label, icon]) => `<a class="tab ${qp.tab === k ? 'active' : ''}" href="${k === 'tags' ? '#/tags' : k === 'folders' ? '#/folders' : searchUrl({ ...state.route.params, tab: k, id: undefined })}">${icon}${label}</a>`).join('')}
        <a class="tab" href="#/upload">${I.upload}Upload</a>
        <button class="tab right ${qp.tools ? 'active' : ''}" data-action="tools">Tools</button>
      </nav>
      <div class="tools-row ${qp.tools || qp.tags.length || qp.folder || qp.mode === 'vector' ? '' : 'hidden'}">
        <select class="gsel" data-param="mode" title="Search mode">
          <option value="keyword" ${qp.mode === 'keyword' ? 'selected' : ''}>Keyword search</option>
          <option value="vector" ${qp.mode === 'vector' ? 'selected' : ''}>Vector search (AI)</option>
        </select>
        <select class="gsel" data-param="sort" title="Sort">
          <option value="relevance" ${qp.sort === 'relevance' ? 'selected' : ''}>Relevance</option>
          <option value="newest" ${qp.sort === 'newest' ? 'selected' : ''}>Newest</option>
        </select>
        <select class="gsel" data-param="folder" title="Folder">
          <option value="">All folders</option>
          ${folders.map(([f, n]) => `<option value="${esc(f)}" ${qp.folder === f ? 'selected' : ''}>${esc(f)} (${n})</option>`).join('')}
        </select>
        ${qp.tab === 'images' ? `<button class="chip ${qp.sel ? 'on' : ''}" data-action="toggle-select">${I.select} Select</button>` : ''}
        ${tagList.slice(0, 12).map(([t]) => `<a class="chip ${qp.tags.includes(t) ? 'on' : ''}" href="${searchUrl({ ...state.route.params, tags: toggleTag(qp.tags, t), id: undefined })}">${esc(t)}</a>`).join('')}
        ${tagList.length > 12 ? `<a class="chip" href="#/tags">More tags</a>` : ''}
        ${qp.tags.length || qp.folder ? `<a class="chip" href="${searchUrl({ q: qp.q, tab: qp.tab, mode: qp.mode })}">${I.clear} Clear filters</a>` : ''}
      </div>
      ${appsMenu()}
    </header>
    <div class="results ${qp.id ? 'with-panel' : ''}">
      <main class="results-main">
        <div class="result-stats">
          ${qp.q || qp.tags.length || qp.folder ? `About ${total} result${total === 1 ? '' : 's'} (${(res.ms / 1000).toFixed(3)} seconds)${res.vector ? ' · vector mode' : ''}` : `${total} memes in your library`}
          ${qp.tags.length ? ` · tagged ${qp.tags.map((t) => `<b>${esc(t)}</b>`).join(', ')}` : ''}${qp.folder ? ` · in <b>${esc(qp.folder)}</b>` : ''}
        </div>
        <div id="job-status" class="status ${state.jobStatus ? '' : 'hidden'}">${esc(state.jobStatus)}</div>
        ${corrected ? `<div class="dym"><span class="lbl">Showing results for </span><a href="${searchUrl({ ...state.route.params, q: corrected })}">${esc(corrected)}</a><div style="font-size:14px;margin-top:4px"><span class="lbl">Search instead for </span><a href="${searchUrl({ ...state.route.params, q: qp.q, exact: '1' })}" style="font-style:normal">${esc(qp.q)}</a></div></div>` : ''}
        ${qp.sel && qp.tab === 'images' ? bulkBar() : ''}
        ${total === 0 ? emptyState(qp) : qp.tab === 'images' ? imageGrid(shown, qp) : resultList(shown, res.tokens, qp)}
        ${total > shown.length ? `<div style="text-align:center;margin:10px 0 30px"><button class="gbtn" data-action="more">More results (${total - shown.length} left)</button></div>` : ''}
      </main>
      <aside class="side-panel" id="panel">${qp.id ? detailPanel(memeById(qp.id)) : ''}</aside>
    </div>`;
  $('#sb', app).replaceWith(searchBox({ value: qp.q, compact: true }));
  if (qp.id) { const p = $('#panel'); p.scrollTop = 0; bindDetail(p, memeById(qp.id)); }
}

function toggleTag(tags, t) {
  const s = new Set(tags);
  if (s.has(t)) s.delete(t); else s.add(t);
  return [...s].join('|');
}

function emptyState(qp) {
  return `<div class="empty">
    ${qp.q ? `Your search - <b>${esc(qp.q)}</b> - did not match any memes.` : 'No memes here yet.'}
    <div style="margin-top:12px">Suggestions:</div>
    <ul>
      <li>Make sure all words are spelled correctly.</li>
      <li>Try different or more general keywords.</li>
      <li>Try <a href="${searchUrl({ ...state.route.params, mode: qp.mode === 'vector' ? 'keyword' : 'vector' })}">${qp.mode === 'vector' ? 'keyword' : 'vector (AI)'} search</a>.</li>
      <li><a href="#/upload">Upload memes</a> and generate descriptions so they become searchable.</li>
    </ul></div>`;
}

function snippetFor(m, tokens) {
  const parts = [];
  if (m.text) parts.push(`"${m.text}"`);
  if (m.description) parts.push(m.description);
  if (!parts.length) parts.push('No description yet. Open the meme and click Generate description.');
  return highlight(parts.join(' - '), tokens);
}

function resultList(results, tokens, qp) {
  return results.map(({ meme: m, score }) => `
    <div class="g" data-id="${esc(m.id)}">
      <div class="g-head">
        <img class="fav" src="${esc(m.url)}" alt="" loading="lazy">
        <div>
          <div class="site">${esc(m.source === 'upload' ? 'My uploads' : 'Memegle')}</div>
          <div class="url">memes <b>›</b> ${esc(m.folder.split('/').join(' › '))} <b>›</b> ${esc(m.filename)}</div>
        </div>
      </div>
      <h3><a href="${searchUrl({ ...state.route.params, tab: 'images', id: m.id })}">${highlight(m.title, tokens)}${m.description ? '' : ' (no description)'}</a></h3>
      <div class="g-body">
        <div class="g-snippet">${qp.mode !== 'vector' && m.created ? `<span class="date">${new Date(m.created).toLocaleDateString()} - </span>` : ''}${snippetFor(m, tokens)}${qp.mode === 'vector' ? ` <span class="date">(${Math.round(score * 100)}% match)</span>` : ''}</div>
        <img class="g-thumb" src="${esc(m.url)}" alt="${esc(m.title)}" loading="lazy" data-action="open" data-id="${esc(m.id)}">
      </div>
      ${m.tags?.length ? `<div class="g-tags">${m.tags.map((t) => `<a class="chip sm" href="${searchUrl({ tab: qp.tab, tags: t })}">${esc(t)}</a>`).join('')}</div>` : ''}
    </div>`).join('');
}

function imageGrid(results, qp) {
  return `<div class="img-grid ${qp.sel ? 'selecting' : ''}">
    ${results.map(({ meme: m }) => {
      const ar = m.width && m.height ? Math.min(2.2, Math.max(0.6, m.width / m.height)) : 1;
      return `<div class="img-card ${state.selected.has(m.id) ? 'selected' : ''} ${qp.id === m.id ? 'active' : ''}" style="--ar:${ar.toFixed(3)}" data-action="${qp.sel ? 'select' : 'open'}" data-id="${esc(m.id)}">
        <div class="thumb-wrap">
          <img src="${esc(m.url)}" alt="${esc(m.title)}" loading="lazy">
          ${m.description ? '' : '<span class="badge warn">no description</span>'}
          ${m.source === 'upload' ? '<span class="badge" style="top:auto;bottom:8px">upload</span>' : ''}
          <span class="sel">${state.selected.has(m.id) ? I.check : ''}</span>
        </div>
        <div class="cap"><span class="src"><img src="${esc(m.url)}" alt="">${esc(m.folder)}</span>${esc(m.text || m.title)}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function bulkBar() {
  const n = state.selected.size;
  const uploads = [...state.selected].filter((id) => memeById(id)?.source === 'upload').length;
  return `<div class="bulk-bar">
    <span class="count">${n} selected</span>
    <button class="gbtn" data-action="select-all">Select all shown</button>
    <button class="gbtn" data-action="bulk-describe" ${n ? '' : 'disabled'}>${I.sparkle.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px;fill:currentColor"')} Generate descriptions</button>
    <button class="gbtn" data-action="bulk-tag" ${n ? '' : 'disabled'}>Add tag</button>
    <button class="gbtn danger" data-action="bulk-delete" ${n ? '' : 'disabled'}>${uploads === n ? 'Delete' : 'Remove from library'}</button>
    <button class="gbtn" data-action="toggle-select">Done</button>
  </div>`;
}

// ------------------------------------------------------------------ detail panel
function detailPanel(m) {
  if (!m) return `<div class="detail"><div class="detail-head"><button class="icon-btn" data-action="close-panel">${I.close}</button><span class="title">Meme not found</span></div></div>`;
  const similar = similarMemes(m);
  return `<div class="detail" data-id="${esc(m.id)}">
    <div class="detail-head">
      <button class="icon-btn" data-action="close-panel" title="Close" aria-label="Close">${I.close}</button>
      <span class="title" title="${esc(m.path)}">${esc(m.title)}</span>
      <a class="icon-btn" href="${esc(m.url)}" target="_blank" rel="noopener" title="Open image in new tab">${I.open}</a>
    </div>
    <div class="detail-img"><img src="${esc(m.url)}" alt="${esc(m.title)}"></div>
    <div class="meta">
      <span>${I.folder.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px;fill:currentColor"')} ${esc(m.folder)}</span>
      <span>${m.width} × ${m.height}</span>
      <span>${esc(m.filename)}</span>
      <span>${m.source === 'upload' ? 'uploaded ' + new Date(m.created).toLocaleString() : 'bundled'}${m.edited ? ' · edited' : ''}</span>
    </div>
    <div class="actions">
      <button class="gbtn primary" data-action="describe">Generate description</button>
      <button class="gbtn" data-action="download">Download</button>
      <button class="gbtn" data-action="copy">Copy image</button>
      <button class="gbtn" data-action="find-similar">Find similar</button>
      ${m.source === 'bundled' && m.edited ? `<button class="gbtn" data-action="reset">Reset edits</button>` : ''}
      <button class="gbtn danger" data-action="delete">${m.source === 'upload' ? 'Delete' : 'Remove'}</button>
    </div>
    <div class="status" id="d-status"></div>
    <div class="progress hidden" id="d-progress"><div></div></div>
    <h4>Description</h4>
    <textarea id="d-desc" placeholder="Describe the meme: scene, characters, the joke. Used for search.">${esc(m.description)}</textarea>
    <h4>Text in image</h4>
    <textarea id="d-text" style="min-height:56px" placeholder="Transcribed caption text">${esc(m.text)}</textarea>
    <div class="actions"><button class="gbtn primary" data-action="save">Save</button><span class="status" id="d-saved"></span></div>
    <h4>Tags</h4>
    <div class="tag-editor" id="d-tags">
      ${(m.tags || []).map((t) => `<span class="chip sm">${esc(t)}<button class="x" data-action="rm-tag" data-tag="${esc(t)}" title="Remove tag">×</button></span>`).join('')}
      <input id="d-tag-input" list="tag-datalist" placeholder="Add tag, press Enter">
      <datalist id="tag-datalist">${allTags().map(([t]) => `<option value="${esc(t)}">`).join('')}</datalist>
    </div>
    ${similar.length ? `<h4>Similar memes</h4><div class="similar">${similar.map((s) => `<img src="${esc(s.url)}" alt="${esc(s.title)}" title="${esc(s.title)}" data-action="open" data-id="${esc(s.id)}" loading="lazy">`).join('')}</div>` : ''}
  </div>`;
}

function similarMemes(m, n = 8) {
  const q = [...(m.tags || []), m.title, (m.text || '').split(' ').slice(0, 6).join(' ')].join(' ');
  const r = search(state.index, q);
  return r.results.map((x) => x.meme).filter((x) => x.id !== m.id).slice(0, n);
}

function bindDetail(panel, m) {
  if (!m) return;
  const tagInput = $('#d-tag-input', panel);
  tagInput?.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = tagInput.value.trim().toLowerCase();
    if (!t) return;
    const tags = [...new Set([...(m.tags || []), t])];
    await saveMemeFields(m, { tags });
    await reload();
    render();
  });
}

async function describeOne(m, { statusEl, progressEl } = {}) {
  const set = (txt, cls = '') => { if (statusEl) { statusEl.textContent = txt; statusEl.className = 'status ' + cls; } setJob(txt); };
  const prog = (pct) => { if (progressEl) { progressEl.classList.toggle('hidden', pct == null); progressEl.firstElementChild.style.width = (pct || 0) + '%'; } };
  try {
    set(state.settings.provider === 'openai' ? 'Asking vision API...' : 'Loading model (first time downloads ~250 MB)...');
    const r = await describe(m, state.settings, (p) => {
      if (p.status === 'progress') { set(`Downloading model ${p.pct}% (${Math.round(p.loaded / 1048576)} MB)`); prog(p.pct); }
      else if (p.status === 'generating') { set('Generating description...'); prog(100); }
    });
    const fields = { description: r.description || m.description };
    if (r.text) fields.text = r.text;
    await saveMemeFields(m, fields);
    set('Description generated', 'ok');
    prog(null);
    return true;
  } catch (e) {
    console.error(e);
    set('Failed: ' + (e.message || e), 'err');
    prog(null);
    return false;
  }
}

async function runQueue() {
  if (state.queueRunning) return;
  state.queueRunning = true;
  let done = 0; const total = state.queue.length;
  while (state.queue.length) {
    const id = state.queue.shift();
    const m = memeById(id);
    if (!m) continue;
    setJob(`Generating descriptions ${done + 1}/${total}: ${m.title}`);
    const panel = $('#panel .detail[data-id="' + CSS.escape(id) + '"]');
    await describeOne(m, { statusEl: panel ? $('#d-status', panel) : null, progressEl: panel ? $('#d-progress', panel) : null });
    done++;
    await reload();
    if (!/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) render();
  }
  state.queueRunning = false;
  setJob('');
  if (total > 1) toast(`Generated ${done} description${done === 1 ? '' : 's'}`);
}

// ------------------------------------------------------------------ upload
function renderUpload(app) {
  app.innerHTML = `
    <header class="results-top"><div class="results-bar">${logoHtml()}<div id="sb"></div>${topRight()}</div>${appsMenu()}</header>
    <main class="page">
      <h1>Upload memes</h1>
      <p class="lead">Drag and drop, paste from the clipboard, or pick files. Up to 50 images per batch (JPG, PNG, WEBP, GIF).
      Files are stored in this browser only (IndexedDB) and indexed for search. Descriptions can be generated locally with an AI model.</p>
      <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload memes">
        ${I.upload}
        <strong>Drop memes here, paste, or click to browse</strong>
        <span>They never leave your device unless you choose an external vision API in Settings.</span>
      </div>
      <div class="row" style="margin-top:14px">
        <label for="up-folder">Folder</label>
        <input class="ginput grow" id="up-folder" value="${esc(state.settings.uploadFolder)}" list="folder-datalist" placeholder="direct-uploads">
        <datalist id="folder-datalist">${allFolders().map(([f]) => `<option value="${esc(f)}">`).join('')}</datalist>
      </div>
      <div class="row">
        <label class="switch"><input type="checkbox" id="up-auto" ${state.settings.autoDescribe ? 'checked' : ''}> Auto-generate descriptions after upload (${state.settings.provider === 'openai' ? 'vision API' : 'in-browser model'})</label>
      </div>
      <div class="upload-list" id="upload-list"></div>
      <div class="status" id="job-status">${esc(state.jobStatus)}</div>
    </main>`;
  $('#sb', app).replaceWith(searchBox({ compact: true }));
  const dz = $('#dropzone', app);
  dz.addEventListener('click', () => $('#file-input').click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') $('#file-input').click(); });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', (e) => handleFiles([...e.dataTransfer.files]));
  $('#up-folder', app).addEventListener('change', (e) => { state.settings.uploadFolder = e.target.value.trim() || 'direct-uploads'; saveSettings(state.settings); });
  $('#up-auto', app).addEventListener('change', (e) => { state.settings.autoDescribe = e.target.checked; saveSettings(state.settings); });
}

async function handleFiles(files) {
  files = files.filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type));
  if (!files.length) { toast('No supported images (JPG, PNG, WEBP, GIF)'); return; }
  if (files.length > 50) { toast('Max 50 files per batch, taking the first 50'); files = files.slice(0, 50); }
  if (state.route.name !== 'upload') { go('upload'); await new Promise((r) => setTimeout(r, 50)); }
  const list = $('#upload-list');
  const folder = ($('#up-folder')?.value || state.settings.uploadFolder).trim() || 'direct-uploads';
  const added = [];
  for (const f of files) {
    const row = document.createElement('div');
    row.className = 'upload-item';
    const url = URL.createObjectURL(f);
    row.innerHTML = `<img src="${url}" alt=""><span class="name">${esc(f.name)}</span><span class="state">saving...</span>`;
    list?.prepend(row);
    try {
      const rec = await addUpload(f, folder);
      added.push(rec.id);
      $('.state', row).textContent = `saved to ${folder}/${rec.filename}`;
      $('.state', row).classList.add('ok');
    } catch (e) {
      $('.state', row).textContent = 'failed: ' + (e.message || e);
      $('.state', row).classList.add('err');
    }
  }
  await reload();
  toast(`Added ${added.length} meme${added.length === 1 ? '' : 's'}`);
  if (state.settings.autoDescribe && added.length) {
    state.queue.push(...added);
    runQueue();
  }
  const link = document.createElement('div');
  link.className = 'row';
  link.innerHTML = `<a class="gbtn" href="#/search?tab=images&folder=${encodeURIComponent(folder)}" style="display:inline-flex;align-items:center">View in Images</a>`;
  list?.prepend(link);
}

// ------------------------------------------------------------------ lens (search by image)
async function lensSearch(file) {
  const overlay = document.createElement('div');
  overlay.className = 'lens-busy';
  overlay.innerHTML = `<div>${I.lens.replace('<svg', '<svg style="width:48px;height:48px"')}</div><div id="lens-status">Looking at your image...</div><div class="progress"><div style="width:0"></div></div>`;
  document.body.appendChild(overlay);
  try {
    const r = await describe({ blob: file }, state.settings, (p) => {
      if (p.status === 'progress') { $('#lens-status', overlay).textContent = `Downloading model ${p.pct}%`; $('.progress div', overlay).style.width = p.pct + '%'; }
      if (p.status === 'generating') { $('#lens-status', overlay).textContent = 'Describing image...'; $('.progress div', overlay).style.width = '100%'; }
    });
    const words = `${r.text || ''} ${r.description || ''}`.split(/\s+/).filter(Boolean).slice(0, 18).join(' ');
    overlay.remove();
    if (!words) { toast('Could not describe the image'); return; }
    pushHistory(words);
    go('search', { q: words, tab: 'images', mode: 'vector' });
  } catch (e) {
    overlay.remove();
    console.error(e);
    toast('Lens failed: ' + (e.message || e), 5000);
  }
}

// ------------------------------------------------------------------ tags / folders pages
function renderTags(app) {
  const tags = allTags();
  app.innerHTML = `
    <header class="results-top"><div class="results-bar">${logoHtml()}<div id="sb"></div>${topRight()}</div>${appsMenu()}</header>
    <main class="page">
      <h1>Tags</h1>
      <p class="lead">${tags.length} tags across ${state.lib.length} memes. Click a tag to filter, rename or delete it everywhere.</p>
      <div class="row"><input class="ginput grow" id="new-tag" placeholder="Create a tag (assign it from a meme or the bulk bar)"><button class="gbtn" data-action="create-tag">Create</button></div>
      <table class="tag-table">
        ${tags.map(([t, n]) => `<tr data-tag="${esc(t)}">
          <td><a class="chip" href="${searchUrl({ tab: 'images', tags: t })}">${I.tag.replace('<svg', '<svg style="width:16px;height:16px;fill:var(--text-3)"')} ${esc(t)}</a></td>
          <td style="color:var(--text-3)">${n} meme${n === 1 ? '' : 's'}</td>
          <td><button class="gbtn" data-action="rename-tag" data-tag="${esc(t)}">Rename</button> <button class="gbtn danger" data-action="delete-tag" data-tag="${esc(t)}">Delete</button></td>
        </tr>`).join('')}
      </table>
      ${tags.length ? '' : '<p>No tags yet.</p>'}
    </main>`;
  $('#sb', app).replaceWith(searchBox({ compact: true }));
}

function renderFolders(app) {
  const folders = allFolders();
  app.innerHTML = `
    <header class="results-top"><div class="results-bar">${logoHtml()}<div id="sb"></div>${topRight()}</div>${appsMenu()}</header>
    <main class="page">
      <h1>Folders</h1>
      <p class="lead">Bundled memes live in <code>memes/&lt;folder&gt;/</code> in the repository; uploads go to the folder you pick on the Upload page.
      Re-run <code>python tools/build_index.py</code> after adding files to the repository (that is the "rescan").</p>
      <div class="folder-list">
        ${folders.map(([f, n]) => `<a href="${searchUrl({ tab: 'images', folder: f })}">${I.folder}<span>${esc(f)}</span><span class="n">${n}</span></a>`).join('')}
      </div>
    </main>`;
  $('#sb', app).replaceWith(searchBox({ compact: true }));
}

// ------------------------------------------------------------------ settings
async function renderSettings(app) {
  const s = state.settings;
  const stats = await libraryStats();
  const cached = await isModelCached(s.model);
  app.innerHTML = `
    <header class="results-top"><div class="results-bar">${logoHtml()}<div id="sb"></div>${topRight()}</div>${appsMenu()}</header>
    <main class="page">
      <h1>Settings</h1>
      <p class="lead">Everything is stored in this browser. Nothing is sent anywhere unless you configure an external vision API.</p>

      <h2>Appearance</h2>
      <div class="card">
        <div class="row"><label>Theme</label>
          <select class="gsel" data-setting="theme">
            ${['system', 'light', 'dark'].map((t) => `<option value="${t}" ${s.theme === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
          </select></div>
      </div>

      <h2>Search</h2>
      <div class="card">
        <div class="row"><label>Default mode</label>
          <select class="gsel" data-setting="searchMode">
            <option value="keyword" ${s.searchMode === 'keyword' ? 'selected' : ''}>Keyword (BM25, instant)</option>
            <option value="vector" ${s.searchMode === 'vector' ? 'selected' : ''}>Vector (all-MiniLM-L6-v2 embeddings, ~23 MB model)</option>
          </select></div>
        <div class="row"><label>Results per page</label><input class="ginput" style="width:90px" type="number" min="5" max="200" data-setting="resultsPerPage" value="${s.resultsPerPage}"></div>
        <div class="row"><label>Vector index</label><button class="gbtn" data-action="build-vectors">Embed all memes now</button><span class="status" id="vec-status">${state.vectors.size}/${state.lib.length} cached in memory</span></div>
      </div>

      <h2>Description generation</h2>
      <div class="card">
        <div class="row"><label>Provider</label>
          <select class="gsel" data-setting="provider">
            <option value="browser" ${s.provider === 'browser' ? 'selected' : ''}>In-browser model (local, private)</option>
            <option value="openai" ${s.provider === 'openai' ? 'selected' : ''}>OpenAI-compatible vision API</option>
          </select></div>
        <div id="prov-browser" class="${s.provider === 'browser' ? '' : 'hidden'}">
          <div class="row"><label>Image-to-text model</label>
            <select class="gsel" data-setting="model">
              ${CAPTION_MODELS.map((m) => `<option value="${m.id}" ${s.model === m.id ? 'selected' : ''}>${m.label} · ${m.size}</option>`).join('')}
            </select></div>
          <div class="row"><label>Compute</label><span>${hasWebGPU() ? 'WebGPU available (fast)' : 'WebGPU not available, using WASM (slow but works)'}</span></div>
          <div class="row"><label>Model cache</label><button class="gbtn" data-action="download-model">${cached ? 'Model cached · re-check' : 'Download model now'}</button><span class="status" id="model-status"></span></div>
          <div class="progress hidden" id="model-progress"><div></div></div>
          <p style="color:var(--text-3);font-size:12px;margin:8px 0 0">Florence-2 runs with Transformers.js. The first download is cached by the browser; later runs are offline. Tasks used: MORE_DETAILED_CAPTION and OCR, like upstream Meme Search.</p>
        </div>
        <div id="prov-openai" class="${s.provider === 'openai' ? '' : 'hidden'}">
          <div class="row"><label>Base URL</label><input class="ginput grow" data-setting="openaiBaseUrl" value="${esc(s.openaiBaseUrl)}" placeholder="https://api.openai.com/v1"></div>
          <div class="row"><label>API key</label><input class="ginput grow" type="password" data-setting="openaiKey" value="${esc(s.openaiKey)}" placeholder="sk-..."></div>
          <div class="row"><label>Vision model</label><input class="ginput grow" data-setting="openaiModel" value="${esc(s.openaiModel)}" placeholder="gpt-4o-mini"></div>
          <p style="color:var(--text-3);font-size:12px;margin:8px 0 0">Images you generate descriptions for are sent to this endpoint. Works with OpenAI, OpenRouter, Ollama (/v1), LM Studio and similar servers. The key is stored in this browser only.</p>
        </div>
        <div class="row"><label class="switch"><input type="checkbox" data-setting="autoDescribe" ${s.autoDescribe ? 'checked' : ''}> Auto-generate for new uploads</label></div>
      </div>

      <h2>Library</h2>
      <div class="card">
        <div class="kv">
          <span>Bundled memes</span><b>${state.lib.filter((m) => m.source === 'bundled').length}</b>
          <span>Your uploads</span><b>${stats.uploads} (${(stats.bytes / 1048576).toFixed(1)} MB)</b>
          <span>Browser storage</span><b>${stats.quota ? `${(stats.quota.usage / 1048576).toFixed(0)} MB used of ${(stats.quota.quota / 1073741824).toFixed(1)} GB` : 'unknown'}</b>
        </div>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="gbtn" data-action="rescan">Rescan bundled index</button>
          <button class="gbtn" data-action="export">Export library (JSON)</button>
          <button class="gbtn" data-action="import">Import library</button>
          <button class="gbtn" data-action="clear-history">Clear search history</button>
          <button class="gbtn danger" data-action="clear-library">Delete uploads and edits</button>
        </div>
        <div class="status" id="lib-status"></div>
      </div>

      <h2 id="about">About</h2>
      <div class="card" style="line-height:1.6">
        <p style="margin:0 0 8px"><b>Memegle</b> is Google for memes: a static, browser-only rebuild of
        <a href="https://github.com/meme-search/meme-search" target="_blank" rel="noopener">Meme Search</a> by neonwatty (Apache-2.0).
        Same ideas (image-to-text indexing, keyword and vector search, tags, folders, bulk generation, drag-and-drop upload, dark mode),
        but no server: the index is a JSON file, your uploads live in IndexedDB and the AI models run in your browser.</p>
        <p id="how" style="margin:0 0 8px"><b>How Search works.</b> Keyword mode scores title, caption text, tags, folder and description with BM25 and prefix matching,
        and offers "Did you mean" from the vocabulary of your own library. Vector mode embeds every meme description with all-MiniLM-L6-v2 and ranks by cosine similarity.
        Memegle Lens describes an image you pick and searches for it.</p>
        <p id="privacy" style="margin:0"><b>Privacy.</b> No analytics, no accounts, no uploads to a server. Model files come from the Hugging Face CDN once and are cached.
        Source: <a href="https://github.com/justbuildsstuff/Memegle" target="_blank" rel="noopener">github.com/justbuildsstuff/Memegle</a>.</p>
      </div>
    </main>`;
  $('#sb', app).replaceWith(searchBox({ compact: true }));
  $$('[data-setting]', app).forEach((el) => {
    el.addEventListener('change', () => {
      const k = el.dataset.setting;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number') v = Math.max(5, Math.min(200, +v || DEFAULT_SETTINGS.resultsPerPage));
      state.settings[k] = v;
      saveSettings(state.settings);
      if (k === 'theme') applyTheme();
      if (k === 'provider') { $('#prov-browser').classList.toggle('hidden', v !== 'browser'); $('#prov-openai').classList.toggle('hidden', v !== 'openai'); }
      if (k === 'searchMode') state.limit = 0;
    });
  });
  if (location.hash.includes('#about') || location.hash.includes('#how') || location.hash.includes('#privacy')) {
    const id = location.hash.split('#').pop();
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }
}

// ------------------------------------------------------------------ actions (event delegation)
async function onAction(action, el, e) {
  const qp = currentQueryParams();
  const id = el.dataset.id || $('#panel .detail')?.dataset.id;
  const m = id ? memeById(id) : null;
  switch (action) {
    case 'settings': go('settings'); break;
    case 'apps': $('#apps-menu')?.classList.toggle('hidden'); e.stopPropagation(); break;
    case 'lucky': {
      if (!state.lib.length) { go('upload'); break; }
      const pick = state.lib[Math.floor(Math.random() * state.lib.length)];
      go('search', { tab: 'images', id: pick.id });
      break;
    }
    case 'tools': go('search', { ...state.route.params, tools: qp.tools ? undefined : '1' }); break;
    case 'toggle-select': state.selected.clear(); go('search', { ...state.route.params, sel: qp.sel ? undefined : '1', id: undefined }); break;
    case 'more': state.limit = (state.limit || state.settings.resultsPerPage) + state.settings.resultsPerPage; render(); break;
    case 'open': go('search', { ...state.route.params, tab: 'images', id }); break;
    case 'close-panel': go('search', { ...state.route.params, id: undefined }); break;
    case 'select': {
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      el.classList.toggle('selected', state.selected.has(id));
      $('.sel', el).innerHTML = state.selected.has(id) ? I.check : '';
      const bar = $('.bulk-bar'); if (bar) bar.outerHTML = bulkBar();
      break;
    }
    case 'select-all': {
      $$('.img-card').forEach((c) => state.selected.add(c.dataset.id));
      render();
      break;
    }
    case 'bulk-describe': state.queue.push(...[...state.selected].filter((x) => !state.queue.includes(x))); runQueue(); toast(`Queued ${state.selected.size} memes`); break;
    case 'bulk-tag': {
      const t = prompt('Tag to add to the selected memes:');
      if (!t) break;
      for (const sid of state.selected) { const mm = memeById(sid); if (mm) await saveMemeFields(mm, { tags: [...new Set([...(mm.tags || []), t.trim().toLowerCase()])] }); }
      await reload(); render(); toast(`Tagged ${state.selected.size} memes with "${t.trim()}"`);
      break;
    }
    case 'bulk-delete': {
      if (!confirm(`Remove ${state.selected.size} memes from your library? Uploads are deleted; bundled memes are hidden (restore via Rescan in Settings).`)) break;
      for (const sid of state.selected) { const mm = memeById(sid); if (mm) await deleteMeme(mm); }
      state.selected.clear();
      await reload(); render();
      break;
    }
    case 'describe': if (m) { state.queue.unshift(m.id); runQueue(); } break;
    case 'save': {
      if (!m) break;
      await saveMemeFields(m, { description: $('#d-desc').value.trim(), text: $('#d-text').value.trim() });
      await reload();
      $('#d-saved').textContent = 'Saved'; $('#d-saved').className = 'status ok';
      setTimeout(() => render(), 400);
      break;
    }
    case 'rm-tag': if (m) { await saveMemeFields(m, { tags: (m.tags || []).filter((t) => t !== el.dataset.tag) }); await reload(); render(); } break;
    case 'reset': if (m) { await resetOverride(m); await reload(); render(); toast('Edits reset'); } break;
    case 'delete': {
      if (!m) break;
      if (!confirm(m.source === 'upload' ? `Delete "${m.filename}" permanently?` : `Remove "${m.filename}" from your library? (Rescan in Settings restores bundled memes.)`)) break;
      await deleteMeme(m); await reload(); go('search', { ...state.route.params, id: undefined }); toast('Removed');
      break;
    }
    case 'download': {
      if (!m) break;
      const a = document.createElement('a');
      a.href = m.url; a.download = m.filename; a.click();
      break;
    }
    case 'copy': {
      if (!m) break;
      try {
        let blob = m.blob || await (await fetch(m.url)).blob();
        if (blob.type !== 'image/png') blob = await toPng(blob);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Image copied to clipboard');
      } catch (err) { console.error(err); toast('Copy failed: ' + (err.message || err)); }
      break;
    }
    case 'find-similar': if (m) go('search', { q: [m.text, ...(m.tags || [])].filter(Boolean).join(' ').slice(0, 80) || m.title, tab: 'images', mode: state.settings.searchMode }); break;
    case 'create-tag': {
      const t = $('#new-tag')?.value.trim().toLowerCase();
      if (!t) break;
      toast(`Tag "${t}" is ready: assign it from a meme or via Select on the Images tab`);
      go('search', { tab: 'images', sel: '1' });
      break;
    }
    case 'rename-tag': {
      const from = el.dataset.tag; const to = prompt(`Rename tag "${from}" to:`, from)?.trim().toLowerCase();
      if (!to || to === from) break;
      for (const mm of state.lib) if ((mm.tags || []).includes(from)) await saveMemeFields(mm, { tags: [...new Set(mm.tags.map((t) => (t === from ? to : t)))] });
      await reload(); render();
      break;
    }
    case 'delete-tag': {
      const t = el.dataset.tag;
      if (!confirm(`Delete tag "${t}" from all memes?`)) break;
      for (const mm of state.lib) if ((mm.tags || []).includes(t)) await saveMemeFields(mm, { tags: mm.tags.filter((x) => x !== t) });
      await reload(); render();
      break;
    }
    case 'build-vectors': {
      $('#vec-status').textContent = 'Embedding...';
      try { await ensureVectors((d, t) => { $('#vec-status').textContent = `${d}/${t}`; }); $('#vec-status').textContent = `${state.vectors.size}/${state.lib.length} embedded`; }
      catch (err) { $('#vec-status').textContent = 'Failed: ' + (err.message || err); }
      break;
    }
    case 'download-model': {
      const st = $('#model-status'); const pr = $('#model-progress');
      st.textContent = 'Downloading...'; pr.classList.remove('hidden');
      try {
        await getCaptioner(state.settings.model, (p) => { if (p.status === 'progress') { st.textContent = `${p.pct}% (${Math.round(p.loaded / 1048576)} MB)`; pr.firstElementChild.style.width = p.pct + '%'; } });
        st.textContent = 'Model ready'; st.className = 'status ok';
      } catch (err) { st.textContent = 'Failed: ' + (err.message || err); st.className = 'status err'; }
      pr.classList.add('hidden');
      break;
    }
    case 'rescan': {
      const ovs = await idb.getAll('overrides');
      for (const o of ovs) if (o.hidden) { delete o.hidden; await idb.put('overrides', o); }
      await reload(); render(); toast(`Rescanned: ${state.lib.length} memes`);
      break;
    }
    case 'export': {
      const blob = await exportLibrary();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `memegle-library-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      break;
    }
    case 'import': $('#import-input').click(); break;
    case 'clear-history': clearHistory(); toast('Search history cleared'); break;
    case 'clear-library': {
      if (!confirm('Delete all uploads, edits and cached embeddings in this browser? Bundled memes stay.')) break;
      await clearLibrary(); state.vectors.clear(); await reload(); render(); toast('Library cleared');
      break;
    }
    default: break;
  }
}

async function toPng(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

// ------------------------------------------------------------------ render loop
let renderToken = 0;
async function render() {
  const token = ++renderToken;
  state.route = parseRoute();
  const app = $('#app');
  if (state.route.name !== 'search') state.limit = 0;
  document.title = state.route.name === 'search' && state.route.params.q ? `${state.route.params.q} - Memegle` : 'Memegle';
  const prevScroll = window.scrollY;
  switch (state.route.name) {
    case 'home': renderHome(app); break;
    case 'search': await renderResults(app, () => token !== renderToken); break;
    case 'upload': renderUpload(app); break;
    case 'settings': await renderSettings(app); break;
    case 'tags': renderTags(app); break;
    case 'folders': renderFolders(app); break;
    default: renderHome(app);
  }
  if (token !== renderToken) return;
  if (state.route.name === 'search' && state.route.params.id) {
    window.scrollTo(0, prevScroll);
  } else if (state.route.name !== 'search') window.scrollTo(0, 0);
}

function bindGlobal() {
  document.addEventListener('mousedown', (e) => {
    $$('.searchbox.focus').forEach((sb) => { if (!sb.contains(e.target)) sb.classList.remove('focus'); });
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && !el.matches('a[href]')) { e.preventDefault(); onAction(el.dataset.action, el, e); return; }
    if (!e.target.closest('#apps-menu') && !e.target.closest('[data-action=apps]')) $('#apps-menu')?.classList.add('hidden');
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-param]');
    if (!el) return;
    const k = el.dataset.param;
    if (k === 'mode') { state.settings.searchMode = el.value; saveSettings(state.settings); }
    go('search', { ...state.route.params, [k]: el.value, id: undefined });
  });
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(tag)) { e.preventDefault(); $('.searchbox input')?.focus(); }
    if (e.key === 'Escape' && state.route.name === 'search' && state.route.params.id && !/INPUT|TEXTAREA/.test(tag)) go('search', { ...state.route.params, id: undefined });
  });
  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    e.preventDefault();
    handleFiles(files);
  });
  document.addEventListener('dragover', (e) => { if (state.route.name !== 'upload') e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (state.route.name === 'upload') return;
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) handleFiles(files);
  });
  $('#file-input').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
  $('#lens-input').addEventListener('change', (e) => { if (e.target.files[0]) lensSearch(e.target.files[0]); e.target.value = ''; });
  $('#import-input').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const n = await importLibrary(await f.text()); await reload(); render(); toast(`Imported ${n} records`); }
    catch (err) { toast('Import failed: ' + (err.message || err)); }
  });
  window.addEventListener('hashchange', () => { state.limit = 0; render(); });
}

(async function main() {
  window.addEventListener('error', (e) => console.log('[memegle] error', e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => console.log('[memegle] rejection', e.reason && (e.reason.stack || e.reason)));
  applyTheme();
  const q = new URLSearchParams(location.search).get('q');
  if (q && !location.hash) history.replaceState(null, '', location.pathname + '#/search?q=' + encodeURIComponent(q));
  await reload();
  bindGlobal();
  render();
})();
