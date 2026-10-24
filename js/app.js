// Memegle - Google for memes. Live meme search across public sources, Google look and feel,
// plus a private "My memes" library in the browser. Vanilla JS SPA with hash routing.
import {
  loadLibrary, loadSettings, saveSettings, loadHistory, pushHistory, clearHistory, saveMemeFields, resetOverride,
  deleteMeme, addUpload, getEmbedding, putEmbedding, exportLibrary, importLibrary, clearLibrary, libraryStats, DEFAULT_SETTINGS, idb,
} from './store.js?v=6';
import { buildIndex, search, suggestions as librarySuggestions, highlight, rankByVector, embeddingText, hashText, tokenize } from './search.js?v=6';
import { describe, embed, getCaptioner, CAPTION_MODELS, hasWebGPU, isModelCached } from './ai.js?v=6';
import {
  SOURCE_INFO, DEFAULT_LEMMY_COMMUNITIES, DEFAULT_REDDIT_SUBS, searchLemmy, searchLemmyGlobal, trendingLemmy, trendingMastodon, searchMastodon, searchReddit, fetchRedditPool,
  searchBluesky, trendingBluesky,
  searchImgflip, fetchImgflip, searchTenor, tenorAutocomplete, searchGiphy, searchImgur, knowledgePanel,
  memeSuggestions, spellCorrection, createSession, favicon, relevance,
} from './sources.js?v=6';

// ------------------------------------------------------------------ icons
const I = {
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path fill="#4285f4" d="m12 15c1.66 0 3-1.31 3-2.97v-7.02c0-1.66-1.34-3.01-3-3.01s-3 1.34-3 3.01v7.02c0 1.66 1.34 2.97 3 2.97z"/><path fill="#34a853" d="m11 18.08h2v3.92h-2z"/><path fill="#fbbc05" d="m7.05 16.87c-1.27-1.33-2.05-2.83-2.05-4.87h2c0 1.45 0.56 2.42 1.47 3.38v0.32l-1.15 1.18z"/><path fill="#ea4335" d="m12 16.93a4.97 5.25 0 0 1 -3.54 -1.55l-1.41 1.49c1.26 1.34 3.02 2.13 4.95 2.13 3.87 0 6.99-2.92 6.99-7h-1.99c0 2.92-2.24 4.93-5 4.93z"/></svg>',
  lens: '<svg viewBox="0 0 192 192"><rect fill="none" height="192" width="192"/><g><circle fill="#34a853" cx="144.07" cy="144" r="16"/><circle fill="#4285f4" cx="96.07" cy="104" r="24"/><path fill="#ea4335" d="M24,135.2c0,18.11,14.69,32.8,32.8,32.8H96v-16l-40.1-0.1c-8.8,0-15.9-8.19-15.9-17.9v-18H24V135.2z"/><path fill="#fbbc05" d="M168,72.8c0-18.11-14.69-32.8-32.8-32.8H116l20,16c8.8,0,16,8.29,16,18v30h16V72.8z"/><path fill="#4285f4" d="M112,24l-32,0L68,40H56.8C38.69,40,24,54.69,24,72.8V92h16V74c0-9.71,7.2-18,16-18h80L112,24z"/></g></svg>',
  clear: '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  apps: '<svg viewBox="0 0 24 24"><path d="M6 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 12c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4-8c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm-4 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
  gif: '<svg viewBox="0 0 24 24"><path d="M11.5 9H13v6h-1.5zM9 9H6c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h3c.6 0 1-.5 1-1v-2H8.5v1.5h-2v-3H10V10c0-.5-.4-1-1-1zm10 1.5V9h-4.5v6H16v-2h2v-1.5h-2v-1z"/></svg>',
  template: '<svg viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  history: '<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
  trend: '<svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
  select: '<svg viewBox="0 0 24 24"><path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2zM7 17h10V7H7v10zm2-8h6v6H9V9z"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>',
  comment: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
};
const sm = (svg, px = 16) => svg.replace('<svg', `<svg style="width:${px}px;height:${px}px;vertical-align:-3px;fill:currentColor"`);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const logoHtml = (cls = '') => `<a class="logo ${cls}" href="#/" aria-label="Memegle home">${'Memegle'.split('').map((c) => `<span>${c}</span>`).join('')}</a>`;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtNum = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n || 0));
function ago(ts) {
  if (!ts) return '';
  const d = (Date.now() - ts) / 1000;
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  if (d < 86400 * 30) return `${Math.round(d / 86400)} days ago`;
  if (d < 86400 * 365) return `${Math.round(d / (86400 * 30))} months ago`;
  return `${Math.round(d / (86400 * 365))} years ago`;
}

// ------------------------------------------------------------------ state
const EXTRA_DEFAULTS = {
  safeSearch: true,
  sources: { lemmy: true, bluesky: true, reddit: true, imgflip: true, mastodon: true, tenor: true, giphy: true, imgur: true, library: true, wiki: true },
  parade: true,
  tenorKey: '', giphyKey: '', imgurClientId: '',
  googleSuggest: true,
  lemmyCommunities: DEFAULT_LEMMY_COMMUNITIES.join('\n'),
  redditSubs: DEFAULT_REDDIT_SUBS.join('\n'),
};
const state = {
  lib: [], index: null,
  settings: { ...EXTRA_DEFAULTS, ...loadSettings() },
  route: { name: 'home', params: {} },
  sessions: new Map(), itemsById: new Map(),
  vectors: new Map(), vectorHash: new Map(),
  selected: new Set(), queue: [], queueRunning: false, jobStatus: '',
  limit: 0, unsubscribe: null,
};
state.settings.sources = { ...EXTRA_DEFAULTS.sources, ...(state.settings.sources || {}) };

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
async function reload() { state.lib = await loadLibrary(); state.index = buildIndex(state.lib); }
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
function lang() { return (navigator.language || 'en').slice(0, 2); }
function communities() { return state.settings.lemmyCommunities.split(/\s+/).filter(Boolean); }
function subs() { return state.settings.redditSubs.split(/\s+/).filter(Boolean); }

function libItem(m) {
  return {
    id: `library:${m.id}`, source: 'library', kind: /\.gif$/i.test(m.filename) ? 'gif' : 'image',
    title: m.text || m.title, body: m.description || '', image: m.url, thumb: m.url, width: m.width, height: m.height,
    url: `#/search?tab=library&id=${encodeURIComponent('library:' + m.id)}`, site: 'My memes', path: m.folder, created: m.created || 0,
    nsfw: false, tags: m.tags || [], score: 0, meme: m,
  };
}
function registerLibrary() { for (const m of state.lib) state.itemsById.set(`library:${m.id}`, libItem(m)); }

// ------------------------------------------------------------------ router
function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [rawPath, qs = ''] = hash.split('?');
  const path = rawPath.split('#')[0];
  const params = Object.fromEntries(new URLSearchParams(qs.split('#')[0]));
  const seg = path.split('/').filter(Boolean);
  if (!seg.length) return { name: 'home', params };
  return { name: seg[0], params };
}
function buildUrl(name, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) qs.set(k, v);
  const s = qs.toString();
  return `#/${name === 'home' ? '' : name}${s ? '?' + s : ''}`;
}
function go(name, params = {}) { location.hash = buildUrl(name, params); }
const searchUrl = (params) => buildUrl('search', params);

function qp() {
  const p = state.route.params;
  return {
    q: (p.q || '').trim(), tab: p.tab || 'all', sort: p.sort || 'relevance', safe: p.safe !== '0' && state.settings.safeSearch !== false || p.safe === '1',
    src: p.src ? p.src.split(',').filter(Boolean) : [],
    id: p.id || '', sel: p.sel === '1', tools: p.tools === '1', tags: p.tags ? p.tags.split('|').filter(Boolean) : [], folder: p.folder || '',
  };
}

