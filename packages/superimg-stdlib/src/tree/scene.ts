//! Pure authored scene resolution. No clock, DOM, host commands, or mutable rig instances.
import type {
  MediaSemantic,
  InstanceProps,
  SpatialSceneProps,
  VisualDefinition,
  VisualFrame,
  SceneMatrix,
  SceneBounds,
  ScenePoint,
  ScenePosition,
  SceneProjection,
  SceneTransform,
  SpatialSceneSnapshot,
  ResolvedVisualInstance,
  ResolvedVisualPart,
  SceneNodeSnapshot,
  SceneRuntimeInput,
  VisualAnchor,
} from "../scene-types.js";
import type { MediaChild, MediaElement, MediaNode } from "./node-types.js";
import { isMediaElement } from "./h.js";
import { h } from "./h.js";
import { validateSubjectBinding } from "./subjects.js";

export function visual<TData>(
  input: Omit<VisualDefinition<TData>, "kind">,
): VisualDefinition<TData> {
  assertId(input.id);
  if (typeof input.render !== "function")
    throw new TypeError("visual requires render({ data })");
  return Object.freeze({ ...input, kind: "@foxworth/superimg/visual" });
}
export function Instance<TData>(props: InstanceProps<TData>): MediaElement {
  assertId(props.id);
  if (props.of?.kind !== "@foxworth/superimg/visual")
    throw new TypeError("Instance requires a visual definition");
  if (props.at && props.attachTo)
    throw new TypeError("Instance.at and attachTo are mutually exclusive");
  const binding = validateSubjectBinding(props);
  return h("Instance", binding ? { ...props, binding } : props);
}
export function Scene(
  props: SpatialSceneProps,
  ...children: MediaChild[]
): MediaElement {
  assertId(props.id);
  positive(props.width, "Scene.width");
  positive(props.height, "Scene.height");
  const tree = h("Scene", props, ...children);
  return {
    ...tree,
    sceneResolver: (options) => resolveSpatialScene(tree, options),
  };
}
export const IDENTITY_MATRIX: SceneMatrix = Object.freeze({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
});
export function multiplySceneMatrices(
  l: SceneMatrix,
  r: SceneMatrix,
): SceneMatrix {
  return {
    a: l.a * r.a + l.c * r.b,
    b: l.b * r.a + l.d * r.b,
    c: l.a * r.c + l.c * r.d,
    d: l.b * r.c + l.d * r.d,
    e: l.a * r.e + l.c * r.f + l.e,
    f: l.b * r.e + l.d * r.f + l.f,
  };
}
export function transformScenePoint(m: SceneMatrix, p: ScenePoint): ScenePoint {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}
export function transformSceneBounds(
  m: SceneMatrix,
  b: SceneBounds,
): SceneBounds {
  const ps = [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x, y: b.y + b.height },
    { x: b.x + b.width, y: b.y + b.height },
  ].map((p) => transformScenePoint(m, p));
  const x = Math.min(...ps.map((p) => p.x)),
    y = Math.min(...ps.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...ps.map((p) => p.x)) - x,
    height: Math.max(...ps.map((p) => p.y)) - y,
  };
}
const translate = (x: number, y: number): SceneMatrix => ({
  ...IDENTITY_MATRIX,
  e: x,
  f: y,
});
const matrixText = (m: SceneMatrix) =>
  `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
const ascii = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const qualify = (scope: string, id: string) =>
  `${scope}/${encodeURIComponent(id)}`;
const DEFAULT_PROJECTION: SceneProjection = {
  x: [1, 0],
  y: [0, 1],
  z: [0, 0],
  depth: [0, 0, 1],
};
function finite(n: number, name: string): number {
  if (!Number.isFinite(n)) throw new TypeError(`${name} must be finite`);
  return n;
}
function positive(n: number, name: string): number {
  finite(n, name);
  if (n <= 0) throw new TypeError(`${name} must be positive`);
  return n;
}
function assertId(id: string): void {
  if (typeof id !== "string" || !id || id.trim() !== id)
    throw new TypeError("Scene identities must be nonempty trimmed strings");
}
function bounds(b: SceneBounds): SceneBounds {
  finite(b.x, "bounds.x");
  finite(b.y, "bounds.y");
  positive(b.width, "bounds.width");
  positive(b.height, "bounds.height");
  return b;
}
function union(bs: readonly SceneBounds[]): SceneBounds {
  if (!bs.length) throw new TypeError("Cannot resolve empty visual bounds");
  const x = Math.min(...bs.map((b) => b.x)),
    y = Math.min(...bs.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...bs.map((b) => b.x + b.width)) - x,
    height: Math.max(...bs.map((b) => b.y + b.height)) - y,
  };
}
function localMatrix(t: SceneTransform = {}): SceneMatrix {
  if (t.rotateX !== undefined || t.rotateY !== undefined || t.z !== undefined)
    throw new TypeError(
      "Use at.z for depth; Scene supports planar transforms only",
    );
  const r = (finite(t.rotate ?? 0, "rotate") * Math.PI) / 180,
    x = finite(t.scaleX ?? t.scale ?? 1, "scaleX"),
    y = finite(t.scaleY ?? t.scale ?? 1, "scaleY");
  return {
    a: Math.cos(r) * x,
    b: Math.sin(r) * x,
    c: -Math.sin(r) * y,
    d: Math.cos(r) * y,
    e: finite(t.x ?? 0, "transform.x"),
    f: finite(t.y ?? 0, "transform.y"),
  };
}
function project(p: ScenePosition, basis: SceneProjection): ScenePoint {
  const x = finite(p.x, "at.x"),
    y = finite(p.y, "at.y"),
    z = finite(p.z ?? 0, "at.z");
  return {
    x: basis.x[0] * x + basis.y[0] * y + basis.z[0] * z,
    y: basis.x[1] * x + basis.y[1] * y + basis.z[1] * z,
  };
}
function depth(p: ScenePosition, b: SceneProjection): number {
  const d = b.depth ?? [0, 0, 1];
  return p.x * d[0] + p.y * d[1] + (p.z ?? 0) * d[2];
}
function childrenFlat(children: readonly MediaChild[]): MediaElement[] {
  const out: MediaElement[] = [];
  for (const c of children) {
    if (Array.isArray(c)) out.push(...childrenFlat(c));
    else if (isMediaElement(c)) out.push(c);
    else if (c !== null && c !== undefined && typeof c !== "boolean")
      throw new TypeError("Scene children must be Instance nodes");
  }
  return out;
}
function opaque(tree: MediaNode): boolean {
  return (
    tree.type === "Html" ||
    tree.type === "Video" ||
    tree.type === "Plate" ||
    childrenFlatLoose(tree.children).some(opaque)
  );
}
function childrenFlatLoose(cs: readonly MediaChild[]): MediaElement[] {
  const out: MediaElement[] = [];
  for (let index = 0; index < cs.length; index++) {
    const child = cs[index];
    if (Array.isArray(child)) out.push(...childrenFlatLoose(child));
    else if (isMediaElement(child)) out.push(child);
  }
  return out;
}

function semanticNode(
  id: string,
  semantic: MediaSemantic = {},
  parentId: string | null = null,
): SceneNodeSnapshot {
  const actions = [...new Set(semantic.actions ?? [])];
  for (const a of actions)
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(a))
      throw new TypeError(`Invalid scene action ${a}`);
  return {
    id,
    kind: semantic.kind ?? "instance",
    role: semantic.role ?? null,
    label: semantic.label ?? null,
    state: semantic.state ?? null,
    space: semantic.space ?? "world",
    parentId,
    childIds: [],
    tags: [...(semantic.tags ?? [])],
    actions,
    visible: true,
    opacity: 1,
    transform: {},
    animation: null,
    properties: {},
    metadata: { ...(semantic.metadata ?? {}) },
  };
}
function semanticAttrs(node: SceneNodeSnapshot): Record<string, unknown> {
  return {
    "data-si-node": node.id,
    ...(node.actions.length
      ? { "data-si-actions": node.actions.join(" ") }
      : {}),
  };
}

/** Scope known SVG resource references; Html interiors remain explicitly opaque. */
function namespaceArt(tree: MediaNode, scope: string): MediaNode {
  const ids = new Map<string, string>();
  const prefix = `si_${[...scope].map((c) => c.codePointAt(0)!.toString(16)).join("_")}_`;
  const gather = (n: MediaNode) => {
    if (typeof n.props.id === "string")
      ids.set(n.props.id, prefix + n.props.id);
    if (typeof n.props.html === "string")
      for (const m of n.props.html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/g))
        ids.set(m[2]!, prefix + m[2]);
    for (const c of childrenFlatLoose(n.children)) gather(c);
  };
  gather(tree);
  const refs = (s: string) =>
    s
      .replace(
        /url\(\s*(["']?)#([^\s)"']+)\1\s*\)/g,
        (all, q: string, id: string) =>
          ids.has(id) ? `url(${q}#${ids.get(id)}${q})` : all,
      )
      .replace(
        /\b(id|href|xlink:href)\s*=\s*(["'])(.*?)\2/g,
        (all, k: string, q: string, v: string) => {
          const id = k === "id" ? v : v.startsWith("#") ? v.slice(1) : "";
          return ids.has(id)
            ? `${k}=${q}${k === "id" ? "" : "#"}${ids.get(id)}${q}`
            : all;
        },
      );
  const walk = (n: MediaNode): MediaNode => {
    const props = { ...n.props };
    for (const [k, v] of Object.entries(props)) {
      if (k === "id" && typeof v === "string") props[k] = ids.get(v) ?? v;
      else if (
        (k === "mask" || k === "clip" || k === "filter") &&
        typeof v === "string"
      )
        props[k] = v.includes("url(") ? refs(v) : (ids.get(v) ?? v);
      else if (k === "html" && typeof v === "string") props[k] = refs(v);
      else if (
        (k === "href" || k === "xlink:href") &&
        typeof v === "string" &&
        v.startsWith("#")
      )
        props[k] = `#${ids.get(v.slice(1)) ?? v.slice(1)}`;
      else if (
        (k === "aria-labelledby" || k === "aria-describedby") &&
        typeof v === "string"
      )
        props[k] = v
          .split(/\s+/)
          .map((id) => ids.get(id) ?? id)
          .join(" ");
      else if (typeof v === "string" && v.includes("url(")) props[k] = refs(v);
    }
    return { ...n, props, children: mapChildren(n.children, walk) };
  };
  return walk(tree);
}
function mapChild(c: MediaChild, fn: (n: MediaNode) => MediaNode): MediaChild {
  return Array.isArray(c) ? mapChildren(c, fn) : isMediaElement(c) ? fn(c) : c;
}
// Read array elements directly: serialization never delegates to caller methods or species.
function mapChildren(
  children: readonly MediaChild[],
  fn: (n: MediaNode) => MediaNode,
): readonly MediaChild[] {
  let changed: MediaChild[] | undefined;
  for (let index = 0; index < children.length; index++) {
    const child = children[index],
      next = mapChild(child, fn);
    if (!changed && next !== child) {
      changed = [];
      for (let before = 0; before < index; before++)
        changed.push(children[before]);
    }
    if (changed) changed.push(next);
  }
  return changed ?? children;
}
/** Vector parts paint natively; layout parts use an explicit SVG foreignObject. */
function paintContent(content: MediaNode, b: SceneBounds): MediaNode {
  if (content.type === "Vector")
    return { ...content, props: { ...content.props, x: b.x, y: b.y } };
  if (content.type === "Html")
    return b.x === 0 && b.y === 0
      ? content
      : h("g", { transform: `translate(${b.x} ${b.y})` }, content);
  if (
    content.type.startsWith("Vector") ||
    ["g", "path", "rect", "circle", "ellipse", "line", "text", "defs"].includes(
      content.type,
    )
  )
    return content;
  return h(
    "foreignObject",
    { x: b.x, y: b.y, width: b.width, height: b.height },
    h(
      "div",
      {
        xmlns: "http://www.w3.org/1999/xhtml",
        style: `width:${b.width}px;height:${b.height}px`,
      },
      content,
    ),
  );
}

export interface ResolveSceneOptions {
  readonly prefix?: string;
  readonly runtime?: SceneRuntimeInput;
  /** Observes each resolved paint occurrence in the same order as the authored scene. */
  readonly onPaintPart?: (part: ResolvedVisualPart, content: MediaNode, bounds: SceneBounds, opacity: number) => void;
}
/** Resolve once into an ordinary tree and a packet describing that exact tree. */
export function resolveSceneTree(
  tree: MediaNode,
  options: ResolveSceneOptions = {},
): MediaNode {
  if (tree.type === "Instance")
    throw new TypeError("Instance must be placed inside Scene");
  if (tree.type === "Scene") {
    if (!tree.sceneResolver)
      throw new TypeError("Use Scene() to create an authored spatial scene");
    return tree.sceneResolver(options);
  }
  const children = mapChildren(tree.children, (n) =>
    resolveSceneTree(n, options),
  );
  const sem = tree.props.semantic;
  const props =
    sem && typeof tree.props["data-si-node"] !== "string"
      ? {
          ...tree.props,
          ...semanticAttrs(
            semanticNode(
              qualify(options.prefix ?? "media", sem.id ?? tree.props.id ?? ""),
              sem,
            ),
          ),
        }
      : tree.props;
  if (sem) assertId(sem.id ?? tree.props.id ?? "");
  return props === tree.props && children === tree.children
    ? tree
    : { ...tree, props, children };
}
interface Draft {
  props: InstanceProps<unknown>;
  frame: VisualFrame;
  id: string;
  node: SceneNodeSnapshot;
  matrix?: SceneMatrix;
  depth?: number;
}
function resolveSpatialScene(
  tree: MediaNode,
  options: ResolveSceneOptions,
): MediaNode {
  const p = tree.props as unknown as SpatialSceneProps,
    scope = options.prefix
      ? qualify(options.prefix, p.id)
      : encodeURIComponent(p.id);
  const projection = p.projection ?? DEFAULT_PROJECTION;
  for (const arr of [
    projection.x,
    projection.y,
    projection.z,
    projection.depth ?? [0, 0, 1],
  ])
    for (const n of arr) finite(n, "projection");
  const entries = new Map<string, Draft>(),
    qualifiedEntries = new Map<string, Draft>(),
    nodes: SceneNodeSnapshot[] = [
      semanticNode(scope, {
        ...p.semantic,
        kind: p.semantic?.kind ?? "scene",
        label: p.semantic?.label ?? p.id,
      }),
    ];
  for (const el of childrenFlat(tree.children)) {
    if (el.type !== "Instance")
      throw new TypeError(
        "Scene children must be Instance nodes; put screen layout beside Scene",
      );
    const ip = el.props as unknown as InstanceProps<unknown>;
    assertId(ip.id);
    validateSubjectBinding(ip);
    if (entries.has(ip.id)) throw new TypeError(`Duplicate instance ${ip.id}`);
    const frame = ip.of.render({ data: ip.data as never }),
      id = qualify(scope, ip.id);
    const partIds = new Set<string>();
    if (!frame.parts.length)
      throw new TypeError(`Visual ${ip.of.id} requires a part`);
    if (frame.bounds) bounds(frame.bounds);
    for (const part of frame.parts) {
      finite(part.band ?? 0, "band");
      assertId(part.id);
      if (partIds.has(part.id))
        throw new TypeError(`Duplicate part ${part.id}`);
      partIds.add(part.id);
      bounds(part.bounds);
      if (!isMediaElement(part.content))
        throw new TypeError("Visual part content must be a media tree");
    }
    for (const [name, a] of Object.entries(frame.anchors ?? {})) {
      assertId(name);
      finite(a.x, "anchor.x");
      finite(a.y, "anchor.y");
      finite(a.angle ?? 0, "anchor.angle");
    }
    const node = semanticNode(
      id,
      ip.semantic,
      ip.semantic?.parent !== undefined
        ? ip.semantic.parent === null
          ? null
          : qualify(scope, ip.semantic.parent)
        : ip.attachTo
          ? qualify(scope, ip.attachTo.instance)
          : scope,
    );
    const draft: Draft = { props: ip, frame, id, node };
    entries.set(ip.id, draft);
    qualifiedEntries.set(id, draft);
    nodes.push(node);
  }
  // Host overrides affect the same placement computation as pixels and bounds.
  for (const op of options.runtime?.operations ?? []) {
    const d = qualifiedEntries.get(op.target);
    if (!d) continue;
    if (op.type === "show") d.node = { ...d.node, visible: true };
    else if (op.type === "hide") d.node = { ...d.node, visible: false };
    else if (op.type === "set")
      d.node = {
        ...d.node,
        ...(op.value.visible !== undefined
          ? { visible: op.value.visible }
          : {}),
        ...(op.value.opacity !== undefined
          ? { opacity: op.value.opacity }
          : {}),
        transform: { ...d.node.transform, ...op.value.transform },
        properties: { ...d.node.properties, ...op.value.properties },
        ...(op.value.animation !== undefined
          ? { animation: op.value.animation }
          : {}),
      };
    else if (op.type === "fadeIn")
      d.node = {
        ...d.node,
        visible: true,
        opacity: op.options?.progress ?? 1,
        animation: { type: "fadeIn", ...op.options },
      };
    else if (op.type === "pulse")
      d.node = { ...d.node, animation: { type: "pulse", ...op.options } };
  }
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const seen = new Set<string>();
    let current: SceneNodeSnapshot | undefined = node;
    while (current?.parentId) {
      if (seen.has(current.id))
        throw new TypeError(`Semantic parent cycle at ${current.id}`);
      seen.add(current.id);
      const parentId = current.parentId;
      current = nodesById.get(parentId);
      if (!current) throw new TypeError(`Missing semantic parent ${parentId}`);
    }
  }
  for (const d of entries.values()) {
    finite(d.node.opacity, "opacity");
    if (d.node.opacity < 0 || d.node.opacity > 1)
      throw new TypeError("opacity must be between 0 and 1");
  }
  const active = new Set<string>();
  const place = (d: Draft): SceneMatrix => {
    if (d.matrix) return d.matrix;
    if (active.has(d.id)) throw new TypeError(`Attachment cycle at ${d.id}`);
    active.add(d.id);
    let base: SceneMatrix, dep: number;
    if (d.props.attachTo) {
      const parent = entries.get(d.props.attachTo.instance);
      if (!parent)
        throw new TypeError(
          `Unknown attachment instance ${d.props.attachTo.instance}`,
        );
      if (parent.node.space !== d.node.space)
        throw new TypeError(
          "Attached instances must use the same coordinate space",
        );
      const a = parent.frame.anchors?.[d.props.attachTo.anchor];
      if (!a) throw new TypeError(`Missing anchor ${d.props.attachTo.anchor}`);
      base = multiplySceneMatrices(
        place(parent),
        multiplySceneMatrices(
          translate(a.x, a.y),
          localMatrix({ rotate: a.angle ?? 0 }),
        ),
      );
      dep = parent.depth!;
      if (!parent.node.visible) d.node = { ...d.node, visible: false };
    } else {
      const at = d.props.at ?? { x: 0, y: 0, z: 0 },
        point =
          d.node.space === "screen"
            ? { x: finite(at.x, "at.x"), y: finite(at.y, "at.y") }
            : project(at, projection);
      base = translate(point.x, point.y);
      dep = depth(at, projection);
    }
    d.depth = dep;
    d.matrix = multiplySceneMatrices(
      base,
      localMatrix({ ...d.props.transform, ...d.node.transform }),
    );
    active.delete(d.id);
    return d.matrix;
  };
  const preParts: Array<{
    draft: Draft;
    part: VisualFrame["parts"][number];
    matrix: SceneMatrix;
    bounds: SceneBounds;
    depth: number;
  }> = [];
  for (const d of entries.values()) {
    const m = place(d);
    for (const part of d.frame.parts) {
      const off = part.placement ?? { x: 0, y: 0, z: 0 },
        q =
          d.node.space === "screen"
            ? {
                x: finite(off.x, "placement.x"),
                y: finite(off.y, "placement.y"),
              }
            : project(off, projection),
        pm = multiplySceneMatrices(translate(q.x, q.y), m);
      preParts.push({
        draft: d,
        part,
        matrix: pm,
        bounds: transformSceneBounds(pm, part.bounds),
        depth: d.depth! + depth(off, projection) + (part.depthBias ?? 0),
      });
    }
  }
  const partsByDraft = new Map<Draft, typeof preParts>();
  for (const part of preParts) {
    const parts = partsByDraft.get(part.draft);
    if (parts) parts.push(part);
    else partsByDraft.set(part.draft, [part]);
  }
  const inputCamera = { ...p.camera, ...options.runtime?.camera };
  let zoom = positive(inputCamera.zoom ?? 1, "camera.zoom"),
    cx = finite(inputCamera.x ?? 0, "camera.x"),
    cy = finite(inputCamera.y ?? 0, "camera.y");
  if (inputCamera.follow)
    throw new TypeError(
      "Use an explicit camera position or fit target; follow has no implicit spatial clock",
    );
  const fit = inputCamera.fit;
  const targets = fit
    ? "targets" in fit
      ? fit.targets
      : [fit.target]
    : undefined;
  if (targets) {
    if (!targets.length) throw new TypeError("Camera fit requires targets");
    const wanted = targets.map((id) => {
      const d = entries.get(id) ?? qualifiedEntries.get(id);
      if (!d || d.node.space === "screen" || !d.node.visible)
        throw new TypeError(`Camera fit target unavailable: ${id}`);
      return d.frame.bounds
        ? transformSceneBounds(d.matrix!, d.frame.bounds)
        : union(partsByDraft.get(d)!.map((x) => x.bounds));
    });
    const b = union(wanted),
      padding = finite(fit?.padding ?? 0, "fit.padding");
    if (padding < 0 || p.width <= 2 * padding || p.height <= 2 * padding)
      throw new TypeError("Camera fit padding leaves no viewport");
    const rot = localMatrix({ rotate: inputCamera.rotation ?? 0 }),
      rb = transformSceneBounds(rot, b);
    zoom = Math.min(
      (p.width - 2 * padding) / positive(rb.width, "fit.width"),
      (p.height - 2 * padding) / positive(rb.height, "fit.height"),
    );
    cx = b.x + b.width / 2;
    cy = b.y + b.height / 2;
  }
  const cm = targets
    ? multiplySceneMatrices(
        translate(p.width / 2, p.height / 2),
        multiplySceneMatrices(
          localMatrix({ scale: zoom, rotate: inputCamera.rotation ?? 0 }),
          translate(-cx, -cy),
        ),
      )
    : multiplySceneMatrices(
        localMatrix({ scale: zoom, rotate: inputCamera.rotation ?? 0 }),
        translate(-cx, -cy),
      );
  const instances: ResolvedVisualInstance[] = [];
  for (const d of entries.values()) {
    const mat =
      d.node.space === "screen"
        ? d.matrix!
        : multiplySceneMatrices(cm, d.matrix!);
    const ib = d.frame.bounds
      ? transformSceneBounds(mat, d.frame.bounds)
      : union(
          partsByDraft.get(d)!
            .map((x) =>
              transformSceneBounds(
                d.node.space === "screen" ? IDENTITY_MATRIX : cm,
                x.bounds,
              ),
            ),
        );
    const anchors: Record<string, VisualAnchor> = {};
    for (const [name, a] of Object.entries(d.frame.anchors ?? {})) {
      const point = transformScenePoint(mat, a),
        r = ((a.angle ?? 0) * Math.PI) / 180;
      const dx = mat.a * Math.cos(r) + mat.c * Math.sin(r),
        dy = mat.b * Math.cos(r) + mat.d * Math.sin(r);
      anchors[name] = { ...point, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
    }
    const binding = validateSubjectBinding(d.props);
    instances.push({
      id: d.id,
      entityId: d.props.entityId ?? null,
      definitionId: d.props.of.id,
      ...(binding ? { binding } : {}),
      matrix: mat,
      bounds: ib,
      anchors,
      ...(d.props.semantic?.hit && d.node.visible && d.node.actions.length
        ? {
            hit: {
              region: d.props.semantic.hit,
              matrix: mat,
              bounds: transformSceneBounds(
                mat,
                d.props.semantic.hit.kind === "rect"
                  ? d.props.semantic.hit
                  : {
                      x: d.props.semantic.hit.x - d.props.semantic.hit.radius,
                      y: d.props.semantic.hit.y - d.props.semantic.hit.radius,
                      width: d.props.semantic.hit.radius * 2,
                      height: d.props.semantic.hit.radius * 2,
                    },
              ),
            },
          }
        : {}),
      attachment: d.props.attachTo
        ? {
            instance: qualify(scope, d.props.attachTo.instance),
            anchor: d.props.attachTo.anchor,
          }
        : null,
    });
  }
  const instancesById = new Map(instances.map((instance) => [instance.id, instance]));
  preParts.sort(
    (a, b) =>
      (a.part.band ?? 0) - (b.part.band ?? 0) ||
      b.depth - a.depth ||
      (a.part.order ?? 0) - (b.part.order ?? 0) ||
      ascii(a.draft.id, b.draft.id) ||
      ascii(a.part.id, b.part.id),
  );
  const parts: ResolvedVisualPart[] = [],
    paint: MediaNode[] = [];
  for (const x of preParts) {
    const d = x.draft,
      mat =
        d.node.space === "screen"
          ? x.matrix
          : multiplySceneMatrices(cm, x.matrix),
      id = qualify(`${d.id}/parts`, x.part.id),
      b = transformSceneBounds(mat, x.part.bounds),
      isOpaque = opaque(x.part.content);
    const resolvedPart: ResolvedVisualPart = {
      id,
      instanceId: d.id,
      bounds: b,
      matrix: mat,
      band: x.part.band ?? 0,
      depth: finite(x.depth, "depth"),
      order: finite(x.part.order ?? 0, "order"),
      opaque: isOpaque,
    };
    parts.push(resolvedPart);
    const node = semanticNode(
      id,
      {
        kind: "part",
        space: d.node.space,
        actions: d.node.actions,
        metadata: { instanceId: d.id },
      },
      d.id,
    );
    nodes.push({ ...node, visible: d.node.visible, opacity: d.node.opacity });
    const content = resolveSceneTree(x.part.content, { prefix: id });
    const opacity = d.node.visible ? d.node.opacity : 0;
    options.onPaintPart?.(resolvedPart, content, x.part.bounds, opacity);
    paint.push(
      h(
        "VectorGroup",
        {
          ...semanticAttrs({ ...d.node, id }),
          "data-si-instance": d.id,
          "data-si-part": id,
          transform: matrixText(mat),
          opacity,
          ...(d.node.visible ? {} : { style: "display:none" }),
        },
        namespaceArt(
          paintContent(
            content,
            x.part.bounds,
          ),
          id,
        ),
      ),
    );
  }
  // Explicit hit targets are painted last, while invisible nodes never intercept.
  for (const d of entries.values()) {
    const hit = d.props.semantic?.hit;
    if (!hit || !d.node.visible || !d.node.actions.length) continue;
    const mat = instancesById.get(d.id)!.matrix;
    let shape: MediaNode;
    if (hit.kind === "rect") {
      bounds(hit);
      shape = h("rect", {
        x: hit.x,
        y: hit.y,
        width: hit.width,
        height: hit.height,
        fill: "transparent",
        "pointer-events": "all",
      });
    } else {
      finite(hit.x, "hit.x");
      finite(hit.y, "hit.y");
      positive(hit.radius, "hit.radius");
      shape = h("circle", {
        cx: hit.x,
        cy: hit.y,
        r: hit.radius,
        fill: "transparent",
        "pointer-events": "all",
      });
    }
    paint.push(
      h(
        "VectorGroup",
        {
          ...semanticAttrs(d.node),
          transform: matrixText(mat),
          "data-si-hit": "1",
        },
        shape,
      ),
    );
  }
  // Preserve emitted node/part order while building each child list once.
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const children = childrenByParent.get(node.parentId);
    if (children) children.push(node.id);
    else childrenByParent.set(node.parentId, [node.id]);
  }
  const updatedNodes = nodes.map((n) => {
    const d = qualifiedEntries.get(n.id);
    return {
      ...n,
      ...(d
        ? {
            visible: d.node.visible,
            opacity: d.node.opacity,
            transform: d.node.transform,
            properties: d.node.properties,
          }
        : {}),
      childIds: childrenByParent.get(n.id) ?? [],
    };
  });
  const snapshot: SpatialSceneSnapshot = {
    schemaVersion: 0,
    sceneId: scope,
    activeState: null,
    rootIds: [scope],
    nodes: updatedNodes,
    states: {},
    camera: {
      x: cx,
      y: cy,
      zoom,
      rotation: inputCamera.rotation ?? 0,
      fit: targets
        ? {
            target: targets.join(","),
            ...(fit?.padding !== undefined ? { padding: fit.padding } : {}),
          }
        : null,
      follow: null,
    },
    instances,
    parts,
    cameraMatrix: cm,
    viewport: { x: 0, y: 0, width: p.width, height: p.height },
  };
  // JSON validation prevents accidental host handlers/authority in the portable packet.
  const frozenSnapshot = freezeJson(
    JSON.parse(
      JSON.stringify(snapshot, (_k, v) => {
        if (
          typeof v === "function" ||
          typeof v === "symbol" ||
          typeof v === "bigint"
        )
          throw new TypeError("Scene snapshot must be JSON-shaped");
        if (typeof v === "number" && !Number.isFinite(v))
          throw new TypeError("Scene snapshot contains nonfinite data");
        return v;
      }),
    ),
  );
  const clipId = `clip_${[...scope].map((c) => c.codePointAt(0)!.toString(16)).join("_")}`;
  const children =
    p.clip === false
      ? paint
      : [
          h(
            "VectorDefs",
            {},
            h(
              "VectorClip",
              { id: clipId },
              h("rect", { x: 0, y: 0, width: p.width, height: p.height }),
            ),
          ),
          h("VectorGroup", { clip: clipId }, ...paint),
        ];
  return {
    ...h(
      "Vector",
      {
        id: scope,
        width: p.width,
        height: p.height,
        viewBox: { x: 0, y: 0, width: p.width, height: p.height },
        fit: "fill",
        "data-si-scene-id": scope,
      },
      ...children,
    ),
    sceneSnapshot: frozenSnapshot,
  };
}

