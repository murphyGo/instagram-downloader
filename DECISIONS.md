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

---

*New entries go below, newest at the bottom.*
