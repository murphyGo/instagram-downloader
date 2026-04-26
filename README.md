# Instagram Downloader

인스타그램 공개 포스트 URL을 입력하면 이미지와 동영상을 다운로드합니다. 모바일에서 쓸 수 있는 web UI(GitHub Pages)와 CLI를 함께 제공합니다.

## Status

In development. See `PLAN.md` for progress.

## Run

### Web (GitHub Pages)

배포본: `https://<user>.github.io/instagram-downloader/`

로컬:
```bash
npm install
npm run dev   # http://localhost:5173/instagram-downloader/
```

### CLI

```bash
npm install
npm run build:cli
node dist/cli.js https://www.instagram.com/<user>/reel/<id>/ --out ./downloads --json
```

## Deploy

GitHub Actions로 `main` 푸시 시 자동 배포됩니다 (`.github/workflows/deploy.yml`).
처음에는 저장소 Settings → Pages에서 **Source: GitHub Actions**로 설정해야 합니다.

## Scope

- ✅ 공개 포스트의 이미지/비디오/캐러셀 다운로드
- ❌ 스토리, 비공개 계정 (v1 범위 밖 — 인증 필요)

자세한 내용은 `BRIEF.md` 참고.