// ------------------------------------------------------------------ search box with live suggestions
let suggestTimer = null;
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
  let items = []; let active = -1; let seq = 0;

  const draw = () => {
    wrap.classList.toggle('has-suggest', items.length > 0);
    sug.innerHTML = items.map((it, i) => `
      <div class="suggest-item ${i === active ? 'active' : ''}" data-i="${i}" role="option">
        ${it.kind === 'history' ? I.history : it.kind === 'trend' ? I.trend : it.thumb ? `<img src="${esc(it.thumb)}" alt="">` : I.search}
        <span>${esc(it.text)}</span>
        <span class="kind">${it.kind === 'history' ? 'Recent' : it.kind === 'trend' ? 'Trending template' : it.kind === 'template' ? 'Template' : it.kind === 'meme' ? 'My memes' : ''}</span>
      </div>`).join('');
  };
  const compute = async () => {
    const my = ++seq;
    const q = input.value.trim();
    const history = loadHistory();
    const out = []; const seen = new Set();
    const push = (text, kind, extra = {}) => { const k = text.toLowerCase(); if (seen.has(k) || out.length >= 10) return; seen.add(k); out.push({ text, kind, ...extra }); };
    if (!q) {
      history.slice(0, 5).forEach((h) => push(h, 'history'));
      try { const tpl = await fetchImgflip(); if (my !== seq) return; tpl.slice(0, 7).forEach((t) => push(t.title, 'trend')); } catch { /* offline */ }
      items = out; active = -1; draw();
      return;
    }
    history.filter((h) => h.toLowerCase().includes(q.toLowerCase())).slice(0, 2).forEach((h) => push(h, 'history'));
    try { (await fetchImgflip()).filter((t) => t.title.toLowerCase().includes(q.toLowerCase())).slice(0, 2).forEach((t) => push(t.title, 'template', { thumb: t.thumb })); } catch { /* ignore */ }
    if (my !== seq) return;
    librarySuggestions(state.index, state.lib, q, [], 3).forEach((s) => { if (s.kind === 'meme') push(s.text, 'meme', { thumb: s.meme.url, id: s.meme.id }); });
    items = out.slice(); active = -1; draw();
    if (state.settings.googleSuggest || state.settings.tenorKey) {
      const [g, t] = await Promise.all([state.settings.googleSuggest ? memeSuggestions(q, { lang: lang() }) : [], tenorAutocomplete(q, state.settings.tenorKey)]);
      if (my !== seq) return;
      g.forEach((s) => push(s, 'search'));
      t.forEach((s) => push(s, 'search'));
      items = out; draw();
    }
  };
  const schedule = () => { clearTimeout(suggestTimer); suggestTimer = setTimeout(compute, 120); };
  const submit = (q) => {
    q = (q ?? input.value).trim();
    wrap.classList.remove('focus'); input.blur();
    const p = state.route.name === 'search' ? { ...state.route.params } : {};
    delete p.id; delete p.sel;
    if (q) pushHistory(q);
    go('search', { ...p, q });
  };
  const pick = (it) => {
    if (it.kind === 'meme') { go('search', { q: it.text, tab: 'library', id: 'library:' + it.id }); return; }
    submit(it.text);
  };
  input.addEventListener('focus', () => { wrap.classList.add('focus'); active = -1; });
  input.addEventListener('click', () => { wrap.classList.add('focus'); compute(); });
  input.addEventListener('input', () => {
    $('.sb-clear', wrap).classList.toggle('hidden', !input.value);
    $('.sb-divider', wrap).classList.toggle('hidden', !input.value);
    schedule();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; draw(); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; draw(); }
    else if (e.key === 'Escape') { wrap.classList.remove('focus'); input.blur(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
  });
  sug.addEventListener('mousedown', (e) => { const el = e.target.closest('.suggest-item'); if (!el) return; e.preventDefault(); pick(items[+el.dataset.i]); });
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
  rec.lang = navigator.language || 'en-US'; rec.interimResults = true;
  toast('Listening...', 6000);
  rec.onresult = (e) => { const t = [...e.results].map((r) => r[0].transcript).join(' '); input.value = t; if (e.results[e.results.length - 1].isFinal) submit(t); };
  rec.onerror = () => toast('Voice search failed');
  rec.start();
}

function topRight() {
  return `<div class="right">
      <a class="link" href="#/search?tab=images" title="Trending memes">Images</a>
      <a class="link" href="#/search?tab=library">My memes</a>
      <button class="icon-btn" data-action="settings" title="Settings" aria-label="Settings">${I.settings}</button>
      <button class="icon-btn" data-action="apps" title="Memegle apps" aria-label="Memegle apps">${I.apps}</button>
      <button class="avatar" data-action="settings" title="Local library (this browser)">M</button>
    </div>`;
}
function appsMenu() {
  return `<div class="apps-menu hidden" id="apps-menu">
      <a href="#/search?tab=images">${I.image}<span>Images</span></a>
      <a href="#/search?tab=gifs">${I.gif}<span>GIFs</span></a>
      <a href="#/search?tab=templates">${I.template}<span>Templates</span></a>
      <a href="#/search?tab=library">${I.save}<span>My memes</span></a>
      <a href="#/upload">${I.upload}<span>Upload</span></a>
      <a href="#/settings">${I.settings}<span>Settings</span></a>
    </div>`;
}
function pageHeader() {
  return `<header class="results-top"><div class="results-bar">${logoHtml()}<div id="sb"></div>${topRight()}</div>${appsMenu()}</header>`;
}

// ------------------------------------------------------------------ home
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
      <p class="offered">Only memes, live from Lemmy, Bluesky, Mastodon, Reddit, Imgflip${state.settings.tenorKey ? ', Tenor' : ''}${state.settings.giphyKey ? ', Giphy' : ''} and <a href="#/search?tab=library">your own collection</a>.</p>
    </main>
    <footer class="home-footer">
      <div class="country">Only memes. Nothing else.</div>
      <div class="links">
        <div><a href="#/settings#about">About</a><a href="#/settings#how">How Search works</a><a href="https://github.com/justbuildsstuff/Memegle" target="_blank" rel="noopener">Source</a></div>
        <div><a href="#/settings#privacy">Privacy</a><a href="#/settings#sources">Sources</a><a href="#/settings">Settings</a></div>
      </div>
    </footer>`;
  const sb = searchBox({ autofocus: window.innerWidth > 640 });
  const stage = document.createElement('div');
  stage.className = 'sb-stage';
  stage.appendChild(sb);
  $('#sb', app).replaceWith(stage);
  $('[data-action=home-search]', app).addEventListener('click', () => sb.requestSubmit());
  if (state.settings.parade !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches) mountParade(stage);
}

// Meme parade: trending templates walk along and through the search bar on the home page.
async function mountParade(stage) {
  let tpl = [];
  try { tpl = await fetchImgflip(); } catch { return; }
  if (!tpl.length || !stage.isConnected) return;
  const picks = tpl.slice(0, 40).sort(() => Math.random() - 0.5).slice(0, 12);
  const parade = document.createElement('div');
  parade.className = 'parade';
  parade.setAttribute('aria-hidden', 'true');
  parade.innerHTML = picks.map((t, i) => {
    const lane = i % 3 === 0 ? 'top' : 'through';
    const dur = 14 + Math.random() * 14; const delay = -(Math.random() * dur); const size = 38 + Math.round(Math.random() * 22);
    const dir = i % 2 ? 'rtl' : 'ltr';
    return `<div class="walker ${lane} ${dir}" style="--dur:${dur.toFixed(1)}s;--delay:${delay.toFixed(1)}s;--size:${size}px;--bob:${(0.42 + Math.random() * 0.3).toFixed(2)}s" data-action="parade-pick" data-q="${esc(t.title)}" title="${esc(t.title)}"><img src="${esc(t.thumb)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></div>`;
  }).join('');
  stage.prepend(parade);
}

// ------------------------------------------------------------------ sessions (live search)
function enabled(src) {
  const s = state.settings;
  if (SOURCE_INFO[src]?.parent) src = SOURCE_INFO[src].parent;
  if (!s.sources[src]) return false;
  if (src === 'tenor') return Boolean(s.tenorKey);
  if (src === 'giphy') return Boolean(s.giphyKey);
  if (src === 'imgur') return Boolean(s.imgurClientId);
  return true;
}

async function libraryAdapter(q, p) {
  if (!q) return { items: state.lib.slice(0, 40).map(libItem) };
  if (state.settings.searchMode === 'vector') {
    try {
      await ensureVectors();
      const [qv] = await embed([q]);
      const r = rankByVector(state.lib, state.vectors, qv, { tags: p.tags, folder: p.folder });
      return { items: r.results.map((x) => ({ ...libItem(x.meme), score: Math.round(x.score * 100) })) };
    } catch (e) { console.warn('vector search failed, keyword fallback', e); }
  }
  const r = search(state.index, q, { tags: p.tags, folder: p.folder });
  return { items: r.results.map((x) => libItem(x.meme)) };
}

function adaptersFor(q, p, page = 1) {
  const s = state.settings;
  const list = [];
  if (!q) {
    if (enabled('lemmy')) list.push({ source: 'lemmy', run: async () => ({ items: await trendingLemmy({ communities: communities().slice(0, 12) }) }) });
    if (enabled('bluesky')) list.push({ source: 'bluesky', run: async () => ({ items: await trendingBluesky() }) });
    if (enabled('mastodon')) list.push({ source: 'mastodon', run: async () => ({ items: await trendingMastodon() }) });
    if (enabled('reddit')) list.push({ source: 'reddit', run: async () => ({ items: (await fetchRedditPool({ subs: subs().slice(0, 4), count: 30 })).sort(() => Math.random() - 0.5) }) });
    if (enabled('imgflip')) list.push({ source: 'imgflip', run: async () => ({ items: await fetchImgflip() }) });
    if (enabled('library')) list.push({ source: 'library', run: () => libraryAdapter('', p) });
    return list;
  }
  if (enabled('lemmy')) list.push({ source: 'lemmy', run: ({ onPartial }) => searchLemmy(q, { communities: communities(), sort: p.sort, page, onPartial }) });
  if (enabled('lemmy')) list.push({ source: 'lemmy_global', run: ({ onPartial }) => searchLemmyGlobal(q, { sort: p.sort, page, onPartial }) });
  if (enabled('bluesky') && (page === 1 || s.sources.bluesky)) list.push({ source: 'bluesky', run: ({ onPartial, session }) => {
    const cursor = page > 1 ? session.extra.bluesky?.next || '' : '';
    if (page > 1 && !cursor) return { skipped: true };
    return searchBluesky(q, { sort: p.sort, cursor, onPartial });
  } });
  if (page === 1) {
    if (enabled('mastodon')) list.push({ source: 'mastodon', run: () => searchMastodon(q) });
    if (enabled('reddit')) list.push({ source: 'reddit', run: () => searchReddit(q, { subs: subs() }) });
    if (enabled('imgflip')) list.push({ source: 'imgflip', run: () => searchImgflip(q) });
    if (enabled('library')) list.push({ source: 'library', run: () => libraryAdapter(q, p) });
  }
  if (enabled('tenor')) list.push({ source: 'tenor', run: ({ session }) => searchTenor(q, { key: s.tenorKey, safe: p.safe, pos: page > 1 ? session.extra.tenor?.next || '' : '' }) });
  if (enabled('giphy')) list.push({ source: 'giphy', run: ({ session }) => searchGiphy(q, { key: s.giphyKey, safe: p.safe, offset: page > 1 ? session.extra.giphy?.next || 0 : 0 }) });
  if (enabled('imgur')) list.push({ source: 'imgur', run: () => searchImgur(q, { clientId: s.imgurClientId, safe: p.safe, page }) });
  return list;
}

