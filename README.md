# aidlc-lite

A lightweight, solo-developer-first AIDLC starter. Three files, two skills. No approval gates, no audit logs, no per-stage paperwork.

## Why this exists

[AWS AI-DLC](https://github.com/aws-samples/sample-aws-ai-dlc-rules) and [aidlc-starter](https://github.com/murphyGo/aidlc-starter) are excellent for team projects with stakeholders, compliance needs, and 5k+ lines of code. They are too heavy for personal projects: ~20 approval gates, ~18k lines of rules, and a documents-to-code ratio that inverts on small work.

`aidlc-lite` keeps the genuinely useful core — one round of intent clarification, a one-page brief, an append-only decision log, a flat checklist — and drops everything else.

| What's kept | What's dropped |
|---|---|
| 5-question idea capture | User stories with personas |
| 1-page `BRIEF.md` | `audit.md` (git log replaces it) |
| Flat `PLAN.md` checklist | Per-stage approval gates |
| Append-only `DECISIONS.md` (ADR) | functional / NFR / infra design as separate stages |
| `/lite-init`, `/lite-dev`, `/code-review` | reverse-engineering, cross-check, refinement-log, TECH-DEBT.md |
| 7 deep-analysis review protocols (concurrency, security, etc.) | session log integration, NFR docs |

## When to use this

Use **aidlc-lite** if:
- Solo developer, no stakeholders
- Personal project, prototype, hackathon, side project
- < ~3k lines of code expected
- You want to ship, not document

Use **full AI-DLC / aidlc-starter** if:
- Multi-developer team
- Compliance / audit trail required
- Hand-off to others is likely
- 5k+ lines, multiple modules, real NFRs

## Quick start

```bash
# 1. Clone this template
git clone <this-repo-url> my-project
cd my-project

# 2. Detach from this template's git history
rm -rf .git
git init

# 3. In Claude Code, run:
/lite-init

# 4. Answer 5 questions. BRIEF.md, PLAN.md, DECISIONS.md are generated.
# 5. Push to your own repo
git remote add origin git@github.com:you/my-project.git
git add . && git commit -m "Initial brief and plan"
git push -u origin main

# 6. Start building
/lite-dev    # picks the next unchecked PLAN.md item, implements it
```

## What you end up with

```
my-project/
├── BRIEF.md         # 1 page: problem, MVP, tech, out-of-scope, success
├── PLAN.md          # flat checklist; checking items off IS your state
├── DECISIONS.md     # append-only ADR log for non-obvious choices
├── CLAUDE.md        # project context for Claude Code
└── .claude/skills/
    ├── lite-init/   # re-runnable: refine the brief / replan
    ├── lite-dev/    # the dev driver
    └── code-review/ # deep review with conditional protocols
        └── protocols/  # concurrency, security-boundary, ... (lazy-loaded)
```

No `aidlc-docs/`, no `audit.md`, no `aidlc-state.md`. The three root files are the entire spec.

## The three skills

### `/lite-init`
Five questions (one shot — answer what you can, skip the rest). Generates `BRIEF.md`, `PLAN.md`, `DECISIONS.md`, and a project-specific `CLAUDE.md`. Re-runnable: detects existing files and offers to refine.

### `/lite-dev`
Reads `PLAN.md`, picks the next unchecked task, reads `BRIEF.md` for context, implements it, checks the box, optionally appends a `DECISIONS.md` entry if a non-obvious choice was made. That's the loop.

The commit is the approval gate. There is no other gate.

### `/code-review`
Deep review for pending changes (defaults to `git diff`). Adapted from aidlc-starter:
- Language patterns (Go / Python / TS-JS / Rust)
- Framework patterns (FastAPI / Django / Flask / Express / NestJS / React / Next.js / Gin / Echo / etc.)
- 7 deep-analysis protocols loaded **only when their signals appear** in the code: concurrency, data-integrity, error-contract, memory, performance, resource-lifecycle, security-boundary
- Reads `BRIEF.md` and `DECISIONS.md` to avoid flagging out-of-scope features as "missing"

Run it when you want — typically before a commit. It is **not** a gate inside `/lite-dev`.

## Design principles (and what we refuse to add)

1. **No approval gate inflation.** "Continue to Next Stage?" prompts grow back into full AIDLC if you let them. We don't.
2. **Three files, not three templates.** `BRIEF.md` is prose with bullets, not a fill-in-the-blank form with FR-001 numbering.
3. **Git is the audit log.** No `audit.md`, no "raw input never summarized" rules.
4. **State lives in the checklist.** `PLAN.md` checkboxes ARE the state. No separate `aidlc-state.md`.
5. **Promotion is one-way and manual.** If your project outgrows aidlc-lite, copy the files into an aidlc-starter project. No two-way sync, no auto-migration.

## License

MIT.
