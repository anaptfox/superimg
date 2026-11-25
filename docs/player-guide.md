# Player Guide

The neutral Player is a passive host for canonical deterministic media. It loads a media definition, accepts host data, controls time, and renders HTML/SVG into its surface.

```ts
import { Player } from "@foxworth/superimg/player";
import launch from "./launch.media";

const player = new Player({ container: "#launch" });
await player.load(launch, { data: { title: "Launch day" } });
player.play();
await player.seek({ progress: 0.5 });
await player.seek({ seconds: 1.5 });
await player.seek({ frame: 12 });
```

React:

```tsx
import { Player } from "@foxworth/superimg/react/player";
import launch from "./launch.media";

export function LaunchPreview() {
  return <Player media={launch} data={{ title: "Launch day" }} controls />;
}
```

It does not expose semantic scene queries, guides, actions, or hit targets. Those belong to `InteractivePlayer` from `@foxworth/superimg/react/interactive`.

Collections remain a server-side export concept. Local preview resolves the collection once and sends only the selected entry to the passive Player.

For exact browser capture, mount `createPreviewInspection` from
`@foxworth/superimg/inspection`. It observes requested and accepted frames separately and
holds playback or driven input while waiting for resources. See
[Browser inspection](./inspection.md) for ordinary JavaScript and optional page tools.

## Host-controlled Programs

`present()` uses one Player to display a retained Program. Manual mode selects
named top-level parts; timeline mode plays one continuous projection. Nested
Programs retain their own timing. The host owns navigation controls and policy.

```ts
import { Player } from "@foxworth/superimg/player";
import { present } from "@foxworth/superimg/player/program";
import { story } from "./story.js";

const player = new Player({ container: "#stage", playbackMode: "once" });
const session = present(player, story, {
  mode: "manual",
  size: { width: 1920, height: 1080 },
  fps: 25,
});
const result = await session.ready;
if (result.status !== "success") throw new Error(result.message);
await session.go("chapter");

// Dispose the session before the player owned by this host.
session.dispose();
player.dispose();
```

Use `parts`, `currentId`, `currentIndex`, `go`, `next` and `previous` for named
selection. A failed replacement retains the last committed media. Competing loads
use the latest request. Await load outcomes rather than assuming a selection
committed when it was requested.

A choice is selected by its qualified path: pass
`routes: { "lesson/explanation": "beginner" }` initially, or call
`session.choose("lesson/explanation", "advanced")`. Scoped updates use `setData`;
interactive child scenes use `setScene` and `on("action", listener)`.

Read `session.snapshot()` for the initial state, then subscribe with
`session.on("state", listener)`. `currentId` identifies committed media;
`pending` identifies a requested load, navigation or route selection. `result`
contains the latest settled `LoadResult`, or `null` while an operation is pending.
Disposal emits a final state with `disposed: true`. These events describe
selection operations, not every frame or data update.

SuperImg supplies the media session, playback and inspection. Presentation
libraries own deck documents, notes, reading views and their controls. Timed
exports use the same authored Program through `time()`.

## Resolved cues

A successful Player or DomPlayer load returns `cues` with start, end, and still
times in seconds. Use `getCues()` to read cues against the current accepted
clock. To recompute data-dependent cues, load the definition with the new data.
