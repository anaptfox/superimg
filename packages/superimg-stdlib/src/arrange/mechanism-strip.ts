//! Mechanism strip: declared nodes, per-edge evidence, no graph layout.

import { Frame, Stack } from "../tree/primitives.js";
import { Vector } from "../tree/vector.js";
import type { MediaChild, MediaElement } from "../tree/node-types.js";
import { DEFAULT_SIZE, EVIDENCE_LABEL, checkBase, chip, fail, throwIf } from "./base.js";
import { arrangementShell } from "./chrome.js";
import {
  GAP_Y,
  NODE_HEIGHT,
  cardType,
  cardWidthFor,
  connectorGeometry,
  innerHeightFor,
  innerWidthFor,
  keyPanelHeight,
  layerBandHeight,
  layerBoxes,
  pipelineBoxes,
  narrowestSlot,
  pipelineCapacity,
  type CardType,
  type NodeBox,
} from "./mechanism-geometry.js";
import {
  CLAIM_TRACKING,
  connectorInk,
  connectorLabel,
  evidenceKey,
  fitsOneLine,
  nodeCard,
  predictMark,
} from "./mechanism-paint.js";
import type {
  ArrangeFailure,
  EvidenceKind,
  IntervalMotionPhase,
  MechanismEdge,
  MechanismStripSpec,
} from "./types.js";

const EVIDENCE_KINDS: ReadonlySet<EvidenceKind> = new Set([
  "observation",
  "derived",
  "interpretation",
  "proposal",
]);

function edgeKey(edge: Pick<MechanismEdge, "from" | "to">): string {
  return `${edge.from}->${edge.to}`;
}

function frameIds(spec: MechanismStripSpec): string[] {
  return spec.layout.kind === "pipeline"
    ? (spec.layout.order ?? [])
    : (spec.layout.layers ?? []).flat();
}

function checkNodesAndEdges(spec: MechanismStripSpec): {
  failures: ArrangeFailure[];
  nodeIds: Set<string>;
} {
  const failures: ArrangeFailure[] = [];
  const nodes = spec.nodes ?? [];
  if (nodes.length === 0) {
    failures.push(fail("missing-correspondence", "Provide at least one node."));
  }
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node.id?.trim() || !node.label?.trim()) {
      failures.push(fail("missing-correspondence", "Every node needs a stable id and label."));
      continue;
    }
    if (nodeIds.has(node.id)) {
      failures.push(fail("missing-correspondence", `Duplicate node id '${node.id}'.`));
    }
    nodeIds.add(node.id);
  }

  const edges = spec.edges ?? [];
  if (edges.length === 0) {
    failures.push(fail("missing-correspondence", "Provide at least one edge connecting the nodes."));
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      failures.push(
        fail(
          "missing-correspondence",
          `Edge ${edge.from} -> ${edge.to} references an undeclared node.`,
        ),
      );
    }
    if (!EVIDENCE_KINDS.has(edge.claim)) {
      failures.push(
        fail(
          "unsupported-claim",
          `Edge ${edge.from} -> ${edge.to} needs a claim: observation, derived, interpretation, or proposal.`,
        ),
      );
    }
  }
  return { failures, nodeIds };
}

function checkFrame(spec: MechanismStripSpec, nodeIds: Set<string>): ArrangeFailure[] {
  const failures: ArrangeFailure[] = [];
  if (spec.layout?.kind !== "pipeline" && spec.layout?.kind !== "layers") {
    return [fail("unaligned-frame", 'Layout must declare kind "pipeline" (order) or "layers".')];
  }
  const ids = frameIds(spec);
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!nodeIds.has(id)) {
      failures.push(fail("unaligned-frame", `Layout references undeclared node '${id}'.`));
    }
  }
  for (const [id, count] of counts) {
    if (count > 1) {
      failures.push(fail("unaligned-frame", `Node '${id}' appears more than once in the layout.`));
    }
  }
  for (const id of nodeIds) {
    if (!ids.includes(id)) {
      failures.push(fail("unaligned-frame", `Node '${id}' is declared but missing from the layout.`));
    }
  }
  return failures;
}

/** Paper between the strip and the key that explains it. */
const GROUP_GAP = 44;
/** Below this the claim word stops being readable, so it is dropped entirely. */
const CLAIM_TAG_MIN = 10;
const CLAIM_TAG_MAX = 14;

interface StripPlan {
  innerWidth: number;
  bodyHeight: number;
  /** Height the strip band may use once the key panel is paid for. */
  stripLimit: number;
  cardWidth: number;
  type: CardType;
  claims: Set<EvidenceKind>;
  keyHeight: number;
  /** Size for the per-edge claim word, or 0 when the gap cannot hold it legibly. */
  claimTag: number;
}

