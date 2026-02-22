import * as acorn from "acorn";

export interface TemplateMetadataConfig {
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  outputs?: Record<string, { width?: number; height?: number; fps?: number }>;
}

export interface TemplateMetadata {
  hasRenderExport: boolean;
  hasDefaultExport: boolean;
  config?: TemplateMetadataConfig;
}

type VariableInitMap = Map<string, acorn.Expression | null>;
type ExportMap = Map<string, string>;

function getIdentifierName(node: acorn.Node | null | undefined): string | undefined {
  if (!node || node.type !== "Identifier") return undefined;
  return (node as acorn.Identifier).name;
}

function readPositiveNumberLiteral(node: acorn.Expression | null | undefined): number | undefined {
  if (!node) return undefined;
  if (node.type === "Literal" && typeof node.value === "number" && Number.isFinite(node.value) && node.value > 0) {
    return node.value;
  }
  if (
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument.type === "Literal" &&
    typeof node.argument.value === "number"
  ) {
    const value = -node.argument.value;
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
}

function readConfigObject(expr: acorn.Expression): TemplateMetadataConfig | undefined {
  if (expr.type !== "ObjectExpression") return undefined;

  const config: TemplateMetadataConfig = {};
  for (const property of expr.properties) {
    if (property.type !== "Property" || property.kind !== "init" || property.computed) continue;

    let key: string | undefined;
    if (property.key.type === "Identifier") {
      key = property.key.name;
    } else if (property.key.type === "Literal" && typeof property.key.value === "string") {
      key = property.key.value;
    }
    if (!key) continue;

    // Parse outputs object
    if (key === "outputs") {
      const outputsExpr = property.value as acorn.Expression;
      if (outputsExpr.type === "ObjectExpression") {
        const outputs: Record<string, { width?: number; height?: number; fps?: number }> = {};
        for (const presetProp of outputsExpr.properties) {
          if (presetProp.type !== "Property" || presetProp.kind !== "init" || presetProp.computed) continue;
          let presetName: string | undefined;
          if (presetProp.key.type === "Identifier") {
            presetName = presetProp.key.name;
          } else if (presetProp.key.type === "Literal" && typeof presetProp.key.value === "string") {
            presetName = presetProp.key.value;
          }
          if (!presetName) continue;
          const presetExpr = presetProp.value as acorn.Expression;
          if (presetExpr.type !== "ObjectExpression") continue;
          const preset: { width?: number; height?: number; fps?: number } = {};
          for (const field of presetExpr.properties) {
            if (field.type !== "Property" || field.kind !== "init" || field.computed) continue;
            let fieldKey: string | undefined;
            if (field.key.type === "Identifier") {
              fieldKey = field.key.name;
            } else if (field.key.type === "Literal" && typeof field.key.value === "string") {
              fieldKey = field.key.value;
            }
            if (!fieldKey) continue;
            const fieldValue = readPositiveNumberLiteral(field.value as acorn.Expression);
            if (fieldValue === undefined) continue;
            if (fieldKey === "width") preset.width = fieldValue;
            if (fieldKey === "height") preset.height = fieldValue;
            if (fieldKey === "fps") preset.fps = fieldValue;
          }
          outputs[presetName] = preset;
        }
        if (Object.keys(outputs).length > 0) {
          config.outputs = outputs;
        }
      }
      continue;
    }

    const numericValue = readPositiveNumberLiteral(property.value as acorn.Expression);
    if (numericValue === undefined) continue;

    if (key === "width") config.width = numericValue;
    if (key === "height") config.height = numericValue;
    if (key === "fps") config.fps = numericValue;
    if (key === "durationSeconds") config.durationSeconds = numericValue;
  }

  if (
    config.width === undefined &&
    config.height === undefined &&
    config.fps === undefined &&
    config.durationSeconds === undefined &&
    config.outputs === undefined
  ) {
    return undefined;
  }

  return config;
}

function resolveExpression(
  name: string,
  variableInits: VariableInitMap,
  visited: Set<string> = new Set()
): acorn.Expression | undefined {
  if (visited.has(name)) return undefined;
  visited.add(name);

  const init = variableInits.get(name);
  if (!init) return undefined;

  if (init.type === "Identifier") {
    return resolveExpression(init.name, variableInits, visited);
  }

  return init;
}

function resolveObjectExpression(
  name: string,
  variableInits: VariableInitMap,
  visited: Set<string> = new Set()
): acorn.Expression | undefined {
  const expr = resolveExpression(name, variableInits, visited);
  if (!expr) return undefined;
  if (expr.type === "ObjectExpression") return expr;
  return undefined;
}

function unwrapDefineTemplate(expr: acorn.Expression): acorn.Expression {
  if (
    expr.type === "CallExpression" &&
    expr.arguments.length === 1 &&
    (expr.arguments[0] as acorn.Expression).type === "ObjectExpression"
  ) {
    return expr.arguments[0] as acorn.Expression;
  }
  return expr;
}

/**
 * Extract template metadata without executing user code.
 */
export function extractTemplateMetadata(code: string): TemplateMetadata {
  const ast = acorn.parse(code, {
    sourceType: "module",
    ecmaVersion: "latest",
  }) as acorn.Program;

  const variableInits: VariableInitMap = new Map();
  const exportMap: ExportMap = new Map();
  let hasDefaultExport = false;
  let defaultConfig: TemplateMetadataConfig | undefined;

  for (const node of ast.body) {
    if (node.type === "VariableDeclaration") {
      for (const declaration of node.declarations) {
        const name = getIdentifierName(declaration.id);
        if (!name) continue;
        variableInits.set(name, (declaration.init as acorn.Expression | null) ?? null);
      }
    }

    if (node.type === "FunctionDeclaration" && node.id) {
      variableInits.set(node.id.name, null);
    }

    if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) {
        if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
          exportMap.set(node.declaration.id.name, node.declaration.id.name);
        }
        if (node.declaration.type === "VariableDeclaration") {
          for (const declaration of node.declaration.declarations) {
            const name = getIdentifierName(declaration.id);
            if (!name) continue;
            exportMap.set(name, name);
            variableInits.set(name, (declaration.init as acorn.Expression | null) ?? null);
          }
        }
      }

      if (!node.source) {
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ExportSpecifier") continue;
          const exported = getIdentifierName(specifier.exported);
          const local = getIdentifierName(specifier.local);
          if (exported && local) {
            exportMap.set(exported, local);
          }
        }
      }
    }

    if (node.type === "ExportDefaultDeclaration") {
      hasDefaultExport = true;

      // Resolve the declaration expression
      let expr: acorn.Expression | undefined;
      const decl = node.declaration;

      if (decl.type === "FunctionDeclaration" || decl.type === "FunctionExpression") {
        // `export default function render(ctx) {}` or `export default function(ctx) {}`
        if (decl.id) {
          exportMap.set("render", decl.id.name);
        }
      } else if (decl.type === "Identifier") {
        // `export default mod` — resolve through variableInits
        expr = resolveExpression(decl.name, variableInits);
        if (expr) {
          expr = unwrapDefineTemplate(expr);
        }
      } else {
        // `export default { ... }` or `export default defineTemplate({ ... })`
        expr = unwrapDefineTemplate(decl as acorn.Expression);
      }

      // Extract render/config from resolved object expression
      if (expr && expr.type === "ObjectExpression") {
        for (const prop of expr.properties) {
          if (prop.type !== "Property" || prop.computed) continue;
          const key = getIdentifierName(prop.key);
          if (key === "render") {
            exportMap.set("render", "__default_render__");
          } else if (key === "config") {
            const configExpr = prop.value as acorn.Expression;
            if (configExpr.type === "ObjectExpression") {
              defaultConfig = readConfigObject(configExpr);
            }
          }
        }
      }
    }
  }

  const localRender = exportMap.get("render");
  const localConfig = exportMap.get("config");

  let config: TemplateMetadataConfig | undefined;
  if (localConfig) {
    const configExpr = resolveObjectExpression(localConfig, variableInits);
    if (configExpr) {
      config = readConfigObject(configExpr);
    }
  }

  // Fall back to config extracted from default export
  if (!config && defaultConfig) {
    config = defaultConfig;
  }

  return {
    hasRenderExport: Boolean(localRender),
    hasDefaultExport,
    config,
  };
}