function sessionFor(p) {
  const key = JSON.stringify([p.q.toLowerCase(), p.sort, p.safe, state.settings.searchMode, p.tags, p.folder]);
  let s = state.sessions.get(key);
  if (s && Date.now() - s.createdAt < 10 * 60000) return s;
  s = createSession(p.q, { sort: p.sort, safe: p.safe }, adaptersFor(p.q, p, 1));
  s.createdAt = Date.now(); s.key = key;
  const ping = () => s.listeners.forEach((l) => l(s));
  if (p.q) {
    s.panelValue = undefined; s.relatedValue = undefined;
    (state.settings.sources.wiki ? knowledgePanel(p.q) : Promise.resolve(null)).then((v) => { s.panelValue = v || null; ping(); });
    (state.settings.googleSuggest ? memeSuggestions(p.q, { lang: lang() }) : Promise.resolve([])).then((v) => { s.relatedValue = v || []; ping(); });
  }
  state.sessions.set(key, s);
  if (state.sessions.size > 30) state.sessions.delete(state.sessions.keys().next().value);
  return s;
}

function registerItems(session) { for (const it of session.items) state.itemsById.set(it.id, it); }

function visibleItems(session, p) {
  let items = session.items;
  if (p.tab === 'images') items = items.filter((i) => i.kind !== 'template' || p.q);
  else if (p.tab === 'gifs') items = items.filter((i) => i.kind === 'gif');
  else if (p.tab === 'templates') items = items.filter((i) => i.kind === 'template');
  else if (p.tab === 'library') items = items.filter((i) => i.source === 'library');
  if (p.src.length) items = items.filter((i) => p.src.includes(i.source));
  // own memes only join web results when the title itself matches
  if (p.tab !== 'library' && !p.src.length) items = items.filter((i) => i.source !== 'library' || (p.q && (i.rel || 0) >= 1));
  return items;
}

// ------------------------------------------------------------------ results page
async function renderResults(app, isStale) {
  const p = qp();
  const session = sessionFor(p);
  if (!p.sel) state.selected.clear();
  const tabs = [['all', 'All', I.search], ['images', 'Images', I.image], ['gifs', 'GIFs', I.gif], ['templates', 'Templates', I.template], ['library', 'My memes', I.save]];
  app.innerHTML = `
    <header class="results-top">
      <div class="results-bar">${logoHtml()}<div id="sb"></div>${topRight()}</div>
      <nav class="tabs">
        ${tabs.map(([k, label, icon]) => `<a class="tab ${p.tab === k ? 'active' : ''}" href="${searchUrl({ ...state.route.params, tab: k, id: undefined, sel: undefined })}">${icon}${label}</a>`).join('')}
        <button class="tab right ${p.tools ? 'active' : ''}" data-action="tools">Tools</button>
      </nav>
      <div class="tools-row ${p.tools || p.src.length || !p.safe ? '' : 'hidden'}">
        <select class="gsel" data-param="sort" title="Sort">
          <option value="relevance" ${p.sort === 'relevance' ? 'selected' : ''}>Relevance</option>
          <option value="newest" ${p.sort === 'newest' ? 'selected' : ''}>Newest</option>
          <option value="top" ${p.sort === 'top' ? 'selected' : ''}>Most upvoted</option>
        </select>
        <a class="chip ${p.safe ? 'on' : ''}" href="${searchUrl({ ...state.route.params, safe: p.safe ? '0' : '1' })}" title="Hide NSFW results">${sm(I.shield)} SafeSearch ${p.safe ? 'on' : 'off'}</a>
        ${Object.keys(SOURCE_INFO).filter((k) => !SOURCE_INFO[k].hidden && enabled(k)).map((src) => `<a class="chip ${p.src.includes(src) ? 'on' : ''}" href="${searchUrl({ ...state.route.params, src: toggleList(p.src, src), id: undefined })}"><img src="${favicon(SOURCE_INFO[src].site)}" alt="" style="width:14px;height:14px;border-radius:3px">${esc(SOURCE_INFO[src].label)}</a>`).join('')}
        ${p.tab === 'library' ? `<button class="chip ${p.sel ? 'on' : ''}" data-action="toggle-select">${sm(I.select)} Select</button><a class="chip" href="#/upload">${sm(I.upload)} Upload</a>` : ''}
        ${p.src.length ? `<a class="chip" href="${searchUrl({ ...state.route.params, src: undefined })}">${sm(I.clear)} Clear filters</a>` : ''}
      </div>
      ${appsMenu()}
    </header>
    <div class="results ${p.id ? 'with-panel' : ''}">
      <main class="results-main" id="results-body"></main>
      <aside class="side-panel" id="panel"></aside>
    </div>`;
  $('#sb', app).replaceWith(searchBox({ value: p.q, compact: true }));
  const draw = () => {
    if (isStale()) return;
    registerItems(session);
    renderBody($('#results-body'), session, p);
    renderPanel($('#panel'), p.id);
  };
  if (state.unsubscribe) state.unsubscribe();
  state.unsubscribe = session.subscribe(() => { if (!isStale()) draw(); });
  draw();
}
function toggleList(list, v) { const s = new Set(list); if (s.has(v)) s.delete(v); else s.add(v); return [...s].join(','); }

function statusLine(session, p, items) {
  const loading = Object.entries(session.status).filter(([k, v]) => !k.includes(':') && v === 'loading').map(([k]) => SOURCE_INFO[k]?.label || k);
  const errors = Object.entries(session.status).filter(([k, v]) => !k.includes(':') && v === 'error').map(([k]) => SOURCE_INFO[k]?.label || k);
  const secs = (session.elapsed / 1000).toFixed(2);
  let txt;
  if (!p.q) txt = session.done ? `${items.length} ${p.tab === 'library' ? 'memes in your collection' : 'trending memes right now'}` : 'Loading trending memes...';
  else txt = session.done ? `About ${items.length} result${items.length === 1 ? '' : 's'} (${secs} seconds)` : `${items.length} results so far, searching ${loading.join(', ') || '...'}`;
  return `<div class="result-stats">${txt}${errors.length ? ` <span title="These sources did not respond">· ${errors.join(', ')} unavailable</span>` : ''}${session.done ? '' : ' <span class="spinner"></span>'}</div>`;
}

function renderBody(root, session, p) {
  const items = visibleItems(session, p);
  const limit = Math.max(state.limit || state.settings.resultsPerPage, 20);
  const shown = items.slice(0, limit);
  const parts = [statusLine(session, p, items)];
  if (state.jobStatus) parts.push(`<div class="status" id="job-status">${esc(state.jobStatus)}</div>`);
  if (p.q && session.done && items.length < 3) parts.push(`<div id="correction"></div>`);
  if (p.tab === 'library' && p.sel) parts.push(bulkBar());

  if (p.tab === 'all') parts.push(renderAll(session, p, items, shown));
  else if (!items.length) parts.push(session.done ? emptyState(p, session) : skeletonGrid());
  else parts.push(imageGrid(shown, p));

  if (items.length > shown.length) parts.push(`<div class="more"><button class="gbtn" data-action="more">More results (${items.length - shown.length} more loaded)</button></div>`);
  else if (p.q && session.done && p.tab !== 'library' && p.tab !== 'templates' && (enabled('lemmy') || enabled('bluesky') || enabled('tenor') || enabled('giphy') || enabled('imgur')) && session.page < 5) parts.push(`<div class="more"><button class="gbtn" data-action="load-more">Load more from the web</button></div>`);
  root.innerHTML = parts.join('');
  if (p.q && session.done && items.length < 3 && state.settings.googleSuggest) {
    spellCorrection(p.q, { lang: lang() }).then((c) => {
      const el = $('#correction'); if (!el || !c) return;
      el.innerHTML = `<div class="dym"><span class="lbl">Did you mean: </span><a href="${searchUrl({ ...state.route.params, q: c })}">${esc(c)}</a></div>`;
    });
  }
}

function skeletonGrid() {
  return `<div class="img-grid">${Array.from({ length: 12 }, (_, i) => `<div class="img-card skeleton" style="--ar:${[1.33, 1, 1.78, 0.8, 1.2, 1][i % 6]}"><div class="thumb-wrap"></div><div class="cap"><span class="bar"></span><span class="bar short"></span></div></div>`).join('')}</div>`;
}

