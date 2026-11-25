import { createHash } from "node:crypto";
import { parseSync } from "oxc-parser";
import {
  makeCompositionHoldBindingId,
  makeDurationBindingId,
  makePhaseBindingId,
  makePropertyBindingId,
} from "@superimg/core/edit";
import type {
  EditManifest,
  EditReasonCode,
  EditSourceBinding,
  MediaCoordinates,
} from "@superimg/types";

export type EditableSourceFile = Readonly<{
  relativePath: string;
  source: string;
  /** Scene owning render-local Frame/Html and director calls. */
  sceneId?: string;
}>;

export type ExtractEditBindingsOptions = Readonly<{
  coordinates: MediaCoordinates;
  intentHash: string;
  files: readonly EditableSourceFile[];
}>;

export type ExtractedEditBindings = Readonly<{
  manifest: EditManifest;
  sourceHashes: Readonly<Record<string, string>>;
}>;

type AstNode = {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
};

type PropertyInfo = Readonly<{
  node: AstNode;
  name?: string;
  value?: AstNode;
  computed: boolean;
}>;

const POSITIONED_CONSTRUCTORS = new Set(["Frame", "Html"]);
const IDENTIFIED_NODE_CONSTRUCTORS = new Set(["Frame", "Text", "Image", "Video", "Html", "Stack", "Fill", "Plate", "Safe", "Spacer"]);
const DURATION = /^(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s|f)$/;
const PHASE = /^(\d+(?:\.\d+)?|\.\d+)(%|s)$/;

export function hashEditSource(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

export function extractEditBindings(
  options: ExtractEditBindingsOptions,
): ExtractedEditBindings {
  const bindings: EditSourceBinding[] = [];
  const sourceHashes: Record<string, string> = {};
  const nodeCounts = new Map<string, number>();
  for (const file of options.files) {
    const sourceHash = hashEditSource(file.source);
    sourceHashes[file.relativePath] = sourceHash;
    const program = parse(file);
    restrictConstructorCalls(program);
    if (file.sceneId) walk(program, (node) => {
      if (node.type !== "CallExpression" || !IDENTIFIED_NODE_CONSTRUCTORS.has(identifier(unwrap(node.callee)) ?? "")) return;
      const props = firstObjectArgument(node);
      const id = props && stringLiteral(findProperty(objectProperties(props), "id")?.value);
      if (id) {
        const target = `${file.sceneId}::${id}`;
        nodeCounts.set(target, (nodeCounts.get(target) ?? 0) + 1);
      }
    });
    scanPositionedNodes(program, file, sourceHash, bindings);
    scanTextNodes(program, file, sourceHash, bindings);
    scanNodeProperties(program, file, sourceHash, bindings);
    scanInlineAudioPlacements(program, file, sourceHash, bindings);
    scanComposeDurations(program, file, sourceHash, bindings);
    scanDirectorPhases(program, file, sourceHash, bindings);
    scanTimedCompositionHolds(program, file, sourceHash, bindings);
  }

  markDuplicateBindings(bindings);
  for (const binding of bindings) {
    if ((nodeCounts.get(binding.targetId) ?? 0) > 1 && binding.reason !== "cross-file-target") {
      binding.capability = "inspect-only";
      binding.reason = "duplicate-target";
      delete binding.source;
    }
  }
  bindings.sort((left, right) =>
    left.bindingId.localeCompare(right.bindingId) ||
    (left.source?.relativePath ?? "").localeCompare(right.source?.relativePath ?? "") ||
    (left.source?.startByte ?? 0) - (right.source?.startByte ?? 0)
  );
  const summary = bindings.reduce(
    (counts, binding) => {
      if (binding.capability === "exact") counts.exactBindingCount += 1;
      else if (binding.capability === "opaque") counts.opaqueCount += 1;
      else counts.inspectOnlyCount += 1;
      return counts;
    },
    { exactBindingCount: 0, inspectOnlyCount: 0, opaqueCount: 0 },
  );
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 0,
      coordinates: options.coordinates,
      intentHash: options.intentHash,
      summary,
      bindings: bindings.map((binding) => Object.freeze(binding)),
    }),
    sourceHashes: Object.freeze({ ...sourceHashes }),
  });
}

