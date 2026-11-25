// Line and ordinary bar authoring now lives on the typed @foxworth/superimg/charts entry.
// Specialized string helpers below remain available until individually migrated.
export { barRace } from "./bar-race.js";
export type { BarRaceKeyframe, BarRaceOpts } from "./bar-race.js";
export { area } from "./area.js";
export type { AreaChartOpts } from "./area.js";
export { stack } from "./stack.js";
export type { StackChartOpts, StackOffset } from "./stack.js";
export { treemap, pack, sunburst } from "./hierarchy.js";
export type { HierarchyDatum, HierarchyOpts } from "./hierarchy.js";
export { contour, density } from "./contour.js";
export type { ContourOpts, DensityOpts } from "./contour.js";
export { force } from "./force.js";
export type { ForceNode, ForceLink, ForceOpts } from "./force.js";
export { pie } from "./pie.js";
export { scatter } from "./scatter.js";
export { sparkline } from "./sparkline.js";
export type { ScatterPoint, ScatterOpts, TrendLineOpts } from "./scatter.js";
export type { PieLabelOpts, PieOpts } from "./pie.js";
export type { SparklineOpts } from "./sparkline.js";
export { legend } from "./legend.js";
export type { ChartDataPoint, ChartSeries, ChartOpts, ChartScaleOpts } from "./shared.js";
