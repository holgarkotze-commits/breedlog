const VERSION = '2026-08-18.3';
const AGRA_INDEX = 'https://www.agra.com.na/index.php/commercial-results/auctionsummaries';
const WLA_INDEX = 'https://www.whkla.com/auction-averages/';
const KAROO_INDEX = 'https://www.karoo-gobabis.com/gobabis';
const KAROO_CALENDAR = 'https://www.karoo-gobabis.com/auctiondates';
const NLA_INDEX = 'https://auctions.swiftvee.com/';
const MAX_HTML_BYTES = 1_200_000;
const LIVE_CACHE_SECONDS = 15 * 60;
const DISCOVERY_CACHE_SECONDS = 30 * 60;

const json = (value, init = {}) => new Response(JSON.stringify(value), {
  ...init,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60, stale-while-revalidate=300',
    'x-market-version': VERSION,
    ...(init.headers || {}),
  },
});

function stripTags(s = '') {
  return s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readTextCapped(response, maxBytes = MAX_HTML_BYTES) {
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${response.url}`);
  const len = Number(response.headers.get('content-length') || 0);
  if (len && len > maxBytes) throw new Error(`Source exceeds ${maxBytes} byte cap`);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Source exceeded read cap');
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

function abs(base, href) {
  try { return new URL(href.replaceAll('&amp;', '&'), base).toString(); }
  catch { return null; }
}

function discoverLinks(html, base, predicate) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = abs(base, m[1]);
    if (u && predicate(u) && !out.includes(u)) out.push(u);
  }
  return out;
}

function classifySpecies(animalClass = '') {
  const c = animalClass.trim().toLowerCase();
  if (c.startsWith('goat')) return 'goat';
  if (c.startsWith('sheep')) return 'sheep';
  const cattleTokens = ['bull', 'cow', 'heifer', 'ox', 'stoor', 'tolly', 'weaner', 'calf', 'nguni'];
  if (cattleTokens.some(t => c.includes(t))) return 'cattle';
  return null;
}

function numberOrNull(value) {
  if (value == null || /-{2,}/.test(String(value))) return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseAgraRows(html, sourceUrl) {
  const plain = stripTags(html);
  const venue = (plain.match(/Venue:\s*([^|]{2,100}?)\s+Date:/i) || [])[1]?.trim() || 'Unknown venue';
  const date = new URL(sourceUrl).searchParams.get('date') || null;
  const rows = [];
  const tr = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = tr.exec(html))) {
    const cells = [];
    const td = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c;
    while ((c = td.exec(m[1]))) cells.push(stripTags(c[1]));
    if (cells.length < 5) continue;
    const animalClass = cells[0].trim();
    const species = classifySpecies(animalClass);
    if (!species) continue;
    rows.push({
      house_id: 'agra',
      house: 'Agra Auctions',
      venue,
      date,
      species,
      class: animalClass,
      on_offer: numberOrNull(cells[1]),
      price_kg: numberOrNull(cells[2]),
      avg_weight: numberOrNull(cells[3]),
      price_head: numberOrNull(cells[4]),
      source_url: sourceUrl,
      evidence_confidence: 1,
    });
  }
  return rows;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'STITCH-WORX-Livestock-Market-Intelligence/2.0 (+public-source-indexer)',
      'accept': 'text/html,application/xhtml+xml',
    },
    cf: { cacheTtl: 300, cacheEverything: false },
  });
  return readTextCapped(response);
}

function dateFromUrl(url) {
  try { return new URL(url).searchParams.get('date'); }
  catch { return null; }
}

async function fetchAgraCurrent({ maxAuctions = 20 } = {}) {
  const indexHtml = await fetchHtml(AGRA_INDEX);
  let links = discoverLinks(indexHtml, AGRA_INDEX, u => u.includes('commercial-results/auctionsummary') && u.includes('date='));
  links = links
    .map(url => ({ url, date: dateFromUrl(url) }))
    .filter(x => x.date && x.date.startsWith('2026-'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxAuctions);

  const rows = [];
  const errors = [];
  const chunks = [];
  for (let i = 0; i < links.length; i += 5) chunks.push(links.slice(i, i + 5));
  for (const chunk of chunks) {
    const settled = await Promise.allSettled(chunk.map(async item => {
      const html = await fetchHtml(item.url);
      const parsed = parseAgraRows(html, item.url);
      if (!parsed.length) errors.push({ url: item.url, error: 'No commercial rows parsed from current source layout' });
      return parsed;
    }));
    settled.forEach((result, idx) => {
      if (result.status === 'fulfilled') rows.push(...result.value);
      else errors.push({ url: chunk[idx].url, error: String(result.reason?.message || result.reason) });
    });
  }
  return {
    rows,
    latest_discovered: links[0]?.date || null,
    latest_parsed: rows.map(r => r.date).filter(Boolean).sort().at(-1) || null,
    source_count: links.length,
    errors,
  };
}

async function loadVerifiedFallback(env, requestUrl) {
  const assetUrl = new URL('/fallback-data.js', requestUrl);
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString()));
  if (!response.ok) throw new Error(`Fallback asset unavailable: HTTP ${response.status}`);
  const text = await response.text();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Fallback asset format invalid');
  const payload = JSON.parse(text.slice(start, end + 1));
  return payload;
}

function mergeEvidenceRows(fallbackRows, liveRows) {
  const map = new Map();
  for (const row of fallbackRows || []) {
    const key = [row.house_id || row.house, row.date, row.venue, row.class].join('|');
    map.set(key, row);
  }
  for (const row of liveRows || []) {
    const key = [row.house_id || row.house, row.date, row.venue, row.class].join('|');
    map.set(key, row);
  }
  return [...map.values()];
}

function latestDateInText(text) {
  const p1 = /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g;
  const p2 = /\b(0?[1-9]|[12]\d|3[01])\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/gi;
  const p3 = /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/g;
  const dates = [];
  let m;
  while ((m = p1.exec(text))) dates.push(`${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`);
  const months = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };
  while ((m = p2.exec(text))) dates.push(`${m[3]}-${String(months[m[2].toLowerCase()]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`);
  while ((m = p3.exec(text))) dates.push(`${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`);
  return dates.filter(d => d.startsWith('2026-')).sort().at(-1) || null;
}

async function sourceHealth() {
  const sources = [
    { id:'agra', name:'Agra Auctions', url:AGRA_INDEX, numeric:'structured', method:'HTML tables', expected:'all commercial cattle, sheep and goat classes' },
    { id:'wla', name:'Windhoek Livestock Auctioneers', url:WLA_INDEX, numeric:'visual/archive', method:'HTML archive + published average sheets', expected:'large- and small-stock averages' },
    { id:'nla', name:'Namibia Livestock Auctioneers', url:NLA_INDEX, numeric:'mixed', method:'SwiftVEE event/lot data or direct feed', expected:'event-level livestock data where publicly listed' },
    { id:'karoo', name:'Karoo-Ochse', url:KAROO_INDEX, numeric:'PDF/archive', method:'dated averages PDFs + direct feed', expected:'Gobabis/Omaheke commercial averages' },
  ];
  const results = [];
  for (const source of sources) {
    try {
      if (source.id === 'nla') {
        results.push({ ...source, reachable:true, latest_publication:null, status:'Public coverage varies by event; direct feed recommended for authoritative commercial averages.' });
        continue;
      }
      const html = await fetchHtml(source.url);
      let latest = latestDateInText(stripTags(html));
      if (source.id === 'karoo') {
        try {
          const cal = await fetchHtml(KAROO_CALENDAR);
          latest = [latest, latestDateInText(stripTags(cal))].filter(Boolean).sort().at(-1) || latest;
        } catch {}
      }
      results.push({ ...source, reachable:true, latest_publication:latest, status:'reachable' });
    } catch (error) {
      results.push({ ...source, reachable:false, latest_publication:null, status:String(error?.message || error) });
    }
  }
  return { generated_at:new Date().toISOString(), sources:results };
}

function filterRows(rows, url) {
  const species = (url.searchParams.get('species') || '').toLowerCase();
  const animalClass = url.searchParams.get('class') || '';
  const house = url.searchParams.get('house') || '';
  const venue = url.searchParams.get('venue') || '';
  const from = url.searchParams.get('from') || '2026-01-01';
  return rows.filter(r => (!species || r.species === species) && (!animalClass || r.class === animalClass) && (!house || r.house_id === house) && (!venue || r.venue === venue) && (!from || r.date >= from));
}

function summarize(rows) {
  const valid = rows.filter(r => Number.isFinite(r.price_kg));
  const classes = [...new Set(rows.map(r => r.class))].sort();
  const venues = [...new Set(rows.map(r => r.venue))].sort();
  const latestDate = rows.map(r => r.date).filter(Boolean).sort().at(-1) || null;
  const latestRows = latestDate ? rows.filter(r => r.date === latestDate) : [];
  return {
    latest_date: latestDate,
    latest_rows: latestRows.length,
    latest_on_offer: latestRows.reduce((s, r) => s + (r.on_offer || 0), 0),
    classes,
    venues,
    observations: rows.length,
    min_price_kg: valid.length ? Math.min(...valid.map(r => r.price_kg)) : null,
    max_price_kg: valid.length ? Math.max(...valid.map(r => r.price_kg)) : null,
  };
}

async function cachedJson(request, keySuffix, ttlSeconds, producer) {
  const cache = caches.default;
  const key = new Request(`${new URL(request.url).origin}/__cache/${keySuffix}`, { method:'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const value = await producer();
  const response = json(value, { headers:{ 'cache-control':`public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}` } });
  await cache.put(key, response.clone());
  return response;
}

async function livePayload(url, env, requestUrl) {
  const fallback = await loadVerifiedFallback(env, requestUrl);
  let current;
  try {
    current = await fetchAgraCurrent({ maxAuctions:24 });
  } catch (error) {
    current = { rows:[], latest_discovered:null, latest_parsed:null, source_count:0, errors:[{ url:AGRA_INDEX, error:String(error?.message || error) }] };
  }
  const merged = mergeEvidenceRows(fallback.rows || [], current.rows || []);
  const rows = filterRows(merged, url).sort((a, b) => b.date.localeCompare(a.date) || a.venue.localeCompare(b.venue) || a.class.localeCompare(b.class));
  const fallbackLatest = fallback.meta?.latest_discovered?.agra?.date || fallback.meta?.latest_fully_parsed_fallback || null;
  const liveRows = current.rows?.length || 0;
  return {
    generated_at:new Date().toISOString(),
    version:VERSION,
    market_year:2026,
    data_mode:liveRows ? 'live-source + verified-2026-baseline' : 'verified-2026-baseline; live-parser-degraded',
    source:'Agra commercial results + verified evidence baseline',
    latest_discovered:current.latest_discovered || fallbackLatest,
    latest_parsed:current.latest_parsed || fallback.meta?.latest_fully_parsed_fallback || null,
    source_count:current.source_count || 0,
    live_rows:liveRows,
    fallback_rows:fallback.rows?.length || 0,
    errors:current.errors || [],
    summary:summarize(rows),
    rows,
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return json({ ok:true, service:'Namibia Livestock Market Live', version:VERSION, time:new Date().toISOString(), data_mode:'live-source + verified-2026-baseline' }, { headers:{ 'cache-control':'no-store' } });
    }
    if (url.pathname === '/api/live') {
      return cachedJson(request, `live-${url.searchParams.toString() || 'all'}`, LIVE_CACHE_SECONDS, () => livePayload(url, env, request.url));
    }
    if (url.pathname === '/api/source-health') {
      return cachedJson(request, 'source-health', DISCOVERY_CACHE_SECONDS, sourceHealth);
    }
    if (url.pathname === '/api/refresh' && request.method === 'POST') {
      if (!env.REFRESH_TOKEN) return json({ error:'REFRESH_TOKEN not configured' }, { status:503, headers:{ 'cache-control':'no-store' } });
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
      if (token !== env.REFRESH_TOKEN) return json({ error:'unauthorized' }, { status:401, headers:{ 'cache-control':'no-store' } });
      return json(await livePayload(url, env, request.url), { headers:{ 'cache-control':'no-store' } });
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await Promise.all([fetchAgraCurrent({ maxAuctions:24 }), sourceHealth()]);
        console.log(JSON.stringify({ event:'scheduled-refresh', version:VERSION, at:new Date().toISOString(), cron:controller.cron, status:'ok' }));
      } catch (error) {
        console.error(JSON.stringify({ event:'scheduled-refresh', version:VERSION, at:new Date().toISOString(), status:'error', error:String(error?.message || error) }));
      }
    })());
  },
};