/** Only named imports from the public authoring entry are trusted. If a local
 * declaration shadows one anywhere, conservatively disable that name. */
function restrictConstructorCalls(program: AstNode): void {
  const known = new Set([...IDENTIFIED_NODE_CONSTRUCTORS, "video", "compose", "time", "sequence", "together", "choose"]);
  const imports = new Map<string, string>();
  for (const declaration of nodeArray(program.body)) {
    if (declaration.type !== "ImportDeclaration" || stringLiteral(unwrap(declaration.source)) !== "@foxworth/superimg" || declaration.importKind === "type") continue;
    for (const spec of nodeArray(declaration.specifiers)) {
      if (spec.type !== "ImportSpecifier" || spec.importKind === "type") continue;
      const imported = identifier(unwrap(spec.imported));
      const local = identifier(unwrap(spec.local));
      if (imported && local && known.has(imported)) imports.set(local, imported);
    }
  }
  const shadowed = new Set<string>();
  const addPattern = (value: unknown): void => {
    if (!isNode(value)) return;
    if (value.type === "Identifier") { if (typeof value.name === "string") shadowed.add(value.name); return; }
    if (value.type === "Property") { addPattern(value.value); return; }
    if (value.type === "AssignmentPattern") { addPattern(value.left); return; }
    if (value.type === "RestElement") { addPattern(value.argument); return; }
    if (value.type === "ObjectPattern") for (const prop of nodeArray(value.properties)) addPattern(prop);
    if (value.type === "ArrayPattern") for (const item of nodeArray(value.elements)) addPattern(item);
  };
  walk(program, (node) => {
    if (node.type === "VariableDeclarator" || node.type === "ClassDeclaration" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ClassExpression") addPattern(node.id);
    if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") for (const param of nodeArray(node.params)) addPattern(param);
    if (node.type === "CatchClause") addPattern(node.param);
  });
  walk(program, (node) => {
    if (node.type !== "CallExpression") return;
    const callee = unwrap(node.callee);
    if (callee?.type !== "Identifier" || typeof callee.name !== "string") return;
    const name = callee.name;
    const canonical = imports.get(name);
    if (canonical && !shadowed.has(name)) callee.name = canonical;
    else if (known.has(name) || canonical) callee.name = "__unverified_superimg_call__";
  });
}

/** Only inline video audio clip placement, explicitly authored as seconds. */
function scanInlineAudioPlacements(program: AstNode, file: EditableSourceFile, sourceHash: string, out: EditSourceBinding[]): void {
  walk(program, (node) => {
    if (node.type !== "CallExpression" || identifier(unwrap(node.callee)) !== "video") return;
    const root = firstObjectArgument(node);
    if (!root) return;
    const rootProps = objectProperties(root);
    const audioProp = findProperty(rootProps, "audio");
    if (audioProp?.value?.type !== "ObjectExpression") return;
    const audioProps = objectProperties(audioProp.value);
    const clipsProp = findProperty(audioProps, "clips");
    if (clipsProp?.value?.type !== "ArrayExpression") return;
    for (const element of nodeArray(clipsProp.value.elements)) {
      const clip = unwrap(element);
      if (clip?.type !== "ObjectExpression") continue;
      const props = objectProperties(clip);
      const idProp = findProperty(props, "id");
      const id = stringLiteral(idProp?.value);
      if (!id) continue;
      const atProp = findProperty(props, "at");
      if (!atProp) continue;
      const raw = stringLiteral(atProp.value);
      const match = raw && /^(?:\d+(?:\.\d+)?|\.\d+)s$/.test(raw) ? Number(raw.slice(0, -1)) : undefined;
      const all = [rootProps, audioProps, props];
      const reason: EditReasonCode | undefined = all.some((group) => group.some((p) => p.computed)) ? "computed-property"
        : all.some((group) => group.some((p) => p.node.type === "SpreadElement")) ? "spread-property"
        : rootProps.filter((p) => p.name === "audio").length !== 1 || audioProps.filter((p) => p.name === "clips").length !== 1 || props.filter((p) => p.name === "id").length !== 1 || props.filter((p) => p.name === "at").length !== 1 ? "duplicate-target"
        : props.some((p) => p.name === "atScene") || match === undefined || !Number.isFinite(match) ? "expression-binding" : undefined;
      out.push(binding({ bindingId: `audio::${id}#placement.at`, targetId: `audio::${id}`, propertyPath: "audio.placement.at", capability: reason === undefined ? "exact" : "inspect-only",
        ...(reason === undefined ? { value: match! } : { reason }),
        ...(reason === undefined && atProp.value ? { source: sourceLocation(file, sourceHash, atProp.value, "string-duration") } : {}) }));
    }
  });
}

const NODE_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  Text: ["color", "size", "weight"], Frame: ["fill", "width", "height"],
  Image: ["src", "width", "height"], Video: ["src", "width", "height"],
};

