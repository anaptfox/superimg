import { parseSync } from "oxc-parser";
import { compilerDiagnostics } from "../errors/compiler-diagnostics.js";
import type { CompilerDiagnostic } from "@superimg/types";
import { SourceMapGenerator } from "source-map-js";
import type { MediaDiagnosticCode } from "@superimg/types";

export interface SourceRange {
  start: number;
  end: number;
}

export interface ProjectionSourceMap {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent: string[];
  names: string[];
  mappings: string;
}

export interface SourceProjection {
  code: string;
  map: ProjectionSourceMap;
}

export interface ImportedBindingDescriptor {
  module: string;
  imported: string;
  local: string;
  kind: "default" | "named";
}

export type CollectionEntriesDescriptor =
  | {
      kind: "static";
      source: string;
      range: SourceRange;
    }
  | {
      kind: "provider";
      import: ImportedBindingDescriptor;
      range: SourceRange;
    };

export type CollectionEntryIdDescriptor =
  | { kind: "property"; property: string; range: SourceRange }
  | { kind: "function"; source: string; range: SourceRange }
  | { kind: "imported-function"; import: ImportedBindingDescriptor; range: SourceRange };

interface DescriptorBase {
  schemaVersion: 0;
  filename: string;
  mediaProjection: SourceProjection;
  diagnostics?: readonly CompilerDiagnostic[];
}

export interface OrdinaryMediaSourceDescriptor extends DescriptorBase {
  kind: "media";
}

export interface CollectionSourceDescriptor extends DescriptorBase {
  kind: "collection";
  declaration: "direct" | "binding";
  binding?: string;
  collectionRange: SourceRange;
  mediaRange: SourceRange;
  entries: CollectionEntriesDescriptor;
  entryId?: CollectionEntryIdDescriptor;
  entriesProjection: SourceProjection;
}

export type SourceDescriptor = OrdinaryMediaSourceDescriptor | CollectionSourceDescriptor;

export class MediaSourceAnalysisError extends Error {
  compilerDiagnostics?: readonly CompilerDiagnostic[];
  readonly code: MediaDiagnosticCode;
  readonly filename: string;
  readonly range: SourceRange | undefined;

  constructor(
    code: MediaDiagnosticCode,
    filename: string,
    message: string,
    range?: SourceRange,
  ) {
    super(message);
    this.name = "MediaSourceAnalysisError";
    this.code = code;
    this.filename = filename;
    this.range = range;
  }
}

interface AstNode extends SourceRange {
  type: string;
  [key: string]: unknown;
}

interface ImportBinding extends ImportedBindingDescriptor {
  declaration: AstNode;
  specifier: AstNode;
}

interface ParsedSource {
  program: AstNode;
  comments: Array<SourceRange & { value: string }>;
  diagnostics: readonly CompilerDiagnostic[];
}

interface LocatedCollection {
  call: AstNode;
  object: AstNode;
  declaration: "direct" | "binding";
  binding?: string;
}

const SOURCE_MAP_DIRECTIVE_PREFIXES = ["# sourceMappingURL=", "@ sourceMappingURL="] as const;

function fail(
  code: MediaDiagnosticCode,
  filename: string,
  message: string,
  node?: SourceRange,
): never {
  throw new MediaSourceAnalysisError(code, filename, message, node);
}

function isNode(value: unknown): value is AstNode {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string" &&
    typeof (value as { start?: unknown }).start === "number" &&
    typeof (value as { end?: unknown }).end === "number"
  );
}

function nodeArray(value: unknown): AstNode[] {
  return Array.isArray(value) ? value.filter(isNode) : [];
}

