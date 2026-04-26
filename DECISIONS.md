# Decisions

> Append-only ADR log. Only record choices future-you would wonder about.
>
> Format: each entry is `## YYYY-MM-DD: <short title>` followed by a `**Why**:` paragraph. Newest entries at the bottom.

---

## 2026-04-27: TypeScript / Node 단일 언어

**Why**: CLI와 Web UI가 동일한 스크래핑 로직을 공유해야 하고, GH Pages 정적 배포 제약상 web은 브라우저에서 직접 동작해야 함. Python으로 가면 CLI는 깔끔하지만 web 쪽 코드를 처음부터 다시 짜야 함. TS는 양쪽에서 같은 모듈을 임포트해서 쓸 수 있어 중복이 사라짐. 트레이드오프: Python의 `instaloader`/`gallery-dl` 같은 성숙한 라이브러리를 못 씀 — 직접 구현.

## 2026-04-27: Web UI는 CORS 프록시 경유

**Why**: GH Pages는 정적 호스팅만 가능해서 자체 백엔드를 둘 수 없음. 브라우저에서 인스타그램 엔드포인트를 직접 호출하면 CORS로 차단됨. v1은 공개 CORS 프록시(예: `corsproxy.io`)를 경유하고 프록시 URL을 설정 가능하게 둠. 트레이드오프: 무료 공개 프록시는 자주 끊김/레이트 리밋. 자체 호스팅이 필요해지면 Cloudflare Workers free tier로 옮기는 길을 열어두지만 v1엔 안 함. CLI는 Node에서 직접 fetch하므로 프록시 불필요.

## 2026-04-27: 스토리/비공개 콘텐츠 v1 제외

**Why**: 스토리, 비공개 계정, 일부 릴스는 인스타그램 로그인 쿠키가 필요. 사용자가 BRIEF에 "포스트나 스토리"라 적었지만, 쿠키 처리는 보안(쿠키 저장/입력)·법적·유지보수(인스타가 자주 깨뜨림) 비용이 크므로 v1은 공개 포스트로 한정. 동작 검증 후 v2에서 쿠키 입력 필드를 추가하는 옵션을 남겨둠.

## 2026-04-27: CLI는 에이전트 친화 출력

**Why**: BRIEF에서 "다른 에이전트가 활용"을 명시. 사람용 progress 출력은 stderr로 보내고 stdout은 `--json` 시 구조화된 결과만, 미디어 파일 경로 목록 포함. exit code: 0 성공, 1 잘못된 URL/포스트 없음, 2 네트워크/프록시 실패. 이 규약을 README에 박제.

## 2026-04-27: ESM 모듈 시스템 채택 (`"type": "module"`)

**Why**: 브라우저(Vite는 ESM 네이티브)와 Node 양쪽에서 같은 코드를 공유하려면 ESM이 자연스러움. CommonJS로 가면 web 번들과 Node 런타임 사이에 dual-package 문제가 생김. 트레이드오프: TS에서 상대 경로 import가 빌드 산출물의 `.js` 확장자를 명시해야 함 (`import { foo } from './foo.js'`). Node 20+를 요구하는 BRIEF와도 부합.

## 2026-04-27: Vite `root: 'web'` + `base: '/instagram-downloader/'`

**Why**: `index.html`을 web 디렉토리에 두고 Vite의 root로 지정 — 정적 자산과 CLI 코드가 섞이지 않게 분리. base는 GH Pages가 `https://<user>.github.io/<repo>/` 경로로 서빙하는 점을 고정. 다른 이름으로 포크 시 vite.config.ts 한 줄 수정 필요. 빌드 산출물은 `dist-web/`로 분리(`dist/`는 CLI 전용)해서 두 빌드가 충돌하지 않도록 함.

## 2026-04-27: Scraper 스파이크 결과 — 두 가지 경로 채택

**Why**: 2026-04-27 기준 다음 경로 확인:

- ❌ `?__a=1`, oEmbed (`api.instagram.com/oembed`), 임의 doc_id의 GraphQL — 모두 실패 (404/302/403/login wall)
- ✅ **og: 메타 스크래핑** — `GET https://www.instagram.com/p/<shortcode>/` 요청 시 `User-Agent: facebookexternalhit/1.1`을 보내면 og:image, og:video 메타 태그가 풀 HTML에 박혀서 옴. 헤더 한 줄로 끝, 인증·앱ID 불필요. 한계: og:image는 640px 썸네일이고 캐러셀은 첫 항목만 노출.
- ✅ **web_profile_info API 폴백** — `GET /api/v1/users/web_profile_info/?username=<u>` + `X-IG-App-ID: 936619743392459` 헤더로 호출하면 풀 해상도 `display_url`, `video_url`, 캐러셀 `edge_sidecar_to_children` 포함 12개 최근 포스트 반환. og:url에서 username을 뽑아 매칭. (앱ID는 Instagram 웹앱이 공개적으로 노출하는 값.)

