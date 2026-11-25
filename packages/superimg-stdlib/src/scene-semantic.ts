//! Shared semantic scene evaluation and markup projection.

import type { JsonObject } from "./scene-types.js";
import { isMediaElement } from "./tree/h.js";
import type { MediaChild, MediaElement } from "./tree/node-types.js";
import type {
  SceneAuthoring,
  SceneCameraPatch,
  SceneCameraSnapshot,
  SceneNodeBinding,
  SceneNodeDefinition,
  SceneNodeSnapshot,
  SceneNodeStatePatch,
  SceneOperation,
  SceneQuery,
  SceneRuntimeInput,
  SceneStateDefinition,
  SceneStateInput,
  SceneSnapshot,
} from "./scene-types.js";

const DEFAULT_CAMERA: SceneCameraSnapshot = {
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
  fit: null,
  follow: null,
};

type MutableNode = {
  definition: SceneNodeDefinition;
  visible: boolean;
  opacity: number;
  transform: NonNullable<SceneNodeStatePatch["transform"]>;
  animation: NonNullable<SceneNodeStatePatch["animation"]> | null;
  properties: JsonObject;
};

const projectionInputs = new WeakMap<SceneAuthoring, () => SceneRuntimeInput>();

/** Resolve declaration precedence without sampling visuals or advancing a clock. */
export function sceneProjectionInput(scene: SceneAuthoring): SceneRuntimeInput {
  const input = projectionInputs.get(scene);
  if (!input) throw new TypeError("Scene authoring belongs to another runtime");
  return input();
}

