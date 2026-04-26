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

  const og = await fetchOgTags(fetchFn, shortcode, opts.proxyUrl);

  // Single video: og:video carries the full-quality MP4. Done.
  if (og['og:type'] === 'video' && og['og:video']) {
    return [{ type: 'video', url: og['og:video'], filename: filenameFor(og['og:video'], shortcode, 0) }];
  }

  // Image or carousel: try web_profile_info for full-res + carousel children.
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

  throw new Error('No media URL found in post');
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
    headers: { 'X-IG-App-ID': IG_APP_ID, 'Accept': '*/*' },
  });
  if (!res.ok) throw new Error(`web_profile_info HTTP ${res.status}`);
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
    return { type: 'video', url: node.video_url, filename: filenameFor(node.video_url, shortcode, index) };
  }
  if (node.display_url) {
    return { type: 'image', url: node.display_url, filename: filenameFor(node.display_url, shortcode, index) };
  }
  return null;
}

function wrap(url: string, proxyUrl: string | undefined): string {
  return proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;
}

function usernameFromOgUrl(ogUrl: string | undefined): string | undefined {
  if (!ogUrl) return undefined;
  const m = USERNAME_RE.exec(ogUrl);
  return m?.[1];
}

function filenameFor(mediaUrl: string, shortcode: string, index: number): string {
  const ext = extFromUrl(mediaUrl);
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
