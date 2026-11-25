# Packed codec and library consumer verification

After building the root and Node public distributions, run the same packed
consumer check that `pnpm check` runs after the workspace checks:

```sh
pnpm verify:codec-consumers
node scripts/verify-codec-consumers.mjs --evidence-dir /path/to/new-evidence-directory
```

The optional evidence directory must not exist. It retains the exact two packed
tarballs and their SHA-256 hashes, command output, install manifests and locks,
fixture hashes, TypeScript configuration, and any generated consumer facts. The
lockfiles reference the disposable install's original tarball paths; compare their
integrity against the retained archives. Disposable installations and generated
media are removed on success or failure.

The combined fixture installs MediaBunny, `@mediabunny/server`, and
`@mediabunny/dts` at 1.65.2, Node AV at 6.2.0, and Playwright at 1.65.0.

The runner uses one combined strict pnpm consumer for codec operations and the
public library journey, plus a separate root-only missing-peer consumer. It uses
only the root and Node SuperImg packages, their declared dependencies and peers,
and TypeScript/Node types as development dependencies. The consumer type check
uses `strict` and `skipLibCheck: false`. The Node entry may import the root runtime
kernel as a dependency; node-first invokes the Node frame helper before explicitly
importing the root runtime.

The final library journey exercises a prepared input and cut, a directly requested
frame-2 edit with a host writer, and an embedded-video edit preview. It does not
claim browser-accepted selection evidence. A codec-only pass is not final acceptance.

Prerequisites are pnpm, registry access, permission for native install scripts,
the Chromium installation used by SuperImg, and ffmpeg with `libx264`,
`prores_ks`, AAC, and experimental `dca` encoders. A missing prerequisite is a
failure, not a skipped test. This pnpm consumer check does not establish npm,
browser, device, or release acceptance.