export function createInteractiveSceneAuthoring(
  sceneId = "default",
  runtime: SceneRuntimeInput = {},
): SceneAuthoring {
  const definitions = new Map<string, SceneNodeDefinition>();
  const states = new Map<string, SceneStateDefinition>();
  const authored: SceneOperation[] = [];
  let authoredState: string | null = null;
  let authoredCamera: SceneCameraPatch = {};

  const binding = (id: string): SceneNodeBinding => ({
    id,
    get attrs() {
      const actions = definitions.get(id)?.actions ?? [];
      return `data-si-node="${escapeAttr(id)}"${actions.length ? ` data-si-actions="${escapeAttr(actions.join(" "))}"` : ""}`;
    },
    html(html) {
      return annotateRoot(html, this.attrs);
    },
    element(element) {
      const actions = definitions.get(id)?.actions ?? [];
      return {
        ...element,
        props: {
          ...element.props,
          "data-si-node": id,
          ...(actions.length ? { "data-si-actions": actions.join(" ") } : {}),
        },
      };
    },
    show() {
      authored.push({ type: "show", target: id });
      return this;
    },
    hide() {
      authored.push({ type: "hide", target: id });
      return this;
    },
    fadeIn(options) {
      authored.push({
        type: "fadeIn",
        target: id,
        ...(options ? { options } : {}),
      });
      return this;
    },
    pulse(options) {
      authored.push({
        type: "pulse",
        target: id,
        ...(options ? { options } : {}),
      });
      return this;
    },
    set(value) {
      authored.push({ type: "set", target: id, value });
      return this;
    },
  });

  const register = (definition: SceneNodeDefinition): SceneNodeBinding => {
    assertId(definition.id);
    if (definitions.has(definition.id))
      throw new Error(`Duplicate scene node \"${definition.id}\"`);
    definitions.set(definition.id, {
      ...definition,
      actions: uniqueActions(definition.actions),
    });
    return binding(definition.id);
  };

  let api!: SceneAuthoring;
  const node = ((
    id: string,
    htmlOrOptions?: string | Omit<SceneNodeDefinition, "id">,
    options?: Omit<SceneNodeDefinition, "id">,
  ) => {
    const hasHtml = typeof htmlOrOptions === "string";
    const result = register({ id, ...(hasHtml ? options : htmlOrOptions) });
    return hasHtml ? result.html(htmlOrOptions) : result;
  }) as SceneAuthoring["node"];
  const layer = ((
    id: string,
    htmlOrOptions?: string | Omit<SceneNodeDefinition, "id" | "kind">,
    options?: Omit<SceneNodeDefinition, "id" | "kind">,
  ) => {
    const hasHtml = typeof htmlOrOptions === "string";
    const result = register({
      id,
      kind: "layer",
      ...(hasHtml ? options : htmlOrOptions),
    });
    return hasHtml ? result.html(htmlOrOptions) : result;
  }) as SceneAuthoring["layer"];

  api = {
    node,
    layer,
    register,
    state(name, input) {
      states.set(name, normalizeState(input));
      return api;
    },
    states(inputs) {
      for (const [name, input] of Object.entries(inputs))
        states.set(name, normalizeState(input));
      return api;
    },
    use(name) {
      authoredState = name;
      return api;
    },
    show(target) {
      authored.push({ type: "show", target });
      return api;
    },
    hide(target) {
      authored.push({ type: "hide", target });
      return api;
    },
    fadeIn(target, options) {
      authored.push({
        type: "fadeIn",
        target,
        ...(options ? { options } : {}),
      });
      return api;
    },
    pulse(target, options) {
      authored.push({ type: "pulse", target, ...(options ? { options } : {}) });
      return api;
    },
    set(target, value) {
      authored.push({ type: "set", target, value });
      return api;
    },
    apply(...operations) {
      authored.push(...operations);
      return api;
    },
    scope() {
      return api;
    },
    camera: {
      set(value) {
        authoredCamera = { ...authoredCamera, ...value };
        return this;
      },
      pan(x, y) {
        authoredCamera = { ...authoredCamera, x, y };
        return this;
      },
      zoom(zoom) {
        authoredCamera = { ...authoredCamera, zoom };
        return this;
      },
      rotate(rotation) {
        authoredCamera = { ...authoredCamera, rotation };
        return this;
      },
      fit(target, options) {
        authoredCamera = { ...authoredCamera, fit: { target, ...options } };
        return this;
      },
      follow(target) {
        authoredCamera = { ...authoredCamera, follow: { target } };
        return this;
      },
      clearFit() {
        authoredCamera = { ...authoredCamera, fit: null };
        return this;
      },
      clearFollow() {
        authoredCamera = { ...authoredCamera, follow: null };
        return this;
      },
    },
    snapshot(options) {
      const activeState = runtime.state ?? authoredState;
      const mutable = new Map<string, MutableNode>();
      for (const definition of definitions.values()) {
        mutable.set(definition.id, makeNode(definition));
      }
      if (activeState) {
        const state = states.get(activeState);
        if (!state) throw new Error(`Unknown scene state \"${activeState}\"`);
        for (const operation of state.operations)
          applyOperation(mutable, operation);
      }
      for (const operation of authored) applyOperation(mutable, operation);
      for (const operation of runtime.operations ?? [])
        applyOperation(mutable, operation);
      // Snapshot-local adjacency preserves registration order, including children
      // registered before their parent, without rescanning all nodes per child list.
      const childrenByParent = new Map<string, string[]>();
      for (const node of mutable.values()) {
        const parent = node.definition.parent;
        if (parent === undefined || parent === null) continue;
        const children = childrenByParent.get(parent);
        if (children) children.push(node.definition.id);
        else childrenByParent.set(parent, [node.definition.id]);
      }
      const nodes = [...mutable.values()].map((node) =>
        toSnapshot(node, childrenByParent.get(node.definition.id) ?? []),
      );
      const ids = new Set(nodes.map((item) => item.id));
      for (const item of nodes) {
        if (item.parentId && !ids.has(item.parentId)) {
          throw new Error(`Unknown parent node \"${item.parentId}\"`);
        }
      }
      const stateRecord = Object.fromEntries(states);
      return Object.freeze({
        schemaVersion: 0 as const,
        sceneId: options?.sceneId ?? sceneId,
        activeState,
        rootIds: nodes.filter((item) => !item.parentId).map((item) => item.id),
        nodes,
        states: stateRecord,
        camera: patchCamera(
          patchCamera(
            patchCamera(
              DEFAULT_CAMERA,
              activeState ? (states.get(activeState)?.camera ?? {}) : {},
            ),
            authoredCamera,
          ),
          runtime.camera ?? {},
        ),
      });
    },
  };
  projectionInputs.set(api, () => {
    const active = runtime.state ?? authoredState;
    const selected = active ? states.get(active) : undefined;
    if (active && !selected) throw new Error(`Unknown scene state "${active}"`);
    const camera = {
      ...selected?.camera,
      ...authoredCamera,
      ...runtime.camera,
    };
    return {
      operations: [
        ...(selected?.operations ?? []),
        ...authored,
        ...(runtime.operations ?? []),
      ],
      ...(Object.keys(camera).length ? { camera } : {}),
    };
  });
  return api;
}

