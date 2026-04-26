# Instagram Downloader

인스타그램 포스트 URL을 입력하면 이미지/동영상을 다운로드하는 도구. 모바일 친화 web UI(GH Pages) + 에이전트 친화 CLI.

## Quick reference

| File | Role |
|------|------|
| `BRIEF.md` | Problem, MVP scope, tech, out-of-scope, success |
| `PLAN.md` | Flat checklist — checking items off IS the state |
| `DECISIONS.md` | ADR log for non-obvious choices |

## Skills

- `/lite-dev` — picks the next unchecked `PLAN.md` item, implements it, checks it off
- `/code-review` — review pending changes (defaults to `git diff`); reads `BRIEF.md` for project alignment
- `/lite-init` — re-run to refine `BRIEF.md` if direction changes

## Tech

- **Language**: TypeScript
- **Runtime**: Node.js 20+ (CLI), 브라우저 (Web)
- **Web build**: Vite, 정적 SPA, GH Pages 배포
- **Data**: 없음 — 다운로드는 사용자 디바이스로 직접

## Build / test commands

- Install: `npm install`
- Build CLI: `npm run build:cli`
- Build Web: `npm run build:web`
- Dev Web: `npm run dev`
- Test: `npm test`
- Run CLI: `node dist/cli.js <url>`

(아직 구현 전 — `PLAN.md` Setup 단계 완료 후 활성화)

## Conventions

- Commit is the approval gate. No other gates.
- One PLAN.md task per commit when possible.
- If a non-obvious choice is made during dev, append to `DECISIONS.md`.
- CLI 출력: 진행 메시지는 stderr, 결과(특히 `--json`)는 stdout. exit code는 `DECISIONS.md` 규약 따름.

## When to graduate

If this project grows past ~3k LOC, multiple developers, or real compliance/audit needs, copy `BRIEF.md` into an [aidlc-starter](https://github.com/murphyGo/aidlc-starter) `IDEA.md` and run `/init-project` there. aidlc-lite is intentionally one-way — no migration tool.
