# Typed charts

Use `@foxworth/superimg/charts` for line, time-series and bar artwork. TanStack Charts
1.1.0 resolves the layout; SuperImg retains typed vector nodes and samples
motion from explicit progress. No browser mount or animation loop is involved.

```ts
import { video, Frame } from "@foxworth/superimg";
import { defineChart, barY, scaleBand, scaleLinear, layout } from "@foxworth/superimg/charts";

const rows = [
  { id: "april", month: "Apr", revenue: 42 },
  { id: "may", month: "May", revenue: 58 },
];
const definition = defineChart({
  marks: [barY(rows, { id: "revenue", key: "id", x: "month", y: "revenue", fill: "#2563eb" })],
  scales: {
    x: { scale: () => scaleBand<string>().padding(0.2) },
    y: { scale: scaleLinear, nice: true, grid: true },
  },
});

export default video({
  duration: "4s",
  render(ctx) {
    const d = ctx.director({ enter: "25%", hold: "75%" });
    const chart = layout(definition, {
      id: "monthly-revenue",
      width: ctx.width,
      height: ctx.height,
      motion: { barsGrow: d.in("enter") },
    });
    return Frame({ width: ctx.width, height: ctx.height, fill: "#fff" }, chart.artwork);
  },
});
```

`layout(definition, options)` accepts a static TanStack definition. Its options
require a stable occurrence `id`, `width` and `height`. Optional `theme`,
`typography` and synchronous `measureText` control chart layout and paint.
Default paint is concrete, and axis text scales with the chart height. Supply
the same font used by the host when measuring. Without `measureText`,
`diagnostics` reports `APPROXIMATE_TEXT_METRICS`; estimated spacing is not
font-qualified layout.

The entry re-exports `defineChart`, `lineY`, `lineX`, `barY`, `barX`, `areaY`,
`group`, and compact `scaleLinear`, `scaleBand`, `scalePoint`, `scaleOrdinal`.
Other TanStack definitions can be supplied directly. Nonlinear/time scales
use explicitly imported scale implementations. A numeric timestamp x channel
also preserves irregular observation spacing.

## Artwork and meaning

The result exposes `artwork`, `scene`, `points`, `diagnostics`, `point(key)`,
`mark(markId)`, `project(channel, value)` and `pathPoint(nodeKey, progress)`.

- Place `artwork` in the normal media tree. It contains inspectable Vector
  paths, text, clips and marks, rather than boxed SVG markup.
- Use `points` or `point(key)` for original datum identity and resolved
  coordinates. Use explicit mark ids and datum keys. Keys are TanStack's
  qualified keys, not bare input ids.
- `mark(id)` returns that mark's owned scene nodes. `pathPoint` samples a
  polyline or area path in chart coordinates, including enclosing translation.
  It supports a reader travelling with revealed ink without scraping SVG.
- `project` and `scene.scales` share the mapping used by axes and marks.

The scene and semantic points represent the final, unanimated layout. Artwork
may be partially revealed. Retain the result in application memory; it is not
a JSON interchange format because scales and authored callbacks are functions.
Only the artwork crosses the existing media-tree/IR projection.

## Motion and identity

`motion.lineReveal` and `motion.barsGrow` accept progress in 0–1. Per-mark
overrides live at `motion.marks[markId]`. Progress is sampled directly; rendering
frames backward or out of order does not seed the next frame. Use ordinary
Frame/Stack motion for whole-chart fades and travel.

Line reveal follows path length. A gap creates separate path segments. Bars
grow from their resolved interval baseline, including negative values. Auxiliary line dots stay hidden until the line is completely revealed. Partial
area reveal requires an authored fill clip and is rejected by `lineReveal`.
Keep domains and color mappings explicit when comparing charts or animating data.
Point identity can remain stable while a new gap changes line segment identity;
this module does not invent path morphing or entering/exiting datum transitions.

Occurrence ids must differ between charts sharing a media tree. Internal mark
and clip ids are qualified by that occurrence. Duplicate point/node identities
fail with `ChartLayoutError` rather than silently merging artwork.

## Supported rendering contract

Groups/translations/rectangular clips, rules, paths, areas (including polygon
holes), dots, rounded rectangles and labels lower to typed vectors. Independent
rectangle corners lower to a path. Paths preserve non-scaling stroke semantics.

Solid colors are supported. Gradients, unresolved CSS paint, unsupported stroke
joins, custom renderers and dynamic focus/state presentation are rejected with
an error code. Static export disables TanStack pointer/keyboard/focus hosting.
The chart module does not mount controls, tooltips or a TanStack motion renderer.

## Migration

`std.viz.charts.bar`, `barHorizontal`, `bars`, `line`, `lineTime` and `lines`
are replaced by this entry. Use `barX`/`barY`, `lineX`/`lineY` and grouped marks
over shared scales. The migrated npm-stats and chart-primitives examples show
the complete typed path.

Specialized string helpers (`barRace`, area/stack, pie, scatter, sparkline,
legend, hierarchy, contours and force) remain on `std.viz.charts` until their
individual migrations. They are not aliases to the typed chart module. Source
files supporting their tests remain internal where required.

Check and export with the existing CLI. There is no chart-specific command:

```sh
just cli check examples/data/chart-primitives/chart-primitives.media.ts
just cli inspect examples/data/chart-primitives/chart-primitives.media.ts --at 50% --png
just cli export examples/data/chart-primitives/chart-primitives.media.ts --for youtube
```