function emptyState(p, session) {
  const noSources = !Object.keys(SOURCE_INFO).some(enabled);
  const st = session ? Object.entries(session.status).filter(([k]) => !k.includes(':')) : [];
  const allFailed = st.length > 0 && st.every(([, v]) => v === 'error' || v === 'skipped');
  if (allFailed) return `<div class="empty">Memegle could not reach any source.
    <div style="margin-top:12px">The browser blocked or failed every request to the meme sources (lemmy.world, meme-api.com, api.imgflip.com, mastodon.social).
    This happens with strict content blockers, privacy modes or network filters. Allow those hosts or try another browser, then
    <a href="javascript:location.reload()">reload</a>.</div></div>`;
  return `<div class="empty">
    ${p.q ? `Your search - <b>${esc(p.q)}</b> - did not match any memes${p.tab === 'gifs' ? ' in GIF sources' : p.tab === 'library' ? ' in My memes' : ''}.` : 'Nothing here yet.'}
    <div style="margin-top:12px">Suggestions:</div>
    <ul>
      ${noSources ? '<li>All sources are disabled. Enable some in <a href="#/settings#sources">Settings</a>.</li>' : ''}
      ${p.tab === 'gifs' && !enabled('tenor') && !enabled('giphy') ? '<li>Add a free Tenor or Giphy API key in <a href="#/settings#sources">Settings</a> for full GIF search.</li>' : ''}
      ${p.tab === 'library' ? '<li><a href="#/upload">Upload memes</a> or save results from the web with the Save button.</li>' : '<li>Try different or more general keywords, or the name of the meme template.</li>'}
      ${p.tab !== 'all' ? `<li>Look at <a href="${searchUrl({ ...state.route.params, tab: 'all' })}">all result types</a>.</li>` : ''}
      ${p.safe ? `<li><a href="${searchUrl({ ...state.route.params, safe: '0' })}">Turn SafeSearch off</a> if you expect NSFW results.</li>` : ''}
      ${p.q ? `<li>Search the wider web: ${moreSourcesLinks(p.q)}</li>` : ''}
    </ul></div>`;
}

function moreSourcesLinks(q) {
  const e = encodeURIComponent(q);
  return [
    `<a href="https://knowyourmeme.com/search?q=${e}" target="_blank" rel="noopener">Know Your Meme</a>`,
    `<a href="https://www.reddit.com/r/memes/search/?q=${e}&restrict_sr=1" target="_blank" rel="noopener">Reddit</a>`,
    `<a href="https://imgflip.com/memesearch?q=${e}" target="_blank" rel="noopener">Imgflip</a>`,
    `<a href="https://tenor.com/search/${e}-gifs" target="_blank" rel="noopener">Tenor</a>`,
    `<a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q + ' meme')}" target="_blank" rel="noopener">Google Images</a>`,
  ].join(' · ');
}

// ---------- All tab: Google web layout
function renderAll(session, p, items, shown) {
  if (!items.length && !session.done) return `<div class="all-grid"><div class="all-main">${skeletonList()}</div></div>`;
  if (!items.length) return emptyState(p, session);
  const images = items.filter((i) => i.kind !== 'template').slice(0, 8);
  const templates = items.filter((i) => i.kind === 'template').slice(0, 6);
  const list = shown.filter((i) => i.kind !== 'template');
  const tokens = tokenize(p.q);
  const panel = session.panelValue;
  const related = session.relatedValue || [];
  return `<div class="all-grid">
    <div class="all-main">
      ${images.length ? `<div class="g strip-block">
        <div class="g-head"><span class="site">${sm(I.image, 18)} Images for <b>${esc(p.q || 'trending memes')}</b></span></div>
        <div class="strip">${images.map((it) => `<img src="${esc(it.thumb)}" alt="${esc(it.title)}" title="${esc(it.title)}" loading="lazy" style="--ar:${aspect(it)}" onerror="this.remove()" data-action="open" data-id="${esc(it.id)}">`).join('')}</div>
        <a class="strip-more" href="${searchUrl({ ...state.route.params, tab: 'images' })}">View all ${items.filter((i) => i.kind !== 'template').length} images</a>
      </div>` : ''}
      ${templates.length ? `<div class="g strip-block">
        <div class="g-head"><span class="site">${sm(I.template, 18)} Meme templates</span></div>
        <div class="tpl-row">${templates.map((t) => `<a class="tpl" href="${esc(t.url)}" target="_blank" rel="noopener" title="${esc(t.title)} on Imgflip"><img src="${esc(t.thumb)}" alt="" loading="lazy"><span>${esc(t.title)}</span></a>`).join('')}</div>
      </div>` : ''}
      ${list.map((it) => webResult(it, tokens)).join('')}
      ${related.length ? `<div class="g"><h4 class="pasf">People also search for</h4><div class="pasf-grid">${related.slice(0, 8).map((r) => `<a class="chip" href="${searchUrl({ q: r })}">${sm(I.search)} ${esc(r)}</a>`).join('')}</div></div>` : ''}
      ${p.q ? `<div class="g more-sources">More sources: ${moreSourcesLinks(p.q)}</div>` : ''}
    </div>
    <aside class="kp">
      ${panel ? `<div class="kp-card">
        ${panel.thumb ? `<img class="kp-img" src="${esc(panel.thumb)}" alt="">` : ''}
        <h3>${esc(panel.title)}</h3>
        <div class="kp-sub">Meme · Wikipedia</div>
        <p>${esc(panel.extract.slice(0, 420))}${panel.extract.length > 420 ? '...' : ''} <a href="${esc(panel.url)}" target="_blank" rel="noopener">Wikipedia</a></p>
      </div>` : ''}
      ${p.q ? `<div class="kp-card kp-links">
        <h3>About this meme</h3>
        <a href="https://knowyourmeme.com/search?q=${encodeURIComponent(p.q)}" target="_blank" rel="noopener"><img src="${favicon('knowyourmeme.com')}" alt="">Know Your Meme entry</a>
        <a href="https://imgflip.com/memesearch?q=${encodeURIComponent(p.q)}" target="_blank" rel="noopener"><img src="${favicon('imgflip.com')}" alt="">Imgflip templates</a>
        <a href="https://www.reddit.com/r/memes/search/?q=${encodeURIComponent(p.q)}&restrict_sr=1" target="_blank" rel="noopener"><img src="${favicon('reddit.com')}" alt="">r/memes on Reddit</a>
        <a href="https://tenor.com/search/${encodeURIComponent(p.q)}-gifs" target="_blank" rel="noopener"><img src="${favicon('tenor.com')}" alt="">Tenor GIFs</a>
      </div>` : ''}
    </aside>
  </div>`;
}
function skeletonList() {
  return Array.from({ length: 5 }, () => `<div class="g skeleton"><div class="g-head"><span class="fav bar"></span><span class="bar" style="width:160px"></span></div><div class="bar" style="width:60%;height:20px;margin:8px 0"></div><div class="bar" style="width:100%"></div><div class="bar" style="width:80%"></div></div>`).join('');
}
function aspect(it) { return it.width && it.height ? Math.min(2.2, Math.max(0.6, it.width / it.height)).toFixed(3) : '1.2'; }

function webResult(it, tokens) {
  const meta = [];
  if (it.score) meta.push(`${fmtNum(it.score)} upvotes`);
  if (it.comments) meta.push(`${fmtNum(it.comments)} comments`);
  if (it.created) meta.push(ago(it.created));
  if (it.author) meta.push(`by ${esc(it.author)}`);
  const snippet = it.body ? highlight(it.body, tokens) : `${it.kind === 'gif' ? 'GIF' : 'Meme'} posted in ${esc(it.path)} on ${esc(it.site)}.`;
  return `<div class="g" data-id="${esc(it.id)}">
    <div class="g-head">
      <img class="fav" src="${it.source === 'library' ? esc(it.thumb) : favicon(it.site)}" alt="">
      <div>
        <div class="site">${esc(it.site)}</div>
        <div class="url">${esc(it.site)} <b>›</b> ${esc(it.path)}</div>
      </div>
    </div>
    <h3><a href="${esc(it.url)}" ${it.source === 'library' ? '' : 'target="_blank" rel="noopener"'}>${highlight(it.title, tokens)}</a></h3>
    <div class="g-body">
      <div class="g-snippet">${meta.length ? `<span class="date">${meta.join(' · ')} - </span>` : ''}${snippet}</div>
      <img class="g-thumb" src="${esc(it.thumb)}" alt="" loading="lazy" onerror="this.remove()" data-action="open" data-id="${esc(it.id)}">
    </div>
  </div>`;
}

// ---------- grid (Images / GIFs / Templates / My memes)
function imageGrid(items, p) {
  return `<div class="img-grid ${p.sel ? 'selecting' : ''}">
    ${items.map((it) => `<div class="img-card ${state.selected.has(it.id) ? 'selected' : ''} ${p.id === it.id ? 'active' : ''}" style="--ar:${aspect(it)}" data-action="${p.sel ? 'select' : 'open'}" data-id="${esc(it.id)}">
        <div class="thumb-wrap">
          <img src="${esc(it.thumb)}" alt="${esc(it.title)}" loading="lazy" onerror="this.closest('.img-card').classList.add('broken')">
          ${it.kind === 'gif' ? '<span class="badge">GIF</span>' : ''}
          ${it.kind === 'template' ? '<span class="badge">Template</span>' : ''}
          ${it.source === 'library' && !it.body ? '<span class="badge warn">no description</span>' : ''}
          ${it.nsfw ? '<span class="badge warn" style="left:auto;right:8px">NSFW</span>' : ''}
          <span class="sel">${state.selected.has(it.id) ? I.check : ''}</span>
        </div>
        <div class="cap"><span class="src"><img src="${it.source === 'library' ? esc(it.thumb) : favicon(it.site)}" alt="">${esc(it.site)} › ${esc(it.path)}</span>${esc(it.title)}</div>
      </div>`).join('')}
  </div>`;
}

function bulkBar() {
  const n = state.selected.size;
  return `<div class="bulk-bar">
    <span class="count">${n} selected</span>
    <button class="gbtn" data-action="select-all">Select all shown</button>
    <button class="gbtn" data-action="bulk-describe" ${n ? '' : 'disabled'}>${sm(I.sparkle)} Generate descriptions</button>
    <button class="gbtn" data-action="bulk-tag" ${n ? '' : 'disabled'}>Add tag</button>
    <button class="gbtn danger" data-action="bulk-delete" ${n ? '' : 'disabled'}>Delete</button>
    <button class="gbtn" data-action="toggle-select">Done</button>
  </div>`;
}

