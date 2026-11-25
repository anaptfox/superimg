---
name: superimg-ship
description: >
  Check and export SuperImg media, collections, destinations, custom sizes,
  schema-0 artifacts, and atomic bundles.
version: 0.1.1-media-library.20261022.1
---

# SuperImg Ship

```bash
just cli check path/to/foo.media.ts --for 1080x1920 --craft
just cli inspect path/to/foo.media.ts --for 1080x1920 --at 0.8s,1.9s,6.2s --review
just cli export path/to/foo.media.ts --for 1080x1920 --review -o foo-9x16.mp4
just cli export path/to/foo.media.ts --for youtube --for instagram-square
```

For collections, check/export all entries by default and repeat `--entry` to restrict. Providers execute once per command snapshot.

`--for` on `check`, `inspect`, and `export` accepts organic destination IDs or custom `WIDTHxHEIGHT[.format]`. Animated-to-still requires `--poster` or `--at TIME` in seconds (`0s`, `1.5s`, `1500ms`). Inspect/check accept explicit seconds, milliseconds, `f:N`/`Nf`, or explicit progress such as `50%`.

`check` must be green before calling export done. `UNPAINTED_STAGE` and `LOW_CONTRAST_TEXT` mean the PNG can look blank — paint `Fill` and contrasting Text. `RAW_SVG_IN_HTML` means raw `<svg>` was placed inside `Html()` instead of `Vector(...)` + `vector.*`. `SPARSE_FOCAL` means the square stage is mostly empty; design a square edition, do not crop landscape. `1080x1080` / `instagram-square` without a 1:1 edition (or square root) fails `MISSING_EDITION`. Bundles without a media file: `superimg cortex bundle.json --for 1080x1080.png --at 0` (value-first write, not a `media.export` receipt).

Use `-o <file>` on single-artifact exports when a direct output file path is needed (`-o out.mp4`); otherwise export preflights the full matrix and publishes the bundle atomically. Report the receipt and distinguish focused checks from full repository verification.

**Never shell out to `ffmpeg` or `magick montage` to extract frames or build contact sheets.** For one authored movie, `superimg export film.media.ts --for 1920x1080.mp4 --review -o film.mp4 --json` retains a post-encode `contact-sheet.png` and frame PNGs decoded from the exact published bytes (and automatically samples director act/phase holds when no `*.review.ts` companion or `--at` is given). WebM is also supported. Use one explicit target and select any variant/edition alternatives explicitly. The response keeps `publication.state` and `review.state` separate and links local hashed artifacts. A failed/cancelled review can leave a successfully published movie: inspect the receipt before retrying. See `superimg-review` for limits and evidence scope; technical completion leaves visual acceptance unreviewed.

## Attaching versus publishing

`superimg export spec.json --for 1080x1080.png` publishes a local export bundle and returns a receipt. The caller separately decides whether to attach that picture to a conversation. The inline Boundary interaction `media.arrange.still` returns PNG bytes without publishing files; its empty durable footprint does not describe the CLI command. See the `superimg-arrangements` skill.

Request-mode `media.export` creates a proposal for a host that supplies approval, grants and execution. The CLI's current Reach exposes only direct describe/check/inspect/thumbnail/arrange; it does not install request-mode export Control. Grok Bot's plugin provides knowledge for trusted native CLI invocation, not a binding or grant. Possessing bytes, a plugin, or a file is not authority to publish externally. A green `check` does not supply that authority.
