# Changelog

## Unreleased

- Added semantic vector authoring with `Vector` and `vector.group/path/defs/mask/clip/text/run`, namespace-aware lowering, geometry/reference diagnostics, and versioned inspect-tree coverage. `render()` roots are now MediaElement trees; use boxed `Html()` for deliberately opaque markup. Removed the shallow `Card`, `LowerThird`, and `Caption` primitives in favor of local `Frame`/`Stack`/`Text` compositions.
- Added omakase input-driven playback: `drive: "scroll" | "pointer"` on `Player` / `PassivePlayer` seeks the authored timeline. Springs are fixed. `Plate({ src })` plus `superimg plate` compile a short photoreal clip to a seekable atlas. Flagship: `examples/marketing/lockup-tour` hosted by `examples/apps/lockup-scroll` and `examples/apps/lockup-pointer`.
- Framed SuperImg as one program with two outcomes: author/ship media and embed the same program in apps (docs: Author · Embed · Extend). Layout tree authoring, check, and export stay on the Author path — not a second product.
- Added concise `video`, `image`, `svg`, and `ogImage` authoring helpers over canonical `MediaDefinition`.
- Added deterministic `collection({ entries, media, id? })` batch materialization with compiler-enforced server isolation.
- Added responsive editions, root data variants, organic destinations, and custom export canvases.
- Added schema-0 discovery and atomic export receipts for host adapters.
- Separated singular interactive media from neutral definitions and passive playback.