function scanNodeProperties(program: AstNode, file: EditableSourceFile, sourceHash: string, out: EditSourceBinding[]): void {
  const sceneId = file.sceneId;
  if (!sceneId) return;
  walk(program, (node) => {
    if (node.type !== "CallExpression") return;
    const constructor = identifier(unwrap(node.callee));
    const supported = constructor && NODE_PROPERTIES[constructor];
    const props = firstObjectArgument(node);
    if (!supported || !props) return;
    const properties = objectProperties(props);
    const idProperty = findProperty(properties, "id");
    const id = stringLiteral(idProperty?.value);
    const localId = id ?? `unstable@${node.start}`;
    for (const name of supported) {
      const matches = properties.filter((p) => p.name === name);
      if (!matches.length) continue;
      const prop = matches[0]!;
      const stringProp = name === "color" || name === "fill" || name === "src";
      const value = stringProp ? stringLiteral(prop.value) : numberLiteral(prop.value);
      const valid = stringProp ? typeof value === "string" && value.length > 0 : typeof value === "number" && value > 0;
      const reason: EditReasonCode | undefined = id === undefined ? "missing-stable-id"
        : properties.some((p) => p.computed) ? "computed-property"
        : properties.some((p) => p.node.type === "SpreadElement") ? "spread-property"
        : properties.filter((p) => p.name === "id").length !== 1 || matches.length !== 1 ? "duplicate-target"
        : !valid ? "expression-binding" : undefined;
      out.push(binding({ bindingId: makePropertyBindingId(sceneId, localId, `property.${name}`), targetId: `${sceneId}::${localId}`, propertyPath: `property.${name}`,
        capability: reason === undefined ? "exact" : "inspect-only",
        ...(reason === undefined ? { value: value! } : { reason }),
        ...(reason === undefined && prop.value ? { source: sourceLocation(file, sourceHash, prop.value, stringProp ? "string-literal" : "number-literal") } : {}) }));
    }
  });
}