// ------------------------------------------------------------------ side panel
function renderPanel(panel, id) {
  if (!id) { panel.innerHTML = ''; panel.dataset.id = ''; return; }
  if (panel.dataset.id === id && panel.children.length) return; // keep scroll + edits while results stream in
  panel.dataset.id = id;
  const it = state.itemsById.get(id);
  if (!it) {
    panel.innerHTML = `<div class="detail"><div class="detail-head"><button class="icon-btn" data-action="close-panel">${I.close}</button><span class="title">This result is not loaded</span></div><p class="status">Run the search again or go back to the results list.</p></div>`;
    return;
  }
  if (it.source === 'library') { panel.innerHTML = detailPanel(it.meme); bindDetail(panel, it.meme); }
  else panel.innerHTML = viewerPanel(it);
  panel.scrollTop = 0;
}

function viewerPanel(it) {
  const meta = [];
  if (it.score) meta.push(`${sm(I.arrowUp, 14)} ${fmtNum(it.score)}`);
  if (it.comments) meta.push(`${sm(I.comment, 14)} ${fmtNum(it.comments)}`);
  if (it.created) meta.push(ago(it.created));
  if (it.author) meta.push(`by ${esc(it.author)}`);
  if (it.width && it.height) meta.push(`${it.width} × ${it.height}`);
  if (it.kind === 'template' && it.rank) meta.push(`#${it.rank} template on Imgflip`);
  const similar = moreLikeThis(it);
  return `<div class="detail" data-id="${esc(it.id)}">
    <div class="detail-head">
      <button class="icon-btn" data-action="close-panel" title="Close" aria-label="Close">${I.close}</button>
      <img src="${favicon(it.site)}" alt="" style="width:20px;height:20px;border-radius:4px">
      <span class="title" title="${esc(it.title)}">${esc(it.site)} › ${esc(it.path)}</span>
      <a class="icon-btn" href="${esc(it.image)}" target="_blank" rel="noopener" title="Open image in new tab">${I.open}</a>
    </div>
    <div class="detail-img"><img src="${esc(it.image)}" alt="${esc(it.title)}" data-fallback="${esc(it.thumb)}" onerror="if(this.src!==this.dataset.fallback){this.src=this.dataset.fallback}"></div>
    <h3 class="v-title">${esc(it.title)}</h3>
    <div class="meta">${meta.join('<span>·</span>')}</div>
    ${it.body ? `<p class="v-body">${esc(it.body)}</p>` : ''}
    ${it.tags?.length ? `<div class="g-tags">${it.tags.slice(0, 10).map((t) => `<a class="chip sm" href="${searchUrl({ q: t })}">${esc(t)}</a>`).join('')}</div>` : ''}
    <div class="actions">
      <a class="gbtn primary" href="${esc(it.url)}" target="_blank" rel="noopener">${sm(I.open)} Visit ${esc(it.site)}</a>
      ${it.captionUrl ? `<a class="gbtn" href="${esc(it.captionUrl)}" target="_blank" rel="noopener">Caption this template</a>` : ''}
      <button class="gbtn" data-action="save-remote">${sm(I.save)} Save to My memes</button>
      <button class="gbtn" data-action="copy">${sm(I.copy)} Copy image</button>
      <button class="gbtn" data-action="download">${sm(I.download)} Download</button>
      <button class="gbtn" data-action="find-similar">Find similar</button>
    </div>
    <div class="status" id="d-status"></div>
    ${similar.length ? `<h4>More like this</h4><div class="similar">${similar.map((s) => `<img src="${esc(s.thumb)}" alt="${esc(s.title)}" title="${esc(s.title)}" data-action="open" data-id="${esc(s.id)}" loading="lazy" onerror="this.remove()">`).join('')}</div>` : ''}
  </div>`;
}

function moreLikeThis(it, n = 8) {
  const tokens = [...new Set(tokenize(it.title + ' ' + (it.tags || []).join(' ')))];
  const pool = [...state.itemsById.values()].filter((x) => x.id !== it.id && x.kind !== 'template' && x.source !== 'library');
  return pool.map((x) => ({ x, r: relevance(x, tokens, null) })).filter((o) => o.r > 0.2).sort((a, b) => b.r - a.r).slice(0, n).map((o) => o.x);
}

function detailPanel(m) {
  if (!m) return '';
  const similar = search(state.index, [...(m.tags || []), m.title].join(' ')).results.map((x) => x.meme).filter((x) => x.id !== m.id).slice(0, 8);
  return `<div class="detail" data-id="library:${esc(m.id)}" data-meme="${esc(m.id)}">
    <div class="detail-head">
      <button class="icon-btn" data-action="close-panel" title="Close" aria-label="Close">${I.close}</button>
      <span class="title" title="${esc(m.path)}">${esc(m.title)}</span>
      <a class="icon-btn" href="${esc(m.url)}" target="_blank" rel="noopener" title="Open image in new tab">${I.open}</a>
    </div>
    <div class="detail-img"><img src="${esc(m.url)}" alt="${esc(m.title)}"></div>
    <div class="meta">
      <span>${sm(I.folder, 14)} ${esc(m.folder)}</span><span>${m.width} × ${m.height}</span><span>${esc(m.filename)}</span>
      <span>${m.source === 'upload' ? 'saved ' + new Date(m.created).toLocaleString() : 'bundled'}${m.edited ? ' · edited' : ''}</span>
    </div>
    <div class="actions">
      <button class="gbtn primary" data-action="describe">${sm(I.sparkle)} Generate description</button>
      <button class="gbtn" data-action="download">Download</button>
      <button class="gbtn" data-action="copy">Copy image</button>
      ${m.source === 'bundled' && m.edited ? `<button class="gbtn" data-action="reset">Reset edits</button>` : ''}
      <button class="gbtn danger" data-action="delete">${m.source === 'upload' ? 'Delete' : 'Remove'}</button>
    </div>
    <div class="status" id="d-status"></div>
    <div class="progress hidden" id="d-progress"><div></div></div>
    <h4>Description</h4>
    <textarea id="d-desc" placeholder="Describe the meme: scene, characters, the joke. Used for search.">${esc(m.description)}</textarea>
    <h4>Text in image</h4>
    <textarea id="d-text" style="min-height:56px" placeholder="Caption text">${esc(m.text)}</textarea>
    <div class="actions"><button class="gbtn primary" data-action="save">Save</button><span class="status" id="d-saved"></span></div>
    <h4>Tags</h4>
    <div class="tag-editor" id="d-tags">
      ${(m.tags || []).map((t) => `<span class="chip sm">${esc(t)}<button class="x" data-action="rm-tag" data-tag="${esc(t)}" title="Remove tag">×</button></span>`).join('')}
      <input id="d-tag-input" list="tag-datalist" placeholder="Add tag, press Enter">
      <datalist id="tag-datalist">${allTags().map(([t]) => `<option value="${esc(t)}">`).join('')}</datalist>
    </div>
    ${similar.length ? `<h4>Similar in My memes</h4><div class="similar">${similar.map((s) => `<img src="${esc(s.url)}" alt="${esc(s.title)}" title="${esc(s.title)}" data-action="open" data-id="library:${esc(s.id)}" loading="lazy">`).join('')}</div>` : ''}
  </div>`;
}
function bindDetail(panel, m) {
  const tagInput = $('#d-tag-input', panel);
  tagInput?.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = tagInput.value.trim().toLowerCase();
    if (!t) return;
    await saveMemeFields(m, { tags: [...new Set([...(m.tags || []), t])] });
    await refreshLibrary();
  });
}

async function refreshLibrary() {
  await reload();
  registerLibrary();
  state.sessions.clear();
  const panel = $('#panel'); if (panel) panel.dataset.id = '';
  render(true);
}

// ------------------------------------------------------------------ AI describe queue (library)
async function describeOne(m, { statusEl, progressEl } = {}) {
  const set = (txt, cls = '') => { if (statusEl) { statusEl.textContent = txt; statusEl.className = 'status ' + cls; } setJob(txt); };
  const prog = (pct) => { if (progressEl) { progressEl.classList.toggle('hidden', pct == null); progressEl.firstElementChild.style.width = (pct || 0) + '%'; } };
  try {
    set(state.settings.provider === 'openai' ? 'Asking vision API...' : 'Loading model (first time downloads ~340 MB)...');
    const r = await describe(m, state.settings, (p) => {
      if (p.status === 'progress') { set(`Downloading model ${p.pct}% (${Math.round(p.loaded / 1048576)} MB)`); prog(p.pct); }
      else if (p.status === 'generating') { set('Generating description...'); prog(100); }
    });
    const fields = { description: r.description || m.description };
    if (r.text) fields.text = r.text;
    await saveMemeFields(m, fields);
    set('Description generated', 'ok'); prog(null);
    toast(`Described: ${m.title}`);
    return true;
  } catch (e) {
    console.error(e); set('Failed: ' + (e.message || e), 'err'); prog(null);
    return false;
  }
}
function setJob(text) {
  state.jobStatus = text;
  const el = $('#job-status'); if (el) { el.textContent = text; el.classList.toggle('hidden', !text); }
}
async function runQueue() {
  if (state.queueRunning) return;
  state.queueRunning = true;
  let done = 0; const total = state.queue.length;
  while (state.queue.length) {
    const id = state.queue.shift();
    const m = memeById(id); if (!m) continue;
    setJob(`Generating descriptions ${done + 1}/${total}: ${m.title}`);
    const panel = $('#panel .detail[data-meme="' + CSS.escape(id) + '"]');
    await describeOne(m, { statusEl: panel ? $('#d-status', panel) : null, progressEl: panel ? $('#d-progress', panel) : null });
    done++;
    if (!/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) await refreshLibrary();
  }
  state.queueRunning = false; setJob('');
  if (total > 1) toast(`Generated ${done} description${done === 1 ? '' : 's'}`);
}

