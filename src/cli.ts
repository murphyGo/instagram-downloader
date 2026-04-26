#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { fetchMedia, type Media } from './scraper.js';
import { resolveProxyUrl } from './proxy.js';

const USAGE = `Usage: instagram-dl <url> [options]

Options:
  --out <dir>       Output directory (default: current directory)
  --json            Print JSON result to stdout (one object with media[])
  --proxy <url>     Override CORS proxy ($INSTAGRAM_DL_PROXY also works)
  -h, --help        Show this help

Exit codes:
  0  success
  1  bad arguments, invalid URL, or post not found
  2  network / proxy failure
`;

type Args = {
  url?: string;
  outDir: string;
  json: boolean;
  proxy?: string;
  help: boolean;
};

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { outDir: '.', json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--json') args.json = true;
    else if (a === '--out') {
      const v = argv[++i];
      if (v === undefined) throw new Error('--out requires a value');
      args.outDir = v;
    } else if (a === '--proxy') {
      const v = argv[++i];
      if (v === undefined) throw new Error('--proxy requires a value');
      args.proxy = v;
    } else if (!a.startsWith('-')) {
      if (args.url) throw new Error(`Unexpected positional arg: ${a}`);
      args.url = a;
    } else {
      throw new Error(`Unknown option: ${a}`);
    }
  }
  return args;
}

async function downloadOne(media: Media, outDir: string, fallbackName: string): Promise<string> {
  const filename = media.filename ?? fallbackName;
  const path = join(outDir, filename);
  const res = await fetch(media.url);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  if (!res.body) throw new Error('download response has no body');
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(path));
  return path;
}

function isNetworkError(msg: string): boolean {
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|HTTP 5\d\d|server error|Rate limited|proxy|web_profile_info HTTP/i.test(msg);
}

async function main(argv: readonly string[]): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n\n${USAGE}`);
    return 1;
  }

  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (!args.url) {
    process.stderr.write(USAGE);
    return 1;
  }

  const proxyUrl = args.proxy ?? resolveProxyUrl();

  process.stderr.write(`Resolving ${args.url}\n`);
  let media: Media[];
  try {
    media = await fetchMedia(args.url, { proxyUrl });
  } catch (e) {
    const msg = (e as Error).message;
    process.stderr.write(`error: ${msg}\n`);
    return isNetworkError(msg) ? 2 : 1;
  }

  if (media.length === 0) {
    process.stderr.write('error: no media found in post\n');
    return 1;
  }

  await mkdir(args.outDir, { recursive: true });
  process.stderr.write(`Found ${media.length} item${media.length === 1 ? '' : 's'}. Downloading to ${args.outDir}/\n`);

  const results: Array<{ type: 'image' | 'video'; url: string; path: string }> = [];
  for (let i = 0; i < media.length; i++) {
    const m = media[i]!;
    process.stderr.write(`  [${i + 1}/${media.length}] ${m.type} ${m.filename ?? ''}\n`);
    try {
      const path = await downloadOne(m, args.outDir, `media_${i}`);
      results.push({ type: m.type, url: m.url, path });
    } catch (e) {
      process.stderr.write(`    failed: ${(e as Error).message}\n`);
      return 2;
    }
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ media: results }, null, 2)}\n`);
  } else {
    for (const r of results) process.stdout.write(`${r.path}\n`);
  }
  return 0;
}

const code = await main(process.argv.slice(2));
process.exit(code);
