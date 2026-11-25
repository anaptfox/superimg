# Thumbnail guest

Copied and adapted from Boundary `examples/zig/thumbnail` (branch `reach-layer`,
Zig 0.16, zero WASI). SuperImg cannot depend on that example path at
runtime, so the component lives here.

The Boundary template realizes `images.makeThumbnail` and imports `images`. This
guest realizes `media.artifact.thumbnail` and imports only:

- `media.artifacts` — host read of decoded pixel dimensions
- `media.thumbnails` — host write of the scaled thumbnail

It does not decode or encode PNG. The host hands decoded pixels (this guest
only asks for width and height) and encodes the stored bytes. Arithmetic is
the same two multiplies, divide, and min as the Boundary template.

Build: `zig build` in this directory, with `wasm-tools` on PATH.
Output: `zig-out/thumbnail.component.wasm`. Copy it to `thumbnail.component.wasm` to refresh the checked-in fixture used by the host and tests. The current fixture was built with Zig 0.16.0 and wasm-tools 1.261.0.
