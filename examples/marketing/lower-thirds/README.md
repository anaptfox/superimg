# Lower Thirds Example

A transparent, broadcast-style speaker ID. Risograph paper slab: bone stock, ink
type, one terracotta bar, and deliberate misregistration on the name.

## Quick Start

```bash
npx superimg check examples/marketing/lower-thirds/lower-thirds.media.ts --pretty
npx superimg export examples/marketing/lower-thirds/lower-thirds.media.ts --for youtube
npx superimg dev examples/marketing/lower-thirds/lower-thirds.media.ts
```

## What You'll Learn

- `Frame` / `Safe` composition for a product-specific overlay on a transparent root
- `ctx.director()` for explicit enter, hold, and exit phases
- `std.stagger.ms()` for capped, wall-clock entrance and reverse exit cascades
- `std.interpolate()` driving a `clip-path` paper unroll rather than a slide
- Riso misregistration: an accent-colored copy of the name offset behind the ink copy
- Responsive font, padding, and slab sizing through `ctx.isPortrait`

## Timeline

The four-second scene uses a 0.85s entrance, 2.5s hold, and 0.65s exit. Four beats
enter in order — bar grows, paper unrolls, name rises, title follows — and reverse
on the way out.

## Customize It

Edit `sample`, provide live Player data, or use a collection for batch speaker ids.
`accentColor` drives both the bar and the misregistered name ghost.

## Next Steps

- [Hello World](../../basics/hello-world/) — Animated title card
- [Countdown](../countdown/) — Split-flap countdown board
