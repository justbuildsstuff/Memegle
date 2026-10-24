// Memegle live sources: everything here runs in the browser against public APIs (no server).
// Each adapter returns normalized items:
// { id, source, kind: 'image'|'gif'|'template', title, body, image, thumb, width, height, url, site, path,
//   author, score, comments, created, nsfw, tags }
import { tokenize, stem } from './search.js?v=11';

export const SOURCE_INFO = {
  lemmy: { label: 'Lemmy', site: 'lemmy.world', needsKey: false, desc: 'Meme communities across the Fediverse (memes, dankmemes, programmer humor, comics...)' },
  reddit: { label: 'Reddit', site: 'reddit.com', needsKey: false, desc: 'Hot posts from r/memes, r/dankmemes, r/me_irl and friends via meme-api.com (Reddit blocks direct browser access)' },
  imgflip: { label: 'Imgflip templates', site: 'imgflip.com', needsKey: false, desc: 'The 100 most popular meme templates right now' },
  tenor: { label: 'Tenor GIFs', site: 'tenor.com', needsKey: true, keyName: 'tenorKey', keyUrl: 'https://developers.google.com/tenor/guides/quickstart', desc: "Google's GIF search. Free API key from Google Cloud." },
  giphy: { label: 'Giphy', site: 'giphy.com', needsKey: true, keyName: 'giphyKey', keyUrl: 'https://developers.giphy.com/dashboard/', desc: 'GIF and sticker search. Free API key.' },
  imgur: { label: 'Imgur', site: 'imgur.com', needsKey: true, keyName: 'imgurClientId', keyUrl: 'https://api.imgur.com/oauth2/addclient', desc: 'Imgur gallery search. Free Client-ID.' },
  bluesky: { label: 'Bluesky', site: 'bsky.app', needsKey: false, desc: 'Bluesky posts with images or GIFs that say "meme" or carry #memes, ranked by likes' },
  mastodon: { label: 'Mastodon', site: 'mastodon.social', needsKey: false, desc: 'Media posts under #memes, #dankmemes, #shitpost and the hashtag of your search on mastodon.social' },
  library: { label: 'My memes', site: 'memegle', needsKey: false, desc: 'Memes you uploaded or saved in this browser' },
  lemmy_global: { label: 'Lemmy (all meme communities)', site: 'lemmy.world', hidden: true, parent: 'lemmy' },
};
// Instances whose full-text search is queried for image posts in any meme-like community.
export const LEMMY_GLOBAL_HOSTS = ['lemmy.world', 'lemmy.ml', 'sh.itjust.works', 'lemmy.dbzer0.com', 'lemmy.blahaj.zone', 'sopuli.xyz', 'programming.dev'];
const MEME_COMMUNITY_RE = /meme|humor|humour|shitpost|comic|funny|dank|_irl|irl$|joke|cursed|lmao|lol|wholesome|greentext|satire|parody|absurd|onehundredninetysix|^196|clevercomebacks|antiquememes|fakehistory|dumb|silly|chaotic|unix_surrealism|programmerhumor|tenforward|risa/i;
export const DEFAULT_MASTODON_TAGS = ['memes', 'meme', 'dankmemes', 'shitpost', 'funny'];

// name@instance, searched through lemmy.world (federated) unless the community's own instance is listed as host.
export const DEFAULT_LEMMY_COMMUNITIES = [
  'memes@lemmy.ml', 'memes@lemmy.world', 'memes@sopuli.xyz', 'lemmyshitpost@lemmy.world', 'dankmemes@lemmy.world',
  'me_irl@lemmy.world', 'linuxmemes@lemmy.world', 'programmer_humor@programming.dev', 'programmerhumor@lemmy.ml',
  'science_memes@mander.xyz', 'microblogmemes@lemmy.world', 'antiquememesroadshow@lemmy.world', 'comicstrips@lemmy.world',
  'starwarsmemes@lemmy.world', 'rpgmemes@ttrpg.network', 'lotrmemes@midwest.social', '196@lemmy.blahaj.zone',
  'memes@sh.itjust.works', 'memes@lemmy.dbzer0.com', 'wholesomememes@lemmy.world', 'historymemes@lemmy.world', 'fakehistoryporn@lemmy.world',
  'tenforward@lemmy.world', 'risa@startrek.website', 'clevercomebacks@lemmy.world', 'animemes@ani.social', 'dach@feddit.org',
];
const LEMMY_SELF_HOSTS = new Set(['lemmy.ml', 'sopuli.xyz', 'programming.dev', 'sh.itjust.works', 'lemmy.dbzer0.com', 'lemmy.blahaj.zone']);
export const DEFAULT_REDDIT_SUBS = ['memes', 'dankmemes', 'me_irl', 'wholesomememes', 'ProgrammerHumor', 'AdviceAnimals', 'HistoryMemes', 'PrequelMemes'];