/**
 * One sizing pass shared by `checkDensity` and the renderer, so `too-dense`
 * is measured against the cards that will actually be drawn.
 */
function planStrip(spec: MechanismStripSpec, predicting: boolean): StripPlan {
  const size = spec.size ?? DEFAULT_SIZE;
  const innerWidth = innerWidthFor(size.width);
  const bodyHeight = innerHeightFor(size.height);
  const columns =
    spec.layout.kind === "pipeline"
      ? (spec.layout.order ?? []).length
      : (spec.layout.layers ?? []).length;
  const nodes = spec.nodes ?? [];
  const labels = nodes.map((node) => node.label ?? "");
  const notes = nodes.map((node) => node.note ?? "").filter((note) => note.length > 0);
  const cardWidth = cardWidthFor(innerWidth, columns);
  const claims = new Set((spec.edges ?? []).map((edge) => edge.claim));
  const keyHeight = keyPanelHeight(claims.size + (predicting ? 1 : 0));
  // Name the claim on every edge only when the mechanism mixes claims *and*
  // the longest of those words fits the gap at a readable size. Otherwise the
  // stroke carries the claim and the key decodes it — a truncated word would
  // not be more honest, only messier.
  const slot = narrowestSlot(innerWidth, columns, spec.layout.kind === "layers");
  const widest = [...claims].map((claim) => EVIDENCE_LABEL[claim]).join(" ");
  const tagFit = claims.size > 1 ? fitsOneLine(widest, slot, CLAIM_TRACKING) : 0;
  const claimTag = tagFit >= CLAIM_TAG_MIN ? Math.min(tagFit, CLAIM_TAG_MAX) : 0;
  return {
    innerWidth,
    bodyHeight,
    stripLimit: Math.max(NODE_HEIGHT, bodyHeight - keyHeight - GROUP_GAP),
    cardWidth,
    type: cardType(cardWidth, labels, notes),
    claims,
    keyHeight,
    claimTag,
  };
}

function checkDensity(spec: MechanismStripSpec): ArrangeFailure[] {
  const plan = planStrip(spec, spec.motion?.phase === "predict");
  const columnCap = pipelineCapacity(plan.innerWidth);
  if (spec.layout?.kind === "pipeline") {
    const order = spec.layout.order ?? [];
    if (order.length > columnCap) {
      return [
        fail(
          "too-dense",
          `A pipeline row holds at most ${columnCap} nodes at a legible size; got ${order.length}. Use "layers" or split the mechanism.`,
        ),
      ];
    }
    return [];
  }
  if (spec.layout?.kind === "layers") {
    const layers = spec.layout.layers ?? [];
    const rowCap = Math.max(
      1,
      Math.floor((plan.stripLimit + GAP_Y) / (plan.type.height + GAP_Y)),
    );
    const failures: ArrangeFailure[] = [];
    if (layers.length > columnCap) {
      failures.push(
        fail("too-dense", `At most ${columnCap} layers fit at a legible width; got ${layers.length}.`),
      );
    }
    layers.forEach((layer, index) => {
      if (layer.length > rowCap) {
        failures.push(
          fail(
            "too-dense",
            `Layer ${index} stacks ${layer.length} nodes; at most ${rowCap} fit at a legible height.`,
          ),
        );
      }
    });
    return failures;
  }
  return [];
}

function checkPredict(spec: MechanismStripSpec): ArrangeFailure[] {
  const motion = spec.motion;
  if (!motion || motion.phase !== "predict") return [];
  const ids = motion.revealIds ?? [];
  if (ids.length === 0) {
    return [
      fail(
        "predict-spoils",
        "Predict needs revealIds so the answer edges can stay hidden or ticked instead of full ink.",
      ),
    ];
  }
  const edges = spec.edges ?? [];
  const known = new Set(edges.map(edgeKey));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    return [fail("predict-spoils", `revealIds not in edges: ${missing.join(", ")}`)];
  }
  if (ids.length === edges.length) {
    return [
      fail(
        "predict-spoils",
        "Predict that hides every edge leaves no context. Keep at least one context edge.",
      ),
    ];
  }
  return [];
}

export function checkMechanismStrip(spec: MechanismStripSpec): ArrangeFailure[] {
  const { failures, nodeIds } = checkNodesAndEdges(spec);
  return [
    ...checkBase(spec),
    ...failures,
    ...checkFrame(spec, nodeIds),
    ...checkDensity(spec),
    ...checkPredict(spec),
  ];
}