**채택**: scraper.ts는 두 경로를 모두 구현하되 og 우선, 캐러셀 또는 풀 해상도 필요 시 web_profile_info로 폴백. 두 경로 모두 fragile(IG가 언제든 깨뜨릴 수 있음) — README/에러 메시지에 명시.

## 2026-04-27: 브라우저 UA 제약 — URL에 사용자명 권장

**Why**: 브라우저 fetch는 `User-Agent` 헤더 설정을 강제로 차단함(forbidden header). 따라서 og: 메타 스크래핑 경로(FB 크롤러 UA 필요)는 브라우저에서 동작 불가. 폴백인 `web_profile_info`는 `X-IG-App-ID` 커스텀 헤더만 쓰므로 CORS 프록시 경유로 OK — **단 username을 알아야 함**. URL이 `/p/<sc>/` 형태면 username을 추출할 수 없어 실패. URL이 `/<user>/p/<sc>/` 또는 `/<user>/reel/<sc>/`이면 정상 동작. CLI는 Node에서 UA 자유롭게 설정 가능해 양쪽 다 OK. v1에서는 footer 안내로 처리, v2에서 자체 워커(Cloudflare Workers) 도입 시 양쪽 모두 해결 가능.

## 2026-04-27: web_profile_info에 UA + Referer 필수

**Why**: 스파이크 때는 curl이 자동으로 정상 헤더를 붙여서 동작했는데, Node fetch의 기본 헤더로는 IG가 `400 SecFetch Policy violation`을 반환. 캐러셀 스모크 테스트에서 발견. `User-Agent`(현실적인 브라우저 UA)와 `Referer: https://www.instagram.com/<username>/`을 추가하면 200으로 풀린다. 브라우저는 이들 헤더를 자동으로 채우므로 corsproxy 경유 시 문제없을 것으로 기대 — 실패하면 프록시 측 헤더 정책을 의심.

## 2026-04-27: v1 스모크 테스트 결과

**Why**: CLI 5케이스 모두 통과(단일 비디오, 캐러셀 10개, 사용자명 없는 /p/, 존재하지 않는 shortcode→exit 1, 파싱 실패 URL→exit 1). stderr/stdout 분리도 동작 확인. **Web UI는 브라우저로 직접 열어보지 않았음** — `npm run build:web` 통과 + dev server 정적 응답 확인까지만 했고 실제 IG 호출/다운로드 흐름은 사용자가 GH Pages에서 검증해야 함. v2 후보: Cloudflare Worker 기반 자체 프록시.

## 2026-04-27: 자체 프록시 (Fly.io)로 전환 — 무료 공개 프록시 전부 막힘

**Why**: v1 web UI를 production에 띄우니 corsproxy.io는 production origin을 403으로 차단(localhost만 무료), allorigins.win은 502, codetabs는 IG가 "useragent mismatch"로 거부, thingproxy는 서비스 종료. 무료 공개 프록시로는 Instagram이 안정적으로 풀리지 않음. `proxy/` 디렉토리에 의존성 없는 ~120줄 Node 프록시(`server.js` + Dockerfile + fly.toml) 추가, Fly.io에 사용자가 `fly deploy`로 배포. 프록시는 인스타+CDN만 화이트리스트, 경로별로 FB UA / 브라우저 UA / `X-IG-App-ID` 자동 주입. Web UI는 빌드타임 `VITE_PROXY_URL`(GH Actions secret `PROXY_URL`)로 프록시 URL 주입. CF Workers 대신 Fly를 고른 이유: 사용자 기존 서비스가 Fly에 있어 운영 중복 회피. 트레이드오프: 0ms 콜드스타트 대신 1~3s, 단일 region(nrt) 레이튼시.

## 2026-04-27: 1순위 경로를 `/embed/captioned/`로 교체 — 12개 한계 + og:type=article 케이스 해결

**Why**: 사용자가 시도한 reel `DWIlp7age_0`은 og:type이 "article"로 와서 og:video가 없고, 작성자(cho.tanky)의 최근 12개 안에도 없어 web_profile_info 폴백도 실패 → 썸네일만 노출. 조사 결과 `https://www.instagram.com/p/<sc>/embed/captioned/`를 FB UA로 호출하면 응답에 `"contextJSON"` JS 문자열로 박힌 JSON 안에 `gql_data.shortcode_media`(__typename, video_url, display_resources, edge_sidecar_to_children 모두 포함)가 어떤 게시물 종류·연식이든 일관되게 들어옴. 단일 요청이고 인증 불필요. 캐러셀의 풀 해상도(1080px)는 `display_resources` 배열의 가장 큰 src를 골라 사용 (`display_url`은 `lookaside.instagram.com/seo/...` 리다이렉터로 와서 확장자 추출이 깨짐). og: + web_profile_info 경로는 폴백으로 유지.

---

*New entries go below, newest at the bottom.*