function scanTextNodes(program: AstNode, file: EditableSourceFile, sourceHash: string, out: EditSourceBinding[]): void {
  const sceneId = file.sceneId;
  if (!sceneId) return;
  walk(program, (node) => {
    if (node.type !== "CallExpression" || identifier(unwrap(node.callee)) !== "Text") return;
    const props = firstObjectArgument(node);
    if (!props) return;
    const properties = objectProperties(props);
    const idProperty = findProperty(properties, "id");
    const id = stringLiteral(idProperty?.value);
    const localId = id ?? `unstable@${node.start}`;
    const args = nodeArray(node.arguments);
    const child = unwrap(args[1]);
    const value = stringLiteral(child);
    const reason: EditReasonCode | undefined = id === undefined ? "missing-stable-id"
      : properties.some((p) => p.computed) ? "computed-property"
      : properties.some((p) => p.node.type === "SpreadElement") ? "spread-property"
      : properties.filter((p) => p.name === "id").length !== 1 ? "duplicate-target"
      : args.length !== 2 || value === undefined ? "expression-binding" : undefined;
    out.push(binding({ bindingId: makePropertyBindingId(sceneId, localId, "text"), targetId: `${sceneId}::${localId}`,
      propertyPath: "text", capability: reason === undefined ? "exact" : "inspect-only",
      ...(reason === undefined ? { value: value! } : { reason }),
      ...(reason === undefined && child ? { source: sourceLocation(file, sourceHash, child, "string-literal") } : {}) }));
  });
}

/**
 * Bind only literal `hold` properties inside an inline Program passed directly
 * to `time()`. The occurrence path comes from the authored Program tree, not
 * an inferred render/scene order. References, spreads, and computed fields are
 * deliberately inspect-only because they cannot identify one source literal.
 */
function scanTimedCompositionHolds(
  program: AstNode,
  file: EditableSourceFile,
  sourceHash: string,
  out: EditSourceBinding[],
): void {
  walk(program, (node) => {
    if (node.type !== "CallExpression" || callName(node) !== "time") return;
    const root = unwrap(nodeArray(node.arguments)[0]);
    if (root) scanInlineProgramHolds(root, "", file, sourceHash, out);
  });
}

function scanInlineProgramHolds(
  node: AstNode,
  parentPath: string,
  file: EditableSourceFile,
  sourceHash: string,
  out: EditSourceBinding[],
): void {
  if (node.type !== "CallExpression") return;
  const name = callName(node);
  if (name === "sequence" || name === "together") {
    const parts = unwrap(nodeArray(node.arguments)[0]);
    if (!parts || parts.type !== "ArrayExpression") return;
    for (const element of nodeArray(parts.elements)) {
      const use = unwrap(element);
      if (!use || use.type !== "ObjectExpression") continue;
      scanInlineUseHold(use, parentPath, file, sourceHash, out);
    }
    return;
  }
  if (name !== "choose") return;
  const paths = firstObjectArgument(node);
  if (!paths) return;
  const choices = objectProperties(paths);
  if (choices.some((property) => property.computed || property.node.type === "SpreadElement")) return;
  for (const property of choices) {
    if (!property.name || property.computed || !property.value) continue;
    const path = parentPath ? `${parentPath}/${property.name}` : property.name;
    scanInlineProgramHolds(property.value, path, file, sourceHash, out);
  }
}

function scanInlineUseHold(
  use: AstNode,
  parentPath: string,
  file: EditableSourceFile,
  sourceHash: string,
  out: EditSourceBinding[],
): void {
  const properties = objectProperties(use);
  const idProperty = findProperty(properties, "id");
  const id = stringLiteral(idProperty?.value);
  if (!id || idProperty?.computed) return;
  const occurrencePath = parentPath ? `${parentPath}/${id}` : id;
  const content = findProperty(properties, "content")?.value;
  if (content?.type === "CallExpression" && ["sequence", "together", "choose"].includes(callName(content) ?? "")) {
    if (properties.some((property) => property.computed || property.node.type === "SpreadElement") || properties.filter((property) => property.name === "id").length !== 1 || properties.filter((property) => property.name === "content").length !== 1) return;
    scanInlineProgramHolds(content, occurrencePath, file, sourceHash, out);
    return;
  }
  const holdProperty = findProperty(properties, "hold");
  const hold = stringLiteral(holdProperty?.value);
  const exact = hold !== undefined && DURATION.test(hold) && !properties.some((property) => property.computed || property.node.type === "SpreadElement") && properties.filter((property) => property.name === "id").length === 1 && properties.filter((property) => property.name === "hold").length === 1;
  const reason: EditReasonCode | undefined = exact
    ? undefined
    : properties.some((property) => property.computed)
      ? "computed-property"
      : properties.some((property) => property.node.type === "SpreadElement")
        ? "spread-property"
          : properties.filter((property) => property.name === "id").length !== 1 || properties.filter((property) => property.name === "hold").length !== 1
            ? "duplicate-target"
        : holdProperty === undefined
          ? "derived-duration"
          : "expression-binding";
  out.push(binding({
    bindingId: makeCompositionHoldBindingId(occurrencePath),
    targetId: occurrencePath,
    propertyPath: "composition.hold",
    capability: exact ? "exact" : "inspect-only",
    ...(exact ? { value: hold! } : reason !== undefined ? { reason } : {}),
    ...(exact && holdProperty?.value
      ? { source: sourceLocation(file, sourceHash, holdProperty.value, "string-duration") }
      : {}),
  }));
}