const IMG_RE = /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i;
const cache = new Map();

function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.t + ttlMs > Date.now()) return hit.p;
  const p = fn().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { t: Date.now(), p });
  return p;
}

async function getJSON(url, { headers, timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export function favicon(host) { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`; }
export function hostOf(url) { try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; } }

function stripMarkdown(s) {
  return String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#]+/g, '')
    .replace(/:::\s*spoiler[^\n]*/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- relevance
const GENERIC = /^(meme|memes|mem|funny|funni|lol|pic|picture|image|img)$/;
export function meaningfulTokens(q) {
  const all = [...new Set(tokenize(q))];
  const m = all.filter((t) => !GENERIC.test(t));
  return m.length ? m : all;
}
export function cleanQuery(q) {
  const words = q.trim().split(/\s+/);
  const kept = words.filter((w) => !GENERIC.test(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return kept.length ? kept.join(' ') : q.trim();
}
export function relevance(item, qTokens, phrase) {
  if (!qTokens.length) return 0;
  const title = (item.title || '').toLowerCase();
  const body = (item.text || item.body || '').toLowerCase();
  const tags = (item.tags || []).join(' ').toLowerCase();
  const tTok = new Set(tokenize(title));
  const bTok = new Set(tokenize(body + ' ' + tags));
  let hit = 0; let partial = 0;
  for (const q of qTokens) {
    if (tTok.has(q)) hit += 1;
    else if (bTok.has(q)) hit += 0.6;
    else if ([...tTok].some((t) => (q.length >= 4 && t.startsWith(q)) || (q.length > 4 && q.startsWith(t) && t.length > 3))) partial += 0.4;
  }
  let s = (hit + partial) / qTokens.length;
  if (phrase && (title.includes(phrase) || body.includes(phrase))) s += 0.5;
  if (hit >= qTokens.length) s += 0.3;
  return s;
}

export function rank(items, q, { sort = 'relevance' } = {}) {
  const qTokens = meaningfulTokens(q);
  const phrase = q.trim().toLowerCase();
  const now = Date.now();
  for (const it of items) {
    const rel = relevance(it, qTokens, phrase.length >= 4 ? phrase : null);
    const pop = Math.log10((it.score || 0) + 1) / 5;
    const ageDays = it.created ? Math.max(0, (now - it.created) / 86400000) : 365;
    const fresh = Math.max(0, 1 - ageDays / 730) * 0.15;
    const src = it.source === 'imgflip' ? 0.35 : 0;
    it.rel = rel;
    it.rankScore = rel * 2 + pop + fresh + src;
  }
  // drop posts that only matched a generic word like "meme" (keyed GIF APIs rank server-side, keep them)
  const generic = !qTokens.some((t) => !GENERIC.test(t));
  if (qTokens.length && !generic) items = items.filter((it) => it.rel > 0 || it.source === 'tenor' || it.source === 'giphy' || it.source === 'mastodon' || it.source === 'bluesky');
  if (sort === 'newest') items.sort((a, b) => (b.created || 0) - (a.created || 0));
  else if (sort === 'top') items.sort((a, b) => (b.score || 0) - (a.score || 0));
  else items.sort((a, b) => b.rankScore - a.rankScore);
  return items;
}

export function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k1 = (it.image || '').replace(/^https?:\/\//, '').replace(/\?.*$/, '').toLowerCase();
    const k2 = `${(it.title || '').toLowerCase().replace(/\W+/g, ' ').trim()}|${it.path}`;
    if (seen.has(k1) || (it.title && seen.has(k2))) continue;
    seen.add(k1); seen.add(k2);
    out.push(it);
  }
  return out;
}

// ---------------------------------------------------------------- Lemmy
function lemmyItem(p, instanceLabel, { strict = false } = {}) {
  const post = p.post; const c = p.community; const counts = p.counts || {};
  const url = post.url || '';
  const isImg = /^image\//.test(post.url_content_type || '') || IMG_RE.test(url) || /\/pictrs\/image\//.test(url);
  if (!isImg) return null;
  if (strict && !MEME_COMMUNITY_RE.test(`${c.name} ${c.title || ''}`) && !/\bmemes?\b/i.test(post.name)) return null;
  const image = url;
  if (!image) return null;
  const fullText = stripMarkdown(post.body);
  const host = hostOf(post.ap_id) || instanceLabel;
  return {
    id: `lemmy:${post.ap_id}`,
    source: 'lemmy',
    kind: /\.gif(\?|$)/i.test(image) ? 'gif' : 'image',
    title: post.name,
    body: fullText.slice(0, 240) || (post.alt_text || ''),
    text: `${fullText} ${post.alt_text || ''} ${c.title || ''}`.trim(),
    image,
    thumb: post.thumbnail_url || image,
    url: post.ap_id,
    site: host,
    path: `c/${c.name}`,
    community: `${c.name}@${hostOf(c.actor_id)}`,
    author: p.creator?.name,
    score: counts.score || 0,
    comments: counts.comments || 0,
    created: Date.parse(post.published) || 0,
    nsfw: Boolean(post.nsfw || c.nsfw),
    tags: [],
  };
}

function lemmyTarget(community) {
  const [name, instance] = community.split('@');
  if (LEMMY_SELF_HOSTS.has(instance)) return { host: instance, name };
  return { host: 'lemmy.world', name: instance === 'lemmy.world' ? name : community };
}

export async function searchLemmy(q, { communities = DEFAULT_LEMMY_COMMUNITIES, sort = 'relevance', page = 1, limit = 40, onPartial } = {}) {
  const lsort = sort === 'newest' ? 'New' : 'TopAll';
  const results = await Promise.allSettled(communities.map(async (community) => {
    const { host, name } = lemmyTarget(community);
    const u = `https://${host}/api/v3/search?q=${encodeURIComponent(cleanQuery(q))}&type_=Posts&sort=${lsort}&limit=${limit}&page=${page}&community_name=${encodeURIComponent(name)}`;
    const data = await cached(u, 5 * 60000, () => getJSON(u));
    const items = (data.posts || []).map((p) => lemmyItem(p, host)).filter(Boolean);
    onPartial?.(items);
    return items;
  }));
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { items, failed, total: communities.length };
}

