# Native Media Interactions

`@foxworth/superimg-interactions` is the Node-only host package for source and project work.
It exports four independently compiled interaction sets and dispatch-only
mounts. Ordinary `*.media.ts` authoring never imports this package. The
value-first `@foxworth/superimg/runtime` module remains independent of Boundary.

```text
*.media.ts authoring ──────────────── SuperImg-native, Boundary-free
                                  |
                Media / Edit / Render / Script dispatchers
                                  |
                        native Host bindings
                                  |
four CompiledInteractions → Installations → Projections → Bindings → callers
                                  |
                     optional Control request contribution
                              proposal only
```

**Boundary Host** owns identity, admission, binding, revocation, handoff pins, and
request-mode proposals. **SuperImg** owns media behavior, state, execution,
progress, receipts, recovery, lifecycle, runtimes, stores, targets, and
publication. No SuperImg wrapper silently rebinds, fabricates Installations, or
emits partial callers.

The four compiled values are `MEDIA_COMPILED_INTERACTIONS`,
`EDIT_COMPILED_INTERACTIONS`, `RENDER_COMPILED_INTERACTIONS`, and
`SCRIPT_COMPILED_INTERACTIONS`. Callers read
`.program` and `.handles` from those values. There are no Program aliases.

It does not create an application framework, journal, grant store, policy,
transport, or control plane:

- the **Media** set reads sources, freezes providers, compiles artifacts, and
  publishes exports;
- the **Edit** set describes exact source bindings and applies bounded source
  edits;
- the **Render** set executes a deployed media package and supports durable
  host recovery;
- the **Script** set finds media that import a script and reads cues and stills
  from those sources.

## Four paths

1. **Ordinary media authoring.** Write `*.media.ts` with `video()`, `image()`,
   or `define()`. Stay on `superimg` and the CLI. No Boundary imports.
2. **Trusted native dispatch.** Create a mount and call `mount.dispatch` with
   the same opaque context the host already uses. The CLI stays on this path
   and still owns runtime disposal. `superimg edit` dispatches the Edit
   Program (`media.edit.bindings` and the four exact edits). `superimg cortex`
   is value-first `startExport` of planned stills, not `media.export`.
3. **Checked Binding calls.** Install with host-issued IDs, project desired
   modes, then `bindProjection`. Missing modes yield one exhaustive unrealized
   report. There is no partial Binding.
4. **Request-mode proposal.** Optional install `requests` come from
   `contributeMediaControlRequests`, `contributeEditControlRequests`, or
   `contributeRenderControlRequests`. Request mode creates a proposal only.
   Approval, grant, and execution stay in separately distributed Control
   administration.

## Program vocabulary

### Media Program

| Interaction | Exposure | Provider behavior | Result |
|-----------|----------|-------------------|--------|
| `media.project.discover` | Direct only | Does not evaluate modules or providers | Project-relative source catalog |
| `media.source.describe` | Direct only | Compiles one trusted projection; does not execute a provider | Canvas, clock, variants, editions, fonts, and program digest |
| `media.source.check` | Direct only | Uses static entries or a supplied frozen snapshot | Portable check report with source evidence |
| `media.source.inspect` | Direct only | Uses static entries or a supplied frozen snapshot | Portable inspection report with source evidence |
| `media.collection.snapshot` | Direct for trusted stages; request when externally projected | Executes the provider once | Frozen entries and snapshot digest |
| `media.artifact.compile` | Direct for trusted stages; request when externally projected | Never executes a provider; a provider collection needs a snapshot | Atomically published schema-0 Media IR receipt |
| `media.artifact.thumbnail` | Direct | Reads `media.artifacts`; writes `media.thumbnails` | Scaled raster bytes, width, and height. Host decodes pixels; a guest may realize the arithmetic under an import map |
| `media.arrange.still` | Direct | Evaluates a deterministic still arrangement | Planned still composition and inspection evidence |
| `media.speech.voices` | Direct | Reads configured speech-provider voices | Portable voice catalog |
| `media.speech.synthesize` | Direct for trusted stages; request when projected | Calls the configured provider and stores audio | Logical artifact target and narration result |
| `media.narration.prepare` | Direct for trusted stages; request when projected | Prepares audio, alignment, and optional preview under host control | Portable narration result |
| `media.narration.review` | Direct for trusted stages; request when projected | Verifies bounded narration artifacts and publishes review evidence | Portable review result |
| `media.export` | Direct for trusted stages; request when externally projected | Consumes a supplied snapshot, or snapshots once | Durable publication receipt |

