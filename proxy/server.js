// Minimal Instagram-only CORS proxy. Plain Node, no dependencies.
//
// GET /?url=<encoded>           → proxies the URL with IG-friendly headers
// GET /healthz                  → 200 ok (Fly health check)
//
// Allowed targets: www.instagram.com / instagram.com / i.instagram.com,
// and the CDNs *.cdninstagram.com / *.fbcdn.net (for media downloads).
//
// Header injection rules:
// - instagram.com /api/*     → browser UA + Referer + X-IG-App-ID
// - instagram.com /graphql/* → browser UA + Referer + X-IG-App-ID + X-FB-Friendly-Name
// - instagram.com /<other>   → facebookexternalhit/1.1 + Referer (forces og:*)
// - cdninstagram / fbcdn     → browser UA only

import { createServer } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT ?? 3000);
const FB_UA = 'facebookexternalhit/1.1';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const IG_APP_ID = '936619743392459';

const IG_HOSTS = new Set(['www.instagram.com', 'instagram.com', 'i.instagram.com']);

function isIgCdn(host) {
  return /(?:^|\.)cdninstagram\.com$/.test(host) || /(?:^|\.)fbcdn\.net$/.test(host);
}

function extractUsername(pathname) {
  const m = /^\/([^/?#]+)\/(?:p|reel|reels|tv)\//.exec(pathname);
  return m ? m[1] : null;
}

function setCors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-expose-headers', 'content-type, content-length');
}

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': '*',
      'access-control-max-age': '86400',
    });
    res.end();
    return;
  }

  if (req.url === '/healthz' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain' });
    res.end('only GET/HEAD');
    return;
  }

  const reqUrl = new URL(req.url ?? '/', 'http://localhost');
  const raw = reqUrl.searchParams.get('url') ?? '';
  if (!raw) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('Usage: /?url=<encoded-instagram-or-cdn-url>');
    return;
  }

  let target;
  try {
    target = new URL(raw);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end(`Invalid url: ${raw.slice(0, 200)}`);
    return;
  }

  const isIg = IG_HOSTS.has(target.hostname);
  const isCdn = isIgCdn(target.hostname);
  if (!isIg && !isCdn) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end(`Host not allowed: ${target.hostname}`);
    return;
  }

  const isApi = isIg && target.pathname.startsWith('/api/');
  const isGraphql = isIg && target.pathname.startsWith('/graphql/');
  const username = isIg ? extractUsername(target.pathname) : null;

  const headers = {
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'user-agent': isIg && !isApi && !isGraphql ? FB_UA : BROWSER_UA,
  };
  if (isIg) {
    headers.referer = username
      ? `https://www.instagram.com/${username}/`
      : 'https://www.instagram.com/';
  }
  if (isApi || isGraphql) headers['x-ig-app-id'] = IG_APP_ID;
  if (isGraphql) headers['x-fb-friendly-name'] = 'PolarisPostActionLoadPostQueryQuery';

  let upstream;
  try {
    upstream = await fetch(target.toString(), { headers, redirect: 'follow' });
  } catch (e) {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Upstream fetch failed: ${e?.message ?? e}`);
    return;
  }

  const outHeaders = {
    'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
  };
  // If upstream sent compressed bytes, Node's fetch already decompressed them
  // before exposing response.body — so the original content-length / encoding
  // would lie about the body we're streaming. Forward content-length only when
  // we know the body is identity-encoded.
  const upstreamEncoding = upstream.headers.get('content-encoding');
  if (!upstreamEncoding || upstreamEncoding === 'identity') {
    const len = upstream.headers.get('content-length');
    if (len) outHeaders['content-length'] = len;
  }
  // Cache successful media responses briefly to reduce upstream pressure
  if (upstream.ok && isCdn) outHeaders['cache-control'] = 'public, max-age=3600';

  res.writeHead(upstream.status, outHeaders);

  if (req.method === 'HEAD' || !upstream.body) {
    res.end();
    return;
  }

  try {
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch {
    // client disconnected — fine, just stop streaming
  }
});

server.listen(PORT, () => {
  console.log(`instagram-proxy listening on :${PORT}`);
});
