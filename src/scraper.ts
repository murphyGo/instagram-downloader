export type Media = {
  type: 'image' | 'video';
  url: string;
  filename?: string;
};

export type FetchOptions = {
  /** Wrap every Instagram request with this proxy. Format: `https://proxy.example/?url=`
   * (the request URL is appended URL-encoded). Required in browsers; Node ignores it
   * by default. Falsy = direct fetch. */
  proxyUrl?: string;
  /** Override `globalThis.fetch` — for tests. */
  fetchImpl?: typeof fetch;
};

/** Public Instagram web app ID — visible in the page source of any IG profile.
 *  Required by `/api/v1/users/web_profile_info/`. */
const IG_APP_ID = '936619743392459';

/** Facebook crawler UA. Triggers SSR with og: meta tags on post pages. */
const FB_UA = 'facebookexternalhit/1.1';

/** A realistic browser UA. Required by web_profile_info — bare requests
 *  fail with 400 "SecFetch Policy violation". */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const POST_PATH_RE = /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;
const USERNAME_RE = /instagram\.com\/([^/?#]+)\/(?:p|reel|reels|tv)\//;

export type ParsedUrl = { shortcode: string; username?: string };

export function parseShortcode(postUrl: string): ParsedUrl {
  let u: URL;
  try {
    u = new URL(postUrl);
  } catch {
    throw new Error(`Invalid URL: ${postUrl}`);
  }
  if (!/(^|\.)instagram\.com$/.test(u.hostname)) {
    throw new Error(`Not an instagram.com URL: ${postUrl}`);
  }
  const m = POST_PATH_RE.exec(u.pathname);
  if (!m) throw new Error(`No post shortcode in URL: ${postUrl}`);
  const shortcode = m[1]!;
  const um = USERNAME_RE.exec(`instagram.com${u.pathname}`);
  return { shortcode, username: um?.[1] };
}

export async function fetchMedia(
  postUrl: string,
  opts: FetchOptions = {},
): Promise<Media[]> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const { shortcode, username: urlUsername } = parseShortcode(postUrl);

  // Path 1 (preferred): /embed/captioned/ ships the full shortcode_media node
  // for any post age, type, and carousel size. One request, no auth.
  try {
    const items = await fetchViaEmbed(fetchFn, shortcode, opts.proxyUrl);
    if (items.length > 0) return items;
  } catch {
    // fall through — embed format may have changed; let og:/profile try
  }

  const og = await fetchOgTags(fetchFn, shortcode, opts.proxyUrl);

  // Path 2: og:video — fast path for posts where IG marks og:type=video.
  if (og['og:type'] === 'video' && og['og:video']) {
    return [{ type: 'video', url: og['og:video'], filename: filenameFor(og['og:video'], shortcode, 0) }];
  }

  // Path 3: web_profile_info for full-res images + carousel sub-items
  // (limited to the user's latest ~12 posts).
  const username = urlUsername ?? usernameFromOgUrl(og['og:url']);
  if (username) {
    try {
      const items = await fetchViaProfileApi(fetchFn, username, shortcode, opts.proxyUrl);
      if (items.length > 0) return items;
    } catch {
      // fall through to og fallback
    }
  }

  // Last resort: og:image (640px thumbnail). Single item.
  if (og['og:image']) {
    return [{ type: 'image', url: og['og:image'], filename: filenameFor(og['og:image'], shortcode, 0) }];
  }

  const tip = username
    ? 'Post may be private or deleted.'
    : 'In a browser the URL must include the username (e.g. /<user>/p/<shortcode>/) for the fallback path to work.';
  throw new Error(`No media URL found for ${shortcode}. ${tip}`);
}

async function fetchViaEmbed(
  fetchFn: typeof fetch,
  shortcode: string,
  proxyUrl: string | undefined,
): Promise<Media[]> {
  const target = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  const res = await fetchFn(wrap(target, proxyUrl), {
    headers: {
      'User-Agent': FB_UA,
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`embed HTTP ${res.status} for ${shortcode}`);
  const html = await res.text();
  const node = extractEmbedNode(html);
  if (!node) throw new Error(`embed: shortcode_media not found for ${shortcode}`);
  return extractMediaFromNode(node, shortcode);
}

/**
 * The embed page wraps the post data in a JS-encoded string under the key
 * `"contextJSON"`. After decoding the JS string, the resulting JSON has
 * `gql_data.shortcode_media` (or `context.media`) with full data — typename,
 * is_video, display_url / video_url, edge_sidecar_to_children for carousels.
 */
export function extractEmbedNode(html: string): MediaNode | null {
  const marker = '"contextJSON":"';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const contentStart = start + marker.length;

  // Find the unescaped closing " of the JS string literal
  let i = contentStart;
  while (i < html.length) {
    const c = html[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '"') break;
    i++;
  }
  if (i >= html.length) return null;

  const decoded = jsUnescape(html.substring(contentStart, i));

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const root = parsed as {
    gql_data?: { shortcode_media?: MediaNode };
    context?: { media?: MediaNode };
  };
  return root.gql_data?.shortcode_media ?? root.context?.media ?? null;
}

function jsUnescape(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '\\' && i + 1 < s.length) {
      const n = s[i + 1]!;
      switch (n) {
        case '"': out += '"'; i++; continue;
        case '\\': out += '\\'; i++; continue;
        case '/': out += '/'; i++; continue;
        case 'n': out += '\n'; i++; continue;
        case 't': out += '\t'; i++; continue;
        case 'r': out += '\r'; i++; continue;
        case 'b': out += '\b'; i++; continue;
        case 'f': out += '\f'; i++; continue;
        case 'u':
          if (i + 5 < s.length) {
            out += String.fromCharCode(parseInt(s.substring(i + 2, i + 6), 16));
            i += 5;
            continue;
          }
      }
    }
    out += c;
  }
  return out;
}

async function fetchOgTags(
  fetchFn: typeof fetch,
  shortcode: string,
  proxyUrl: string | undefined,
): Promise<Record<string, string>> {
  const target = `https://www.instagram.com/p/${shortcode}/`;
  const res = await fetchFn(wrap(target, proxyUrl), {
    headers: {
      'User-Agent': FB_UA,
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Post not found (404). Private or deleted? ${shortcode}`);
    if (res.status === 429) throw new Error(`Rate limited by Instagram (429). Wait and retry.`);
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Login required (HTTP ${res.status}). Post may be private.`);
    }
    if (res.status >= 500) throw new Error(`Instagram server error (HTTP ${res.status}). Retry later.`);
    throw new Error(`Instagram returned HTTP ${res.status} for ${shortcode}`);
  }
  const html = await res.text();
  return parseOgTags(html);
}

export function parseOgTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta\s+property="(og:[a-z:_]+)"\s+content="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const key = m[1]!;
    const val = decodeHtmlEntities(m[2]!);
    if (!(key in out)) out[key] = val; // keep first occurrence
  }
  return out;
}