Checking and inspection accept deterministic, collection, and interactive
sources. Without a supplied snapshot, provider collections remain explicitly
deferred; selecting or evaluating an entry requires a frozen snapshot because
these read-only interactions never cross the provider boundary implicitly.

### Edit Program

| Interaction | Exposure | Effect |
|-----------|----------|--------|
| `media.edit.bindings` | Direct only | Reports exact, inspect-only, and opaque source bindings |
| `media.edit.set-node-transform` | Direct or request | Changes literal `x` and `y` on an identified `Frame` or `Html` |
| `media.edit.trim-scene-end` | Direct or request | Changes a literal `compose()` scene duration |
| `media.edit.set-phase-boundary` | Direct or request | Rebalances two adjacent literal director phases |
| `media.edit.set-composition-hold` | Direct or request | Changes a literal still hold at a qualified composition occurrence path |

The exact edit surface is intentionally narrow. Expressions, spreads,
computed properties, duplicate or missing identifiers, imported targets, and
derived durations are visible to inspection but are not rewritten. Each edit
includes the current intent hash and source hashes as preconditions.
Composition hold edits bind when the Program is inline in `time()` in the
`*.media.ts` source. Imported Program values, including the shared story-kit
example, remain inspectable but have no exact hold edit binding yet.

An edit control realization plans exact byte replacements and expected Media IR
effects, applies through a temporary sibling file, recompiles, verifies the
bounded effect policy, and returns an inverse command. Reconciliation classifies
only the exact post-state as `completed` and the exact baseline as
`not-applied`; mixed or unknown state is `uncertain`. Undo and redo submit the
inverse as a new interaction with fresh preconditions.

### Render Program

`media.package.render` accepts a deployed `sourceId` and `packageHash`, portable
data, and one output request. It returns a URL-free result receipt containing a
content-derived result ID, MIME type, length, and SHA-256 digest.

SuperImg supplies the compiled set, dispatcher, package executor,
package/result-store interfaces, in-memory and filesystem result stores, and a
reusable Boundary `ControlHook` from `@foxworth/boundary/control`. The consuming host
owns the control journal, actors, policy, approvals, grants, leases, transport,
retention, URLs, downloads, and durable framework receipts.

Render reconciliation follows a conservative rule:

- an exact committed result is `completed`;
- no result and no owned partial state is `not-applied`;
- an attempt-owned partial can be discarded and becomes `not-applied`;
- corruption, conflicting output, unknown ownership, or uncertain cancellation
  remains `uncertain`.

A started or uncertain attempt is never retried before reconciliation.

### Script Program

| Interaction | Exposure | Result |
|-----------|----------|--------|
| `media.script.sources` | Direct only | Media sources that import a project-relative `*.script.md` file |
| `media.script.cues` | Direct only | Resolved cue timing and unplaced blocks for one media source |
| `media.script.still` | Direct only | PNG bytes and source identity for the frame assigned to a script block |

The Script Program is read-only. Its Node mount requires a runtime for stills.
See the [script guide](scripts.md).

## Dispatch-only mounts

The four mounts are SuperImg-native dispatchers. The frozen mount is
`{ dispatch }` plus handler and progress options. They do not carry `program`,
`catalog`, `port`, or `controlHost`. Node adapters create dispatchers only;
they do not install, bind, or mint IDs.

```ts
import { fileURLToPath } from "node:url";
import {
  createNodeMediaInteractionSession,
  createNodeEditInteractionMount,
  createNodeRenderInteractionMount,
  createNodeScriptInteractionMount,
} from "@foxworth/superimg-interactions";

const mediaSession = await createNodeMediaInteractionSession({
  projectRoot,
  authoringFacades: {
    "application/media": fileURLToPath(new URL("./media-authoring.ts", import.meta.url)),
  },
  executionOptions: (context) => ({ signal: context.signal }),
});

const media = mediaSession.mount;

const editing = createNodeEditInteractionMount({
  projectRoot,
  compileSource: compileEditableSource,
});

const rendering = createNodeRenderInteractionMount({
  packageStore,
  resultStore,
  capabilities,
  realizationDigest,
  executor: packageExecutor,
});

const scripts = createNodeScriptInteractionMount({ projectRoot });
```

