# Project Configuration

SuperImg discovers `*.media.ts` and `*.media.js` programs. Media owns content, assets, styling, timing, and default canvas. Delivery destinations and file paths are command/host inputs.

Use root editions for exact-aspect art direction:

```ts
editions: {
  square: { size: { width: 1080, height: 1080 } },
}
```

Use root variants for shallow data changes:

```ts
variants: {
  light: { theme: "light" },
  dark: { theme: "dark" },
}
```

Select delivery independently:

```bash
superimg export launch --for youtube --for instagram-square
superimg export launch --for 1440x1440.mp4
```
