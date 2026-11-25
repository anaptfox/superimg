# Hello World Example

The smallest complete media program: a two-ink riso print where the bars register, the line lands, and the page holds.

## Quick Start

```bash
npx superimg check examples/basics/hello-world/hello-world.media.ts --pretty
npx superimg export examples/basics/hello-world/hello-world.media.ts --for youtube
npx superimg dev examples/basics/hello-world/hello-world.media.ts
```

## What You'll Learn

- `ctx.director()` with explicit enter, hold, and exit phases
- `t.motion()` for a staggered slug → title → caption cascade
- `t.tween()` driving the width of the two ink bars, offset by a beat
- `Frame` / `Stack` / `Text` / `Fill` layout instead of raw markup
- Data-driven title and accent ink through `sample`

The media program uses its default 1920×1080 canvas. Export can request any destination or custom size. Embed the same program with the Player when you need it live in an app.

## Customize It

Edit `sample.title` and `sample.accent`, or supply live Player data. To batch-materialize many prints, wrap the media in `collection({ entries, media })`.

## Next Steps

- [Compose Demo](../compose-demo/) — three scenes cut into one short film
- [Responsive Demo](../responsive-demo/) — one program, two art-directed canvases