The session creates its runtime and mount from the same kernel. The host calls
`await mediaSession.dispose()` after admitted work finishes; the borrowed Media
mount never disposes a runtime. Use the lower-level mount only with a runtime
created by the same kernel, such as the CLI command pipeline. A runtime from
`@foxworth/superimg/runtime.init()` belongs to the value-first API and must not be passed
to this lower-level source mount.
Concrete edit and render options depend on the host compiler and package/result
stores.

`authoringFacades` maps a host's bare authoring specifier to an absolute,
browser-safe module file. The mapping also enables collection and interactive
source recognition, so hosts do not need a matching package in `node_modules`
or a second analyzer-only facade list.

## Installation, Projection, and Binding

```ts
import { admitAll, bindProjection, directRealizationIds } from "@foxworth/boundary";
import {
  MEDIA_COMPILED_INTERACTIONS,
  installMediaInteractions,
  projectMediaInteractions,
} from "@foxworth/superimg-interactions";

const { installation, controller: installationController } =
  await installMediaInteractions(media, {
    installationId: "deploy:media:1",
    realizationIds: directRealizationIds(MEDIA_COMPILED_INTERACTIONS, "release:1"),
  });

const projection = await projectMediaInteractions({ describe: "direct" });
const bound = await bindProjection(projection, installation, { admit: admitAll });
if (bound.status === "bound") {
  const caller = bound.binding.connect();
  // The host retains bound.controller and installationController.
  // It can give another component bound.binding without revocation authority.
}
```

`install*Interactions` requires host-issued Installation and realization IDs with
no defaults. Boundary's `directRealizationIds` expands an explicit host release revision
when that naming convention fits the host; explicit per-interaction IDs remain valid.
The result is `{ installation, controller }`. Only the controller carries
revocation authority. A successful Binding similarly returns a separate controller.
Each installed interaction gets one exhaustive `NativeInteractionBinding`
that delegates exactly once to `mount.dispatch` with the same opaque context.

`projectMediaInteractions`, `projectEditInteractions`, and
`projectRenderInteractions` take compiled handles only. They do not inspect a
mount or Installation. A request Projection is valid before any Installation
exists. `bindProjection` is the only place missing modes become an exhaustive
unrealized report.

Optional install `requests` come from SuperImg's `contributeMediaControlRequests`,
`contributeEditControlRequests`, or `contributeRenderControlRequests`, which
use `@foxworth/boundary/control/host`. Create the supplied Control with Boundary's
`digestControlRealization` and keep that exact object. SuperImg no longer copies
resolved Controls or creates incomplete Control targets through `resolve*Control`
and `bind*Control` wrappers. The host implements `ControlHost.resolve(target)`
with its own parsers and the full target supplied by Boundary. SuperImg keeps every
media, edit, and render hook. Request mode creates a proposal only.

`presentProjection(projection)` from `@foxworth/boundary` derives presentation and
schemas for exactly the selected aliases and modes. Request-only interactions do
not advertise direct output schemas. Presentation does not confer availability
or authority. Hosts may also supply `observation` to `bindProjection`; call
observations preserve outcome certainty and cannot replace handler results if
publication fails. They complement SuperImg's durable render progress rather
than replacing it.

The application host owns `control.request`, `control.approve`,
`control.grant`, `control.execute`, `control.reconcile`, `control.status`, and
`control.list`. Those interactions remain direct-only and are neither
reimplemented nor re-exported by SuperImg.

## Declared errors

Host errors are an exact code plus code-specific `details`. SuperImg evidence
lives inside `details`. Trusted `mount.dispatch` continues to throw SuperImg
errors unchanged. Binding translates only proven post-dispatch domain outcomes
into `declaredInteractionError`.

| Family | Declare | Do not declare |
|--------|---------|----------------|
| Media | `INVALID_INPUT` when Binding translates a completed domain reject | `UNKNOWN_INTERACTION`, `INVALID_OUTPUT`, `CONTROL_*`, `CANCELLED`, `INTERACTION_FAILED`. `MediaInteractionUncertainError` stays a fault |
| Edit | `SOURCE_STALE`, `BINDING_UNAVAILABLE`, `EFFECT_POLICY_VIOLATION`, post-schema `INVALID_INPUT` | same infra set |
| Render | `PACKAGE_NOT_FOUND`, `PACKAGE_CHANGED`, `UNSUPPORTED_RENDER_PATH`, `RESULT_CONFLICT`, post-schema `INVALID_INPUT` | same infra set |

Cancellation after dispatch and unverifiable effect state remain `unknown`.
Declared errors are completed Host outcomes, which is why `CANCELLED` and
`INTERACTION_FAILED` must not be declared. A progress terminal of `cancelled` is
observational; the corresponding Host outcome may remain `unknown`.

