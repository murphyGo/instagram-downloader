# Instagram Downloader

인스타그램 공개 포스트 URL을 붙여넣으면 이미지/동영상/캐러셀을 다운로드합니다. 모바일에서 쓸 수 있는 web UI(GitHub Pages)와 에이전트가 호출할 수 있는 CLI를 함께 제공합니다.

## Web

GitHub Pages 배포본:
`https://murphygo.github.io/instagram-downloader/`

브라우저는 `User-Agent` 헤더를 직접 못 보내기 때문에, **URL에 사용자명이 포함된 형식**이 가장 잘 됩니다:

- ✅ `https://www.instagram.com/<user>/p/<shortcode>/`
- ✅ `https://www.instagram.com/<user>/reel/<shortcode>/`
- ⚠️ `https://www.instagram.com/p/<shortcode>/` — 사용자명이 없으면 폴백 경로가 막혀 실패할 수 있음

해당 사용자의 **최근 12개 포스트**까지 풀 해상도로 가져옵니다(원리상 web_profile_info의 페이지 단위 한계).

### 로컬 개발

```bash
npm install
npm run dev      # http://localhost:5173/instagram-downloader/
npm run build:web
```

### 프록시 변경

기본은 `https://corsproxy.io/?`. 다른 CORS 프록시를 쓰려면:

- 일회성: 페이지 URL에 `?proxy=https%3A%2F%2Fmyproxy.example%2F%3Furl%3D` 추가
- 영구: 브라우저 콘솔에서 `localStorage.setItem('igdl-proxy', 'https://myproxy.example/?url=')`
- 비활성화: `?proxy=` (값 없이)

## CLI

```bash
npm install
npm run build:cli
node dist/cli.js https://www.instagram.com/<user>/reel/<id>/ --out ./downloads --json
```

또는 `npm link` 후 `instagram-dl <url>`로 호출 가능. CLI는 Node에서 `User-Agent`를 자유롭게 보낼 수 있어 `/p/<shortcode>/` 형식도 무리 없이 동작합니다.

### 옵션

| 플래그 | 의미 |
|------|----|
| `<url>` | (필수) 인스타그램 포스트/릴 URL |
| `--out <dir>` | 저장 디렉토리 (기본: 현재 디렉토리) |
| `--json` | 결과를 JSON으로 stdout 출력 |
| `--proxy <url>` | CORS 프록시 (보통 Node에선 불필요) |
| `-h, --help` | 도움말 |

### Exit code

| 코드 | 의미 |
|----|----|
| 0 | 성공 |
| 1 | 잘못된 인자 / URL 파싱 실패 / 포스트 없음 |
| 2 | 네트워크 / 프록시 / 레이트 리밋 |

진행 메시지는 stderr, 결과(파일 경로 또는 `--json`)는 stdout으로 분리되므로 다른 에이전트가 파이프로 받기 좋습니다.

## Deploy

Web UI를 GitHub Pages에 띄우려면 **(1) 자체 프록시 배포 → (2) GH Pages 활성화 → (3) `PROXY_URL` 시크릿 설정** 순서가 필요합니다.

### 1. Fly.io 프록시 배포

무료 공개 CORS 프록시는 IG가 다 막아둬서 자체 프록시가 필수입니다. `proxy/` 디렉토리에 자체 포함 Fly 앱이 있습니다.

```bash
cd proxy
fly launch --copy-config --no-deploy   # 또는 fly apps create <name>
# fly.toml의 app/region을 수정 (kr 사용자는 nrt 권장)
fly deploy
```

배포 후 URL을 메모: `https://<your-app>.fly.dev/`

CLI에서도 같은 프록시를 쓰려면:
```bash
INSTAGRAM_DL_PROXY='https://<your-app>.fly.dev/?url=' node dist/cli.js <url>
```
(CLI는 Node에서 헤더 자유롭게 설정 가능해 보통은 프록시 없이 직접 호출 가능합니다.)

### 2. GitHub Pages 활성화

저장소 **Settings → Pages → Source: GitHub Actions**로 설정.

### 3. `PROXY_URL` 시크릿 설정

저장소 **Settings → Secrets and variables → Actions → New repository secret**:

- Name: `PROXY_URL`
- Value: `https://<your-app>.fly.dev/?url=` ← 끝에 `/?url=` 포함

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 web을 빌드해 GitHub Pages에 자동 배포합니다.

## Scope

- ✅ 공개 포스트/릴의 이미지/비디오/캐러셀 다운로드
- ❌ **스토리, 비공개 계정, 로그인 필요한 콘텐츠** — v1 범위 밖 (인증 필요)
- ❌ 일괄/대량 다운로드, 큐, 히스토리

자세한 의도는 `BRIEF.md`, 결정 근거는 `DECISIONS.md` 참고.

## 알려진 한계

- 인스타그램이 공개 엔드포인트를 자주 변경합니다 — 동작이 깨지면 `DECISIONS.md`의 스파이크 결과를 다시 검증해야 할 수 있습니다.
- 무료 공개 CORS 프록시(`corsproxy.io` 등)는 끊기거나 레이트 리밋이 걸리는 경우가 있습니다. 위의 프록시 변경 방법으로 대안을 지정하세요.
- 같은 사용자의 13번째 이상 옛 포스트는 web_profile_info로 가져올 수 없습니다. CLI는 og: 경로로 더 멀리까지 동작합니다.
