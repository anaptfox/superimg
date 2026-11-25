---
name: superimg-pipeline
description: >
  End-to-end SuperImg video workflow from idea to shipped files. Use when the
  user wants a full video (launch, explainer, reel, product demo) from concept
  through design, build, polish, review, format variants, and render. Routes
  across superimg-brief, video-designer, superimg, animator, superimg-review,
  superimg-variants, and superimg-ship.
version: 0.1.1-media-library.20261022.1
---

# SuperImg Pipeline

Conductor skill: **ideate → design → build → polish → review → variants → ship**.

Each stage names a skill to load. If that skill is not installed, read its
embedded copy in this skill's directory instead: `./<skill-name>/REFERENCE.md`
(same content, bundled so this skill works standalone).

Do not invent CSS, period, unless using `h()` / `Html()`. Motion is pure `render(ctx)`.

## Stages (run in order; skip only when already done)

| # | Stage | Load skill | Exit when |
|---|--------|------------|-----------|
| 1 | **Brief** | `superimg-brief` | Structured YAML brief exists |
| 2 | **Design** | `video-designer` *(if visual-heavy)* | Palette + layout + key frames decided |
| 3 | **Build** | `superimg` | `*.media.ts` compiles; skeleton on screen |
| 4 | **Polish** | `animator` | Motion feels intentional (holds, easing, one focal) |
| 5 | **Review** | `superimg-review` | `check` ok; authored checks and observed visual acceptance accounted for; craft findings listed or fixed |
| 6 | **Responsive delivery** | `superimg-variants` *(if multi-format)* | editions and destinations decided |
| 7 | **Ship** | `superimg-ship` | MP4/GIF/stills (and optional artifact) written |

## Routing heuristics

| User signal | Jump to |
|-------------|---------|
| “Idea / script / what should it say” | brief |
| “Make it beautiful / diagram / redesign” | video-designer |
| “Wire the template / director / std” | superimg |
| “Feels stiff / too fast / cluttered” | animator |
| “Review / QA / is it ready” | superimg-review |
| “Also reel / square / OG” | superimg-variants |
| “Export / render / ship” | superimg-ship |
| “Full video from scratch” | this pipeline from stage 1 |

Light templates (centered card, stats counter) may skip stage 2.
Heavy scenes (diagrams, broadcast layout) should not skip stage 2.

## Non-negotiables

1. **`check` green before final `render`.**
2. Prefer percent director phases; unitful motion times (`"0.3s"`, `"20%"`).
3. One focal motion per beat.
4. No custom render `-o` unless the user asks.
5. For intentional edits in an agent session: `baseline save` → edit → `diff --baseline --expect-only`.

## Success

User can open the shipped file(s) and the brief’s `must_show` items are all visible in the right beats.