function parse(file: EditableSourceFile): AstNode {
  const result = parseSync(file.relativePath, file.source, {
    range: true,
    sourceType: "module",
    showSemanticErrors: true,
  });
  const firstError = result.errors.find((error) => error.severity === "Error");
  if (firstError) {
    throw new SyntaxError(
      `${file.relativePath}: ${firstError.message || "could not parse media source"}`,
    );
  }
  return result.program as unknown as AstNode;
}

function scanPositionedNodes(
  program: AstNode,
  file: EditableSourceFile,
  sourceHash: string,
  out: EditSourceBinding[],
): void {
  const sceneId = file.sceneId;
  if (!sceneId) return;
  walk(program, (node) => {
    if (node.type !== "CallExpression") return;
    const callee = unwrap(node.callee);
    if (!callee || callee.type !== "Identifier") return;
    if (!POSITIONED_CONSTRUCTORS.has(identifier(callee) ?? "")) return;
    const props = firstObjectArgument(node);
    if (!props) return;
    const properties = objectProperties(props);
    const idProperty = findProperty(properties, "id");
    const id = stringLiteral(idProperty?.value);
    const localId = id ?? `unstable@${node.start}`;
    const targetId = `${sceneId}::${localId}`;
    const spread = properties.some((property) => property.node.type === "SpreadElement");
    for (const axis of ["x", "y"] as const) {
      const property = findProperty(properties, axis);
      const value = numberLiteral(property?.value);
      const reason: EditReasonCode | undefined = id === undefined
        ? "missing-stable-id"
        : properties.some((p) => p.computed)
          ? "computed-property"
          : spread ? "spread-property"
          : properties.filter((p) => p.name === "id").length !== 1 || properties.filter((p) => p.name === axis).length > 1 ? "duplicate-target"
          : property === undefined
            ? spread ? "spread-property" : "missing-property"
            : value === undefined
              ? "expression-binding"
              : undefined;
      out.push(binding({
        bindingId: makePropertyBindingId(sceneId, localId, `initial.transform.${axis}`),
        targetId,
        propertyPath: `initial.transform.${axis}`,
        capability: reason === undefined ? "exact" : "inspect-only",
        ...(reason === undefined ? { value: value! } : { reason }),
        ...(reason === undefined && property?.value
          ? { source: sourceLocation(file, sourceHash, property.value, "number-literal") }
          : {}),
      }));
    }
  });
}