function parseSource(source: string, filename: string): ParsedSource {
  const result = parseSync(filename, source, {
    range: true,
    sourceType: "module",
    showSemanticErrors: true,
  });
  const firstError = result.errors.find((error) => error.severity === "Error");
  if (firstError) {
    const label = firstError.labels[0];
    const error = new MediaSourceAnalysisError(
      "MEDIA_SOURCE_PARSE_ERROR",
      filename,
      firstError.message || `Could not parse ${filename}.`,
      label ? { start: label.start, end: label.end } : undefined,
    );
    error.compilerDiagnostics = compilerDiagnostics({ errors: result.errors }, "source", filename).map((item) => {
      const start = item.labels?.[0]?.start;
      const before = start === undefined ? undefined : source.slice(0, start);
      return { ...item, code: "MEDIA_SOURCE_PARSE_ERROR", ...(before === undefined ? {} : {
        line: before.split("\n").length, column: before.length - before.lastIndexOf("\n") - 1,
      }) };
    });
    throw error;
  }
  return {
    program: result.program as unknown as AstNode,
    diagnostics: result.errors.length ? compilerDiagnostics({ errors: result.errors }, "source", filename) : [],
    comments: result.comments.map((comment) => ({
      start: comment.start,
      end: comment.end,
      value: comment.value,
    })),
  };
}

function walk(node: AstNode, visit: (node: AstNode, parent?: AstNode, key?: string) => void): void {
  const seen = new Set<object>();
  const descend = (value: unknown, parent?: AstNode, key?: string): void => {
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (isNode(value)) {
      visit(value, parent, key);
      for (const [childKey, child] of Object.entries(value)) {
        if (childKey === "parent" || childKey === "range") continue;
        if (Array.isArray(child)) {
          for (const item of child) descend(item, value, childKey);
        } else {
          descend(child, value, childKey);
        }
      }
      return;
    }
    for (const [childKey, child] of Object.entries(value)) {
      if (childKey !== "parent" && childKey !== "range") descend(child, parent, childKey);
    }
  };
  descend(node);
}

function identifierName(node: unknown): string | undefined {
  if (!isNode(node) || node.type !== "Identifier") return undefined;
  return typeof node.name === "string" ? node.name : undefined;
}

function literalValue(node: unknown): unknown {
  if (!isNode(node) || node.type !== "Literal") return undefined;
  return node.value;
}

function staticPropertyName(property: AstNode): string | undefined {
  if (property.computed === true) return undefined;
  const key = property.key;
  return identifierName(key) ?? (typeof literalValue(key) === "string" ? String(literalValue(key)) : undefined);
}

function unwrapExpression(node: AstNode): AstNode {
  let current = node;
  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSSatisfiesExpression" ||
    current.type === "TSTypeAssertion" ||
    current.type === "TSNonNullExpression"
  ) {
    const expression = current.expression;
    if (!isNode(expression)) break;
    current = expression;
  }
  return current;
}

function sourceSlice(source: string, range: SourceRange): string {
  return source.slice(range.start, range.end);
}

function importName(specifier: AstNode): string | undefined {
  const imported = specifier.imported;
  if (specifier.type === "ImportDefaultSpecifier") return "default";
  if (specifier.type === "ImportSpecifier") {
    return identifierName(imported) ?? (typeof literalValue(imported) === "string" ? String(literalValue(imported)) : undefined);
  }
  return undefined;
}

function collectImports(program: AstNode): Map<string, ImportBinding> {
  const imports = new Map<string, ImportBinding>();
  for (const statement of nodeArray(program.body)) {
    if (statement.type !== "ImportDeclaration") continue;
    const module = literalValue(statement.source);
    if (typeof module !== "string") continue;
    for (const specifier of nodeArray(statement.specifiers)) {
      const local = identifierName(specifier.local);
      if (!local) continue;
      if (specifier.type === "ImportNamespaceSpecifier") {
        imports.set(local, {
          module,
          imported: "*",
          local,
          kind: "named",
          declaration: statement,
          specifier,
        });
        continue;
      }
      const imported = importName(specifier);
      if (!imported) continue;
      imports.set(local, {
        module,
        imported,
        local,
        kind: specifier.type === "ImportDefaultSpecifier" ? "default" : "named",
        declaration: statement,
        specifier,
      });
    }
  }
  return imports;
}

const COLLECTION_MODULES = new Set(["@foxworth/superimg"]);

export interface MediaSourceAnalysisOptions {
  /** Additional authoring facades that export collection and defineInteractive. */
  readonly facades?: readonly string[];
}

function isFacadeModule(
  module: string,
  options: MediaSourceAnalysisOptions,
): boolean {
  return options.facades?.includes(module) === true;
}

