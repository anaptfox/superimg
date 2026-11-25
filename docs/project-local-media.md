# A media library inside your project

Keep authored media, reusable artwork and assets in the package that owns them.
A library can contain images, videos, reels, and work used directly by a browser
application. File export is optional.

## Add media to an existing application

Install `@foxworth/superimg` for authoring and `@foxworth/superimg-cli` for local commands. Run
initialization in the package whose dependencies and scripts should own the work:

```sh
pnpm exec superimg init . --example hello-world
pnpm media:list
pnpm media:dev
pnpm exec superimg check hello-world
```

Initialization adds `media:dev` and `media:list` when those names are available.
Existing scripts and dependency specifications are preserved. The CLI is added
as a development dependency when missing. Installation uses the selected package
manager and the manifest's dependency specifications.

Content goes into `media/` by default. Pass `--dir` to choose another directory inside the package.
Choose another location explicitly:

```sh
pnpm exec superimg init . --dir media/brand --example og-card
pnpm exec superimg new announcement --dir media/campaigns --example og-card
```

`--dir` is relative to the selected package, including when `new` is invoked from
a source subdirectory. Repeated initialization preserves an existing complete
example and user edits. Partial collisions are reported rather than overwritten.
An explicit directory must stay inside the package and cannot traverse symlinks.

Use `init <new-directory>` to create an intentionally independent project. Creating
an ordinary media folder with `--dir` does not create another package or lockfile.
Browser download is deferred; request `--with-browser` only when needed.

## Use a workspace media package

Create and register a package with your team's normal workspace tooling. Then run
SuperImg inside that package. To keep content directly at its root:

```sh
cd packages/media
pnpm exec superimg init . --dir . --example og-card
pnpm media:dev
```

The package owns its media dependencies and scripts. The workspace owns membership,
its package-manager version and shared lockfile. Declare package exports and app
dependencies using your normal workspace conventions. Apps should import those
exports rather than sibling build directories.

Package-manager selection uses an explicit `--pm`, then package/workspace
`packageManager` declarations and lockfiles, before the invoking user agent.
Conflicts produce a repair hint. `--pm` is an intentional override; it does not
migrate the workspace or reconcile conflicting lockfiles for you.

Library discovery belongs to the nearest package manifest. It excludes nested
packages and private retained material. Select another package through its own
working directory or an explicit source path. A single-source preview and export
use the source's owning package.

## Author, embed, or deliver

Shared artwork is ordinary TypeScript. Discoverable works use `*.media.ts` or
`*.media.js`. A campaign can share artwork between a still and a video without
creating a source file for each output format. See the
[campaign library](../examples/marketing/campaign-library/README.md).

Use responsive rendering for sizing, editions for exact-aspect art direction,
variants for content patches, and collections for identified data records.
Export accepts multiple destinations:

```sh
pnpm exec superimg export media/campaigns/launch.media.ts --for 1200x630.png --for 1080x1080.png
```

A square destination needs appropriate square art direction. Requested targets
select matching editions across the selected entries and variants; inspect the
planned coverage rather than assuming one artifact per target.

For never-exported work, the application imports the authored value and mounts
its Player or interactive controller through the application's bundler. Scroll
and pointer hosts supply playback input; stateful controls use the interactive
controller. See [pointer playback](../examples/apps/lockup-pointer/README.md),
[scroll playback](../examples/apps/lockup-scroll/README.md), and the
[interactive host](../examples/apps/queue-explainer/README.md).

Keep a reusable story as a retained Program when it needs both manual navigation
and a timed film. [Story Kit](../examples/composed/story-kit/README.md) defines
the named parts; a host using `present()` in manual mode presents the
same program with host-owned navigation.

The dev preview has variant and edition selectors. You can choose an initial
selection from the command line:

```sh
pnpm exec superimg dev media/campaigns/launch.media.ts --variant teams --edition square
```

