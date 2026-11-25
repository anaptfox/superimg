# Namespaced child assets

Two independent child modules each declare `assets.logo` with different SVG
bytes: a red circle and a cyan square. The parent calls `time(sequence(...))`
directly: no top-level await or host setup is required for owned bytes. Its
generated root asset map uses the occurrence-qualified keys `first/logo` and
`second/logo`; inside either child, `ctx.asset("logo")` stays local.

Run `superimg check namespaced-assets.media.ts` to compile the normal media
module path.