function isCollectionImport(
  binding: ImportBinding | undefined,
  options: MediaSourceAnalysisOptions,
): boolean {
  return (
    binding !== undefined &&
    binding.imported === "collection" &&
    (COLLECTION_MODULES.has(binding.module) || isFacadeModule(binding.module, options))
  );
}

function isInteractiveImport(
  binding: ImportBinding | undefined,
  options: MediaSourceAnalysisOptions,
): boolean {
  if (!binding) return false;
  if (isFacadeModule(binding.module, options)) {
    return binding.imported === "defineInteractive";
  }
  if (binding.module === "@foxworth/superimg/interactive/define") {
    return true;
  }
  return (
    binding.module === "@superimg/interactive/define" &&
    binding.imported === "defineInteractive"
  );
}

function topLevelVariables(program: AstNode): Map<string, { declaration: AstNode; declarator: AstNode }> {
  const variables = new Map<string, { declaration: AstNode; declarator: AstNode }>();
  for (const statement of nodeArray(program.body)) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declarator of nodeArray(statement.declarations)) {
      const name = identifierName(declarator.id);
      if (name) variables.set(name, { declaration: statement, declarator });
    }
  }
  return variables;
}

function locateCollection(
  program: AstNode,
  imports: Map<string, ImportBinding>,
  filename: string,
  options: MediaSourceAnalysisOptions,
): LocatedCollection | undefined {
  const defaults = nodeArray(program.body).filter((statement) => statement.type === "ExportDefaultDeclaration");
  if (defaults.length !== 1) return undefined;
  const declaration = defaults[0]!.declaration;
  if (!isNode(declaration)) return undefined;
  let call = unwrapExpression(declaration);
  let binding: string | undefined;
  let declarationKind: "direct" | "binding" = "direct";

  if (call.type === "Identifier") {
    binding = identifierName(call);
    const topLevel = binding ? topLevelVariables(program).get(binding) : undefined;
    if (!topLevel) return undefined;
    const init = topLevel.declarator.init;
    if (!isNode(init)) return undefined;
    call = unwrapExpression(init);
    const initCallee = call.type === "CallExpression" ? identifierName(call.callee) : undefined;
    if (!isCollectionImport(initCallee ? imports.get(initCallee) : undefined, options)) return undefined;
    if (topLevel.declaration.kind !== "const" || nodeArray(topLevel.declaration.declarations).length !== 1) {
      fail(
        "UNSUPPORTED_COLLECTION_SYNTAX",
        filename,
        "A collection exported through a binding must use one top-level const declaration.",
        topLevel.declaration,
      );
    }
    declarationKind = "binding";
  }

  if (call.type !== "CallExpression") return undefined;
  const callee = identifierName(call.callee);
  if (!isCollectionImport(callee ? imports.get(callee) : undefined, options)) return undefined;
  const args = nodeArray(call.arguments);
  if (args.length !== 1 || args[0]!.type !== "ObjectExpression") {
    fail(
      "UNSUPPORTED_COLLECTION_SYNTAX",
      filename,
      "collection() requires one inline object argument.",
      call,
    );
  }

  if (binding && isReassigned(program, binding, call)) {
    fail(
      "COLLECTION_PROVIDER_REASSIGNED",
      filename,
      `Collection binding \`${binding}\` must not be reassigned.`,
      call,
    );
  }

  return {
    call,
    object: args[0]!,
    declaration: declarationKind,
    ...(binding ? { binding } : {}),
  };
}

function findCollectionCall(
  program: AstNode,
  imports: Map<string, ImportBinding>,
  options: MediaSourceAnalysisOptions,
): AstNode | undefined {
  let found: AstNode | undefined;
  walk(program, (node) => {
    if (found || node.type !== "CallExpression") return;
    const local = identifierName(node.callee);
    if (isCollectionImport(local ? imports.get(local) : undefined, options)) found = node;
  });
  return found;
}

function isReassigned(program: AstNode, name: string, declarationNode: AstNode): boolean {
  let reassigned = false;
  walk(program, (node) => {
    if (reassigned || (node.start >= declarationNode.start && node.end <= declarationNode.end)) return;
    if (node.type === "AssignmentExpression") {
      const left = unwrapAssignable(node.left);
      if (identifierName(left) === name) reassigned = true;
    } else if (node.type === "UpdateExpression") {
      const argument = unwrapAssignable(node.argument);
      if (identifierName(argument) === name) reassigned = true;
    }
  });
  return reassigned;
}