## Interaction Progress

Long exports expose one minimal observer model at the runtime and interaction
seams. `ExportOptions.onProgress` receives portable `ExportProgressEvent`
values from the raw value runtime. `MediaInteractionProgressOptions`,
`MediaInteractionProgressRecord`, and `createMediaInteractionProgressReporter()`
let an interaction host add its durable execution identity and one ordered clock.
The callback and reporter are host runtime objects; neither appears in a
portable Program contract.

Each `MediaInteractionProgressRecord` contains:

- `interaction`: the host-assigned `executionId`, optional real `attemptId`, and
  the Program, interaction, and contract digests;
- a strictly increasing `sequence` and monotonic `elapsedMs`;
- a `subject` for the interaction, a stable `stageId`, or a durably identified
  item within a stage;
- optional `work` with a concrete unit, nondecreasing `completed`, and `total`
  only when the total is known; and
- `state`: `started`, `running`, `succeeded`, `failed`, `cancelled`, or
  `uncertain`.

`failed` carries a portable `code`, `path`, and `message`; `cancelled` may carry
a reason; `uncertain` requires one. Each subject has one lifecycle, accepts one
terminal record, and rejects later records.

A handler that crosses a possibly-started effect seam and cannot prove either
completion or non-application closes any already-started child stages and then
throws `MediaInteractionUncertainError` with the evidence-backed reason. The mount
records the interaction terminal as `uncertain`. Host treats that uncertainty as
an unknown outcome, not a completed declared error.

A mounted host supplies the observer at the host seam. The mount adds exact
Program and contract identity and emits the interaction lifecycle around the
handler:

```ts
const session = await createNodeMediaInteractionSession<BuildContext>({
  projectRoot,
  progress: ({ context }) => ({
    executionId: context.executionId,
    ...(context.attemptId === undefined
      ? {}
      : { attemptId: context.attemptId }),
    observer: {
      append: (record) => progressLog.append(record),
    },
  }),
});
```

Totals are optional and remain stable once observed. Consumers render an
unknown total as a heartbeat such as `37 frames`, never `37/0`, and derive no
percentage when the denominator is absent. An item's identity comes from its
media coordinates, not a label or loop index. A reporter resumes after the
last committed sequence, so the first new record is that sequence plus one.

```json
{
  "schemaVersion": 1,
  "kind": "media-interaction-progress",
  "interaction": {
    "executionId": "build-2026-08-30:hero",
    "programDigest": "sha256:...",
    "interactionId": "media.export",
    "contractDigest": "sha256:..."
  },
  "sequence": 12,
  "elapsedMs": 1847,
  "subject": {
    "kind": "item",
    "stageId": "runtime.render",
    "item": {
      "itemId": "runtime.render:...",
      "kind": "rendition",
      "entryId": "hero",
      "variantId": "default",
      "editionId": "landscape",
      "renditionId": "youtube"
    }
  },
  "state": "running",
  "work": { "unit": "frames", "completed": 37, "total": 180 }
}
```

The Node runtime reports exact `runtime.render` rendition and frame work. Its
`ExportProgressEvent` has the same stage/item/work subset, while the interactions
reporter supplies cross-stage identity, ordering, elapsed time, and the
interaction terminal record. Observation failure does not fail or cancel export.
Cancellation remains an `AbortSignal`; retry and reconciliation remain host
decisions. `uncertain` is reserved for a real possibly-started effect and its
attempt evidence. Progress is neither authority, cancellation, retry policy,
effect proof, nor the schema-0 publication receipt.

The reporter is a small interface over a deep module: it hides portable value
copying, lifecycle validation, one monotonic sequencer and clock, work
checkpoints, and serialized observer appends. The Node adapter emits at the
locality where rendition and frame work becomes known; the interactions adapter
adds identity and lifecycle once. This depth gives every host the same ordering
invariants without coupling the value runtime to Boundary.

Invalid local updates raise `MediaInteractionProgressError` with one of
`INVALID_PROGRESS_VALUE`, `INVALID_PROGRESS_TRANSITION`,
`PROGRESS_AFTER_TERMINAL`, `PROGRESS_IDENTITY_MISMATCH`,
`PROGRESS_NON_MONOTONIC`, or `PROGRESS_TOTAL_CHANGED`. These diagnose an
adapter integration bug; they are not portable Program-declared errors.

### Downstream raw-export adapters

