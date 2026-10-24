# Memegle

**Google for memes.** A live, meme-only search engine with the look and behaviour of Google
Search. Type anything, get memes from across the web: nothing else. Runs entirely in the browser
and is hosted as a static site, no server, no accounts, no tracking.

Live: **https://justbuildsstuff.github.io/Memegle/**

Memegle grew out of [Meme Search](https://github.com/meme-search/meme-search) by neonwatty
(Apache-2.0). Its features (AI descriptions, tags, folders, vector search) live on under
**My memes**, the private collection in your browser. The web search on top is new.

## What it does

- **Live search** across meme communities on Lemmy (searched in parallel through lemmy.world and
  the communities' home instances), hot posts of meme subreddits (via meme-api.com) and the Imgflip
  template list. Results stream in as each source answers and are merged, de-duplicated and ranked
  by title match, upvotes and freshness. "About N results (x.xx seconds)", of course.
- **Suggestions as you type**, live from Google's suggest service (meme-specific), plus Imgflip
  template names, your recent searches and matches from My memes. "Did you mean" for typos.
- **Tabs like Google**: All (image strip, template row, web-style result list, "People also
  search for", Wikipedia knowledge panel), Images (masonry grid with side-panel viewer), GIFs,
  Templates, My memes. Tools: sort by relevance / newest / most upvoted, SafeSearch, per-source
  filters.
- **Viewer panel**: visit the source, caption the template on Imgflip, save to My memes, copy,
  download, find similar, more like this.
- **My memes**: upload (drag and drop, paste, file picker), save any web result, describe memes with
  Florence-2 running in the browser (WebGPU or WASM) or an OpenAI-compatible vision API, OCR of the
  caption text, tags, folders, bulk generation, BM25 or vector search (all-MiniLM-L6-v2), export and
  import. Everything is stored in IndexedDB and never leaves the device.
- **Optional keyed sources**: add free API keys in Settings for Tenor and Giphy (GIF search and
  autocomplete) and Imgur (gallery search). Keys are stored in the browser only.
- Google-isms: "I'm Feeling Memey", Memegle Lens (pick an image, it gets described and searched),
  voice search, apps grid, light and dark theme, `/` focuses the search box.

## Sources

| Source | How | Needs key |
|---|---|---|
| Lemmy | `/api/v3/search` on lemmy.world (federated) and the communities' own instances; `post/list` Hot for trending | no |
| Reddit | meme-api.com (`/gimme/<subreddit>/50`), filtered by relevance | no |
| Imgflip | `api.imgflip.com/get_memes` (top 100 templates) | no |
| Wikipedia | Action API, knowledge panel when an article about the meme exists | no |
| Google suggest | JSONP `suggestqueries.google.com` for suggestions and spelling | no |
| Tenor | API v2 search + autocomplete | yes |
| Giphy | API v1 search | yes |
| Imgur | gallery search | yes |

The community and subreddit lists are editable in Settings. Reddit's own API and most GIF APIs
block anonymous browser requests, which is why GIF search needs a key.

## Run it locally

```sh
git clone https://github.com/justbuildsstuff/Memegle.git
cd Memegle
python tools/serve.py           # or any static server with correct .js MIME types
```

Open http://127.0.0.1:8000. ES modules need a real HTTP origin, `file://` will not work.

## Bundled memes

`memes/<folder>/` holds memes shipped with the site (currently the four upstream examples).
`python tools/build_index.py` rebuilds `data/memes.json` and keeps existing descriptions and tags;
`--caption` describes new images with Florence-2 on your machine (`pip install transformers torch pillow`).

## Project layout

```
index.html          shell, loads js/app.js
css/memegle.css     Google-style theme, light + dark tokens
js/app.js           views, routing, live sessions, actions
js/sources.js       source adapters (Lemmy, Reddit, Imgflip, Tenor, Giphy, Imgur, Wikipedia, Google suggest), ranking, sessions
js/search.js        BM25, suggestions, did-you-mean, vector ranking for My memes
js/store.js         bundled index + IndexedDB uploads/edits/embeddings, settings, history
js/ai.js            Transformers.js (Florence-2, MiniLM) and OpenAI-compatible provider
data/memes.json     search index for memes/ (generated)
tools/              build_index.py, serve.py
```

## License

Apache-2.0, like the upstream project. See `LICENSE` and `NOTICE`. Search results belong to their
authors and platforms; Memegle links to them and does not host them.