function unwrapAssignable(value: unknown): AstNode | undefined {
  return isNode(value) ? unwrapExpression(value) : undefined;
}

function objectProperties(
  object: AstNode,
  filename: string,
): Map<string, AstNode> {
  const properties = new Map<string, AstNode>();
  for (const property of nodeArray(object.properties)) {
    if (property.type === "SpreadElement") {
      fail(
        "COLLECTION_OPTION_SPREAD",
        filename,
        "collection() options cannot use spreads; entries and media must remain statically separable.",
        property,
      );
    }
    if (property.type !== "Property") {
      fail("UNSUPPORTED_COLLECTION_SYNTAX", filename, "Unsupported collection() option.", property);
    }
    if (property.computed === true) {
      fail(
        "COLLECTION_COMPUTED_PROPERTY",
        filename,
        "collection() option names cannot be computed.",
        property,
      );
    }
    const name = staticPropertyName(property);
    if (!name || !["entries", "media", "entryId"].includes(name)) {
      fail(
        "UNSUPPORTED_COLLECTION_SYNTAX",
        filename,
        `Unknown collection() option${name ? ` \`${name}\`` : ""}.`,
        property,
      );
    }
    if (properties.has(name)) {
      fail(
        "COLLECTION_OPTION_DUPLICATE",
        filename,
        `collection() option \`${name}\` is duplicated.`,
        property,
      );
    }
    properties.set(name, property);
  }
  return properties;
}

function propertyValue(property: AstNode): AstNode {
  const value = property.value;
  if (!isNode(value)) throw new TypeError("Expected an AST property value.");
  return unwrapExpression(value);
}

function isJsonExpression(node: AstNode): boolean {
  const value = unwrapExpression(node);
  if (value.type === "Literal") {
    const literal = value.value;
    return (
      literal === null ||
      typeof literal === "string" ||
      typeof literal === "boolean" ||
      (typeof literal === "number" && Number.isFinite(literal))
    );
  }
  if (value.type === "UnaryExpression" && value.operator === "-") {
    const argument = value.argument;
    return isNode(argument) && argument.type === "Literal" && typeof argument.value === "number" && Number.isFinite(-argument.value);
  }
  if (value.type === "ArrayExpression") {
    const elements = value.elements;
    return Array.isArray(elements) && elements.every((element) => element !== null && isNode(element) && element.type !== "SpreadElement" && isJsonExpression(element));
  }
  if (value.type === "ObjectExpression") {
    return nodeArray(value.properties).every((property) => {
      if (property.type !== "Property" || property.computed === true || property.method === true) return false;
      const name = staticPropertyName(property);
      return name !== undefined && isNode(property.value) && isJsonExpression(property.value);
    });
  }
  return false;
}

