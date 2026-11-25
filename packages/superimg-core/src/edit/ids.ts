//! Stable edit binding id helpers.

const PROPERTY_SEP = "#";
const SCENE_NODE_SEP = "::";

/** Spatial / property binding: `intro::title#initial.transform.x` */
export function makePropertyBindingId(
  sceneId: string,
  localNodeId: string,
  propertyPath: string,
): string {
  return `${sceneId}${SCENE_NODE_SEP}${localNodeId}${PROPERTY_SEP}${propertyPath}`;
}

/** Scene duration binding: `intro#duration` */
export function makeDurationBindingId(sceneId: string): string {
  return `${sceneId}${PROPERTY_SEP}duration`;
}

/** Retained-composition still hold: `chapter/card#hold`. */
export function makeCompositionHoldBindingId(occurrencePath: string): string {
  return `${occurrencePath}${PROPERTY_SEP}hold`;
}

export function parseCompositionHoldBindingId(
  bindingId: string,
): { occurrencePath: string } | null {
  if (!bindingId.endsWith(`${PROPERTY_SEP}hold`)) return null;
  const occurrencePath = bindingId.slice(0, -`${PROPERTY_SEP}hold`.length);
  if (!occurrencePath || occurrencePath.includes(PROPERTY_SEP) || occurrencePath.includes(SCENE_NODE_SEP)) {
    return null;
  }
  return { occurrencePath };
}

export function parsePropertyBindingId(bindingId: string): {
  sceneId: string;
  localNodeId: string;
  propertyPath: string;
} | null {
  const hash = bindingId.indexOf(PROPERTY_SEP);
  if (hash <= 0) return null;
  const left = bindingId.slice(0, hash);
  const propertyPath = bindingId.slice(hash + 1);
  const sep = left.indexOf(SCENE_NODE_SEP);
  if (sep <= 0) return null;
  return {
    sceneId: left.slice(0, sep),
    localNodeId: left.slice(sep + SCENE_NODE_SEP.length),
    propertyPath,
  };
}

export function parseDurationBindingId(
  bindingId: string,
): { sceneId: string } | null {
  if (!bindingId.endsWith(`${PROPERTY_SEP}duration`)) return null;
  const sceneId = bindingId.slice(0, -`${PROPERTY_SEP}duration`.length);
  if (!sceneId || sceneId.includes(PROPERTY_SEP)) return null;
  // Duration bindings do not use ::
  if (sceneId.includes(SCENE_NODE_SEP)) return null;
  return { sceneId };
}

/** Phase weight binding: `intro#phases.enter` */
export function makePhaseBindingId(
  sceneId: string,
  phaseName: string,
): string {
  return `${sceneId}${PROPERTY_SEP}phases.${phaseName}`;
}

export function parsePhaseBindingId(
  bindingId: string,
): { sceneId: string; phaseName: string } | null {
  const hash = bindingId.indexOf(PROPERTY_SEP);
  if (hash <= 0) return null;
  const sceneId = bindingId.slice(0, hash);
  const rest = bindingId.slice(hash + 1);
  if (!rest.startsWith("phases.")) return null;
  const phaseName = rest.slice("phases.".length);
  if (!sceneId || !phaseName || sceneId.includes(SCENE_NODE_SEP)) return null;
  return { sceneId, phaseName };
}