let vectorBusy = null;
async function ensureVectors(onProgress) {
  if (vectorBusy) return vectorBusy;
  vectorBusy = (async () => {
    const todo = [];
    for (const m of state.lib) {
      const text = embeddingText(m); const h = hashText(text);
      if (state.vectorHash.get(m.id) === h && state.vectors.has(m.id)) continue;
      const cached = await getEmbedding(m.id);
      if (cached && cached.hash === h) { state.vectors.set(m.id, cached.vec); state.vectorHash.set(m.id, h); continue; }
      todo.push({ m, text, h });
    }
    for (let i = 0; i < todo.length; i += 16) {
      const batch = todo.slice(i, i + 16);
      const vecs = await embed(batch.map((b) => b.text), (p) => { if (p.status === 'progress') setJob(`Loading embedding model ${p.pct}%`); });
      for (let j = 0; j < batch.length; j++) { state.vectors.set(batch[j].m.id, vecs[j]); state.vectorHash.set(batch[j].m.id, batch[j].h); await putEmbedding(batch[j].m.id, batch[j].h, vecs[j]); }
      onProgress?.(i + batch.length, todo.length);
    }
    setJob('');
  })();
  try { await vectorBusy; } finally { vectorBusy = null; }
}

// ------------------------------------------------------------------ save remote item to library
async function saveRemote(it, statusEl) {
  const set = (t, cls = '') => { if (statusEl) { statusEl.textContent = t; statusEl.className = 'status ' + cls; } };
  try {
    set('Fetching image...');
    const res = await fetch(it.image);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Not an image');
    const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');
    const name = (it.title || 'meme').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'meme';
    const file = new File([blob], `${name}.${ext}`, { type: blob.type });
    const rec = await addUpload(file, `saved/${it.source}`);
    await saveMemeFields({ id: rec.id, source: 'upload' }, {
      description: [it.body, `Saved from ${it.site} (${it.path}). ${it.url}`].filter(Boolean).join(' '),
      text: it.title,
      tags: [...new Set([it.source, ...(it.tags || []).slice(0, 5)])],
    });
    await reload(); registerLibrary(); state.sessions.clear();
    set('Saved to My memes', 'ok');
    toast('Saved to My memes');
    if (state.settings.autoDescribe) { state.queue.push(rec.id); runQueue(); }
  } catch (e) {
    console.error(e);
    set(`Could not save: ${e.message || e}. The site may block cross-origin downloads; open the image and save it manually.`, 'err');
  }
}