function isDedicatedServerModule(module: string): boolean {
  const withoutQuery = module.split(/[?#]/, 1)[0] ?? module;
  const withoutExtension = withoutQuery.replace(/\.(?:[cm]?[jt]sx?)$/u, "");
  const segments = withoutExtension.split("/").filter(Boolean);
  const basename = segments.at(-1) ?? "";
  return basename.endsWith(".server") || segments.includes("server");
}

function publicImport(binding: ImportBinding): ImportedBindingDescriptor {
  return {
    module: binding.module,
    imported: binding.imported,
    local: binding.local,
    kind: binding.kind,
  };
}

function analyzeEntries(
  expression: AstNode,
  source: string,
  imports: Map<string, ImportBinding>,
  program: AstNode,
  filename: string,
): CollectionEntriesDescriptor {
  const value = unwrapExpression(expression);
  if (value.type === "ArrayExpression" && isJsonExpression(value)) {
    return { kind: "static", source: sourceSlice(source, value), range: value };
  }
  if (value.type !== "Identifier") {
    fail(
      "COLLECTION_ENTRIES_UNSUPPORTED",
      filename,
      "entries must be an inline JSON-compatible array or an imported server provider.",
      value,
    );
  }
  const local = identifierName(value)!;
  const binding = imports.get(local);
  if (!binding || binding.imported === "*") {
    fail(
      "COLLECTION_ENTRIES_UNSUPPORTED",
      filename,
      "A provider used by entries must be directly imported from a dedicated server module; local and namespace providers are not supported.",
      value,
    );
  }
  if (!isDedicatedServerModule(binding.module)) {
    fail(
      "COLLECTION_PROVIDER_NOT_SERVER_MODULE",
      filename,
      `Collection provider \`${local}\` must be imported from a dedicated .server module.`,
      value,
    );
  }
  if (isReassigned(program, local, binding.specifier)) {
    fail(
      "COLLECTION_PROVIDER_REASSIGNED",
      filename,
      `Collection provider \`${local}\` must not be reassigned.`,
      value,
    );
  }
  return { kind: "provider", import: publicImport(binding), range: value };
}

function analyzeEntryId(
  expression: AstNode | undefined,
  source: string,
  imports: Map<string, ImportBinding>,
  program: AstNode,
  filename: string,
): CollectionEntryIdDescriptor | undefined {
  if (!expression) return undefined;
  const value = unwrapExpression(expression);
  if (value.type === "Literal" && typeof value.value === "string") {
    return { kind: "property", property: value.value, range: value };
  }
  if (value.type === "ArrowFunctionExpression" || value.type === "FunctionExpression") {
    if (value.async === true || value.generator === true) {
      fail("COLLECTION_ID_UNSUPPORTED", filename, "Collection entryId functions must be synchronous.", value);
    }
    const freeNames = [...collectFunctionFreeNames(value)];
    if (freeNames.length > 0) {
      fail(
        "COLLECTION_ID_UNSUPPORTED",
        filename,
        `Inline entryId functions must be self-contained; import ${JSON.stringify(freeNames[0])} from a dedicated .server module instead.`,
        value,
      );
    }
    return { kind: "function", source: sourceSlice(source, value), range: value };
  }
  if (value.type === "Identifier") {
    const local = identifierName(value)!;
    const binding = imports.get(local);
    if (!binding || binding.imported === "*" || !isDedicatedServerModule(binding.module)) {
      fail(
        "COLLECTION_ID_UNSUPPORTED",
        filename,
        "An entryId function identifier must be directly imported from a dedicated .server module.",
        value,
      );
    }
    if (isReassigned(program, local, binding.specifier)) {
      fail("COLLECTION_PROVIDER_REASSIGNED", filename, `Collection entryId function \`${local}\` must not be reassigned.`, value);
    }
    return { kind: "imported-function", import: publicImport(binding), range: value };
  }
  fail(
    "COLLECTION_ID_UNSUPPORTED",
    filename,
    "entryId must be a string-valued key or a synchronous function.",
    value,
  );
}

const DETERMINISTIC_ID_GLOBALS = new Set(["String"]);

function collectFunctionFreeNames(root: AstNode): Set<string> {
  const bound = new Set<string>();
  walk(root, (node) => {
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      node.type === "FunctionDeclaration"
    ) {
      addBindingNames(node.id, bound);
      for (const parameter of nodeArray(node.params)) addBindingNames(parameter, bound);
      return;
    }
    if (node.type === "VariableDeclarator" || node.type === "ClassDeclaration") {
      addBindingNames(node.id, bound);
      return;
    }
    if (node.type === "CatchClause") addBindingNames(node.param, bound);
  });
  return new Set(
    [...collectIdentifierNames(root)].filter(
      (name) => !bound.has(name) && !DETERMINISTIC_ID_GLOBALS.has(name),
    ),
  );
}

function addBindingNames(value: unknown, names: Set<string>): void {
  if (!isNode(value)) return;
  walk(value, (node, parent, key) => {
    if (node.type !== "Identifier") return;
    if (parent?.type === "AssignmentPattern" && key === "right") return;
    const name = identifierName(node);
    if (name) names.add(name);
  });
}

function collectIdentifierNames(root: AstNode): Set<string> {
  const names = new Set<string>();
  const importRanges =
    root.type === "Program"
      ? nodeArray(root.body)
          .filter((statement) => statement.type === "ImportDeclaration")
          .map((statement) => ({ start: statement.start, end: statement.end }))
      : [];
  walk(root, (node, parent, key) => {
    if (node.type !== "Identifier") return;
    if (importRanges.some((range) => node.start >= range.start && node.end <= range.end)) return;
    if (parent?.type === "ImportDeclaration" || key === "specifiers") return;
    if (parent?.type === "Property" && key === "key" && parent.computed !== true && parent.shorthand !== true) return;
    if (parent?.type === "MemberExpression" && key === "property" && parent.computed !== true) return;
    const name = identifierName(node);
    if (name) names.add(name);
  });
  return names;
}

function importRewriteEnd(
  source: string,
  statement: AstNode,
  comments: ParsedSource["comments"],
): number {
  const trailing = comments.find((comment) => {
    if (comment.start < statement.end) return false;
    const between = source.slice(statement.end, comment.start);
    return !between.includes("\n") && between.trim() === "";
  });
  return trailing?.end ?? statement.end;
}

function importedModulesInProjection(projection: SourceProjection, filename: string): Set<string> {
  const parsed = parseSource(projection.code, filename);
  const modules = new Set<string>();
  for (const statement of nodeArray(parsed.program.body)) {
    if (statement.type !== "ImportDeclaration") continue;
    const module = literalValue(statement.source);
    if (typeof module === "string") modules.add(module);
  }
  return modules;
}

function resolveTopLevelInitializer(
  expression: AstNode,
  variables: Map<string, { declaration: AstNode; declarator: AstNode }>,
): AstNode {
  let value = unwrapExpression(expression);
  const visited = new Set<string>();
  while (value.type === "Identifier") {
    const name = identifierName(value);
    if (!name || visited.has(name)) return value;
    visited.add(name);
    const init = variables.get(name)?.declarator.init;
    if (!isNode(init)) return value;
    value = unwrapExpression(init);
  }
  return value;
}

function rejectNestedOrInteractive(
  media: AstNode,
  program: AstNode,
  imports: Map<string, ImportBinding>,
  filename: string,
  options: MediaSourceAnalysisOptions,
): void {
  const variables = topLevelVariables(program);
  const resolved = resolveTopLevelInitializer(media, variables);
  walk(resolved, (node) => {
    if (node.type !== "CallExpression") return;
    const local = identifierName(node.callee);
    const binding = local ? imports.get(local) : undefined;
    if (isCollectionImport(binding, options)) {
      fail(
        "COLLECTION_NESTED",
        filename,
        "Collections cannot contain another collection.",
        node,
      );
    }
    if (isInteractiveImport(binding, options) || binding?.imported === "defineInteractive") {
      fail(
        "COLLECTION_INTERACTIVE_UNSUPPORTED",
        filename,
        "Interactive definitions are singular live experiences and cannot be wrapped in collection().",
        node,
      );
    }
  });
}

function mask(chars: string[], start: number, end: number): void {
  for (let index = start; index < end; index++) {
    if (chars[index] !== "\n" && chars[index] !== "\r") chars[index] = " ";
  }
}

function overwrite(chars: string[], start: number, end: number, value: string): void {
  mask(chars, start, end);
  const writable = end - start;
  if (value.length > writable) throw new Error("Projection rewrite exceeded its AST span.");
  for (let index = 0; index < value.length; index++) chars[start + index] = value[index]!;
}

function sanitizeSourceMapComments(chars: string[], comments: ParsedSource["comments"]): void {
  for (const comment of comments) {
    const value = comment.value.trimStart();
    if (SOURCE_MAP_DIRECTIVE_PREFIXES.some((prefix) => value.startsWith(prefix))) {
      mask(chars, comment.start, comment.end);
    }
  }
}

function renderImport(statement: AstNode, retained: AstNode[], source: string): string {
  if (retained.length === nodeArray(statement.specifiers).length) return sourceSlice(source, statement);
  const module = literalValue(statement.source);
  if (typeof module !== "string") return "";
  const defaults = retained.filter((specifier) => specifier.type === "ImportDefaultSpecifier");
  const namespaces = retained.filter((specifier) => specifier.type === "ImportNamespaceSpecifier");
  const named = retained.filter((specifier) => specifier.type === "ImportSpecifier");
  const clauses: string[] = [];
  if (defaults[0]) clauses.push(sourceSlice(source, defaults[0]));
  if (namespaces[0]) clauses.push(sourceSlice(source, namespaces[0]));
  if (named.length > 0) clauses.push(`{ ${named.map((specifier) => sourceSlice(source, specifier)).join(", ")} }`);
  if (clauses.length === 0) return "";
  const importType = statement.importKind === "type" ? " type" : "";
  return `import${importType} ${clauses.join(", ")} from ${JSON.stringify(module)};`;
}

function createProjectionMap(code: string, filename: string): ProjectionSourceMap {
  const generator = new SourceMapGenerator({ file: filename });
  const lines = code.split("\n");
  for (let index = 0; index < lines.length; index++) {
    generator.addMapping({
      generated: { line: index + 1, column: 0 },
      original: { line: index + 1, column: 0 },
      source: filename,
    });
  }
  generator.setSourceContent(filename, code);
  const map = generator.toJSON();
  return {
    version: Number(map.version),
    ...(map.file ? { file: map.file } : {}),
    sources: [...map.sources],
    sourcesContent: (map.sourcesContent ?? []).map((content) => content ?? ""),
    names: [...map.names],
    mappings: map.mappings,
  };
}

function projectMedia(
  source: string,
  filename: string,
  parsed: ParsedSource,
  located: LocatedCollection,
  media: AstNode,
): SourceProjection {
  // OXC spans and JavaScript string offsets count UTF-16 code units.
  const chars = source.split("");
  mask(chars, located.call.start, located.call.end);
  const mediaSource = sourceSlice(source, media);
  overwrite(chars, media.start, media.end, mediaSource);
  sanitizeSourceMapComments(chars, parsed.comments);

  let firstPass = chars.join("");
  const projected = parseSource(firstPass, filename);
  const needed = collectIdentifierNames(projected.program);
  for (const statement of nodeArray(parsed.program.body)) {
    if (statement.type !== "ImportDeclaration") continue;
    const specifiers = nodeArray(statement.specifiers);
    if (specifiers.length === 0) continue;
    const retained = specifiers.filter((specifier) => {
      const local = identifierName(specifier.local);
      return local !== undefined && needed.has(local);
    });
    overwrite(
      chars,
      statement.start,
      importRewriteEnd(source, statement, parsed.comments),
      renderImport(statement, retained, source),
    );
  }
  firstPass = chars.join("");
  parseSource(firstPass, filename);
  return { code: firstPass, map: createProjectionMap(firstPass, filename) };
}

function importStatement(binding: ImportedBindingDescriptor, alias: string): string {
  const module = JSON.stringify(binding.module);
  if (binding.kind === "default") return `import ${alias} from ${module};`;
  const imported = binding.imported === binding.local ? binding.imported : `${binding.imported}`;
  return `import { ${imported} as ${alias} } from ${module};`;
}

function projectEntries(
  entries: CollectionEntriesDescriptor,
  entryId: CollectionEntryIdDescriptor | undefined,
  filename: string,
): SourceProjection {
  const lines: string[] = [];
  let entriesExpression: string;
  if (entries.kind === "provider") {
    lines.push(importStatement(entries.import, "__superimg_entries"));
    entriesExpression = "__superimg_entries";
  } else {
    entriesExpression = entries.source;
  }
  let entryIdExpression: string | undefined;
  if (entryId?.kind === "property") {
    entryIdExpression = JSON.stringify(entryId.property);
  } else if (entryId?.kind === "function") {
    entryIdExpression = entryId.source;
  } else if (entryId?.kind === "imported-function") {
    lines.push(importStatement(entryId.import, "__superimg_entry_id"));
    entryIdExpression = "__superimg_entry_id";
  }
  lines.push(
    `export default { entries: ${entriesExpression}${entryIdExpression === undefined ? "" : `, entryId: ${entryIdExpression}`} };`,
  );
  const code = `${lines.join("\n")}\n`;
  return { code, map: createProjectionMap(code, `${filename}?superimg-entries`) };
}

function identityProjection(source: string, filename: string, comments: ParsedSource["comments"]): SourceProjection {
  const chars = source.split("");
  sanitizeSourceMapComments(chars, comments);
  const code = chars.join("");
  return { code, map: createProjectionMap(code, filename) };
}

/**
 * Parse a raw `*.media.ts` module without executing it and split deterministic
 * collection authoring into server-only entries and browser-safe media.
 */
export function analyzeMediaSource(
  source: string,
  filename: string,
  options: MediaSourceAnalysisOptions = {},
): SourceDescriptor {
  const parsed = parseSource(source, filename);
  const imports = collectImports(parsed.program);
  const located = locateCollection(parsed.program, imports, filename, options);
  if (!located) {
    const unsupportedCollection = findCollectionCall(parsed.program, imports, options);
    if (unsupportedCollection) {
      fail(
        "UNSUPPORTED_COLLECTION_SYNTAX",
        filename,
        "collection() must be the direct default export or one top-level const binding exported as default.",
        unsupportedCollection,
      );
    }
    return {
      schemaVersion: 0,
      kind: "media",
      filename,
      ...(parsed.diagnostics.length ? { diagnostics: parsed.diagnostics } : {}),
      mediaProjection: identityProjection(source, filename, parsed.comments),
    };
  }

  const properties = objectProperties(located.object, filename);
  const entriesProperty = properties.get("entries");
  if (!entriesProperty) {
    fail("COLLECTION_ENTRIES_REQUIRED", filename, "collection() requires an entries option.", located.object);
  }
  const mediaProperty = properties.get("media");
  if (!mediaProperty) {
    fail("COLLECTION_MEDIA_REQUIRED", filename, "collection() requires a media option.", located.object);
  }

  const entriesValue = propertyValue(entriesProperty);
  const mediaValue = propertyValue(mediaProperty);
  const entryIdProperty = properties.get("entryId");
  const entryIdValue = entryIdProperty ? propertyValue(entryIdProperty) : undefined;
  const entries = analyzeEntries(entriesValue, source, imports, parsed.program, filename);
  const entryId = analyzeEntryId(entryIdValue, source, imports, parsed.program, filename);

  rejectNestedOrInteractive(mediaValue, parsed.program, imports, filename, options);
  const mediaProjection = projectMedia(source, filename, parsed, located, mediaValue);
  const mediaModules = importedModulesInProjection(mediaProjection, filename);
  if (entries.kind === "provider" && mediaModules.has(entries.import.module)) {
    fail(
      "COLLECTION_PROVIDER_MEDIA_MODULE_SHARED",
      filename,
      `Collection provider module ${JSON.stringify(entries.import.module)} is also used by media and cannot be isolated from the browser graph.`,
      entriesValue,
    );
  }
  if (entryId?.kind === "imported-function" && mediaModules.has(entryId.import.module)) {
    fail(
      "COLLECTION_PROVIDER_MEDIA_MODULE_SHARED",
      filename,
      `Collection entryId module ${JSON.stringify(entryId.import.module)} is also used by media and cannot be isolated from the browser graph.`,
      entryIdValue,
    );
  }

  const entriesProjection = projectEntries(entries, entryId, filename);
  return {
    schemaVersion: 0,
    kind: "collection",
    filename,
    ...(parsed.diagnostics.length ? { diagnostics: parsed.diagnostics } : {}),
    declaration: located.declaration,
    ...(located.binding ? { binding: located.binding } : {}),
    collectionRange: { start: located.call.start, end: located.call.end },
    mediaRange: { start: mediaValue.start, end: mediaValue.end },
    entries,
    ...(entryId ? { entryId } : {}),
    mediaProjection,
    entriesProjection,
  };
}

/** Fail closed when a browser compiler is handed an unprojected collection. */
export function assertBrowserSourceCanCompile(descriptor: SourceDescriptor): void {
  if (descriptor.kind === "collection") {
    throw new MediaSourceAnalysisError(
      "COLLECTION_REQUIRES_SERVER_PROJECTION",
      descriptor.filename,
      "Raw collection source cannot enter a browser bundle; compile descriptor.mediaProjection instead.",
      descriptor.collectionRange,
    );
  }
}