// Full-text search on several instances, kept to image posts in meme-like communities.
export async function searchLemmyGlobal(q, { hosts = LEMMY_GLOBAL_HOSTS, sort = 'relevance', page = 1, limit = 50, onPartial } = {}) {
  const lsort = sort === 'newest' ? 'New' : 'TopAll';
  const apiPages = [page * 2 - 1, page * 2];
  const jobs = hosts.flatMap((host) => apiPages.map((ap) => [host, ap]));
  const results = await Promise.allSettled(jobs.map(async ([host, ap]) => {
    const u = `https://${host}/api/v3/search?q=${encodeURIComponent(cleanQuery(q))}&type_=Posts&sort=${lsort}&limit=${limit}&page=${ap}`;
    const data = await cached(u, 5 * 60000, () => getJSON(u, { timeout: 15000 }));
    const items = (data.posts || []).map((p) => lemmyItem(p, host, { strict: true })).filter(Boolean);
    onPartial?.(items);
    return items;
  }));
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return { items, failed: results.filter((r) => r.status === 'rejected').length, total: jobs.length };
}

export async function trendingLemmy({ communities = DEFAULT_LEMMY_COMMUNITIES.slice(0, 12), limit = 25 } = {}) {
  const results = await Promise.allSettled(communities.map(async (community) => {
    const { host, name } = lemmyTarget(community);
    const u = `https://${host}/api/v3/post/list?community_name=${encodeURIComponent(name)}&sort=Hot&limit=${limit}`;
    const data = await cached(u, 10 * 60000, () => getJSON(u));
    return (data.posts || []).filter((p) => !p.post.featured_community).map((p) => lemmyItem(p, host)).filter(Boolean);
  }));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

// ---------------------------------------------------------------- Bluesky (public AppView, CORS enabled, no key)
const BSKY_HOSTS = ['api.bsky.app', 'public.api.bsky.app'];
const BSKY_NSFW = /^(porn|sexual|nudity|graphic-media|gore)$/;
function bskyItems(posts) {
  const out = [];
  for (const post of posts || []) {
    const rec = post.record || {};
    const text = String(rec.text || '').replace(/\s+/g, ' ').trim();
    const handle = post.author?.handle || 'unknown';
    const rkey = String(post.uri || '').split('/').pop();
    const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
    const labels = [...(post.labels || []), ...(rec.labels?.values || [])].map((l) => l.val || '');
    const nsfw = labels.some((v) => BSKY_NSFW.test(v));
    const tags = (rec.tags || []).concat((rec.facets || []).flatMap((f) => (f.features || []).filter((x) => x.tag).map((x) => x.tag))).map((t) => String(t).toLowerCase());
    const title = (text.replace(/https?:\/\/\S+/g, '').replace(/#\w+/g, '').trim() || `Post by @${handle}`).slice(0, 160);
    const base = {
      source: 'bluesky', title, body: '', text: `${text} ${tags.join(' ')}`, url, site: 'bsky.app', path: `@${handle}`,
      author: post.author?.displayName || handle, score: (post.likeCount || 0) + (post.repostCount || 0), comments: post.replyCount || 0,
      created: Date.parse(post.indexedAt || rec.createdAt) || 0, nsfw, tags,
    };
    const embed = post.embed || {};
    const images = embed.images || embed.media?.images || [];
    images.forEach((im, i) => out.push({
      ...base, id: `bsky:${post.uri}#${i}`, kind: 'image', image: im.fullsize, thumb: im.thumb || im.fullsize,
      width: im.aspectRatio?.width, height: im.aspectRatio?.height, body: im.alt || '', text: `${base.text} ${im.alt || ''}`,
    }));
    const ext = embed.external || embed.media?.external;
    if (ext && /media\.tenor\.com|\.gif(\?|$)/i.test(ext.uri || '') && (ext.thumb || ext.uri)) {
      const m = /[?&]ww=(\d+)&hh=(\d+)/.exec(ext.uri || '');
      out.push({ ...base, id: `bsky:${post.uri}#gif`, kind: 'gif', image: ext.uri, thumb: ext.thumb || ext.uri, width: m ? +m[1] : undefined, height: m ? +m[2] : undefined, body: ext.title || '' });
    }
  }
  return out;
}
async function bskyGet(params) {
  let err;
  for (const host of BSKY_HOSTS) {
    const u = `https://${host}/xrpc/app.bsky.feed.searchPosts?${params}`;
    try { return await cached(u, 5 * 60000, () => getJSON(u, { timeout: 10000 })); } catch (e) { err = e; }
  }
  throw err;
}
export async function searchBluesky(q, { sort = 'relevance', cursor = '', limit = 50, onPartial } = {}) {
  const base = cleanQuery(q);
  const bsort = sort === 'newest' ? 'latest' : 'top';
  // two views: posts that say "meme", and posts tagged #memes
  const queries = [
    `q=${encodeURIComponent(base + ' meme')}&sort=${bsort}&limit=${limit}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`,
    `q=${encodeURIComponent(base)}&tag=memes&sort=${bsort}&limit=${limit}`,
    `q=${encodeURIComponent(base)}&tag=meme&sort=${bsort}&limit=${Math.min(limit, 25)}`,
  ];
  const results = await Promise.allSettled(queries.map(async (p, i) => {
    const d = await bskyGet(p);
    const items = bskyItems(d.posts);
    onPartial?.(items);
    return { items, cursor: i === 0 ? d.cursor : undefined };
  }));
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value.items : []));
  const next = results[0].status === 'fulfilled' ? results[0].value.cursor : '';
  return { items, next, failed: results.filter((r) => r.status === 'rejected').length, total: queries.length };
}
export async function trendingBluesky({ limit = 50 } = {}) {
  const results = await Promise.allSettled([
    bskyGet(`q=meme&tag=memes&sort=top&limit=${limit}`),
    bskyGet(`q=memes&sort=latest&limit=${limit}`),
    bskyGet(`q=meme&tag=dankmemes&sort=top&limit=25`),
  ]);
  return results.flatMap((r) => (r.status === 'fulfilled' ? bskyItems(r.value.posts) : []));
}

// ---------------------------------------------------------------- Mastodon hashtag timelines (public, CORS enabled)
const MASTO_MEME_TAG_RE = /meme|shitpost|humor|humour|funny|dank|lol|joke/i;
function htmlToText(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(String(html).replace(/<br\s*\/?>|<\/p>/gi, ' '), 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}
function mastodonItems(statuses, { requireMemeTag = false } = {}) {
  const out = [];
  for (const s of statuses) {
    const st = s.reblog || s;
    const text = htmlToText(st.content);
    const tags = (st.tags || []).map((t) => t.name.toLowerCase());
    if (requireMemeTag && !tags.some((t) => MASTO_MEME_TAG_RE.test(t)) && !/\bmemes?\b/i.test(text)) continue;
    for (const m of st.media_attachments || []) {
      if (m.type !== 'image' && m.type !== 'gifv') continue;
      const image = m.type === 'gifv' ? (m.preview_url || m.url) : m.url;
      if (!image) continue;
      const title = (text.replace(/#\w+/g, '').trim() || m.description || `#${tags[0] || 'meme'}`).slice(0, 140);
      out.push({
        id: `masto:${st.url || st.uri}#${m.id}`, source: 'mastodon', kind: m.type === 'gifv' ? 'gif' : 'image',
        title, body: m.description || '', text: `${text} ${tags.join(' ')} ${m.description || ''}`, image, thumb: m.preview_url || image,
        width: m.meta?.original?.width, height: m.meta?.original?.height,
        url: st.url || st.uri, site: hostOf(st.url || st.uri) || 'mastodon.social', path: tags.length ? `#${tags[0]}` : 'post',
        author: st.account?.acct, score: (st.favourites_count || 0) + (st.reblogs_count || 0), comments: st.replies_count || 0,
        created: Date.parse(st.created_at) || 0, nsfw: Boolean(st.sensitive), tags,
      });
    }
  }
  return out;
}
export async function trendingMastodon({ tags = DEFAULT_MASTODON_TAGS, host = 'mastodon.social', limit = 40 } = {}) {
  const results = await Promise.allSettled(tags.map((tag) => {
    const u = `https://${host}/api/v1/timelines/tag/${encodeURIComponent(tag)}?only_media=true&limit=${limit}`;
    return cached(u, 5 * 60000, () => getJSON(u)).then((d) => mastodonItems(d));
  }));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
export async function searchMastodon(q, { host = 'mastodon.social', limit = 40 } = {}) {
  const tag = cleanQuery(q).toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!tag || tag.length < 3) return { items: [] };
  const tags = [tag, `${tag}meme`, `${tag}memes`];
  const results = await Promise.allSettled(tags.map((t, i) => {
    const u = `https://${host}/api/v1/timelines/tag/${encodeURIComponent(t)}?only_media=true&limit=${limit}`;
    return cached(u, 5 * 60000, () => getJSON(u)).then((d) => mastodonItems(d, { requireMemeTag: i === 0 }));
  }));
  return { items: results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])), failed: results.filter((r) => r.status === 'rejected').length, total: tags.length };
}

// ---------------------------------------------------------------- Reddit (via meme-api.com)
function redditItem(m) {
  if (!m.url || !IMG_RE.test(m.url)) return null;
  const id = (m.postLink || '').split('/').pop();
  return {
    id: `reddit:${id || m.url}`,
    source: 'reddit',
    kind: /\.gif(\?|$)/i.test(m.url) ? 'gif' : 'image',
    title: m.title,
    body: '',
    image: m.url,
    thumb: (m.preview && m.preview[Math.min(2, m.preview.length - 1)]) || m.url,
    url: m.postLink,
    site: 'reddit.com',
    path: `r/${m.subreddit}`,
    author: m.author,
    score: m.ups || 0,
    comments: 0,
    created: 0,
    nsfw: Boolean(m.nsfw || m.spoiler),
    tags: [],
  };
}

export async function fetchRedditPool({ subs = DEFAULT_REDDIT_SUBS, count = 50 } = {}) {
  const results = await Promise.allSettled(subs.map((sub) => {
    const u = `https://meme-api.com/gimme/${encodeURIComponent(sub)}/${count}`;
    return cached(u, 10 * 60000, () => getJSON(u, { timeout: 15000 })).then((d) => (d.memes || []).map(redditItem).filter(Boolean));
  }));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

export async function searchReddit(q, opts = {}) {
  const pool = await fetchRedditPool(opts);
  const qTokens = [...new Set(tokenize(q))];
  const items = pool.filter((it) => relevance(it, qTokens, null) >= 0.4);
  return { items, poolSize: pool.length };
}

// ---------------------------------------------------------------- Imgflip templates
export async function fetchImgflip() {
  return cached('imgflip', 60 * 60000, async () => {
    const d = await getJSON('https://api.imgflip.com/get_memes');
    return (d.data?.memes || []).map((m, i) => ({
      id: `imgflip:${m.id}`,
      source: 'imgflip',
      kind: 'template',
      title: m.name,
      body: `Meme template with ${m.box_count} text box${m.box_count === 1 ? '' : 'es'}. Rank #${i + 1} on Imgflip right now.`,
      image: m.url,
      thumb: m.url,
      width: m.width,
      height: m.height,
      url: `https://imgflip.com/meme/${m.id}`,
      captionUrl: `https://imgflip.com/memegenerator/${m.id}`,
      site: 'imgflip.com',
      path: 'meme templates',
      score: 100 - i,
      created: 0,
      nsfw: false,
      tags: ['template'],
      rank: i + 1,
    }));
  });
}

export async function searchImgflip(q) {
  const all = await fetchImgflip();
  const qTokens = [...new Set(tokenize(q))];
  const phrase = q.trim().toLowerCase();
  return { items: all.filter((t) => relevance(t, qTokens, phrase) >= 0.5 || t.title.toLowerCase().includes(phrase)) };
}

// ---------------------------------------------------------------- Tenor v2 (Google)
export async function searchTenor(q, { key, safe = true, pos = '', limit = 30 } = {}) {
  if (!key) return { items: [], skipped: true };
  const u = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}&client_key=memegle&limit=${limit}&media_filter=gif,tinygif&contentfilter=${safe ? 'medium' : 'off'}${pos ? '&pos=' + encodeURIComponent(pos) : ''}`;
  const d = await cached(u, 5 * 60000, () => getJSON(u));
  const items = (d.results || []).map((r) => {
    const gif = r.media_formats?.gif || r.media_formats?.mediumgif; const tiny = r.media_formats?.tinygif || gif;
    if (!gif) return null;
    return {
      id: `tenor:${r.id}`, source: 'tenor', kind: 'gif', title: r.title || r.content_description || r.h1_title || 'GIF',
      body: (r.tags || []).join(', '), image: gif.url, thumb: tiny.url, width: gif.dims?.[0], height: gif.dims?.[1],
      url: r.itemurl || r.url, site: 'tenor.com', path: 'gifs', score: 0, created: (r.created || 0) * 1000, nsfw: false, tags: r.tags || [],
    };
  }).filter(Boolean);
  return { items, next: d.next };
}
export async function tenorAutocomplete(q, key) {
  if (!key || !q) return [];
  try {
    const d = await getJSON(`https://tenor.googleapis.com/v2/autocomplete?q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}&client_key=memegle&limit=6`);
    return d.results || [];
  } catch { return []; }
}
export async function tenorTrendingTerms(key) {
  if (!key) return [];
  try {
    const d = await cached('tenor-trending', 30 * 60000, () => getJSON(`https://tenor.googleapis.com/v2/trending_terms?key=${encodeURIComponent(key)}&client_key=memegle&limit=10`));
    return d.results || [];
  } catch { return []; }
}

