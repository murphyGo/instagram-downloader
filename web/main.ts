import './style.css';
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
    <div id="results" class="results"></div>
    <footer>
      공개 포스트만 지원. 스토리/비공개는 인증이 필요합니다.<br/>
      브라우저는 <code>https://www.instagram.com/&lt;user&gt;/p/&lt;id&gt;/</code> 형식 URL이 더 잘 됩니다 (사용자명 포함).<br/>
      프록시 변경: <code>?proxy=&lt;url&gt;</code>
    </footer>
  </main>
`;

const form = document.querySelector<HTMLFormElement>('#form')!;
const urlInput = document.querySelector<HTMLInputElement>('#url')!;
const goButton = document.querySelector<HTMLButtonElement>('#go')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const resultsEl = document.querySelector<HTMLDivElement>('#results')!;

// VITE_PROXY_URL is injected at build time. Set it in CI (`secrets.PROXY_URL`)
// to your deployed Fly.io proxy. For local `npm run dev` it can be omitted —
// resolveProxyUrl falls back to corsproxy.io which works on localhost.
const proxyUrl = resolveProxyUrl(import.meta.env.VITE_PROXY_URL);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void handleSubmit();
});

async function handleSubmit(): Promise<void> {
  const url = urlInput.value.trim();
  if (!url) return;

  goButton.disabled = true;
  statusEl.classList.remove('error');
  statusEl.textContent = '가져오는 중…';
  resultsEl.innerHTML = '';

  try {
    const media = await fetchMedia(url, { proxyUrl });
    if (media.length === 0) {
      statusEl.textContent = '미디어를 찾지 못했습니다.';
      return;
    }
    statusEl.textContent = `${media.length}개 발견`;
    renderMedia(media);
  } catch (err) {
    statusEl.classList.add('error');
    statusEl.textContent = `오류: ${(err as Error).message}`;
  } finally {
    goButton.disabled = false;
  }
}

function renderMedia(media: Media[]): void {
  const frag = document.createDocumentFragment();
  for (const m of media) {
    const card = document.createElement('div');
    card.className = 'card';

    if (m.type === 'image') {
      const img = document.createElement('img');
      img.src = m.url;
      img.alt = m.filename ?? 'image';
      img.loading = 'lazy';
      card.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = m.url;
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

async function downloadAsBlob(m: Media, btn: HTMLButtonElement): Promise<void> {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '받는 중…';
  try {
    const fetchUrl = proxyUrl ? `${proxyUrl}${encodeURIComponent(m.url)}` : m.url;
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = m.filename ?? 'media';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    alert(`다운로드 실패: ${(err as Error).message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