function answerSet(spec: MechanismStripSpec): Set<string> {
  return new Set(spec.motion?.revealIds ?? []);
}

const TICK_LENGTH = 30;

/** Cards keep their content height unless a declared stack of them will not fit. */
function fittedCardHeight(spec: MechanismStripSpec, plan: StripPlan): number {
  if (spec.layout.kind !== "layers") return plan.type.height;
  const rows = Math.max(1, ...spec.layout.layers.map((layer) => layer.length));
  if (layerBandHeight(spec.layout.layers, plan.type.height) <= plan.stripLimit) {
    return plan.type.height;
  }
  return Math.max(48, Math.floor((plan.stripLimit - (rows - 1) * GAP_Y) / rows));
}

/** Height the band needs once the cards are the size their words make them. */
function bandHeightFor(spec: MechanismStripSpec, cardHeight: number): number {
  return spec.layout.kind === "pipeline"
    ? cardHeight
    : layerBandHeight(spec.layout.layers, cardHeight);
}

function stripBand(
  spec: MechanismStripSpec,
  plan: StripPlan,
  phase: IntervalMotionPhase,
  cardHeight: number,
  bandHeight: number,
): MediaElement {
  const answers = answerSet(spec);
  const boxes: NodeBox[] =
    spec.layout.kind === "pipeline"
      ? pipelineBoxes(spec.layout.order, plan.innerWidth, cardHeight)
      : layerBoxes(spec.layout.layers, plan.innerWidth, cardHeight);
  const boxById = new Map(boxes.map((box) => [box.id, box] as const));
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node] as const));
  const type: CardType = { ...plan.type, height: cardHeight };

  const visible =
    phase === "hold" ? spec.edges.filter((edge) => !answers.has(edgeKey(edge))) : spec.edges;
  const ink: MediaChild[] = [];
  const words: MediaChild[] = [];
  for (const edge of visible) {
    const from = boxById.get(edge.from);
    const to = boxById.get(edge.to);
    if (!from || !to) continue;
    const predicting = phase === "predict" && answers.has(edgeKey(edge));
    const geometry = connectorGeometry(from, to, predicting ? TICK_LENGTH : undefined);
    const id = `edge-${edge.from}-${edge.to}`;
    ink.push(connectorInk(edge, geometry, id));
    words.push(
      predicting
        ? predictMark(geometry, `${id}-ask`)
        : connectorLabel(edge, geometry, `${id}-label`, plan.claimTag),
    );
  }

  const cards = boxes.map((box) => {
    const node = nodeById.get(box.id);
    return node ? nodeCard(node, box, type) : null;
  });

  return Frame(
    { id: "mechanism-band", width: plan.innerWidth, height: bandHeight, overflow: "visible" },
    Vector(
      {
        id: "mechanism-edges",
        width: plan.innerWidth,
        height: bandHeight,
        viewBox: { x: 0, y: 0, width: plan.innerWidth, height: bandHeight },
      },
      ...ink,
    ),
    ...words,
    ...cards,
  );
}

export function mechanismStrip(
  spec: MechanismStripSpec,
  phaseOverride?: IntervalMotionPhase,
): MediaElement {
  throwIf(checkMechanismStrip(spec));
  const phase = phaseOverride ?? spec.motion?.phase ?? "hold";
  const predicting = phase === "predict";
  const plan = planStrip(spec, predicting);
  const cardHeight = fittedCardHeight(spec, plan);
  const bandHeight = bandHeightFor(spec, cardHeight);
  // Two parts paper above the strip to three below: high enough to read on
  // from the chips, low enough that the plate is not top-heavy.
  const free = Math.max(0, plan.bodyHeight - bandHeight - GROUP_GAP - plan.keyHeight);

  const body = Frame(
    { id: "mechanism-body", width: plan.innerWidth, height: plan.bodyHeight },
    Stack(
      {
        width: "fill",
        height: "fill",
        justify: "start",
        gap: GROUP_GAP,
        pad: { top: Math.round(free * 0.4) },
      },
      stripBand(spec, plan, phase, cardHeight, bandHeight),
      evidenceKey(plan.claims, plan.innerWidth, plan.keyHeight, predicting),
    ),
  );

  const unit = spec.layout.kind === "pipeline" ? "stages" : "parts";
  const chips = [
    chip("layout", spec.layout.kind),
    chip("nodes", `${spec.nodes.length} ${unit}`),
    chip("edges", `${spec.edges.length} hand-offs`),
  ];
  return arrangementShell(spec, chips, body);
}