export function queryInteractiveScene(
  snapshot: SceneSnapshot,
  query: SceneQuery,
): readonly SceneNodeSnapshot[] {
  return snapshot.nodes.filter(
    (node) =>
      (query.id === undefined || node.id === query.id) &&
      (query.kind === undefined || node.kind === query.kind) &&
      (query.role === undefined || node.role === query.role) &&
      (query.parentId === undefined || node.parentId === query.parentId) &&
      (query.visible === undefined || node.visible === query.visible) &&
      (query.state === undefined || node.state === query.state) &&
      (query.space === undefined || node.space === query.space) &&
      (query.tag === undefined || node.tags.includes(query.tag)) &&
      (query.tags === undefined ||
        query.tags.every((tag) => node.tags.includes(tag))),
  );
}

export function getInteractiveSceneNode(
  snapshot: SceneSnapshot,
  id: string,
): SceneNodeSnapshot | undefined {
  return snapshot.nodes.find((node) => node.id === id);
}

export function projectInteractiveSceneHtml(
  html: string,
  snapshot: SceneSnapshot,
): string {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return projectHtml(html, nodes);
}

/**
 * Keep authored structure and untouched child references. Raw markup remains
 * boxed and follows the same projection and downstream sanitization policy.
 * A motion/style conflict needs the legacy post-lowering CSS ordering.
 */
export function projectInteractiveSceneTree(
  tree: MediaElement,
  snapshot: SceneSnapshot,
): MediaElement | null {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let requiresHtml = false;
  const projectChildren = (
    children: readonly MediaChild[],
  ): readonly MediaChild[] => {
    let changed: MediaChild[] | undefined;
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      const projected = projectChild(child);
      if (projected !== child) {
        changed ??= [...children];
        changed[index] = projected;
      }
    }
    return changed ?? children;
  };
  const projectChild = (child: MediaChild): MediaChild => {
    if (Array.isArray(child)) return projectChildren(child);
    return isMediaElement(child) ? projectNode(child) : child;
  };
  const projectNode = (element: MediaElement): MediaElement => {
    if (requiresHtml) return element;
    let props = element.props;
    const id = props["data-si-node"];
    const node = typeof id === "string" ? nodes.get(id) : undefined;
    if (node) {
      const styles = sceneStyles(node);
      if (styles.length) {
        // lower() composes authored opacity/transform with props.motion. The
        // former HTML projection overrides them after composition instead.
        // Retain that exact behavior through the established fallback.
        if (
          props.motion &&
          (node.opacity !== 1 || transformCss(node.transform))
        ) {
          requiresHtml = true;
          return element;
        }
        props = {
          ...props,
          style:
            props.style === undefined
              ? styles.join(";")
              : [props.style, styles.join(";")],
        };
      }
    }
    if (
      (element.type === "Html" || element.type === "Video") &&
      typeof props.html === "string"
    ) {
      const html = projectHtml(props.html, nodes);
      if (html !== props.html) props = { ...props, html };
    }
    const children = projectChildren(element.children);
    if (props === element.props && children === element.children)
      return element;
    return { ...element, props, children };
  };
  const projected = projectNode(tree);
  return requiresHtml ? null : projected;
}

