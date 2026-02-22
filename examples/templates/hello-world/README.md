# Hello World Example

An animated title card that fades in, holds, and fades out — a great starting point for learning SuperImg.

## Quick Start

```bash
# Development mode (browser preview with hot reload)
pnpm dev

# Render a specific preset
pnpm render --preset youtube   # 1920x1080
pnpm render --preset reels     # 1080x1920

# Render all presets at once
pnpm render --all              # Both youtube + reels
```

## What You'll Learn

This template demonstrates six stdlib functions across three modules:

| Function | What it does here |
|----------|-------------------|
| `std.easing.easeOutCubic(t)` | Smooth deceleration on element entrances |
| `std.math.lerp(a, b, t)` | Interpolate opacity, position, and hue |
| `std.math.clamp(val, 0, 1)` | Create timed animation phases (enter/hold/exit) |
| `std.color.lighten(color, amount)` | Derive a lighter accent for gradient text |
| `std.color.mix(c1, c2, weight)` | Blend accent with white for a glow effect |
| `std.color.alpha(color, opacity)` | Semi-transparent accent lines and glow |

It also demonstrates **responsive layout** using `ctx.isPortrait` to adjust font sizes and spacing for different aspect ratios.

## Output Presets

This template defines two output presets via `config.outputs`:

| Preset | Resolution | Aspect Ratio |
|--------|-----------|--------------|
| `youtube` | 1920x1080 | 16:9 (landscape) |
| `reels` | 1080x1920 | 9:16 (portrait) |

## Customize It

This template uses a `defaults` export. Override values by passing data, or edit the defaults in `template.js`:

```js
export const defaults = {
  title: "Hello, SuperImg!",
  subtitle: "Create stunning videos from code",
  accentColor: "#667eea",
};
```

Try different accent colors: `#f093fb` (pink), `#4fd1c5` (teal), `#f6ad55` (orange).

## Next Steps

- [countdown](../countdown) — Countdown timer with particle effects
- [server-ts](../server-ts) — TypeScript template with full types
- [assets-demo](../assets-demo) — Backgrounds, audio, and template defaults
