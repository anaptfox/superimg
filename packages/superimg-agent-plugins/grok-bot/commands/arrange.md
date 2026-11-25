---
name: arrange
description: Pick a perceptual arrangement that names the work it removes, or answer in text.
---

Name the reader's question and the work the picture would externalize.
If you cannot, answer in text or a table.

If you can, write the arrangement as JSON and use the door — you do not
need to author a `*.media.ts` file:

```bash
superimg check spec.json                     # admission, no browser
superimg export spec.json --for 1080x1080.png --json  # bytes on disk
```

Patterns: `point-with-context`, `registered-comparison`, `aligned-intervals`,
`value-against-reference`, `mechanism-strip`.

Always `--check` first. A refusal names the invariant that cannot hold —
the pattern does not apply, so do not ship a generic card. Attach the
reported artifact path. This plugin is knowledge; it does not dispatch.
