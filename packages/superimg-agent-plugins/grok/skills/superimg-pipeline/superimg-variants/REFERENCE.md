---
name: superimg-variants
description: >
  Deliver one SuperImg media program to YouTube, portrait, square, custom sizes,
  content variants, and exact-aspect editions.
version: 0.1.1-media-library.20261022.1
---

# SuperImg Responsive Delivery

One story, many canvases. Keep platform delivery out of authored content.

1. Make the root render responsive through `ctx.width`, `ctx.height`, `createResponsive(ctx)`, and `Safe` / `getSafeBox` from `@foxworth/superimg/stdlib`.
2. Add root `editions` only where an exact aspect ratio needs different art direction. Square chat stills (`instagram-square`, `1080x1080`, `1440x1440`) fail `MISSING_EDITION` unless the root is already square or `editions.square` exists — export will not letterbox landscape art. Tiny ink on that square stage fails `SPARSE_FOCAL`.
3. Use root `variants` only for content/data patches.
4. Pass `--for` to `check`, `inspect`, and `export` to verify layout, review contact sheets, and export at target dimensions:

```bash
superimg check launch.media.ts --for 1080x1920 --craft
superimg inspect launch.media.ts --for 1080x1920 --at 0.8s,1.9s --review
superimg export launch.media.ts --for 1080x1920 --review -o launch-9x16.mp4
superimg export launch.media.ts --for youtube --for instagram-square --for tiktok
```

Built-in organic ids are `youtube`, `instagram-square`, `tiktok`, `linkedin`, `facebook`, `x`, `pinterest`, `threads`, and `reddit`.

For an animated source targeting a still, provide a poster or `--at`. A static source cannot be promoted to video.