async function fetchViaProfileApi(
  fetchFn: typeof fetch,
  username: string,
  targetShortcode: string,
  proxyUrl: string | undefined,
): Promise<Media[]> {
  const target = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const res = await fetchFn(wrap(target, proxyUrl), {
    headers: {
      'X-IG-App-ID': IG_APP_ID,
      'Accept': '*/*',
      // Browsers ignore these on outbound, but Node needs them or IG rejects with 400.
      'User-Agent': BROWSER_UA,
      'Referer': `https://www.instagram.com/${encodeURIComponent(username)}/`,
    },
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error(`Rate limited by Instagram profile API (429). Wait and retry.`);
    if (res.status === 404) throw new Error(`User '${username}' not found (404).`);
    if (res.status >= 500) throw new Error(`Instagram profile API error (HTTP ${res.status}).`);
    throw new Error(`web_profile_info HTTP ${res.status}`);
  }
  const data = (await res.json()) as ProfileApiResponse;
  const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
  for (const edge of edges) {
    const node = edge?.node;
    if (!node || node.shortcode !== targetShortcode) continue;
    return extractMediaFromNode(node, targetShortcode);
  }
  return []; // shortcode not in latest 12 posts
}

type MediaNode = {
  __typename?: string;
  shortcode?: string;
  is_video?: boolean;
  display_url?: string;
  video_url?: string;
  display_resources?: Array<{ src: string; config_width: number; config_height: number }>;
  edge_sidecar_to_children?: { edges?: Array<{ node?: MediaNode }> };
};

type ProfileApiResponse = {
  data?: { user?: { edge_owner_to_timeline_media?: { edges?: Array<{ node?: MediaNode }> } } };
};

function extractMediaFromNode(node: MediaNode, shortcode: string): Media[] {
  if (node.__typename === 'GraphSidecar') {
    const children = node.edge_sidecar_to_children?.edges ?? [];
    return children
      .map((c, i) => nodeToMedia(c.node, shortcode, i))
      .filter((m): m is Media => m !== null);
  }
  const m = nodeToMedia(node, shortcode, 0);
  return m ? [m] : [];
}

function nodeToMedia(node: MediaNode | undefined, shortcode: string, index: number): Media | null {
  if (!node) return null;
  if (node.is_video && node.video_url) {
    return { type: 'video', url: node.video_url, filename: filenameFor(node.video_url, shortcode, index, 'video') };
  }
  // Prefer the largest entry in display_resources (full res, ~1080px). display_url
  // from the embed page is sometimes the lookaside SEO redirector which is harder
  // to filename and may resolve to a smaller variant.
  const imageUrl = pickLargestImage(node.display_resources) ?? node.display_url;
  if (imageUrl) {
    return { type: 'image', url: imageUrl, filename: filenameFor(imageUrl, shortcode, index, 'image') };
  }
  return null;
}

function pickLargestImage(resources: MediaNode['display_resources']): string | undefined {
  if (!resources || resources.length === 0) return undefined;
  let best = resources[0]!;
  for (const r of resources) {
    if (r.config_width > best.config_width) best = r;
  }
  return best.src;
}

function wrap(url: string, proxyUrl: string | undefined): string {
  return proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;
}

function usernameFromOgUrl(ogUrl: string | undefined): string | undefined {
  if (!ogUrl) return undefined;
  const m = USERNAME_RE.exec(ogUrl);
  return m?.[1];
}

function filenameFor(mediaUrl: string, shortcode: string, index: number, type: 'image' | 'video' = 'image'): string {
  const ext = extFromUrl(mediaUrl) || (type === 'video' ? '.mp4' : '.jpg');
  return `${shortcode}_${index}${ext}`;
}

function extFromUrl(u: string): string {
  try {
    const path = new URL(u).pathname;
    const m = /\.(mp4|jpg|jpeg|png|webp)$/i.exec(path);
    return m ? `.${m[1]!.toLowerCase()}` : '';
  } catch {
    return '';
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