// ---------------------------------------------------------------- Giphy
export async function searchGiphy(q, { key, safe = true, offset = 0, limit = 25 } = {}) {
  if (!key) return { items: [], skipped: true };
  const u = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=${safe ? 'pg-13' : 'r'}&lang=en`;
  const d = await cached(u, 5 * 60000, () => getJSON(u));
  const items = (d.data || []).map((g) => ({
    id: `giphy:${g.id}`, source: 'giphy', kind: 'gif', title: g.title || 'GIF', body: g.alt_text || '', image: g.images?.original?.url,
    thumb: g.images?.fixed_width?.url || g.images?.original?.url, width: +g.images?.original?.width || 0, height: +g.images?.original?.height || 0,
    url: g.url, site: 'giphy.com', path: 'gifs', author: g.username, score: 0, created: Date.parse(g.import_datetime) || 0,
    nsfw: g.rating === 'r', tags: [],
  })).filter((x) => x.image);
  return { items, next: offset + items.length };
}

// ---------------------------------------------------------------- Imgur
export async function searchImgur(q, { clientId, safe = true, page = 1 } = {}) {
  if (!clientId) return { items: [], skipped: true };
  const u = `https://api.imgur.com/3/gallery/search/top/all/${page}?q=${encodeURIComponent(q + ' meme')}${safe ? '&mature=false' : ''}`;
  const d = await cached(u, 5 * 60000, () => getJSON(u, { headers: { Authorization: `Client-ID ${clientId}` } }));
  const items = (d.data || []).map((g) => {
    const img = g.is_album ? (g.images || [])[0] : g;
    if (!img || !img.link || !/^image\//.test(img.type || '')) return null;
    return {
      id: `imgur:${g.id}`, source: 'imgur', kind: /gif/.test(img.type) ? 'gif' : 'image', title: g.title || img.title || 'Imgur post',
      body: g.description || img.description || '', image: img.link, thumb: `https://i.imgur.com/${img.id}m.jpg`, width: img.width, height: img.height,
      url: g.link, site: 'imgur.com', path: 'gallery', author: g.account_url, score: g.ups || g.points || 0, comments: g.comment_count || 0,
      created: (g.datetime || 0) * 1000, nsfw: Boolean(g.nsfw), tags: (g.tags || []).map((t) => t.name),
    };
  }).filter(Boolean);
  return { items };
}

// ---------------------------------------------------------------- Wikipedia knowledge panel
export async function knowledgePanel(q) {
  const term = /meme/i.test(q) ? q : `${q} meme`;
  const u = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrlimit=1&prop=extracts|pageimages|info&inprop=url&exintro=1&explaintext=1&exsentences=3&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;
  try {
    const d = await cached(u, 60 * 60000, () => getJSON(u));
    const page = Object.values(d.query?.pages || {})[0];
    if (!page || !page.extract) return null;
    const qTokens = tokenize(q);
    const tTok = tokenize(page.title + ' ' + page.extract.slice(0, 300));
    const overlap = qTokens.filter((t) => tTok.includes(t)).length / Math.max(1, qTokens.length);
    if (overlap < 0.5) return null;
    if (!/\b(meme|memes|viral|internet|catchphrase|image macro|reaction|4chan|reddit|tiktok)\b/i.test(page.extract)) return null;
    return { title: page.title, extract: page.extract, thumb: page.thumbnail?.source, url: page.fullurl, site: 'en.wikipedia.org' };
  } catch { return null; }
}

// ---------------------------------------------------------------- Google suggestions (JSONP, works without CORS)
let suggestSeq = 0;
const suggestWaiters = new Map();
if (typeof window !== 'undefined') {
  window.google = window.google || {};
  window.google.ac = window.google.ac || {};
  window.google.ac.h = (data) => {
    // youtube client format: [query, [[text, 0, [..]], ...], {...}]
    const q = Array.isArray(data) ? data[0] : '';
    const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1].map((x) => (Array.isArray(x) ? x[0] : x)).filter(Boolean) : [];
    const w = suggestWaiters.get(q);
    if (w) { suggestWaiters.delete(q); w.resolve(list); }
    else for (const [, ww] of suggestWaiters) { if (ww.q.toLowerCase() === String(q).toLowerCase()) { ww.resolve(list); suggestWaiters.delete(ww.q); break; } }
  };
}

