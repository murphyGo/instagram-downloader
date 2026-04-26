# Lite Init Skill

Bootstrap a personal project from a rough idea in one shot. Five questions, three files generated.

## Arguments

- `$ARGUMENTS` — (optional) the idea as a sentence. If provided, skip Q1.

## Objective

Generate `BRIEF.md`, `PLAN.md`, `DECISIONS.md`, and a project-specific `CLAUDE.md` from a single round of dialogue. Replace the template's `README.md` with a project README. Leave the three skills (`lite-init`, `lite-dev`, `code-review`) in place. **Do not** create `aidlc-docs/`, `audit.md`, `aidlc-state.md`, or any refinement-log.

## Execution Steps

### Step 1: Detect existing state

Check the project root for two signals:
- **BRIEF signal**: does `BRIEF.md` exist?
- **Code signal**: do any source files or project manifests exist? Look for: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, `Gemfile`, `composer.json`, OR any `src/` / `lib/` / `app/` directory with source files (`.py`, `.ts`, `.tsx`, `.js`, `.go`, `.rs`, `.java`, `.rb`, `.php`).

| BRIEF | Code | Mode | Action |
|-------|------|------|--------|
| absent | absent | **Greenfield** | Proceed to Step 2 directly |
| absent | present | **Brownfield** | Run Step 1a first, then Step 2 with extracted context |
| present | any | **Refinement** | Read it, ask: "Existing BRIEF.md found. Refine it (R), regenerate from scratch (X), or cancel (C)?" |

For Refinement: R → Step 2 with the existing brief as context. X → rename existing to `BRIEF.md.bak`, proceed as Greenfield/Brownfield based on Code signal. C → stop.

### Step 1a: Brownfield context extraction (only if Code signal present)

Before asking the 5 questions, build a quick mental model from what's already there. Do NOT read every file — just enough to fill in obvious answers:

1. **Tech stack** — read the manifest (`package.json` dependencies, `pyproject.toml` deps, `go.mod`, `Cargo.toml`). Identify language, framework, key libs.
2. **Structure** — list top-level directories and their roles. One paragraph max.
3. **Existing README** — read if it exists. It often answers Q1–Q3.
4. **Test/build commands** — extract from `package.json` scripts, `Makefile`, `pyproject.toml` `[tool.*]` sections.

Then in Step 2, **pre-fill** the questions with what you found and ask the user to confirm/correct rather than answer from scratch:

```
I see this is an existing project. Here's what I picked up — confirm or correct:

1. **One-liner** — looks like: <inferred from README or structure>
2. **Problem & user** — <inferred or "unclear from code, please describe">
3. **MVP features** — what's done so far: <list>; what's still missing for v1?
4. **Tech stack** — <detected>: confirm?
5. **Out of scope + success** — anything you're explicitly NOT building, and what does "v1 ships" look like?

Answer only what needs correction or filling in.
```

**Brownfield BRIEF rules** (override Step 4 *structure*, not the ≤1 page length cap):
- BRIEF's "MVP features" section MUST distinguish **Done** vs **Remaining**
- BRIEF's "Tech" section reflects what's **detected**, not aspirational
- PLAN.md tasks should target the **Remaining** features, not redo what's done
- DECISIONS.md gets one entry: "Adopted from existing codebase on {date}: <one-line summary of inherited tech choices>"

### Step 2: One-shot question block

Present **all five questions at once**. The user answers what they can, in any format, and may write `skip` for any.

```
Let's capture your idea. Answer what you can — skip the rest.

1. **One-liner** — what is this in one sentence?
2. **Problem & user** — what problem does it solve, and who has it? ("me" is a valid answer)
3. **MVP features** — 3 things that must work for v1?
4. **Tech stack** — language / framework / data store? (write "recommend" if unsure)
5. **Out of scope + success** — what are you explicitly NOT building, and how will you know it's done?
```

Wait for the user's response. **Do not loop.** One round only.

### Step 3: Fill gaps with defaults

For any skipped question, apply these defaults silently:

| Skipped | Default |
|---------|---------|
| One-liner | Synthesize from problem + features |
| Problem | "Personal need: [first feature]" |
| Features | If user gave any, use them; else ask one targeted follow-up |
| Tech stack | Recommend based on the project type (CLI → Python; web API → Go or Node; web app → Next.js; data → Python+SQLite) and note rationale in `DECISIONS.md` |
| Out of scope | List the obvious omissions (auth, multi-user, deployment) |
| Success criteria | "v1 ships when MVP features work end-to-end" |

If features are entirely missing AND can't be inferred, ask **one** follow-up: "What are 2-3 things this needs to do?" Otherwise proceed.

### Step 4: Generate the three files

Behavior depends on the mode picked in Step 1:

| Mode | Source | Output |
|------|--------|--------|
| First init (Greenfield or Brownfield) | Read `templates/BRIEF.md`, `templates/PLAN.md`, `templates/DECISIONS.md` | Write filled copies to project root |
| Refinement (R) | Read existing root `BRIEF.md` / `PLAN.md` / `DECISIONS.md` | Edit them in place — do NOT touch `templates/` |
| Refinement (X) | Step 1 already renamed existing files to `.bak`; treat as a first init | Read from `templates/` if still present; if `templates/` was already consumed, reuse the `.bak` files as a starting point and note this in `DECISIONS.md` |

**Generation rules:**
- `BRIEF.md` — keep under 1 page (~50 lines). Prose with bullets. No FR-001 numbering. No NFR sections unless user mentioned perf/security explicitly.
- `PLAN.md` — flat checklist of 5–15 tasks grouped by phase (Setup / Core / Polish are common, but adapt). Inline build/test commands at the top once tech is decided. No "units," no nested stage headings.
- `DECISIONS.md` — append one entry for each non-obvious choice made during init (e.g., recommended tech stack, deferred features). Format: `## YYYY-MM-DD: <title>` then 2-4 lines of rationale. Use today's date as provided by the system.

### Step 5: Generate project CLAUDE.md

**Replace** the template's `CLAUDE.md` with a project-specific one:

```markdown
# {Project Name}

{One-liner from BRIEF.md}

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

- {Language / Framework / Data — pulled from BRIEF.md}

## Build / test commands

{Inline from PLAN.md top section, or "TBD" if not yet decided}

## Conventions

- Commit is the approval gate. No other gates.
- One PLAN.md task per commit when possible.
- If a non-obvious choice is made during dev, append to `DECISIONS.md`.
```

### Step 6: Replace template README

**Replace** the template's `README.md` with a minimal project README:

```markdown
# {Project Name}

{One-liner}

## Status

In development. See `PLAN.md` for progress.

## Run

{Build/test/run commands once they exist, else "TBD"}
```

### Step 7: Clean up template artifacts

- Delete `templates/` if it exists (the templates have been consumed). On Refinement runs `templates/` is typically already absent — skip silently in that case.
- Leave `.claude/skills/lite-init/`, `.claude/skills/lite-dev/`, and `.claude/skills/code-review/` in place — all three are part of the runtime toolkit.
- **Do not** touch `.git/` — the user manages that themselves (per the README quick start, they typically `rm -rf .git && git init` before cloning).

### Step 8: Final report

Print a short summary:

```
✓ BRIEF.md, PLAN.md, DECISIONS.md generated
✓ CLAUDE.md and README.md replaced for this project
✓ Templates consumed and removed

Next: run /lite-dev to start on the first PLAN.md task.
```

**Do not** offer to commit. The user does that.

## Guidelines

- **One round only.** Do not loop on follow-ups. If something critical is missing, ask one targeted question and accept whatever comes back.
- **Default aggressively.** A reasonable default written in `DECISIONS.md` is better than another round of questions.
- **No suggestion menus.** Do not present "Here are 8 things I noticed about your idea" the way `/init-project` does. The user already knows their idea.
- **Resist scope creep.** If you find yourself wanting to add user stories, NFR docs, or stage gates — stop. That is not this skill.

## Example invocations

- `/lite-init` — fresh start, idea will come from the dialogue
- `/lite-init "a CLI that summarizes my git activity for standups"` — pre-seeds Q1
- `/lite-init` (when `BRIEF.md` already exists) — offers refine / regenerate / cancel