A host that calls `@foxworth/superimg/runtime` `exportMedia` directly, bypassing the
mounted `media.export` interaction, should pass `ExportOptions.onProgress` into
that raw export and map each `ExportProgressEvent` through a
`createMediaInteractionProgressReporter()` it owns. Routing the call through an
observed mount is also valid if the host later moves publication behind that
seam.

Downstream CLIs should emit every mapped record through their existing
backpressure-aware event channel:

```js
await emit({ v: 1, event: "interaction_progress", ...record });
```

The envelope keeps `work.total` optional. Loggers should show stage/item
heartbeats and print `completed/total` only when the total exists; they must
never turn an unknown total into `/0`. Staging, hash and length verification,
fsync/atomic commit, cleanup, and schema-0 receipts remain the publication and
recovery boundary.

## Logical Targets and Receipts

Artifact and publication requests contain only a host-defined `targetId` plus a
relative `artifactId` or `publicationId`. A private `MediaTargetRegistry`
resolves that pair to a filesystem root. Absolute paths never enter an
interaction contract or receipt.

The default trusted-local registry provides:

- `project-artifacts` for Media IR artifacts;
- `project-output` for exported publications.

Both resolve beneath the project's `output/` directory. Hosts can supply their
own immutable registry. Target roots and IDs are checked against traversal and
symlink escapes; the registry digest is evidence frozen by controlled planning.

```ts
const receipt = await media.dispatch(
  {
    interactionId: MEDIA_INTERACTION_IDS.export,
    input: {
      source: "launch",
      publication: {
        targetId: "project-output",
        publicationId: "launch/youtube",
      },
      destinations: ["youtube"],
    },
  },
  context,
);

console.log(receipt.targetId, receipt.publicationId, receipt.manifestDigest);
```

`@foxworth/superimg/runtime` returns an unpublished `ExportBundle` with normalized
relative paths and repeatable artifact streams. `@foxworth/superimg-interactions` consumes
and disposes that bundle, stages artifacts, publishes the manifest last, and
returns a serializable `MediaExportReceipt`. The two values have different
owners and are never interchangeable. An export crash during
`publication.commit` remains uncertain; a receipt is not true before committed
bytes, hash, and length match.

## Generated lock and Binding-backed references

`program.lock` stores exact bytes for the four compiled Programs and is
checked against the live definitions. Typed references are generated from an
actual successful Binding plus explicit source/member metadata through
`@foxworth/boundary/build`. A Program alone cannot produce references.
`checkHostArtifacts` does not write during ordinary validation.

Contract compatibility is structural. Program, contract, control, snapshot,
provider, package, target-registry, artifact, and publication digests remain
separate evidence identities. Matching digests are not behavioral equivalence.
The private mount package peers on `@foxworth/boundary`. The published CLI depends
on the same SDK, with a minimum version of 0.2.0. All subpaths resolve through
one physical SDK instance. This workspace retains its exact SDK archive and
integrity receipt under `vendor/boundary/`, selected by the workspace override;
installs do not require a sibling Boundary checkout.

## Downstream Host Ownership Boundary

A framework host integrates these compiled sets privately beneath its own media
facade. Framework developers author and call that facade; they do not import
SuperImg or the Boundary packages.

SuperImg owns media values, runtime semantics, checking, inspection, rendering,
export, Media IR, capability lifecycles, exact source-edit semantics, package
execution, and portable bundles. The framework host owns source/catalog
identity, provider execution policy, orchestration, authority, publication,
URLs, durable cross-language receipts, framework errors, and deployment.

This keeps request-time HTML and Open Graph rendering, collections,
provider-once snapshots, playback, destinations, variants, editions, and
atomic publication available without moving application authority into the
media library.

## Removed Standalone Jobs Protocol

SuperImg no longer exposes the standalone `/jobs` submit, status, cancellation,
or result protocol, nor public async-job types. Synchronous `/render` remains
available for its existing container use. Durable remote rendering is mounted
through `media.package.render` and the consuming host's Boundary Host Binding and
control protocol.

Cancellation and deadlines are execution context, not authored media identity.
If cancellation may have crossed an effect boundary, the host reconciles the
attempt before deciding whether it can run again.

## Guests and Reach

A WebAssembly guest may realize `media.artifact.thumbnail`. SuperImg owns the
import map: `media.artifacts` is a host read of decoded pixels, and
`media.thumbnails` is a host write. Bind checks that the component's actual
imports are a subset of that map. A guest that also imports
`media.publications` is refused before it runs; the report names
`media-publications`. The guest does not decode PNG.