// ------------------------------------------------------------------ upload / lens
function renderUpload(app) {
  app.innerHTML = `${pageHeader()}
    <main class="page">
      <h1>Upload to My memes</h1>
      <p class="lead">Drag and drop, paste from the clipboard, or pick files. Up to 50 images per batch (JPG, PNG, WEBP, GIF).
      Files are stored in this browser only (IndexedDB), indexed for search and shown under My memes. Descriptions can be generated locally with an AI model.</p>
      <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload memes">
        ${I.upload}<strong>Drop memes here, paste, or click to browse</strong>
        <span>They never leave your device unless you choose an external vision API in Settings.</span>
      </div>
      <div class="row" style="margin-top:14px"><label for="up-folder">Folder</label>
        <input class="ginput grow" id="up-folder" value="${esc(state.settings.uploadFolder)}" list="folder-datalist" placeholder="direct-uploads">
        <datalist id="folder-datalist">${allFolders().map(([f]) => `<option value="${esc(f)}">`).join('')}</datalist></div>
      <div class="row"><label class="switch"><input type="checkbox" id="up-auto" ${state.settings.autoDescribe ? 'checked' : ''}> Auto-generate descriptions after upload (${state.settings.provider === 'openai' ? 'vision API' : 'in-browser model'})</label></div>
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
  if (state.route.name !== 'upload') { go('upload'); await new Promise((r) => setTimeout(r, 60)); }
  const list = $('#upload-list');
  const folder = ($('#up-folder')?.value || state.settings.uploadFolder).trim() || 'direct-uploads';
  const added = [];
  for (const f of files) {
    const row = document.createElement('div');
    row.className = 'upload-item';
    row.innerHTML = `<img src="${URL.createObjectURL(f)}" alt=""><span class="name">${esc(f.name)}</span><span class="state">saving...</span>`;
    list?.prepend(row);
    try {
      const rec = await addUpload(f, folder);
      added.push(rec.id);
      $('.state', row).textContent = `saved to ${folder}/${rec.filename}`; $('.state', row).classList.add('ok');
    } catch (e) { $('.state', row).textContent = 'failed: ' + (e.message || e); $('.state', row).classList.add('err'); }
  }
  await reload(); registerLibrary(); state.sessions.clear();
  toast(`Added ${added.length} meme${added.length === 1 ? '' : 's'}`);
  if (state.settings.autoDescribe && added.length) { state.queue.push(...added); runQueue(); }
  const link = document.createElement('div');
  link.className = 'row';
  link.innerHTML = `<a class="gbtn" href="#/search?tab=library&folder=${encodeURIComponent(folder)}" style="display:inline-flex;align-items:center">View in My memes</a>`;
  list?.prepend(link);
}

async function lensSearch(file) {
  const overlay = document.createElement('div');
  overlay.className = 'lens-busy';
  overlay.innerHTML = `<div>${I.lens.replace('<svg', '<svg style="width:48px;height:48px"')}</div><div id="lens-status">Looking at your image...</div><div class="progress"><div style="width:0"></div></div>`;
  document.body.appendChild(overlay);
  try {
    const r = await describe({ blob: file }, state.settings, (p) => {
      if (p.status === 'progress') { $('#lens-status', overlay).textContent = `Downloading vision model ${p.pct}%`; $('.progress div', overlay).style.width = p.pct + '%'; }
      if (p.status === 'generating') { $('#lens-status', overlay).textContent = 'Describing image...'; $('.progress div', overlay).style.width = '100%'; }
    });
    const words = `${r.text || ''} ${r.description || ''}`.replace(/\s+/g, ' ').trim().split(' ').filter((w) => w.length > 2).slice(0, 8).join(' ');
    overlay.remove();
    if (!words) { toast('Could not describe the image'); return; }
    pushHistory(words);
    go('search', { q: words, tab: 'images' });
  } catch (e) { overlay.remove(); console.error(e); toast('Lens failed: ' + (e.message || e), 5000); }
}

// ------------------------------------------------------------------ tags / folders (library)
function renderTags(app) {
  const tags = allTags();
  app.innerHTML = `${pageHeader()}
    <main class="page">
      <h1>Tags in My memes</h1>
      <p class="lead">${tags.length} tags across ${state.lib.length} memes. Click a tag to filter, rename or delete it everywhere.</p>
      <table class="tag-table">
        ${tags.map(([t, n]) => `<tr>
          <td><a class="chip" href="${searchUrl({ tab: 'library', tags: t })}">${sm(I.tag)} ${esc(t)}</a></td>
          <td style="color:var(--text-3)">${n} meme${n === 1 ? '' : 's'}</td>
          <td><button class="gbtn" data-action="rename-tag" data-tag="${esc(t)}">Rename</button> <button class="gbtn danger" data-action="delete-tag" data-tag="${esc(t)}">Delete</button></td>
        </tr>`).join('')}
      </table>${tags.length ? '' : '<p>No tags yet.</p>'}
    </main>`;
  $('#sb', app).replaceWith(searchBox({ compact: true }));
}
function renderFolders(app) {
  app.innerHTML = `${pageHeader()}
    <main class="page">
      <h1>Folders in My memes</h1>
      <p class="lead">Bundled memes live in <code>memes/&lt;folder&gt;/</code> in the repository; uploads and saved web memes go to the folder you pick.</p>
      <div class="folder-list">${allFolders().map(([f, n]) => `<a href="${searchUrl({ tab: 'library', folder: f })}">${I.folder}<span>${esc(f)}</span><span class="n">${n}</span></a>`).join('')}</div>
    </main>`;
  $('#sb', app).replaceWith(searchBox({ compact: true }));
}

// ------------------------------------------------------------------ settings
async function renderSettings(app) {
  const s = state.settings;
  const stats = await libraryStats();
  const cached = await isModelCached(s.model);
  const srcRow = (key) => {
    const info = SOURCE_INFO[key];
    return `<div class="src-row">
      <label class="switch"><input type="checkbox" data-source="${key}" ${s.sources[key] ? 'checked' : ''}> <img src="${favicon(info.site)}" alt="" style="width:16px;height:16px;border-radius:3px"> <b>${esc(info.label)}</b></label>
      <div class="src-desc">${esc(info.desc)}${info.needsKey ? ` <a href="${info.keyUrl}" target="_blank" rel="noopener">Get a free key</a>` : ''}</div>
      ${info.needsKey ? `<input class="ginput" type="password" data-setting="${info.keyName}" value="${esc(s[info.keyName])}" placeholder="${esc(info.label)} API key" autocomplete="off">` : ''}
    </div>`;
  };
  app.innerHTML = `${pageHeader()}
    <main class="page">
      <h1>Settings</h1>
      <p class="lead">Everything is stored in this browser. Searches go directly from your browser to the public APIs of the sources you enable.</p>

      <h2 id="sources">Sources</h2>
      <div class="card">
        ${['lemmy', 'bluesky', 'reddit', 'imgflip', 'mastodon', 'tenor', 'giphy', 'imgur', 'library'].map(srcRow).join('')}
        <div class="src-row">
          <label class="switch"><input type="checkbox" data-source="wiki" ${s.sources.wiki ? 'checked' : ''}> <img src="${favicon('wikipedia.org')}" alt="" style="width:16px;height:16px"> <b>Wikipedia knowledge panel</b></label>
          <div class="src-desc">Short explanation of the meme next to the results, when Wikipedia has an article.</div>
        </div>
        <div class="row" style="margin-top:14px"><label class="switch"><input type="checkbox" data-setting="safeSearch" ${s.safeSearch ? 'checked' : ''}> SafeSearch on by default (hides NSFW posts)</label></div>
        <div class="row"><label class="switch"><input type="checkbox" data-setting="googleSuggest" ${s.googleSuggest ? 'checked' : ''}> Live Google search suggestions and spelling correction</label></div>
        <div class="row" style="align-items:flex-start"><label for="lemmy-list">Lemmy communities</label>
          <textarea class="ginput grow" id="lemmy-list" data-setting="lemmyCommunities" style="height:120px;font-family:monospace;font-size:12px">${esc(s.lemmyCommunities)}</textarea></div>
        <div class="row" style="align-items:flex-start"><label for="reddit-list">Subreddits (via meme-api.com)</label>
          <textarea class="ginput grow" id="reddit-list" data-setting="redditSubs" style="height:80px;font-family:monospace;font-size:12px">${esc(s.redditSubs)}</textarea></div>
        <div class="row"><button class="gbtn" data-action="reset-sources">Reset community lists</button></div>
      </div>

      <h2>Appearance</h2>
      <div class="card">
        <div class="row"><label>Theme</label>
          <select class="gsel" data-setting="theme">${['system', 'light', 'dark'].map((t) => `<option value="${t}" ${s.theme === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></div>
        <div class="row"><label class="switch"><input type="checkbox" data-setting="parade" ${s.parade !== false ? 'checked' : ''}> Meme parade on the home page (trending templates walk across the search bar)</label></div>
        <div class="row"><label>Results per page</label><input class="ginput" style="width:90px" type="number" min="10" max="200" data-setting="resultsPerPage" value="${s.resultsPerPage}"></div>
      </div>

      <h2>My memes: search and AI</h2>
      <div class="card">
        <div class="row"><label>Library search mode</label>
          <select class="gsel" data-setting="searchMode">
            <option value="keyword" ${s.searchMode === 'keyword' ? 'selected' : ''}>Keyword (BM25, instant)</option>
            <option value="vector" ${s.searchMode === 'vector' ? 'selected' : ''}>Vector (all-MiniLM-L6-v2 embeddings, ~23 MB model)</option>
          </select></div>
        <div class="row"><label>Vector index</label><button class="gbtn" data-action="build-vectors">Embed all memes now</button><span class="status" id="vec-status">${state.vectors.size}/${state.lib.length} in memory</span></div>
        <div class="row"><label>Description provider</label>
          <select class="gsel" data-setting="provider">
            <option value="browser" ${s.provider === 'browser' ? 'selected' : ''}>In-browser model (local, private)</option>
            <option value="openai" ${s.provider === 'openai' ? 'selected' : ''}>OpenAI-compatible vision API</option>
          </select></div>
        <div id="prov-browser" class="${s.provider === 'browser' ? '' : 'hidden'}">
          <div class="row"><label>Image-to-text model</label>
            <select class="gsel" data-setting="model">${CAPTION_MODELS.map((m) => `<option value="${m.id}" ${s.model === m.id ? 'selected' : ''}>${m.label} · ${m.size}</option>`).join('')}</select></div>
          <div class="row"><label>Compute</label><span>${hasWebGPU() ? 'WebGPU available (fast)' : 'WebGPU not available, using WASM (slow but works)'}</span></div>
          <div class="row"><label>Model cache</label><button class="gbtn" data-action="download-model">${cached ? 'Model cached · re-check' : 'Download model now'}</button><span class="status" id="model-status"></span></div>
          <div class="progress hidden" id="model-progress"><div></div></div>
        </div>
        <div id="prov-openai" class="${s.provider === 'openai' ? '' : 'hidden'}">
          <div class="row"><label>Base URL</label><input class="ginput grow" data-setting="openaiBaseUrl" value="${esc(s.openaiBaseUrl)}" placeholder="https://api.openai.com/v1"></div>
          <div class="row"><label>API key</label><input class="ginput grow" type="password" data-setting="openaiKey" value="${esc(s.openaiKey)}" placeholder="sk-..."></div>
          <div class="row"><label>Vision model</label><input class="ginput grow" data-setting="openaiModel" value="${esc(s.openaiModel)}" placeholder="gpt-4o-mini"></div>
        </div>
        <div class="row"><label class="switch"><input type="checkbox" data-setting="autoDescribe" ${s.autoDescribe ? 'checked' : ''}> Auto-generate descriptions for new uploads and saved memes</label></div>
      </div>

      <h2>Library</h2>
      <div class="card">
        <div class="kv">
          <span>Bundled memes</span><b>${state.lib.filter((m) => m.source === 'bundled').length}</b>
          <span>Uploads and saved</span><b>${stats.uploads} (${(stats.bytes / 1048576).toFixed(1)} MB)</b>
          <span>Browser storage</span><b>${stats.quota ? `${(stats.quota.usage / 1048576).toFixed(0)} MB used of ${(stats.quota.quota / 1073741824).toFixed(1)} GB` : 'unknown'}</b>
        </div>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <a class="gbtn" href="#/tags" style="display:inline-flex;align-items:center">Tags</a>
          <a class="gbtn" href="#/folders" style="display:inline-flex;align-items:center">Folders</a>
          <button class="gbtn" data-action="rescan">Restore hidden bundled memes</button>
          <button class="gbtn" data-action="export">Export library (JSON)</button>
          <button class="gbtn" data-action="import">Import library</button>
          <button class="gbtn" data-action="clear-history">Clear search history</button>
          <button class="gbtn danger" data-action="clear-library">Delete uploads and edits</button>
        </div>
      </div>

      <h2 id="about">About</h2>
      <div class="card" style="line-height:1.6">
        <p style="margin:0 0 8px"><b>Memegle</b> is Google for memes: a meme-only search engine that runs entirely in your browser and is hosted as a static site.
        It started as a rebuild of <a href="https://github.com/meme-search/meme-search" target="_blank" rel="noopener">Meme Search</a> (Apache-2.0), whose features live on under My memes.</p>
        <p id="how" style="margin:0 0 8px"><b>How Search works.</b> Your query goes in parallel to the meme communities on Lemmy (searched through lemmy.world and the communities' own instances),
        to hot posts of meme subreddits via meme-api.com, to the Imgflip template list and, with your own keys, to Tenor, Giphy and Imgur. Results are merged, de-duplicated and ranked
        by title match, upvotes and freshness. Suggestions and "Did you mean" come live from Google's suggest service. The knowledge panel is the matching Wikipedia article.
        My memes are searched locally with BM25 or sentence embeddings.</p>
        <p id="privacy" style="margin:0"><b>Privacy.</b> No analytics, no accounts, no Memegle server. Queries are sent to the sources above (and to Google's suggest endpoint if enabled).
        Uploads stay in this browser. Source: <a href="https://github.com/justbuildsstuff/Memegle" target="_blank" rel="noopener">github.com/justbuildsstuff/Memegle</a>.</p>
      </div>
    </main>`;
  $('#sb', app).replaceWith(searchBox({ compact: true }));
  $$('[data-setting]', app).forEach((el) => {
    el.addEventListener('change', () => {
      const k = el.dataset.setting;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number') v = Math.max(10, Math.min(200, +v || DEFAULT_SETTINGS.resultsPerPage));
      state.settings[k] = v; saveSettings(state.settings); state.sessions.clear();
      if (k === 'theme') applyTheme();
      if (k === 'provider') { $('#prov-browser').classList.toggle('hidden', v !== 'browser'); $('#prov-openai').classList.toggle('hidden', v !== 'openai'); }
    });
  });
  $$('[data-source]', app).forEach((el) => el.addEventListener('change', () => { state.settings.sources[el.dataset.source] = el.checked; saveSettings(state.settings); state.sessions.clear(); }));
  const anchor = location.hash.split('#').pop();
  if (['about', 'how', 'privacy', 'sources'].includes(anchor)) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 50);
}

// ------------------------------------------------------------------ actions
async function onAction(action, el, e) {
  const p = qp();
  const id = el.dataset.id || $('#panel .detail')?.dataset.id;
  const it = id ? state.itemsById.get(id) : null;
  const m = it?.source === 'library' ? it.meme : (id && id.startsWith('library:') ? memeById(id.slice(8)) : null);
  const statusEl = $('#d-status');
  switch (action) {
    case 'settings': go('settings'); break;
    case 'parade-pick': pushHistory(el.dataset.q); go('search', { q: el.dataset.q, tab: 'images' }); break;
    case 'apps': $('#apps-menu')?.classList.toggle('hidden'); e.stopPropagation(); break;
    case 'lucky': {
      toast('Picking a meme...');
      try {
        const pool = (await fetchRedditPool({ subs: subs().slice(0, 3), count: 30 })).filter((x) => !x.nsfw || !state.settings.safeSearch);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (!pick) throw new Error('empty');
        state.itemsById.set(pick.id, pick);
        go('search', { tab: 'images', id: pick.id });
      } catch { go('search', { tab: 'images' }); }
      break;
    }
    case 'tools': go('search', { ...state.route.params, tools: p.tools ? undefined : '1' }); break;
    case 'toggle-select': state.selected.clear(); go('search', { ...state.route.params, sel: p.sel ? undefined : '1', id: undefined }); break;
    case 'more': state.limit = (state.limit || state.settings.resultsPerPage) + state.settings.resultsPerPage; render(true); break;
    case 'load-more': {
      const session = sessionFor(p);
      state.limit = (state.limit || state.settings.resultsPerPage) + state.settings.resultsPerPage;
      session.extend(adaptersFor(p.q, p, session.page + 1));
      break;
    }
    case 'open': go('search', { ...state.route.params, id }); break;
    case 'close-panel': go('search', { ...state.route.params, id: undefined }); break;
    case 'select': {
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      el.classList.toggle('selected', state.selected.has(id));
      $('.sel', el).innerHTML = state.selected.has(id) ? I.check : '';
      const bar = $('.bulk-bar'); if (bar) bar.outerHTML = bulkBar();
      break;
    }
    case 'select-all': $$('.img-card').forEach((c) => state.selected.add(c.dataset.id)); render(true); break;
    case 'bulk-describe': {
      const ids = [...state.selected].map((x) => x.replace(/^library:/, '')).filter((x) => memeById(x) && !state.queue.includes(x));
      state.queue.push(...ids); runQueue(); toast(`Queued ${ids.length} memes`);
      break;
    }
    case 'bulk-tag': {
      const t = prompt('Tag to add to the selected memes:'); if (!t) break;
      for (const sid of state.selected) { const mm = memeById(sid.replace(/^library:/, '')); if (mm) await saveMemeFields(mm, { tags: [...new Set([...(mm.tags || []), t.trim().toLowerCase()])] }); }
      await refreshLibrary(); toast(`Tagged ${state.selected.size} memes`);
      break;
    }
    case 'bulk-delete': {
      if (!confirm(`Remove ${state.selected.size} memes from My memes?`)) break;
      for (const sid of state.selected) { const mm = memeById(sid.replace(/^library:/, '')); if (mm) await deleteMeme(mm); }
      state.selected.clear(); await refreshLibrary();
      break;
    }
    case 'describe': if (m) { state.queue.unshift(m.id); runQueue(); } break;
    case 'save': {
      if (!m) break;
      await saveMemeFields(m, { description: $('#d-desc').value.trim(), text: $('#d-text').value.trim() });
      $('#d-saved').textContent = 'Saved'; $('#d-saved').className = 'status ok';
      setTimeout(() => refreshLibrary(), 400);
      break;
    }
    case 'rm-tag': if (m) { await saveMemeFields(m, { tags: (m.tags || []).filter((t) => t !== el.dataset.tag) }); await refreshLibrary(); } break;
    case 'reset': if (m) { await resetOverride(m); await refreshLibrary(); toast('Edits reset'); } break;
    case 'delete': {
      if (!m) break;
      if (!confirm(m.source === 'upload' ? `Delete "${m.filename}" permanently?` : `Remove "${m.filename}" from My memes?`)) break;
      await deleteMeme(m); state.itemsById.delete(`library:${m.id}`); await reload(); registerLibrary(); state.sessions.clear();
      go('search', { ...state.route.params, id: undefined }); toast('Removed');
      break;
    }
    case 'save-remote': if (it) await saveRemote(it, statusEl); break;
    case 'download': {
      const src = m ? m.url : it?.image; if (!src) break;
      try {
        const blob = m?.blob || await (await fetch(src)).blob();
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = m ? m.filename : `${(it.title || 'meme').replace(/[^a-z0-9]+/gi, '_').slice(0, 50)}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      } catch { window.open(src, '_blank', 'noopener'); }
      break;
    }
    case 'copy': {
      const src = m ? m.url : it?.image; if (!src) break;
      try {
        let blob = m?.blob || await (await fetch(src)).blob();
        if (blob.type !== 'image/png') blob = await toPng(blob);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Image copied to clipboard');
      } catch (err) { console.error(err); toast('Copy failed: ' + (err.message || err)); }
      break;
    }
    case 'find-similar': {
      const src = m || it; if (!src) break;
      const q = (m ? [m.text, ...(m.tags || [])].filter(Boolean).join(' ') : it.title).split(/\s+/).slice(0, 8).join(' ');
      go('search', { q, tab: 'images' });
      break;
    }
    case 'rename-tag': {
      const from = el.dataset.tag; const to = prompt(`Rename tag "${from}" to:`, from)?.trim().toLowerCase();
      if (!to || to === from) break;
      for (const mm of state.lib) if ((mm.tags || []).includes(from)) await saveMemeFields(mm, { tags: [...new Set(mm.tags.map((t) => (t === from ? to : t)))] });
      await refreshLibrary();
      break;
    }
    case 'delete-tag': {
      const t = el.dataset.tag; if (!confirm(`Delete tag "${t}" from all memes?`)) break;
      for (const mm of state.lib) if ((mm.tags || []).includes(t)) await saveMemeFields(mm, { tags: mm.tags.filter((x) => x !== t) });
      await refreshLibrary();
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
        await getCaptioner(state.settings.model, (pp) => { if (pp.status === 'progress') { st.textContent = `${pp.pct}% (${Math.round(pp.loaded / 1048576)} MB)`; pr.firstElementChild.style.width = pp.pct + '%'; } });
        st.textContent = 'Model ready'; st.className = 'status ok';
      } catch (err) { st.textContent = 'Failed: ' + (err.message || err); st.className = 'status err'; }
      pr.classList.add('hidden');
      break;
    }
    case 'reset-sources': {
      state.settings.lemmyCommunities = EXTRA_DEFAULTS.lemmyCommunities; state.settings.redditSubs = EXTRA_DEFAULTS.redditSubs;
      saveSettings(state.settings); state.sessions.clear(); render(true);
      break;
    }
    case 'rescan': {
      const ovs = await idb.getAll('overrides');
      for (const o of ovs) if (o.hidden) { delete o.hidden; await idb.put('overrides', o); }
      await refreshLibrary(); toast(`${state.lib.length} memes in My memes`);
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
      if (!confirm('Delete all uploads, saved memes, edits and cached embeddings in this browser? Bundled memes stay.')) break;
      await clearLibrary(); state.vectors.clear(); await refreshLibrary(); toast('Library cleared');
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
async function render(force = false) {
  const token = ++renderToken;
  const prev = state.route;
  state.route = parseRoute();
  const app = $('#app');
  if (state.route.name !== 'search') state.limit = 0;
  const p = state.route.params;
  document.title = state.route.name === 'search' && p.q ? `${p.q} - Memegle` : 'Memegle';
  const prevScroll = window.scrollY;
  // only the open panel changed: patch instead of re-rendering the whole page
  if (!force && state.route.name === 'search' && prev.name === 'search' && $('#results-body') && sameExcept(prev.params, p, ['id'])) {
    $('.results').classList.toggle('with-panel', Boolean(p.id));
    renderPanel($('#panel'), p.id);
    $$('.img-card.active').forEach((c) => c.classList.remove('active'));
    if (p.id) $(`.img-card[data-id="${CSS.escape(p.id)}"]`)?.classList.add('active');
    return;
  }
  if (state.route.name !== 'search' && state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
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
  if (state.route.name === 'search' && (p.id || force)) window.scrollTo(0, prevScroll);
  else window.scrollTo(0, 0);
}
function sameExcept(a, b, keys) {
  const ka = Object.keys(a).filter((k) => !keys.includes(k)); const kb = Object.keys(b).filter((k) => !keys.includes(k));
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function bindGlobal() {
  document.addEventListener('mousedown', (e) => { $$('.searchbox.focus').forEach((sb) => { if (!sb.contains(e.target)) sb.classList.remove('focus'); }); });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && !el.matches('a[href]')) { e.preventDefault(); onAction(el.dataset.action, el, e); return; }
    if (!e.target.closest('#apps-menu') && !e.target.closest('[data-action=apps]')) $('#apps-menu')?.classList.add('hidden');
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-param]'); if (!el) return;
    go('search', { ...state.route.params, [el.dataset.param]: el.value, id: undefined });
  });
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(tag)) { e.preventDefault(); $('.searchbox input')?.focus(); }
    if (e.key === 'Escape' && state.route.name === 'search' && state.route.params.id && !/INPUT|TEXTAREA/.test(tag)) go('search', { ...state.route.params, id: undefined });
  });
  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    e.preventDefault(); handleFiles(files);
  });
  document.addEventListener('dragover', (e) => { if (state.route.name !== 'upload') e.preventDefault(); });
  document.addEventListener('drop', (e) => { if (state.route.name === 'upload') return; e.preventDefault(); const files = [...(e.dataTransfer?.files || [])]; if (files.length) handleFiles(files); });
  $('#file-input').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
  $('#lens-input').addEventListener('change', (e) => { if (e.target.files[0]) lensSearch(e.target.files[0]); e.target.value = ''; });
  $('#import-input').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const n = await importLibrary(await f.text()); await refreshLibrary(); toast(`Imported ${n} records`); }
    catch (err) { toast('Import failed: ' + (err.message || err)); }
  });
  window.addEventListener('hashchange', () => { state.limit = 0; render(); });
}

(async function main() {
  window.addEventListener('error', (e) => console.warn('[memegle] error', e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => console.warn('[memegle] rejection', e.reason && (e.reason.stack || e.reason)));
  applyTheme();
  const q = new URLSearchParams(location.search).get('q');
  if (q && !location.hash) history.replaceState(null, '', location.pathname + '#/search?q=' + encodeURIComponent(q));
  await reload();
  registerLibrary();
  bindGlobal();
  render();
})();
