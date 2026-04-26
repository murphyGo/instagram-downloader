# Plan

> Flat checklist. Checking items off IS the project state.

## Commands

- **Install**: `npm install`
- **Build CLI**: `npm run build:cli`
- **Build Web**: `npm run build:web`
- **Dev Web**: `npm run dev`
- **Test**: `npm test`
- **Run CLI**: `node dist/cli.js <url>` (or `npx instagram-dl <url>` after publish)

## Tasks

### Setup

- [x] Node.js + TypeScript 프로젝트 초기화 (package.json, tsconfig.json, .gitignore)
- [x] 디렉토리 구조: `src/scraper.ts` (공유), `src/cli.ts`, `web/` (Vite app)
- [x] Vite 설치 + GH Pages용 `base` 설정

### Core

- [x] **Scraper 스파이크**: 인증 없이 공개 포스트의 미디어 URL을 얻는 경로 검증 (oEmbed, `?__a=1`, 그래프QL 중 어떤 게 동작하는지). 결과를 `DECISIONS.md`에 기록
- [x] `scraper.ts`: `fetchMedia(url, opts)` → `{type: 'image'|'video', url, ...}[]` 반환. 단일/캐러셀/비디오 모두 처리
- [x] CORS 프록시 어댑터: 브라우저 환경에서만 프록시 경유, Node에서는 직접 fetch. 프록시 URL은 환경변수/쿼리스트링으로 교체 가능
- [x] CLI: `instagram-dl <url> [--out <dir>] [--json]` — 미디어 다운로드 + 진행 출력 + 명확한 exit code
- [x] Web UI: URL 입력 필드, "가져오기" 버튼, 미디어 그리드(이미지 미리보기/비디오 플레이어), 각 항목 다운로드 버튼. 모바일 우선 반응형
- [x] GitHub Actions: `main` push 시 web 빌드 → GH Pages 배포

### Polish

- [x] 에러 처리: 잘못된 URL, 비공개/삭제된 포스트, 프록시 다운, 레이트 리밋
- [x] README: Web URL, CLI 설치/사용법, 알려진 한계 (스토리 미지원, 프록시 필요)
- [x] 스모크 테스트: 알려진 공개 포스트로 Web와 CLI 양쪽 동작 확인

### v1.1: 자체 프록시 (공개 CORS 프록시가 IG에 막혀서 추가)

- [x] Fly.io 프록시 (`proxy/` — server.js + Dockerfile + fly.toml). 인스타+CDN 화이트리스트, FB UA / `X-IG-App-ID` 자동 주입
- [x] Web UI 빌드타임 프록시 주입: `VITE_PROXY_URL` 환경변수
- [x] GH Actions: `secrets.PROXY_URL`을 web 빌드 env로 전달
- [x] README/DECISIONS: Fly 배포 절차 + 시크릿 설정

---

**Conventions**:
- One task ≈ one commit (<200 LOC diff). Split if it grows.
- If a task is blocked, leave it unchecked and skip ahead.
- Add new tasks freely. Reorder freely. Don't nest deeper than one level.
