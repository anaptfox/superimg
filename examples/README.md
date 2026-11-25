# SuperImg Examples

Write a media program once — play it live, export it anywhere.

The public catalog is indexed in `_templates.json`. For this checkout, install
the workspace dependencies from the repository root using the pinned Node.js
and pnpm versions. See [repository setup](../docs/testing.md).

## Author (CLI)

Use with `superimg check`, `superimg export --for …`, and `superimg dev`.

- **hello-world** — First program
- **og-card** / **url** — Stills and link cards
- **responsive-demo** / **shorts** — Editions and a reel canvas
- **lockup-tour** — One lockup, many materials
- **[superimg-launch](marketing/superimg-launch/README.md)** — The 35-second SuperImg launch film: one shared Peg visual reused across pencil test, poster, website, and multi-format campaign kits
- **feature-launch** / **countdown** / **lower-thirds** — Marketing films
- **karaoke** / **terminal** / **code-reveal** / **code-focus** — Devrel and typed code highlighting
- **stats-card** / **changelog** / **bar-race** — Data that means something
- **chatgpt** / **tweet** / **meetup-announcement** — Interfaces, social, events
- **svg-draw** / **pelican-bicycle** / **wow-demo** — Vector films, not a primitive zoo
- **status-badge** — Static SVG with data variants
- **code-galaxy** — A Three.js native surface with a deterministic particle scene

Code Galaxy uses the CLI's prepared native surface bundle. From the repository
root, check it with:

```bash
just cli check examples/marketing/code-galaxy/code-galaxy.media.ts
```

Standalone projects outside that passive-player catalog include
[request-journey](basics/request-journey/README.md), an interactive lesson with a
browser host; [Braess's paradox](science/braess-paradox/README.md), a traffic
simulation; and [Works](showcase/works/README.md), a composed showcase.

## Embed (apps)

- **lockup-scroll** / **lockup-pointer** — Same tour, `drive="scroll"` vs `drive="pointer"`
- **react-player** — React `Player` host
- **hover-preview** — Hover-to-play
- **podcast-splash** — `collection()` batch
- **agent-investigation** — Explore an authored explanation with application controls

- **[queue-explainer](apps/queue-explainer/README.md)** — Interrupt a live explanation with controls or optional AI direction
- **[revision-review](apps/revision-review/README.md)** — Exact source edits, frozen before/after captures, prepared batch rehearsal and export

## Media libraries

[Campaign library](marketing/campaign-library/README.md) shares artwork between a still and a film, with explicit copy variants, square art direction and multiple delivery formats. For live applications, reuse the scroll/pointer and interactive hosts above; [Story Kit](composed/story-kit/README.md) retains a story for timed output and host-controlled presentation through `present()`.
