import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { Box } from "../../layout.js";
import type { ChartOpts } from "./shared.js";
import { chartColors } from "./shared.js";

export interface ForceNode extends SimulationNodeDatum {
  id: string;
  label?: string;
  radius?: number;
}

export interface ForceLink extends SimulationLinkDatum<ForceNode> {
  source: string;
  target: string;
}

export interface ForceOpts extends ChartOpts {
  linkDistance?: number;
  chargeStrength?: number;
  collideRadius?: number;
  nodeRadius?: number;
  showLabels?: boolean;
  labelFontSize?: number;
  linkColor?: string;
  linkWidth?: number;
  /** Total simulation ticks to run (scaled by progress). */
  ticks?: number;
}

const simCache = new Map<string, { nodes: ForceNode[]; links: SimulationLinkDatum<ForceNode>[] }>();

function cacheKey(box: Box, nodes: ForceNode[], links: ForceLink[]): string {
  return `${box.x},${box.y},${box.width},${box.height}|${nodes.map((n) => n.id).join(",")}|${links.map((l) => `${l.source}-${l.target}`).join(",")}`;
}

function runSimulation(
  box: Box,
  nodes: ForceNode[],
  links: ForceLink[],
  tickCount: number,
  opts: ForceOpts,
): { nodes: ForceNode[]; links: SimulationLinkDatum<ForceNode>[] } {
  const key = cacheKey(box, nodes, links);
  const cached = simCache.get(key);
  if (cached && tickCount >= (opts.ticks ?? 300)) return cached;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const simNodes: ForceNode[] = nodes.map((n) => ({ ...n }));
  const simLinks = links.map((l) => ({ ...l }));

  const sim = forceSimulation(simNodes)
    .force(
      "link",
      forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(simLinks)
        .id((d) => d.id)
        .distance(opts.linkDistance ?? 80),
    )
    .force("charge", forceManyBody().strength(opts.chargeStrength ?? -120))
    .force("center", forceCenter(cx, cy))
    .force("collide", forceCollide(opts.collideRadius ?? 20))
    .stop();

  for (let i = 0; i < tickCount; i++) sim.tick();

  const result = { nodes: simNodes, links: simLinks };
  if (tickCount >= (opts.ticks ?? 300)) simCache.set(key, result);
  return result;
}

export function force(
  box: Box,
  nodes: ForceNode[],
  links: ForceLink[],
  timeSeconds: number,
  opts: ForceOpts = {},
): string {
  const progress = opts.progress ?? 1;
  const totalTicks = opts.ticks ?? 300;
  const tickCount = Math.max(1, Math.floor(totalTicks * Math.min(1, progress + timeSeconds * 0.1)));
  const { nodes: simNodes, links: simLinks } = runSimulation(box, nodes, links, tickCount, opts);
  const colors = chartColors(opts);
  const linkColor = opts.linkColor ?? "rgba(148,163,184,0.5)";
  const linkW = opts.linkWidth ?? 1.5;
  const defaultR = opts.nodeRadius ?? 12;
  const labelSize = opts.labelFontSize ?? 11;

  const nodeById = new Map(simNodes.map((n) => [n.id, n]));

  const edges = simLinks
    .map((l) => {
      const src = typeof l.source === "object" ? l.source : nodeById.get(l.source as string);
      const tgt = typeof l.target === "object" ? l.target : nodeById.get(l.target as string);
      if (!src?.x || !tgt?.x || src.y == null || tgt.y == null) return "";
      return `<line x1="${src.x.toFixed(2)}" y1="${src.y!.toFixed(2)}" x2="${tgt.x.toFixed(2)}" y2="${tgt.y!.toFixed(2)}" stroke="${linkColor}" stroke-width="${linkW}" opacity="${progress.toFixed(3)}"/>`;
    })
    .filter(Boolean)
    .join("\n");

  const nodeEls = simNodes
    .map((n, i) => {
      if (n.x == null || n.y == null) return "";
      const r = (n.radius ?? defaultR) * progress;
      const color = colors[i % colors.length]!;
      let label = "";
      if (opts.showLabels && n.label) {
        label = `<text x="${n.x.toFixed(1)}" y="${(n.y + r + labelSize + 2).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="${labelSize}" fill="#94a3b8" opacity="${progress.toFixed(3)}">${n.label}</text>`;
      }
      return `<circle cx="${n.x.toFixed(2)}" cy="${n.y.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}" opacity="${(0.9 * progress).toFixed(3)}"/>${label}`;
    })
    .filter(Boolean)
    .join("\n");

  return `${edges}\n${nodeEls}`;
}