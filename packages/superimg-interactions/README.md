# `@superimg/interactions`

Node-only Host seam for SuperImg project work. Ordinary `*.media.ts` authoring
never imports this package.

SuperImg owns media behavior, dispatch, progress, receipts, recovery, runtimes,
stores, targets, and publication. `@foxworth/boundary` owns identity, admission,
binding, revocation, and request-mode proposals.

## Four paths

1. **Author media.** Use `superimg` helpers. Stay Boundary-free.
2. **Trusted native dispatch.** Create a Media, Edit, or Render mount and call
   `mount.dispatch`. The CLI stays on this path and still owns runtime disposal.
3. **Checked Binding calls.** Compile the three independent sets, install with
   host-issued IDs, project desired modes, then `bindProjection`. Typed
   references come from a successful Binding, not a Program alone.
4. **Request-mode proposal.** Optional `requests` at install time come from
   `contribute*ControlRequests`. Request mode proposes only. Approval, grant,
   and execution stay in separately distributed Control administration.

```ts
import { admitAll, bindProjection, directRealizationIds } from "@foxworth/boundary";
import {
  MEDIA_COMPILED_INTERACTIONS,
  createNodeMediaInteractionMount,
  installMediaInteractions,
  projectMediaInteractions,
} from "@superimg/interactions";

const mount = createNodeMediaInteractionMount({ projectRoot, runtime });
const { installation, controller: installationController } =
  await installMediaInteractions(mount, {
    installationId,
    realizationIds: directRealizationIds(MEDIA_COMPILED_INTERACTIONS, releaseRevision),
  });
const projection = await projectMediaInteractions({ export: "direct" });
const bound = await bindProjection(projection, installation, { admit: admitAll });
if (bound.status === "bound") {
  const caller = bound.binding.connect();
  // Keep bound.controller and installationController in the application host.
  // Give callers only the Binding/Caller, not either controller.
}
```

See [docs/interactions.md](../../docs/interactions.md).

`install*Interactions` returns Boundary's `{ installation, controller }` unchanged.
The Installation and Binding do not carry revocation methods. The host keeps
those separate controllers; revoking one Binding does not revoke its siblings.

Create controlled realizations with `digestControlRealization` from
`@foxworth/boundary/control` and pass the authentic value into `contribute*ControlRequests`.
The old `resolveControl`/`resolveEditControl`/`resolveRenderControl` and `bind*Control`
wrappers were removed: copying a resolved Control loses Boundary provenance, and a
partial target cannot stand in for the full invocation identity. Parsing and
`ControlHost.resolve(target)` remain application-owned.

Use Boundary's `presentProjection` for a caller-specific schema/presentation and
`bindProjection(..., { admit, observation })` for call-outcome evidence. These do
not replace SuperImg's frame/stage progress, publication receipts, or recovery.