function projectHtml(
  html: string,
  nodes: ReadonlyMap<string, SceneNodeSnapshot>,
): string {
  return html.replace(
    /<[A-Za-z][\w:.-]*(?:\s[^<>]*?)?\sdata-si-node\s*=\s*(["'])(.*?)\1[^<>]*>/gi,
    (tag, _quote: string, encodedId: string) => {
      const node = nodes.get(decodeAttr(encodedId));
      if (!node) return tag;
      return appendStyle(tag, sceneStyles(node));
    },
  );
}

function sceneStyles(node: SceneNodeSnapshot): string[] {
  const styles: string[] = [];
  if (!node.visible) styles.push("display:none");
  if (node.opacity !== 1) styles.push(`opacity:${node.opacity}`);
  const transform = transformCss(node.transform);
  if (transform) styles.push(`transform:${transform}`);
  return styles;
}

function normalizeState(input: SceneStateInput): SceneStateDefinition {
  const nodeOps = Object.entries(input.nodes ?? {}).map(([target, value]) => ({
    type: "set" as const,
    target,
    value,
  }));
  return {
    operations: [...nodeOps, ...(input.operations ?? [])],
    ...(input.camera !== undefined ? { camera: input.camera } : {}),
  };
}

function makeNode(definition: SceneNodeDefinition): MutableNode {
  return {
    definition,
    visible: definition.initial?.visible ?? true,
    opacity: definition.initial?.opacity ?? 1,
    transform: { ...(definition.initial?.transform ?? {}) },
    animation: definition.initial?.animation ?? null,
    properties: { ...(definition.initial?.properties ?? {}) },
  };
}

function applyOperation(
  nodes: Map<string, MutableNode>,
  operation: SceneOperation,
): void {
  const node = nodes.get(operation.target);
  if (!node) throw new Error(`Unknown scene node \"${operation.target}\"`);
  if (operation.type === "show") node.visible = true;
  else if (operation.type === "hide") node.visible = false;
  else if (operation.type === "fadeIn") {
    node.visible = true;
    node.opacity = operation.options?.progress ?? 1;
    node.animation = { type: "fadeIn", ...operation.options };
  } else if (operation.type === "pulse") {
    node.animation = { type: "pulse", ...operation.options };
  } else {
    const value = operation.value;
    if (value.visible !== undefined) node.visible = value.visible;
    if (value.opacity !== undefined) node.opacity = value.opacity;
    if (value.transform !== undefined)
      node.transform = { ...node.transform, ...value.transform };
    if (value.animation !== undefined) node.animation = value.animation;
    if (value.properties !== undefined)
      node.properties = { ...node.properties, ...value.properties };
  }
}

function toSnapshot(
  node: MutableNode,
  childIds: string[],
): SceneNodeSnapshot {
  const definition = node.definition;
  return Object.freeze({
    id: definition.id,
    kind: definition.kind ?? "node",
    role: definition.role ?? null,
    label: definition.label ?? null,
    state: definition.state ?? null,
    space: definition.space ?? "world",
    parentId: definition.parent ?? null,
    childIds,
    tags: [...(definition.tags ?? [])],
    actions: [...(definition.actions ?? [])],
    visible: node.visible,
    opacity: node.opacity,
    transform: { ...node.transform },
    animation: node.animation ? { ...node.animation } : null,
    properties: { ...node.properties },
    metadata: { ...(definition.metadata ?? {}) },
  });
}

function patchCamera(
  current: SceneCameraSnapshot,
  patch: SceneCameraPatch,
): SceneCameraSnapshot {
  return {
    x: patch.x ?? current.x,
    y: patch.y ?? current.y,
    zoom: patch.zoom ?? current.zoom,
    rotation: patch.rotation ?? current.rotation,
    fit: patch.fit !== undefined ? patch.fit : current.fit,
    follow: patch.follow !== undefined ? patch.follow : current.follow,
  };
}

function uniqueActions(
  actions: readonly string[] | undefined,
): readonly string[] {
  return [...new Set(actions ?? [])].map((action) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(action)) {
      throw new Error(`Invalid scene action \"${action}\"`);
    }
    return action;
  });
}

function assertId(value: string): void {
  if (!value || value.trim() !== value)
    throw new Error("Scene node id must be non-empty and trimmed");
}

function annotateRoot(html: string, attrs: string): string {
  return html.replace(/^(\s*<[A-Za-z][\w:.-]*)/, `$1 ${attrs}`);
}

function transformCss(value: SceneNodeSnapshot["transform"]): string {
  const parts: string[] = [];
  if (value.x !== undefined || value.y !== undefined)
    parts.push(`translate(${value.x ?? 0}px,${value.y ?? 0}px)`);
  if (value.scale !== undefined) parts.push(`scale(${value.scale})`);
  if (value.rotate !== undefined) parts.push(`rotate(${value.rotate}deg)`);
  return parts.join(" ");
}

function appendStyle(tag: string, styles: string[]): string {
  if (!styles.length) return tag;
  if (/\sstyle\s*=\s*["']/i.test(tag)) {
    return tag.replace(
      /\sstyle\s*=\s*(["'])(.*?)\1/i,
      (_all, quote: string, current: string) =>
        ` style=${quote}${current};${styles.join(";")}${quote}`,
    );
  }
  return tag.replace(/>$/, ` style="${styles.join(";")}">`);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