/** Snapshot collection traverses the same resolved tree that is lowered. */
export function collectSceneSnapshots(
  tree: MediaNode,
): readonly SpatialSceneSnapshot[] {
  const out: SpatialSceneSnapshot[] = [];
  const walk = (n: MediaNode) => {
    if (n.sceneSnapshot) {
      if (out.some((s) => s.sceneId === n.sceneSnapshot!.sceneId))
        throw new TypeError(
          `Duplicate scene identity ${n.sceneSnapshot.sceneId}`,
        );
      out.push(n.sceneSnapshot);
    }
    if (n.sceneSnapshots) out.push(...n.sceneSnapshots);
    for (const c of childrenFlatLoose(n.children)) walk(c);
  };
  walk(tree);
  return out;
}

function freezeJson<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

/** Lift a resolved child packet through an explicit parent canvas placement. */
export function placeSceneSnapshot(
  snapshot: SpatialSceneSnapshot,
  placement: SceneMatrix,
  viewport: SceneBounds,
): SpatialSceneSnapshot {
  return freezeJson({
    ...snapshot,
    viewport: { ...viewport },
    cameraMatrix: multiplySceneMatrices(placement, snapshot.cameraMatrix),
    instances: snapshot.instances.map((instance) => ({
      ...instance,
      matrix: multiplySceneMatrices(placement, instance.matrix),
      ...(instance.hit
        ? {
            hit: {
              ...instance.hit,
              matrix: multiplySceneMatrices(placement, instance.hit.matrix),
              bounds: transformSceneBounds(placement, instance.hit.bounds),
            },
          }
        : {}),
      bounds: transformSceneBounds(placement, instance.bounds),
      anchors: Object.fromEntries(
        Object.entries(instance.anchors).map(([name, anchor]) => {
          const point = transformScenePoint(placement, anchor);
          const r = ((anchor.angle ?? 0) * Math.PI) / 180;
          return [
            name,
            {
              ...point,
              angle:
                (Math.atan2(
                  placement.b * Math.cos(r) + placement.d * Math.sin(r),
                  placement.a * Math.cos(r) + placement.c * Math.sin(r),
                ) *
                  180) /
                Math.PI,
            },
          ];
        }),
      ),
    })),
    parts: snapshot.parts.map((part) => ({
      ...part,
      matrix: multiplySceneMatrices(placement, part.matrix),
      bounds: transformSceneBounds(placement, part.bounds),
    })),
  });
}

