# Lower Thirds Example

A broadcast-style lower third graphic — the kind you see on TV or YouTube
identifying a speaker. Slides in from the left with staggered animation,
holds, then slides back out.

## Quick Start

```bash
# Development mode (browser preview with hot reload)
pnpm dev

# Render to file
pnpm render
```

## What You'll Learn

This template demonstrates staggered element animation with directional
slide transitions:

| Function | What it does here |
|----------|-------------------|
| `std.easing.easeOutCubic(t)` | Smooth deceleration on slide-in entrance |
| `std.easing.easeInCubic(t)` | Smooth acceleration on slide-out exit |
| `std.math.lerp(a, b, t)` | Interpolate translateX from off-screen to final position |
| `std.math.clamp(val, 0, 1)` | Create timed phases with stagger offsets |
| `std.color.alpha(color, opacity)` | Semi-transparent backgrounds and accent glow |

It also demonstrates:
- **Staggered animation**: Bar appears first, then name, then title (0.15s and 0.35s offsets)
- **Reverse-order exit**: Title leaves first, then name, then bar
- **Responsive sizing**: Font sizes and padding adapt via `ctx.isPortrait`
- **Overlay-ready**: Transparent background for compositing over video

## Animation Timeline (4 seconds)

```
Time:  0.0   0.5   1.0   1.5   2.0   2.5   3.0   3.5   4.0
       |--ENTER--|------HOLD------|---EXIT---|
Bar:   ====>                               <====
Name:    =====>                          <=====
Title:      =====>                    <=====
```

## Customize It

Edit the defaults in `template.js`:

```js
export const defaults = {
  name: "Jane Doe",
  title: "Senior Engineer, Acme Corp",
  accentColor: "#3b82f6",
};
```

Try different accent colors: `#ef4444` (red), `#22c55e` (green), `#f59e0b` (amber), `#8b5cf6` (purple).

## Next Steps

- [hello-world](../hello-world) — Animated title card with fade-in/out
- [countdown](../countdown) — Countdown timer with particle effects
- [assets-demo](../assets-demo) — Backgrounds, audio, and template defaults
