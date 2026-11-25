# Nested comparison

The inner split screen is one named Program placed into the outer canvas.
The detail clip sits above it. `inspect` retains `split/baseline`,
`split/alternative`, and `detail`, including both placement levels and each
clip's local frame range.

Run `superimg check nested-comparison.media.ts`, then
`superimg export nested-comparison.media.ts --for youtube`.
