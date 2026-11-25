---
name: superimg-brief
description: >
  Turn a vague video request into a structured SuperImg brief (audience, beats,
  format, tone, must-show facts). Use when the user wants a video idea, reel
  script, launch announce outline, explainer structure, or "what should this
  video say" before writing *.media.ts. Hands off to video-designer or superimg.
version: 0.1.1-media-library.20261022.1
---

# SuperImg Brief

Ideate first; implement second. Output a **structured brief**, then route.

## Output contract (always produce this)

```yaml
audience:          # who watches
goal:              # one sentence outcome
format:            # youtube | reel | square | gif | still | multi
length_seconds:    # target total
beats:             # ordered list
  - name:          # hook | demo | proof | cta …
    seconds:       # or percent of total
    visual:        # what is on screen
    focal:         # subject the viewer should follow
    purpose:       # reading | transition | camera travel | process | material
    acceptance:    # observable condition, e.g. rooftops stay in view during rise
    evidence:      # authored time or range to inspect, e.g. 17.7s or [17s,19s]
    text:          # on-screen copy if any
    voiceover:     # optional VO line
must_show:         # 1–3 non-negotiable visual facts
tone:              # motion + color mood (calm, punchy, playful, broadcast)
palette:           # 2–4 hex if known, else mood words
destinations:      # youtube, instagram-square, tiktok, or custom WIDTHxHEIGHT.format
constraints:       # brand, logos, safe areas, no-face, etc.
next:              # video-designer | superimg | animator
```

## How to brief

1. **One goal.** If the user lists five messages, pick the primary and park the rest.
2. **Beats = director phases or named parts.** Prefer 3–5 beats mapped to `ctx.director({ … })` or retained `Program`/`sequence()`/`time()` composition.
3. **Format drives composition.**
   - `youtube` / horizontal → 16:9, room for titles + lower thirds
   - `reel` → 9:16, large type, center-safe, shorter holds
   - `square` → feed / carousel still or short loop
   - `gif` → short loop, limited palette complexity
   - `still` → single frame, no director
4. **Must-show ≤ 3.** Everything else is decoration.
5. **Motion purpose.** Reading beats need settled text. Camera travel, processes, and material transformations may remain continuous; state the subject and what must stay understandable.

## Hand-off rules

| Next | When |
|------|------|
| **video-designer** | New look, diagrams, full visual redesign, pedagogical viz |
| **superimg** | Skeleton template, API, timing wiring from an existing look |
| **animator** | Structure exists; motion feels stiff/cluttered |
| **superimg-variants** | Same story, multiple aspect ratios |
| **superimg-pipeline** | User wants idea → MP4 end-to-end |

Do **not** jump to CSS keyframes or browser timers. SuperImg motion is pure `render(ctx)`.

## Tiny example

User: “15s product launch for Instagram Reel”

```yaml
audience: builders on Instagram
goal: Want the waitlist link after one clear demo beat
format: reel
length_seconds: 15
beats:
  - { name: hook, seconds: 3, visual: product UI hero, text: "Ship video from TS" }
  - { name: demo, seconds: 8, visual: 3 feature cards stagger, text: each feature }
  - { name: cta, seconds: 4, visual: logo + URL, text: "superimg.dev" }
must_show: [product UI, one metric, URL]
tone: punchy, dark UI, violet accent
destinations: [tiktok]
next: video-designer
```
