# Assets

SuperImg provides two ways to use assets (images, videos, audio) in templates:

1. **`ctx.asset(filename)`** — Zero-config. Drop files in an `assets/` folder next to your template.
2. **`config.assets` + `ctx.assets`** — Declared assets with preloaded metadata (dimensions, duration, size).

## Table of Contents

- [Quick Start](#quick-start)
- [Declared Assets](#declared-assets)
- [Asset Metadata](#asset-metadata)
- [Data-Driven Assets](#data-driven-assets)
- [Soft Validation](#soft-validation)
- [Best Practices](#best-practices)

---

## Quick Start

Drop files into an `assets/` folder next to your template file and reference them with `ctx.asset()`:

```
my-template/
  my-template.media.ts
  assets/
    logo.png
    background.jpg
```

```typescript
import { define } from '@foxworth/superimg';

export default define({
  render(ctx) {
    return `
      <img src="${ctx.asset('logo.png')}" />
      <div style="background: url('${ctx.asset('background.jpg')}')"></div>
    `;
  },
});
```

No config needed. `ctx.asset()` returns a URL string for any file in the co-located `assets/` folder.

---

## Declared Assets

When you need asset metadata (dimensions, duration, file size), declare assets in `config.assets`. The runtime preloads them and makes metadata available via `ctx.assets`:

```typescript
import { define } from '@foxworth/superimg';

export default define({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    assets: {
      logo: { url: '/images/logo.png' },
      hero: { url: '/videos/hero.mp4' },
    },
  },
  render(ctx) {
    const { logo, hero } = ctx.assets;

    return `
      <img src="${logo.url}" width="${logo.width}" height="${logo.height}">
      <div>Video duration: ${hero.duration.toFixed(1)}s</div>
    `;
  },
});
```

---

## Asset Declaration

Assets are explicit URL or owned-byte declarations. Bare path strings are not
accepted, so the runtime can freeze every dependency during preflight.

### Source ownership

For CLI check/inspect/export and Node source interactions, declared local asset, audio and font paths
resolve relative to the selected media source. They must stay inside its owning
project. The host freezes those files into bytes before calling the value runtime,
so invoking the command from another directory does not change those resources.

Development preview also resolves local paths from the media source directory.
It serves declared files through the asset registry and loads local font faces
alongside browser-loaded Google Fonts.

For browser hosts and imported composition children, supply portable bytes or
HTTP(S) URLs, or bind an explicit source base when preparing a composition. A
value passed directly to the runtime has no source filename from which to infer
relative paths. Browser hosts may supply resolved font CSS through Player load
options. Import `isMediaElement` alongside the `MediaElement` type from
`@foxworth/superimg` when accepting a typed media tree in a host.

### URL declaration

```typescript
config: {
  assets: {
    logo: { url: '/images/logo.png' },
    bgVideo: { url: '/videos/background.mp4' },
    music: { url: '/audio/soundtrack.mp3' },
  }
}
```

The asset type is auto-detected from the file extension:
- **Images:** `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
- **Videos:** `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`
- **Audio:** `.mp3`, `.wav`, `.ogg`, `.aac`, `.m4a`, `.flac`, `.opus`

### Bytes declaration

Use caller-owned bytes when the media program already has the exact content:

```typescript
config: {
  assets: {
    avatar: { url: 'https://api.example.com/avatar', type: 'image' },
    logo: { bytes: logoBytes, mimeType: 'image/png' },
  }
}
```

---

## Asset Metadata

Each asset in `ctx.assets` includes full metadata extracted at load time:

### Image Assets

```typescript
interface ImageAssetMeta {
  type: 'image';
  url: string;           // Resolved URL
  width: number;         // Natural width in pixels
  height: number;        // Natural height in pixels
  size: number;          // File size in bytes
  mimeType: string;      // e.g., 'image/png'
}
```

### Video Assets

```typescript
interface VideoAssetMeta {
  type: 'video';
  url: string;           // Resolved URL
  width: number;         // Video width in pixels
  height: number;        // Video height in pixels
  duration: number;      // Duration in seconds
  size: number;          // File size in bytes
  mimeType: string;      // e.g., 'video/mp4'
}
```

### Audio Assets

```typescript
interface AudioAssetMeta {
  type: 'audio';
  url: string;           // Resolved URL
  duration: number;      // Duration in seconds
  size: number;          // File size in bytes
  mimeType: string;      // e.g., 'audio/mpeg'
}
```

### Using Metadata for Layout

```typescript
render(ctx) {
  const { std } = ctx;
  const { productImage, promo } = ctx.assets;

  // Use image dimensions for layout
  const aspectRatio = productImage.width / productImage.height;
  const isWide = aspectRatio > 1.5;

  // Use video duration for timing
  const videoDuration = promo.duration;
  const showVideo = ctx.timeline.seconds < videoDuration;

  return `
    <div class="${isWide ? 'landscape' : 'portrait'}">
      <img src="${productImage.url}"
           style="aspect-ratio: ${productImage.width}/${productImage.height}">
    </div>
    ${showVideo ? std.video.sync({ src: promo.url, at: ctx.timeline.seconds }).html : ''}
  `;
}
```

---

## Data-Driven Assets

For templates where asset URLs come from data (e.g., user-provided images), pass assets as data properties:

```typescript
import { define } from '@foxworth/superimg';

export default define<{
  title: string;
  productImage: string;  // URL provided by caller
}>({
  sample: {
    title: 'Product',
    productImage: '/images/placeholder.png',
  },
  render(ctx) {
    const { title, productImage } = ctx.data;

    return `
      <h1>${title}</h1>
      <img src="${productImage}">
    `;
  },
});
```

For data-driven assets, the caller provides URLs and they're used directly. If you need metadata for data-driven assets, load them in `config.assets` with keys matching your data fields.

---

## Soft Validation

SuperImg uses **soft validation** for assets. If your template uses asset URLs that aren't declared in `config.assets`, you'll see a warning but rendering will continue:

```
⚠️ Template uses undeclared asset: /images/icon.png
   Consider adding to config.assets for reliable preloading
```

This helps catch assets that might not be preloaded, which could cause:
- First-frame flicker (asset loading mid-render)
- Non-deterministic renders (race conditions)
- Missing metadata in `ctx.assets`

---

## Best Practices

### 1. Declare All Static Assets

For predictable renders, declare all assets your template uses:

```typescript
config: {
  assets: {
    logo: { url: '/images/logo.png' },
    background: { url: '/images/bg.jpg' },
    icon: { url: '/images/icon.svg' },
  }
}
```

### 2. Use Metadata for Responsive Layout

Let asset dimensions drive layout instead of hardcoding:

```typescript
render(ctx) {
  const { hero } = ctx.assets;

  // Good: Use actual dimensions
  return `<img src="${hero.url}"
               style="aspect-ratio: ${hero.width}/${hero.height}">`;

  // Avoid: Hardcoded dimensions
  // return `<img src="${hero.url}" width="1920" height="1080">`;
}
```

### 3. Handle Missing Assets Gracefully

Assets that fail to load get fallback metadata (dimensions = 0). Check for this:

```typescript
render(ctx) {
  const { logo } = ctx.assets;

  if (logo.width === 0) {
    return `<div class="placeholder">Logo not available</div>`;
  }

  return `<img src="${logo.url}" width="${logo.width}">`;
}
```

### 4. Use `std.video.sync` for Embedded Video

Headless render cannot rely on `<video autoplay>`. Use `std.video.sync` — it emits marked `<video>` elements and Playwright seeks to the correct frame before capture:

```typescript
render(ctx) {
  const { std } = ctx;
  const { intro } = ctx.assets;

  const introDone = ctx.timeline.seconds > intro.duration;
  if (introDone) return `<div class="content">...</div>`;

  const clip = std.video.sync({ src: intro.url, at: ctx.timeline.seconds });
  return clip.html;
}
```

Options: `src`, `at` (output timeline seconds, default caller passes `timeline.seconds`), `start` (offset into source), `playbackRate`, `objectFit`, `muted`.

---

## Environment Support

Assets work in all SuperImg environments:

| Environment | Asset Preloading | `ctx.assets` Metadata |
|-------------|------------------|----------------------|
| CLI (Playwright) | ✅ | ✅ |
| Browser Player | ✅ | ✅ |
| Dev Server | ✅ | ✅ |

---

## Next Steps

- [Templates & Data](./templates-and-data.md) - Template basics and data flow
- [Project Configuration](./project-config.md) - Global and folder-level config
- [Rendering Architecture](./rendering-architecture.md) - How rendering works