/** Semantic descriptors remain inspectable in ordinary still, video and SVG trees. */
export function collectSceneDescriptions(
  tree: MediaNode,
): readonly import("../scene-types.js").SceneSnapshot[] {
  const spatial = collectSceneSnapshots(tree);
  const nodes: SceneNodeSnapshot[] = [];
  function visit(node: MediaNode, parent: string | null) {
    const semantic = node.props.semantic;
    let id = parent;
    if (semantic) {
      const bound = node.props["data-si-node"];
      if (typeof bound !== "string")
        throw new TypeError("Resolve semantic nodes before inspection");
      if (nodes.some((n) => n.id === bound))
        throw new TypeError(`Duplicate semantic identity ${bound}`);
      nodes.push(semanticNode(bound, semantic, parent));
      id = bound;
    }
    for (const child of childrenFlatLoose(node.children)) visit(child, id);
  }
  visit(tree, null);
  if (!nodes.length) return spatial;
  return [
    ...spatial,
    freezeJson({
      schemaVersion: 0 as const,
      sceneId: "media",
      activeState: null,
      rootIds: nodes.filter((n) => n.parentId === null).map((n) => n.id),
      nodes: nodes.map((n) => ({
        ...n,
        childIds: nodes.filter((c) => c.parentId === n.id).map((c) => c.id),
      })),
      states: {},
      camera: { x: 0, y: 0, zoom: 1, rotation: 0, fit: null, follow: null },
    }),
  ];
}