export function googleSuggest(q, { lang = 'en' } = {}) {
  if (!q.trim()) return Promise.resolve([]);
  const key = `gs:${lang}:${q}`;
  return cached(key, 10 * 60000, () => new Promise((resolve) => {
    const id = ++suggestSeq;
    const s = document.createElement('script');
    const timer = setTimeout(() => { suggestWaiters.delete(q); s.remove(); resolve([]); }, 5000);
    suggestWaiters.set(q, { q, resolve: (list) => { clearTimeout(timer); s.remove(); resolve(list); } });
    s.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}&_=${id}`;
    s.onerror = () => { clearTimeout(timer); suggestWaiters.delete(q); s.remove(); resolve([]); };
    document.head.appendChild(s);
  }));
}

/** Meme-flavoured Google suggestions: ask for "<q> meme" and show the real Google completions. */
export async function memeSuggestions(q, opts) {
  const base = q.trim();
  if (!base) return [];
  const asked = /meme/i.test(base) ? base : `${base} meme`;
  const list = await googleSuggest(asked, opts);
  const out = [];
  for (const s of list) {
    const clean = s.replace(/\s+/g, ' ').trim();
    if (!clean || clean.toLowerCase() === base.toLowerCase()) continue;
    out.push(clean);
  }
  return out.slice(0, 10);
}

export async function spellCorrection(q, opts) {
  const list = await memeSuggestions(q, opts);
  if (!list.length) return null;
  const norm = (s) => s.toLowerCase().replace(/\bmemes?\b/g, '').replace(/\s+/g, ' ').trim();
  const qn = norm(q);
  for (const s of list) {
    const sn = norm(s);
    if (!sn || sn === qn) continue;
    if (sn.startsWith(qn) || qn.startsWith(sn)) continue; // completion, not a correction
    const qw = qn.split(' '); const sw = sn.split(' ');
    if (Math.abs(qw.length - sw.length) > 1) continue;
    return s.replace(/\s*\bmemes?\b\s*$/i, '').trim() || s;
  }
  return null;
}

// ---------------------------------------------------------------- aggregate search session
export function createSession(q, opts, adapters) {
  const session = { q, opts, items: [], byId: new Map(), status: {}, listeners: new Set(), done: false, startedAt: performance.now(), elapsed: 0, page: 1, pending: 0, extra: {} };
  const emit = () => { if (!session.done) session.elapsed = performance.now() - session.startedAt; for (const l of session.listeners) l(session); };
  const add = (source, items) => {
    for (const it of items) {
      if (opts.safe && it.nsfw) continue;
      if (session.byId.has(it.id)) continue;
      session.byId.set(it.id, it);
      session.items.push(it);
    }
    session.items = rank(dedupe(session.items), q, { sort: opts.sort });
  };
  const runAll = (list) => {
    session.done = false;
    session.pending += list.length;
    const runs = list.map(async ({ source, run }) => {
      session.status[source] = 'loading';
      try {
        const r = await run({ onPartial: (items) => { add(source, items); emit(); }, session });
        if (r.skipped) { session.status[source] = 'skipped'; return; }
        add(source, r.items || []);
        session.status[source] = r.failed && r.failed === r.total ? 'error' : 'done';
        session.extra[source] = r;
      } catch (e) {
        console.warn(source, e);
        session.status[source] = 'error';
        session.status[source + ':error'] = e.message || String(e);
      } finally {
        session.pending--;
      }
      emit();
    });
    return Promise.allSettled(runs).then(() => { if (session.pending === 0) { session.done = true; session.elapsed = performance.now() - session.startedAt; emit(); } });
  };
  session.subscribe = (fn) => { session.listeners.add(fn); return () => session.listeners.delete(fn); };
  session.extend = (list) => { session.page++; return runAll(list); };
  runAll(adapters);
  return session;
}