function scanComposeDurations(
  program: AstNode,
  file: EditableSourceFile,
  sourceHash: string,
  out: EditSourceBinding[],
): void {
  walk(program, (node) => {
    if (node.type !== "CallExpression") return;
    const callee = unwrap(node.callee);
    if (!callee || callee.type !== "Identifier" || identifier(callee) !== "compose") return;
    const first = nodeArray(node.arguments)[0];
    if (!first || first.type !== "ArrayExpression") return;
    for (const element of nodeArray(first.elements)) {
      const object = unwrap(element);
      if (!object || object.type !== "ObjectExpression") continue;
      const properties = objectProperties(object);
      const idProperty = findProperty(properties, "id");
      const sceneId = stringLiteral(idProperty?.value);
      if (!sceneId) continue;
      const durationProperty = findProperty(properties, "duration");
      const duration = stringLiteral(durationProperty?.value);
      const exact = duration !== undefined && DURATION.test(duration) &&
        !properties.some((property) => property.computed || property.node.type === "SpreadElement") && properties.filter((property) => property.name === "id").length === 1 && properties.filter((property) => property.name === "duration").length === 1;
      const reason: EditReasonCode | undefined = exact
        ? undefined
        : properties.some((property) => property.computed)
          ? "computed-property"
          : properties.some((property) => property.node.type === "SpreadElement")
            ? "spread-property"
            : durationProperty === undefined || duration === undefined
              ? "derived-duration"
              : "expression-binding";
      out.push(binding({
        bindingId: makeDurationBindingId(sceneId),
        targetId: sceneId,
        propertyPath: "duration",
        capability: exact ? "exact" : "inspect-only",
        ...(exact ? { value: duration } : { reason: reason! }),
        ...(exact && durationProperty?.value
          ? { source: sourceLocation(file, sourceHash, durationProperty.value, "string-duration") }
          : {}),
      }));
    }
  });
}

function scanDirectorPhases(
  program: AstNode,
  file: EditableSourceFile,
  sourceHash: string,
  out: EditSourceBinding[],
): void {
  const sceneId = file.sceneId;
  if (!sceneId) return;
  walk(program, (node) => {
    if (node.type !== "CallExpression" || !isDirectorCallee(unwrap(node.callee))) return;
    const object = firstObjectArgument(node);
    if (!object) return;
    const properties = objectProperties(object);
    for (const property of properties) {
      if (property.node.type === "SpreadElement") {
        out.push(binding({
          bindingId: `${sceneId}#phases.$spread@${property.node.start}`,
          targetId: sceneId,
          propertyPath: "phases",
          capability: "inspect-only",
          reason: "spread-property",
        }));
        continue;
      }
      if (!property.name) continue;
      const raw = stringLiteral(property.value);
      const phase = raw === undefined ? undefined : parsePhase(raw);
      const reason: EditReasonCode | undefined = properties.some((item) => item.computed)
        ? "computed-property"
        : properties.some((item) => item.node.type === "SpreadElement")
          ? "spread-property"
        : phase === undefined
          ? "expression-binding"
          : undefined;
      out.push(binding({
        bindingId: makePhaseBindingId(sceneId, property.name),
        targetId: sceneId,
        propertyPath: `phases.${property.name}`,
        capability: reason === undefined ? "exact" : "inspect-only",
        ...(reason === undefined && phase !== undefined ? { value: phase.value } : { reason: reason! }),
        ...(reason === undefined && property.value
          ? { source: sourceLocation(file, sourceHash, property.value, "string-duration") }
          : {}),
      }));
    }
  });
}

function binding(
  value: Omit<EditSourceBinding, "schemaVersion">,
): EditSourceBinding {
  return { schemaVersion: 0, ...value };
}

function sourceLocation(
  file: EditableSourceFile,
  sourceHash: string,
  node: AstNode,
  syntaxKind: "number-literal" | "string-duration" | "string-literal",
): NonNullable<EditSourceBinding["source"]> {
  return {
    relativePath: file.relativePath,
    sourceHash,
    startByte: Buffer.byteLength(file.source.slice(0, node.start), "utf8"),
    endByte: Buffer.byteLength(file.source.slice(0, node.end), "utf8"),
    syntaxKind,
  };
}

function markDuplicateBindings(bindings: EditSourceBinding[]): void {
  const grouped = new Map<string, EditSourceBinding[]>();
  for (const binding of bindings) {
    const values = grouped.get(binding.bindingId) ?? [];
    values.push(binding);
    grouped.set(binding.bindingId, values);
  }
  for (const values of grouped.values()) {
    if (values.length < 2) continue;
    const paths = new Set(values.map((value) => value.source?.relativePath).filter(Boolean));
    const reason: EditReasonCode = paths.size > 1
      ? "cross-file-target"
      : "duplicate-target";
    for (const value of values) {
      value.capability = "inspect-only";
      value.reason = reason;
      delete value.source;
    }
  }
}

