const DEFAULT_BROWSER_PROXY = 'https://corsproxy.io/?';
const PROXY_QUERY_KEY = 'proxy';
const PROXY_STORAGE_KEY = 'igdl-proxy';
const NODE_ENV_KEY = 'INSTAGRAM_DL_PROXY';

type WindowLike = {
  location?: { search?: string };
  localStorage?: { getItem(k: string): string | null } | null;
};

type ProcessLike = { env?: Record<string, string | undefined> };

/**
 * Resolve the CORS proxy URL based on runtime environment.
 *
 * - Browser: `?proxy=…` query > `localStorage['igdl-proxy']` > `https://corsproxy.io/?`
 * - Node: `$INSTAGRAM_DL_PROXY` > none (direct fetch)
 * - Empty string explicitly disables the proxy in either env.
 *
 * The returned value is a prefix; `scraper.fetchMedia` appends the URL-encoded
 * Instagram URL to it, matching the format used by corsproxy.io and similar.
 */
export function resolveProxyUrl(): string | undefined {
  const w = getWindow();
  if (w !== undefined) return resolveBrowserProxy(w);
  return resolveNodeProxy(getProcess());
}

export function resolveBrowserProxy(w: WindowLike): string | undefined {
  const params = new URLSearchParams(w.location?.search ?? '');
  if (params.has(PROXY_QUERY_KEY)) {
    const v = params.get(PROXY_QUERY_KEY) ?? '';
    return v === '' ? undefined : v;
  }
  let stored: string | null = null;
  try {
    stored = w.localStorage?.getItem(PROXY_STORAGE_KEY) ?? null;
  } catch {
    // localStorage can throw in private mode / sandboxed iframes
  }
  if (stored !== null) return stored === '' ? undefined : stored;
  return DEFAULT_BROWSER_PROXY;
}

export function resolveNodeProxy(p: ProcessLike | undefined): string | undefined {
  const v = p?.env?.[NODE_ENV_KEY]?.trim();
  return v && v !== '' ? v : undefined;
}

function getWindow(): WindowLike | undefined {
  const g = globalThis as { window?: WindowLike };
  return g.window;
}

function getProcess(): ProcessLike | undefined {
  const g = globalThis as { process?: ProcessLike };
  return g.process;
}
