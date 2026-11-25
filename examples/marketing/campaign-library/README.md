# Campaign library

One small campaign contains a still and a two-second film. Both import ordinary
shared artwork; output formats do not get separate source files. The square
edition changes the spacing, and the still's `teams` variant changes the copy.
The film reveals a progress rule and holds its final state.

From the repository root:

```sh
just cli check examples/marketing/campaign-library/launch-card.media.ts
just cli check examples/marketing/campaign-library/launch-film.media.ts
just cli dev examples/marketing/campaign-library/launch-card.media.ts
just cli export examples/marketing/campaign-library/launch-card.media.ts --variant teams --for 640x360.png --for 640x360.html --for 640x640.png
just cli export examples/marketing/campaign-library/launch-film.media.ts --for 640x360.mp4 --for 640x360.webm
```

In an installed consumer package, use its package manager's `superimg` executable
instead of this repository's `just cli`. Run `doctor --json` before native export;
install Chromium only when it reports `CHROMIUM_MISSING`.

The same film can be imported by a browser host and loaded into `Player` without
exporting it. See [pointer playback](../../apps/lockup-pointer/README.md) and
[scroll playback](../../apps/lockup-scroll/README.md) for complete hosts. Stateful
controls use the [interactive host](../../apps/queue-explainer/README.md).

This example uses system text and no network assets. Export tests check actual
PNG dimensions, edition pixels and variant copy. They decode MP4 and WebM to check
codec, dimensions, duration, frame rate, timestamps and sampled reveal frames. These checks do not establish
cross-platform font equivalence or artistic approval. The package topology and
fresh-install acceptance cases are separate from this authored example.

JPEG/WebP additionally require the optional Sharp encoder to be available to the runtime. The first qualification reported EXPORT_FORMAT_UNAVAILABLE for WebP; PNG/HTML is the exercised still delivery pair.
