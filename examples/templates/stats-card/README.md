# Stats Card Example

An animated stats card with a counting number and progress bar. Demonstrates:

- **Phase timing** — Enter, hold (with count-up), and exit phases
- **Staggered animations** — Label, value, and bar animate in sequence
- **Animated number** — Value counts from 0 to target using `std.math.lerp` + easing
- **Progress bar** — Bar fills based on value/target ratio
- **Color utilities** — `std.color.mix`, `std.color.alpha` for gradients and transparency
- **Responsive sizing** — Adapts to portrait/landscape via `isPortrait`

## Quick Start

```bash
pnpm dev        # Browser preview with hot reload
pnpm render     # Render to output.mp4
```

## Customize

Edit `defaults` in the template or pass data when rendering:

```ts
defaults: {
  label: "Conversion Rate",
  value: 94,
  unit: "%",
  target: 100,
  accentColor: "#10b981",
  secondaryColor: "#6ee7b7",
}
```