The selected copy, canvas and inspection coordinates follow the same projection.
Selection survives reload and source updates. A failed update keeps the last
working preview and marks it stale.

Singular interactive sources open in a controller preview with guide-step
navigation and JSON data patches. Apply patches to change root data fields;
Reset preview restores authored sample data at the first frame, paused. Valid
source updates retain the current data patch and guide position where possible.
Live interactive preview does not offer file export. Use an explicit deterministic
guide projection when you intend to export a story.

Select a collection in the library home and choose **Refresh snapshot** to freeze
its entries. You can also open a source directly with an initial entry:

```sh
pnpm exec superimg dev media/campaigns/cards.media.ts --entry north
```

The entry selector changes the preview within that frozen snapshot. Variant and
edition selectors apply to the selected entry. **Export frozen entry** writes that
exact entry and selection to the owning package's `output/` and reports a
publication receipt; it does not rerun the provider. Changing backing rows leaves
the snapshot unchanged until you choose **Refresh snapshot**. A later preview or
export request detects authored source changes, marks the snapshot stale and
disables export until refresh succeeds. Empty collections keep refresh available.

Collection delivery uses the local Node runtime. Listing sources and selecting a
collection in the library home do not execute its provider. Refresh creates that
source's snapshot; separate tabs keep their own entry, variant and edition
selections. Discovery and ordinary checks also remain provider-free.

## Native export and evidence

```sh
pnpm exec superimg doctor --json
pnpm exec superimg check hello-world
pnpm exec superimg inspect hello-world --at 1s --png
```

Install Chromium only on `CHROMIUM_MISSING`. `CHROMIUM_LAUNCH_DENIED` indicates an
installed binary blocked from launching. Video export needs a supported encoder;
install `node-av` and its matching platform binary when doctor reports it missing.
JPEG/WebP require the optional Sharp encoder to be available to the runtime.

Preview evaluates dimensions, timing, assets and audio from the authored source.
Check and inspect report structural evidence; inspect rendered beats too. Export
defaults to the owning package's `output/`. Inspect captures currently default to
source-adjacent `output/.superimg/inspect/`.

## Host a source library in Node

Use the public paired session when a trusted host discovers and operates on source
files. It creates the source mount and runtime together:

```ts
import { createNodeMediaInteractionSession, MEDIA_INTERACTION_IDS } from "@foxworth/superimg-interactions";

const session = await createNodeMediaInteractionSession({ projectRoot });
try {
  const result = await session.mount.dispatch({
    interactionId: MEDIA_INTERACTION_IDS.check,
    input: { source: "media/campaigns/launch" },
  }, {});
} finally {
  await session.dispose();
}
```

Hosts that already import an authored value use `@foxworth/superimg/runtime` directly.
Source admission, execution identity, recovery, publication and deployment remain
host responsibilities. See [native interactions](interactions.md).

## Local framework builds and Stash

For this team's local deployment, Stash distributes the actual `@foxworth/superimg` and
`@foxworth/superimg-cli` package artifacts plus their private dependency closure. Framework
distribution is separate from rendered-media delivery and application deployment.

Route `@foxworth` packages through the intended Stash registry and preserve the
public default registry for external dependencies. Qualify setup, pin, lock
integrity, relock and restart using the actual package artifacts. A successful
exact-tarball installation alone does not establish the registry lifecycle or
preinstall guard.

Packed artifacts remain useful for reproducing a local build:

```sh
just build-render
pnpm --dir packages/superimg pack --pack-destination /absolute/artifacts
pnpm --dir packages/superimg-cli pack --pack-destination /absolute/artifacts
```

Use the printed artifact names and a unique build identity. Pack resolves workspace
and catalog metadata; do not copy a development manifest. Install through the
consumer's normal package manager and preserve its lockfile. The CLI's Boundary
dependency must resolve from the intended local source. A fresh consumer must run
without checkout dependency links, `NODE_PATH`, or custom module-loader hooks.
