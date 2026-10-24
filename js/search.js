// Memegle search: BM25 keyword search with prefix + phrase bonuses, fuzzy "did you mean",
// autocomplete suggestions and cosine ranking for vector mode.

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'is', 'it', 'at', 'for', 'with', 'this', 'that', 'my', 'me', 'i']);

export function stem(w) {
  if (w.length <= 3) return w;
  return w.replace(/(ings|ing|ies|ied|ers|ed|es|s)$/u, (m) => (m === 'ies' || m === 'ied' ? 'i' : ''));
}

export function tokenize(str, { keepStop = false } = {}) {
  const out = [];
  for (const raw of String(str || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9$#@]+/)) {
    if (!raw) continue;
    if (!keepStop && STOP.has(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

const FIELD_WEIGHTS = { text: 3, tags: 3, title: 2.2, description: 1, folder: 1 };
const K1 = 1.4; const B = 0.75;

export function buildIndex(memes) {
  const docs = [];
  const df = new Map();
  const vocab = new Map(); // stem -> { word (display form), df }
  let totalLen = 0;

  for (const m of memes) {
    const tf = new Map();
    const fields = {
      title: m.title || '',
      description: m.description || '',
      text: m.text || '',
      tags: (m.tags || []).join(' '),
      folder: (m.folder || '').replace(/[\/_-]/g, ' '),
    };
    let len = 0;
    for (const [field, value] of Object.entries(fields)) {
      const w = FIELD_WEIGHTS[field];
      const words = String(value).toLowerCase().split(/[^a-z0-9$#@]+/).filter(Boolean);
      for (const word of words) {
        if (STOP.has(word)) continue;
        const t = stem(word);
        tf.set(t, (tf.get(t) || 0) + w);
        len += w;
        const v = vocab.get(t);
        if (!v) vocab.set(t, { word, count: 1 });
        else { v.count++; if (word.length < v.word.length) v.word = word; }
      }
    }
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    const haystack = `${fields.title} ${fields.description} ${fields.text} ${fields.tags}`.toLowerCase();
    docs.push({ meme: m, tf, len, haystack });
    totalLen += len;
  }
  const N = docs.length || 1;
  const avgLen = totalLen / N || 1;
  const idf = new Map();
  for (const [t, d] of df) idf.set(t, Math.log(1 + (N - d + 0.5) / (d + 0.5)));
  const terms = [...df.keys()];
  return { docs, df, idf, avgLen, N, vocab, terms };
}

function scoreDoc(doc, qTokens, index, phrase) {
  let score = 0;
  let matched = 0;
  for (const q of qTokens) {
    const tf = doc.tf.get(q);
    if (tf) {
      const idf = index.idf.get(q) || 0.1;
      score += idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * doc.len / index.avgLen));
      matched++;
      continue;
    }
    if (q.length >= 3) {
      // prefix match: "deploy" vs "deployment"
      let best = 0;
      for (const [t, tf2] of doc.tf) {
        if (t.startsWith(q) || (q.length >= 5 && q.startsWith(t) && t.length >= 4)) {
          const idf = index.idf.get(t) || 0.1;
          const s = 0.55 * idf * (tf2 * (K1 + 1)) / (tf2 + K1 * (1 - B + B * doc.len / index.avgLen));
          if (s > best) best = s;
        }
      }
      if (best) { score += best; matched += 0.5; }
    }
  }
  if (phrase && doc.haystack.includes(phrase)) score *= 1.6;
  if (qTokens.length > 1) score *= 0.6 + 0.4 * (matched / qTokens.length);
  return matched ? score : 0;
}

export function search(index, query, { tags = [], folder = '', sort = 'relevance' } = {}) {
  const t0 = performance.now();
  const qTokens = [...new Set(tokenize(query))];
  const phrase = query.trim().toLowerCase();
  let results = [];
  for (const doc of index.docs) {
    const m = doc.meme;
    if (folder && m.folder !== folder && !m.folder.startsWith(folder + '/')) continue;
    if (tags.length && !tags.every((t) => (m.tags || []).map((x) => x.toLowerCase()).includes(t.toLowerCase()))) continue;
    if (!qTokens.length) { results.push({ meme: m, score: 0 }); continue; }
    const s = scoreDoc(doc, qTokens, index, phrase.length >= 4 ? phrase : null);
    if (s > 0) results.push({ meme: m, score: s });
  }
  if (sort === 'newest' || !qTokens.length) results.sort((a, b) => (b.meme.created || 0) - (a.meme.created || 0) || a.meme.title.localeCompare(b.meme.title));
  else results.sort((a, b) => b.score - a.score);
  return { results, ms: performance.now() - t0, tokens: qTokens };
}

// ---------- fuzzy / did you mean ----------
function levenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array(b.length + 1); const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

export function didYouMean(index, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = words.map((w) => {
    const t = stem(w.replace(/[^a-z0-9$#@]/g, ''));
    if (!t || STOP.has(w) || index.df.has(t)) return w;
    let best = null; let bestD = 3; let bestC = 0;
    for (const [term, info] of index.vocab) {
      const d = levenshtein(t, term);
      if (d < bestD || (d === bestD && info.count > bestC)) { best = info.word; bestD = d; bestC = info.count; }
    }
    if (best && bestD <= 2) { changed = true; return best; }
    return w;
  });
  return changed ? out.join(' ') : null;
}

// ---------- autocomplete ----------
export function suggestions(index, memes, query, history, limit = 8) {
  const q = query.trim().toLowerCase();
  const out = [];
  const seen = new Set();
  const push = (text, kind, meme) => {
    const key = text.toLowerCase();
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({ text, kind, meme });
  };
  if (!q) {
    for (const h of history.slice(0, 6)) push(h, 'history');
    return out;
  }
  for (const h of history) if (h.toLowerCase().includes(q)) push(h, 'history');
  // tags
  const tagCounts = new Map();
  for (const m of memes) for (const t of m.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([t]) => { if (t.toLowerCase().includes(q)) push(t, 'tag'); });
  // meme titles / text
  for (const m of memes) {
    if ((m.text || '').toLowerCase().includes(q)) push(m.text.length > 60 ? m.text.slice(0, 57) + '...' : m.text, 'meme', m);
    else if ((m.title || '').toLowerCase().includes(q)) push(m.title, 'meme', m);
  }
  // vocabulary completions of the last word
  const parts = q.split(/\s+/);
  const last = parts[parts.length - 1];
  const prefix = parts.slice(0, -1).join(' ');
  const cands = [...index.vocab.values()].filter((v) => v.word.startsWith(last) && v.word !== last)
    .sort((a, b) => b.count - a.count);
  for (const c of cands) push((prefix ? prefix + ' ' : '') + c.word, 'search');
  return out;
}

// ---------- highlight ----------
export function highlight(text, qTokens) {
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  if (!text) return '';
  if (!qTokens.length) return esc(text);
  return esc(text).replace(/[A-Za-z0-9$#@]+/g, (w) => {
    const s = stem(w.toLowerCase());
    return qTokens.some((q) => s === q || (q.length >= 3 && s.startsWith(q))) ? `<b>${w}</b>` : w;
  });
}

// ---------- vector ----------
export function cosine(a, b) {
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export function rankByVector(memes, vectors, queryVec, { tags = [], folder = '', min = 0.18 } = {}) {
  const t0 = performance.now();
  const results = [];
  for (const m of memes) {
    if (folder && m.folder !== folder && !m.folder.startsWith(folder + '/')) continue;
    if (tags.length && !tags.every((t) => (m.tags || []).map((x) => x.toLowerCase()).includes(t.toLowerCase()))) continue;
    const v = vectors.get(m.id);
    if (!v) continue;
    const s = cosine(queryVec, v);
    if (s >= min) results.push({ meme: m, score: s });
  }
  results.sort((a, b) => b.score - a.score);
  return { results, ms: performance.now() - t0 };
}

export function embeddingText(m) {
  return [m.title, m.text, m.description, (m.tags || []).join(', ')].filter(Boolean).join('. ');
}

export function hashText(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
