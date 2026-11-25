# @foxworth/superimg-cli

SuperImg's CLI and Node interaction host. Install the CLI and
`@foxworth/superimg` from the same qualified release. This development build
is qualified on Node 26 with an explicit Boundary package artifact; the CLI
tarball alone is not a qualified registry installation.

## Standalone arrangements

Portable arrangement requests are JSON files. They do not need a
project scaffold or a generated TypeScript file.

```sh
superimg check ./board.arrange.json --json
superimg export ./board.arrange.json --for 1920x1080.png --json
superimg export ./board.arrange.json --for 1920x1080.png --at 4s --json
```

`check` reports **admission only**, without launching Chromium or reading
specimen assets. Export also performs admission and runtime preflight, so a
separate check is optional.

Motion patterns can declare a completed-answer poster for still output.
Export reports the selected encoded frame and time. An explicit `--at`
overrides that poster, including `--at 0`. A duration with no encoded answer
frame requires an explicit selection or a longer duration. Moving outputs
retain their full timeline.

Successful arrangement exports return a retained publication receipt, its
manifest, absolute artifact paths, hashes, and byte lengths. The retained
`export.json` also records the arrangement input identity and still selection.
Machine-readable command results use schema version 1 with `ok`, `certainty`
and `certaintyScope`. When a native report or receipt has another schema,
`resultSchemaVersion` identifies that underlying schema; its other fields stay
available on the command result. Failures use `error` to identify the
failure, `findings` contains admission or runtime findings once, and
`publication.state` reports any known local publication state. Usage errors
exit 2; domain refusals exit 1. Command certainty and publication state are
separate. Consumers of the earlier `error.failures` or `effectState` fields
should read `findings` and `publication.state` instead.

Use `check <file>` for admission and `export <file> --for <target>` for the publication receipt and artifact paths.

Arrangement inputs currently reject entry, variant, dry-run,
rasterizer, debug-HTML, and timeout selectors. Authored `*.media.ts` inputs
retain their rich inspection, crop, clip and observer capabilities.
Use `export <file> --duration 6s --for 1920x1080.mp4` when an arrangement
needs an explicit motion duration.
Arrangement editions are declared under `editions` with explicit `size` values;
select one with `--edition`. A destination needs an authored matching aspect.
For one explicit PNG target, `export ... --review` or `arrange ... --review`
retains `review.json` and captured evidence under the owning project's
`.superimg/reviews/`. A standalone file uses its parent directory as the
project root. The result exposes `review.path` for the edition's latest index
and `review.selectionPath` for the selected rendition, clock and review plan;
prior captures remain under `captures/`. Movie export reviews use the same project store and retain a
copy of the exact reviewed movie bytes. The result reports the review outcome
separately from publication. `inspect ... --review` can capture an arrangement
without a project.

Arrangement review detects a uniform blank PNG, named chip wrapping and named
text clipped by rectangular overflow containers. Patterns may mark intentional
text clipping with `data-si-allow-text-clipping="true"` on the text element.
Aligned interval layouts also have a pattern-specific content-height
check. Where the published PNG matches a stable browser capture, named text on
a uniform opaque background is checked against a text-hidden capture. The
packet retains that capture and the browser measurements needed to replay the
calculation. It reports the strongest observed pixel contrast, not a guarantee
that every glyph is legible. Complex
paint, failed capture and mismatched pixels remain unverified. These checks and
an unreviewed visual state do not constitute visual approval.

## Node preparation

`@foxworth/superimg-node/arrangement` exports `readNodeArrangement(path)` for
strict parsing/admission and `prepareNodeArrangement(input, duration?)` for
immutable media preparation. Preparation revalidates admission, resolves
specimen assets, and hashes their bytes with the normalized request and
duration. It returns an arrangement value without TypeScript compilation
metadata. Hosts retain ownership of runtime disposal and publication policy.

See [library operations](../../docs/library-operations.md) for direct source, review, edit and export APIs. The CLI interaction entry remains available for compatibility.
