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

Drop files into an `assets/` folder next to your `.video.ts` file and reference them with `ctx.asset()`:

```
my-template/
  my-template.video.ts
  assets/
    logo.png
    background.jpg
```

```typescript
import { defineScene } from 'superimg';

export default defineScene({
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
import { defineScene } from 'superimg';

export default defineScene({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    assets: {
      logo: '/images/logo.png',
      hero: '/videos/hero.mp4',
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

Assets can be declared in two forms:

### Shorthand (URL string)

```typescript
config: {
  assets: {
    logo: '/images/logo.png',
    bgVideo: '/videos/background.mp4',
    music: '/audio/soundtrack.mp3',
  }
}
```

The asset type is auto-detected from the file extension:
- **Images:** `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
- **Videos:** `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`
- **Audio:** `.mp3`, `.wav`, `.ogg`, `.aac`, `.m4a`, `.flac`, `.opus`

### Explicit Declaration

For URLs without extensions or to override auto-detection:

```typescript
config: {
  assets: {
    avatar: { src: 'https://api.example.com/avatar', type: 'image' },
    clip: { src: '/media/clip', type: 'video' },
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
  const { productImage, promo } = ctx.assets;

  // Use image dimensions for layout
  const aspectRatio = productImage.width / productImage.height;
  const isWide = aspectRatio > 1.5;

  // Use video duration for timing
  const videoDuration = promo.duration;
  const showVideo = ctx.sceneTimeSeconds < videoDuration;

  return `
    <div class="${isWide ? 'landscape' : 'portrait'}">
      <img src="${productImage.url}"
           style="aspect-ratio: ${productImage.width}/${productImage.height}">
    </div>
    ${showVideo ? `<video src="${promo.url}" autoplay muted></video>` : ''}
  `;
}
```

---

## Data-Driven Assets

For templates where asset URLs come from data (e.g., user-provided images), pass assets as data properties:

```typescript
import { defineScene } from 'superimg';

export default defineScene<{
  title: string;
  productImage: string;  // URL provided by caller
}>({
  data: {
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
    logo: '/images/logo.png',
    background: '/images/bg.jpg',
    icon: '/images/icon.svg',
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

### 4. Use Duration for Video Sync

Sync template animations with video asset duration:

```typescript
render(ctx) {
  const { intro } = ctx.assets;

  // Show intro video, then transition to content
  const introDone = ctx.sceneTimeSeconds > intro.duration;

  return introDone
    ? `<div class="content">...</div>`
    : `<video src="${intro.url}" autoplay muted></video>`;
}
```

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
