# Revision review

A native host example for intentional revisions: inspect a named part, preview the source change, compare the two results, and apply an exact command with current preconditions. A separate batch action rehearses difficult data before exporting its prepared inputs.

The visual is a quiet Fieldnote product launch with landscape (960×540) and deliberately recomposed square (540×540) editions. The `title` frame has literal source coordinates; the product's computed width is inspect-only. The square edition is inspect-only in this first edit slice because matching visible coordinates does not prove a source binding.

Build the current render stack with `just build-render` from the repository root, then run `pnpm dev` from this directory and open http://127.0.0.1:4192. The local Vite middleware owns source access, admission, preparation lifetime, edits, and unpublished export files. It is a trusted local development host, not a network service for untrusted projects. Do not expose its port publicly.

The normal path is **inspect → preview → compare → apply → rehearse → correct → export**. Preview is non-mutating. Apply submits an exact command rather than treating possession of a preview reference as permission. A stale source is rejected. An unknown effect pauses controls and is not retried. **Reconcile source** observes the original attempt; only a completed or not-applied result clears that pause. **Undo edit** explicitly requests the inverse and may be rejected if source preconditions changed.

`launch.review.ts` uses the same layout geometry as rendering. Product presence and box containment are authored structural observations. Pixel readability is deliberately unavailable and must remain unverified. These observations do not establish visual quality or occlusion.

**Rehearse batch** deliberately includes a normal entry, over-budget copy, and an absent product. The authored copy-budget and presence checks fail, so that preparation cannot export. **Prepare corrected batch** creates a new snapshot with shorter copy and a supplied product; export is enabled only when no authored check fails. Readability remains unverified even in the corrected batch. This is an example host policy, not a claim of visual acceptance.

Inspect the returned coverage: sampling a beat is not reviewing every encoded frame. Failed entries are evidence, not successful exports. Export writes host-owned unpublished files under `output/rehearsal`; it does not return a durable publication receipt.

## Follow the evidence

1. Inspect **Landscape** and select **Title / source coordinates**. Its literal `x` and `y` values support an exact edit. Select **Product / computed geometry** or switch to **Square** to see why a visible part can remain inspect-only.
2. Change X or Y, then **Preview change**. The host prepares both original and candidate inputs and captures the same global frame for landscape and square. The page shows the landscape pair and reports capture coverage. Source is unchanged.
3. **Apply exact change** rechecks the returned command against current source. **Undo edit** requests an inverse; it can reject stale source. If the response cannot establish completion, use **Reconcile source** rather than resubmitting the effect.
4. **Rehearse batch** prepares the difficult entries at both sizes and reports intentional copy-budget and product-presence failures. Export stays disabled.
5. **Prepare corrected batch** creates a fresh preparation with a short title and present product. Review its new digest, checks, and coverage; the unavailable readability metric stays unverified. **Export prepared batch** consumes this corrected preparation and writes unpublished PNG files. A source change requires an explicit new rehearsal.

The example captures frame 25 (one second at 25 fps). Its authored observations are evaluated at that same instant. Read the reported origin and coverage: `author-reported` is not a pixel measurement, and `visual: unreviewed` is not visual acceptance. Frozen inputs cover the preparation's declared resources; arbitrary script-discovered network dependencies are outside that promise.

## Reusable review helpers

The companion keeps the existing `ReviewPlan` shape. `observeBounds` reports structural containment and dimensions, while `observePresence` reports absence only for a complete inventory:

```ts
import { observeBounds, observePresence } from "@foxworth/superimg/review";

const product = {
  ...observeBounds(layoutProduct(width, height), { width, height }),
  ...observePresence(authoredIds, "product", "complete"),
};
```

Supply the same authored geometry used by rendering. Invalid geometry, incomplete absence evidence, and unavailable metrics must not become successful checks. Captures and human judgment provide separate evidence.

## Related examples

- [Agent inspection](../agent-inspection/README.md): accepted preview state, explicit admission and revocation.
- [Data family](../../composed/data-family/README.md): repeated imported scenes with occurrence-specific data and timing.
- [Story Kit](../../composed/story-kit/README.md): retained named composition shared with a manual deck.

## Files

- `launch.media.ts`: media and square art direction.
- `layout.ts`: pure geometry shared by media and review.
- `launch.review.ts`: small authored review plan.
- `server.ts`: native host, using library edit/review/export facilities.
- `src/main.ts`: thin caller; displays host results and never rewrites source.

## Acceptance

The initial local acceptance run verified the exact title move and inverse, non-writing two-sided preview, stale/denied requests, deliberate failing rehearsal, and six corrected PNG exports from one retained preparation. Both MP4 editions were exported and decoded at intro, entrance, hold and final frames (150 frames, 25 fps, 6 seconds). Browser evidence qualifies the sampled captures; it does not establish visual acceptance for every frame.

The UI keeps readability unverified: geometry and a few captured beats do not prove every output frame is readable. No public deployment or device acceptance is claimed.

A lost local-export response stays unknown separately from source edits. The
source reconciliation button cannot resolve an export attempt; inspect the
unpublished output files before deciding what to do. This small development host
does not provide a durable export-recovery journal.