function walk(root: AstNode, visit: (node: AstNode) => void): void {
  const seen = new Set<object>();
  const descend = (value: unknown): void => {
    if (!value || typeof value !== "object" || seen.has(value as object)) return;
    seen.add(value as object);
    if (isNode(value)) visit(value);
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "parent" || key === "range") continue;
      if (Array.isArray(child)) for (const item of child) descend(item);
      else descend(child);
    }
  };
  descend(root);
}

function firstObjectArgument(call: AstNode): AstNode | undefined {
  const first = nodeArray(call.arguments)[0];
  const unwrapped = unwrap(first);
  return unwrapped?.type === "ObjectExpression" ? unwrapped : undefined;
}

function objectProperties(object: AstNode): PropertyInfo[] {
  return nodeArray(object.properties).map((node) => {
    if (node.type === "SpreadElement") return { node, computed: false };
    const name = staticPropertyName(node);
    const value = isNode(node.value) ? unwrap(node.value) : undefined;
    return {
      node,
      ...(name === undefined ? {} : { name }),
      ...(value === undefined ? {} : { value }),
      computed: node.computed === true,
    };
  });
}

function findProperty(
  properties: readonly PropertyInfo[],
  name: string,
): PropertyInfo | undefined {
  return properties.find((property) => property.name === name);
}

function isDirectorCallee(node: AstNode | undefined): boolean {
  if (!node) return false;
  if (node.type === "Identifier") return identifier(node) === "director";
  if (node.type !== "StaticMemberExpression" && node.type !== "MemberExpression") return false;
  const property = unwrap(node.property);
  return identifier(property) === "director" || stringLiteral(property) === "director";
}

function callName(node: AstNode): string | undefined {
  const callee = unwrap(node.callee);
  return identifier(callee);
}

function staticPropertyName(property: AstNode): string | undefined {
  const key = unwrap(property.key);
  if (!key) return undefined;
  return identifier(key) ?? stringLiteral(key);
}

function identifier(node: AstNode | undefined): string | undefined {
  return node?.type === "Identifier" && typeof node.name === "string"
    ? node.name
    : undefined;
}

function stringLiteral(node: AstNode | undefined): string | undefined {
  if (!node || node.type !== "Literal" || typeof node.value !== "string") return undefined;
  return node.value;
}

function numberLiteral(node: AstNode | undefined): number | undefined {
  if (!node) return undefined;
  if (node.type === "Literal" && typeof node.value === "number" && Number.isFinite(node.value)) {
    return node.value;
  }
  if (node.type === "UnaryExpression" && node.operator === "-") {
    const argument = unwrap(node.argument);
    if (argument?.type === "Literal" && typeof argument.value === "number") {
      return -argument.value;
    }
  }
  return undefined;
}

function parsePhase(raw: string): { value: number; unit: "percent" | "seconds" } | undefined {
  const match = PHASE.exec(raw);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return { value, unit: match[2] === "%" ? "percent" : "seconds" };
}

function unwrap(value: unknown): AstNode | undefined {
  if (!isNode(value)) return undefined;
  let node = value;
  while (
    node.type === "ParenthesizedExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSNonNullExpression"
  ) {
    if (!isNode(node.expression)) break;
    node = node.expression;
  }
  return node;
}

function isNode(value: unknown): value is AstNode {
  return !!value && typeof value === "object" &&
    typeof (value as AstNode).type === "string" &&
    typeof (value as AstNode).start === "number" &&
    typeof (value as AstNode).end === "number";
}

function nodeArray(value: unknown): AstNode[] {
  return Array.isArray(value) ? value.filter(isNode) : [];
}
