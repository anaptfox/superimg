# Media IR

For extenders: Media IR is the deterministic schema-0 boundary between authoring and playback/export. Authors start at Getting Started; this page is the compile/export contract.

Identity coordinates are:

```text
sourceId + entryId? + variantId + editionId
```

`entryId` exists only for deterministic collections. Entry data stays outside IR; identity includes its digest. Base IR may carry generic schema-0 extension envelopes but does not interpret interactive payloads.

The export planner expands entry × variant × selected edition × requested rendition. The URL-free export bundle records IR/extensions, posters, rendition paths, MIME, dimensions, byte counts, hashes, producer/encoder identity, request digest, and destination-registry digest. Raw collection data and deployment URLs are excluded.

`capabilities.visual` is `"tree"` when sampled frames return media elements, otherwise `"opaque-html"` or `"opaque-svg"`. Serialized IR does not store HTML or trees; inspect walks the live capture. `"tree"` maps to edit capability `inspect-only`.

Schema validation accepts only the current schema-0 shape.
