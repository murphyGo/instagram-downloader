import './style.css';
import JSZip from 'jszip';
import { fetchMedia, type Media } from '../src/scraper.js';
import { resolveProxyUrl } from '../src/proxy.js';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app missing');

app.innerHTML = `
  <main>
    <h1>Instagram Downloader</h1>
    <form id="form">
      <input id="url" type="url" name="url" required autocomplete="off"
             placeholder="https://www.instagram.com/p/…" />
      <button type="submit" id="go">가져오기</button>
    </form>
    <p id="status"></p>
    <div id="bulk" class="bulk" hidden>
      <button id="all" type="button">전체 ZIP 다운로드</button>
    </div>
    <div id="results" class="results"></div>
    <footer>
      공개 포스트만 지원. 스토리/비공개는 인증이 필요합니다.<br/>
      미리보기·다운로드는 모두 프록시 경유합니다.<br/>
      프록시 변경: <code>?proxy=&lt;url&gt;</code>
    </footer>
  </main>
`;

const form = document.querySelector<HTMLFormElement>('#form')!;
const urlInput = document.querySelector<HTMLInputElement>('#url')!;
const goButton = document.querySelector<HTMLButtonElement>('#go')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const resultsEl = document.querySelector<HTMLDivElement>('#results')!;
const bulkEl = document.querySelector<HTMLDivElement>('#bulk')!;
const allButton = document.querySelector<HTMLButtonElement>('#all')!;

// VITE_PROXY_URL is injected at build time. Set it in CI (`secrets.PROXY_URL`)
// to your deployed Fly.io proxy. For local `npm run dev` it can be omitted —
// resolveProxyUrl falls back to corsproxy.io which works on localhost.
const proxyUrl = resolveProxyUrl(import.meta.env.VITE_PROXY_URL);

let lastMedia: Media[] = [];

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void handleSubmit();
});

allButton.addEventListener('click', () => {
  void downloadAllAsZip();
});

async function handleSubmit(): Promise<void> {
  const url = urlInput.value.trim();
  if (!url) return;

  goButton.disabled = true;
  statusEl.classList.remove('error');
  statusEl.textContent = '가져오는 중…';
  resultsEl.innerHTML = '';
  bulkEl.hidden = true;
  lastMedia = [];

  try {
    const media = await fetchMedia(url, { proxyUrl });
    if (media.length === 0) {
      statusEl.textContent = '미디어를 찾지 못했습니다.';
      return;
    }
    statusEl.textContent = `${media.length}개 발견`;
    lastMedia = media;
    renderMedia(media);
    if (media.length > 1) bulkEl.hidden = false;
  } catch (err) {
    statusEl.classList.add('error');
    statusEl.textContent = `오류: ${(err as Error).message}`;
  } finally {
    goButton.disabled = false;
  }
}

function viaProxy(url: string): string {
  return proxyUrl ? `${proxyUrl}${encodeURIComponent(url)}` : url;
}

function renderMedia(media: Media[]): void {
  const frag = document.createDocumentFragment();
  for (const m of media) {
    const card = document.createElement('div');
    card.className = 'card';

    if (m.type === 'image') {
      const img = document.createElement('img');
      img.src = viaProxy(m.url);
      img.alt = m.filename ?? 'image';
      img.loading = 'lazy';
      card.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = viaProxy(m.url);
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      card.appendChild(video);
    }

    const btn = document.createElement('button');
    btn.className = 'download';
    btn.textContent = '다운로드';
    btn.addEventListener('click', () => {
      void downloadAsBlob(m, btn);
    });
    card.appendChild(btn);
    frag.appendChild(card);
  }
  resultsEl.appendChild(frag);
}

async function fetchAsBlob(m: Media): Promise<Blob> {
  const res = await fetch(viaProxy(m.url));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${m.filename ?? m.type}`);
  return res.blob();
}

function triggerSave(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadAsBlob(m: Media, btn: HTMLButtonElement): Promise<void> {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '받는 중…';
  try {
    const blob = await fetchAsBlob(m);
    triggerSave(blob, m.filename ?? 'media');
  } catch (err) {
    alert(`다운로드 실패: ${(err as Error).message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function downloadAllAsZip(): Promise<void> {
  if (lastMedia.length === 0) return;
  const original = allButton.textContent;
  allButton.disabled = true;
  try {
    const zip = new JSZip();
    for (let i = 0; i < lastMedia.length; i++) {
      const m = lastMedia[i]!;
      allButton.textContent = `받는 중… ${i + 1}/${lastMedia.length}`;
      const blob = await fetchAsBlob(m);
      zip.file(m.filename ?? `media_${i}`, blob);
    }
    allButton.textContent = '압축 중…';
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const stem = lastMedia[0]?.filename?.split('_')[0] ?? 'instagram';
    triggerSave(zipBlob, `${stem}.zip`);
  } catch (err) {
    alert(`전체 다운로드 실패: ${(err as Error).message}`);
  } finally {
    allButton.disabled = false;
    allButton.textContent = original;
  }
}
