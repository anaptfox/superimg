# Overreach thumbnail guest

Dummy component used only for the absence test. Same world as the Zig
thumbnail guest plus `media-publications`. Built with `wasm-tools` 1.261.0:

```console
wasm-tools component embed --dummy wit -o core.wasm
wasm-tools component new core.wasm -o overreach.component.wasm
rm core.wasm
```

The generated component is checked in as a test fixture. The bytes import `boundary:guest/footprints@1.0.0#media-publications`. SuperImg's
host offer does not map that name, so bind refuses before the guest runs.