The Media Offer reached over the local bus is check, inspect, describe, and
thumbnail (direct), plus snapshot, compile, and export (request). Discover
stays on the trusted CLI path. Nothing delete-shaped is offered.

A CLI media session registers a Reach record while it is open and unregisters
on dispose. `ops list` and `ops mcp` see that surface; they do not become a
SuperImg-authored MCP server. `ops mcp` is the Cortex model door.

A Draft may propose `media.artifact.rotate`. Accept records the contract and
digest. It never mutates the live Media Program. The host recompiles; the
Binding reports `missing-direct` until a realization lands.

## Connect to a running desktop host

The CLI's `desktop` group connects to a running local JavaScript Boundary host.
The host owns its tools, project state, jobs, and installed interactions.

| Subcommand within `desktop` | Result |
| --- | --- |
| `status` | Inspect the current host session |
| `interactions` | Read the live Binding and its input contracts |
| `call <interaction> --input <json-or-file>` | Invoke one interaction, without automatic retries |
| `mcp` | Relay MCP stdio to the host's MCP endpoint |

The host writes a private `desktop-connection.json` containing its loopback
origin and session credential. Select it with `--connection-file <path>` or
`SUPERIMG_DESKTOP_CONNECTION_FILE`. The credential is required; keep the file
private. `--input` accepts inline JSON, a file path, or `@request.json`.
After a disconnect or Binding change, inspect the host's state and any returned
job ID before repeating a mutation: a connection failure can arrive after work
has started.

## Migration from the operation API

This release removes `@foxworth/superimg-cli/operations`; use `@foxworth/superimg-interactions`.
There are no aliases. Helpers, types, handles, and dispatch requests use interaction
terminology. The host-owned `media.*` identifiers remain stable.

Boundary derives new contract and Program digests under `boundary.*` identity
domains. Generate fresh Bindings and obtain fresh approvals. Historical grants,
attempts, and receipts remain historical evidence; they cannot authorize current
execution. Reconcile uncertain effects before any new attempt.

Progress records and status snapshots now use `schemaVersion: 1`,
`media-interaction-progress`, `media-interaction-progress-status`, an `interaction`
identity, and `subject.kind: "interaction"`. The Node journal uses a separate `v1`
namespace. It rejects keys containing `operationId` before native dispatch. Keep
old journal bytes intact; do not rename fields or hashes to make them appear current.
Media IR, export manifests, publication receipts, and exact source-edit command
formats keep their existing versions.

Declared Media, Edit, Render, and Script interaction errors and the CLI dry-run interaction
projection also use `schemaVersion: 1`.

The live Reach path uses `BOUNDARY_BUS_SOCKET` (default `~/.boundary/bus.sock`)
and `/boundary/v1`. The host chooses the transport and admission policy.

## Native revision and batch preparation

For trusted Node code in one process, import `compileNodeEditableSource`,
`NodeEditEngine` and `previewNodeEdit` from `@foxworth/superimg-node/edit`.
Batch preparation remains available as `prepareNodeMediaExport` from
`@foxworth/superimg-interactions`.
These are native functions; they do not introduce new portable Interaction IDs.

`previewNodeEdit(engine, command, context, { targets })` retains both executable
revisions and declared resource sets. `compare(integerGlobalFrame)` captures each
side at its own exact rendition coordinates; absent frames remain absent.
Dispose the preview after reading its report and images. Preview is proposed
evidence; apply remains a separate admitted invocation with fresh preconditions.

`prepareNodeMediaExport(mediaOrStaticCollection, exportOptions)` retains resolved
inputs, declared resources and the rendition matrix. Use `sample(coordinates,
"25f")` to rehearse, then `export({ signal, onProgress })` to consume those same
inputs. Dispose the returned bundle and preparation separately. Hosts execute
providers explicitly before preparation; arbitrary closures and undeclared
script/network effects are outside its frozen-input guarantee. Preparation is
bounded to 256 entries, 64 targets, 1024 planned renditions and 64 MiB fetched
resources (checked after download). Handles have explicit disposal, no automatic
expiry, and confer no authority or durable recovery.

See [revision-review](../examples/apps/revision-review/README.md) for failing and
corrected snapshots, inverse edits and explicit unknown reconciliation. Reusable
`ReviewPlan` observation helpers and the shared evaluator are available from
`@foxworth/superimg/review`; authored containment/presence checks do not establish pixel
readability.
