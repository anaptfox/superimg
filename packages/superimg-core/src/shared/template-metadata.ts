import { parseSync } from "oxc-parser";

export interface TailwindMetadataConfig {
  css?: string;
}

export interface AudioMetadataConfig {
  src: string;
  loop?: boolean;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface TemplateMetadataConfig {
  width?: number;
  height?: number;
  fps?: number;
  duration?: number | string;
  fonts?: string[];
  inlineCss?: string[];
  stylesheets?: string[];
  tailwind?: boolean | TailwindMetadataConfig;
  outputs?: Record<string, { width?: number; height?: number; fps?: number }>;
  watermark?: import("@superimg/types").WatermarkValue;
  background?: import("@superimg/types").BackgroundValue;
  audio?: string | AudioMetadataConfig;
}

export interface TemplateMetadata {
  hasRenderExport: boolean;
  hasDefaultExport: boolean;
  config?: TemplateMetadataConfig;
}

type VariableInitMap = Map<string, any | null>;

function getIdentifierName(node: any): string | undefined {
  if (!node || node.type !== "Identifier") return undefined;
  return node.name;
}

function readPositiveNumberLiteral(node: any): number | undefined {
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

function readAudioConfig(node: any): string | AudioMetadataConfig | undefined {
  // audio: "path/to/audio.mp3"
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  // audio: { src: "...", volume: 0.6, ... }
  if (node.type === "ObjectExpression") {
    const config: AudioMetadataConfig = { src: "" };
    for (const prop of node.properties) {
      if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
      if (prop.computed) continue;
      const key = prop.key.type === "Identifier" ? prop.key.name : undefined;
      if (key === "src" && prop.value.type === "Literal" && typeof prop.value.value === "string") {
        config.src = prop.value.value;
      }
      if (key === "loop" && prop.value.type === "Literal" && typeof prop.value.value === "boolean") {
        config.loop = prop.value.value;
      }
      if (key === "volume" && prop.value.type === "Literal" && typeof prop.value.value === "number") {
        config.volume = prop.value.value;
      }
      if (key === "fadeIn" && prop.value.type === "Literal" && typeof prop.value.value === "number") {
        config.fadeIn = prop.value.value;
      }
      if (key === "fadeOut" && prop.value.type === "Literal" && typeof prop.value.value === "number") {
        config.fadeOut = prop.value.value;
      }
    }
    return config.src ? config : undefined;
  }
  return undefined;
}

function readTailwindConfig(node: any): boolean | TailwindMetadataConfig | undefined {
  // tailwind: true
  if (node.type === "Literal" && node.value === true) {
    return true;
  }
  // tailwind: { css: "..." }
  if (node.type === "ObjectExpression") {
    const config: TailwindMetadataConfig = {};
    for (const prop of node.properties) {
      if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
      if (prop.computed) continue;
      const key = prop.key.type === "Identifier" ? prop.key.name : undefined;
      if (key === "css" && prop.value.type === "Literal" && typeof prop.value.value === "string") {
        config.css = prop.value.value;
      }
      // Also handle template literals for css
      if (key === "css" && prop.value.type === "TemplateLiteral" && prop.value.quasis.length === 1) {
        config.css = prop.value.quasis[0].value.cooked ?? prop.value.quasis[0].value.raw;
      }
    }
    return Object.keys(config).length > 0 ? config : true; // Empty object = just enable tailwind
  }
  return undefined;
}

function readConfigObject(expr: any): TemplateMetadataConfig | undefined {
  if (expr.type !== "ObjectExpression") return undefined;

  const config: TemplateMetadataConfig = {};
  for (const property of expr.properties) {
    if (property.type !== "Property" && property.type !== "ObjectProperty") continue;
    if (property.computed) continue;

    let key: string | undefined;
    if (property.key.type === "Identifier") {
      key = property.key.name;
    } else if (property.key.type === "Literal" && typeof property.key.value === "string") {
      key = property.key.value;
    }
    if (!key) continue;

    if (key === "tailwind") {
      const tailwindValue = readTailwindConfig(property.value);
      if (tailwindValue !== undefined) {
        config.tailwind = tailwindValue;
      }
      continue;
    }

    if (key === "outputs") {
      const outputsExpr = property.value;
      if (outputsExpr.type === "ObjectExpression") {
        const outputs: Record<string, { width?: number; height?: number; fps?: number }> = {};
        for (const presetProp of outputsExpr.properties) {
          if (presetProp.type !== "Property" && presetProp.type !== "ObjectProperty") continue;
          if (presetProp.computed) continue;
          let presetName: string | undefined;
          if (presetProp.key.type === "Identifier") {
            presetName = presetProp.key.name;
          } else if (presetProp.key.type === "Literal" && typeof presetProp.key.value === "string") {
            presetName = presetProp.key.value;
          }
          if (!presetName) continue;
          const presetExpr = presetProp.value;
          if (presetExpr.type !== "ObjectExpression") continue;
          const preset: { width?: number; height?: number; fps?: number } = {};
          for (const field of presetExpr.properties) {
            if (field.type !== "Property" && field.type !== "ObjectProperty") continue;
            if (field.computed) continue;
            let fieldKey: string | undefined;
            if (field.key.type === "Identifier") {
              fieldKey = field.key.name;
            } else if (field.key.type === "Literal" && typeof field.key.value === "string") {
              fieldKey = field.key.value;
            }
            if (!fieldKey) continue;
            const fieldValue = readPositiveNumberLiteral(field.value);
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

    if (key === "watermark") {
      config.watermark = "extracted-by-bundler" as any;
      continue;
    }

    if (key === "background") {
      config.background = "extracted-by-bundler" as any;
      continue;
    }

    if (key === "audio") {
      const audioValue = readAudioConfig(property.value);
      if (audioValue !== undefined) {
        config.audio = audioValue;
      }
      continue;
    }

    const numericValue = readPositiveNumberLiteral(property.value);
    if (numericValue === undefined) continue;

    if (key === "width") config.width = numericValue;
    if (key === "height") config.height = numericValue;
    if (key === "fps") config.fps = numericValue;
    if (key === "duration") {
      config.duration = numericValue;
    }
  }

  // Also check for string-valued duration (e.g. duration: "2s")
  for (const property of expr.properties) {
    if (property.type !== "Property" && property.type !== "ObjectProperty") continue;
    if (property.computed) continue;
    const key = property.key.type === "Identifier" ? property.key.name : undefined;
    if (key === "duration" && !config.duration) {
      if (property.value.type === "Literal" && typeof property.value.value === "string") {
        config.duration = property.value.value;
      }
    }
  }

  if (
    config.width === undefined &&
    config.height === undefined &&
    config.fps === undefined &&
    config.duration === undefined &&
    config.tailwind === undefined &&
    config.outputs === undefined &&
    config.watermark === undefined &&
    config.background === undefined &&
    config.audio === undefined
  ) {
    return undefined;
  }

  return config;
}

function resolveExpression(
  name: string,
  variableInits: VariableInitMap,
  visited: Set<string> = new Set()
): any | undefined {
  if (visited.has(name)) return undefined;
  visited.add(name);

  const init = variableInits.get(name);
  if (!init) return undefined;

  if (init.type === "Identifier") {
    return resolveExpression(init.name, variableInits, visited);
  }

  return init;
}

function unwrapDefineTemplate(expr: any): any {
  if (
    expr.type === "CallExpression" &&
    expr.arguments.length === 1 &&
    expr.arguments[0].type === "ObjectExpression"
  ) {
    return expr.arguments[0];
  }
  return expr;
}

/**
 * Extract template metadata without executing user code.
 * Uses oxc-parser to statically analyze the file.
 */
export async function extractTemplateMetadata(code: string): Promise<TemplateMetadata> {
  // Parse directly using oxc-parser with TS support
  const astResult = parseSync("template.ts", code);
  const ast = astResult.program;

  const variableInits: VariableInitMap = new Map();
  let hasDefaultExport = false;
  let hasRenderExport = false;
  let config: TemplateMetadataConfig | undefined;

  function analyzeExportedExpression(declExpr: any) {
    let expr: any | undefined;

    if (declExpr.type === "Identifier") {
      expr = resolveExpression(declExpr.name, variableInits);
      if (expr) expr = unwrapDefineTemplate(expr);
    } else {
      expr = unwrapDefineTemplate(declExpr);
    }

    if (expr && expr.type === "ObjectExpression") {
      for (const prop of expr.properties) {
        if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
        if (prop.computed) continue;
        const key = getIdentifierName(prop.key);
        // Note: oxc-parser groups methods on objects with Property but might have `method: true`
        if (key === "render") {
          hasRenderExport = true;
        } else if (key === "config") {
          const configExpr = prop.value;
          if (configExpr.type === "ObjectExpression") {
            config = readConfigObject(configExpr);
          }
        }
      }
    }
    // compose([...]) returns a TemplateModule with render
    if (expr && expr.type === "CallExpression") {
      const callee = expr.callee;
      const calleeName =
        callee.type === "Identifier"
          ? callee.name
          : callee.type === "MemberExpression" &&
            callee.property.type === "Identifier"
          ? callee.property.name
          : undefined;
      if (calleeName === "compose") {
        hasRenderExport = true;
      }
    }
  }

  for (const node of ast.body) {
    if (node.type === "VariableDeclaration") {
      for (const declaration of node.declarations) {
        const name = getIdentifierName(declaration.id);
        if (!name) continue;
        variableInits.set(name, declaration.init ?? null);
      }
    }

    if (node.type === "ExportDefaultDeclaration") {
      hasDefaultExport = true;
      analyzeExportedExpression(node.declaration);
    }

    // Support: export { x as default }
    if (node.type === "ExportNamedDeclaration" && node.specifiers && node.specifiers.length > 0) {
      for (const specifier of node.specifiers) {
        const exportedName = specifier.exported.type === "Identifier" ? specifier.exported.name : specifier.exported.value;
        const localName = specifier.local.type === "Identifier" ? specifier.local.name : undefined;
        
        if (exportedName === "default" && localName) {
          hasDefaultExport = true;
          const resolvedExpr = resolveExpression(localName, variableInits);
          if (resolvedExpr) analyzeExportedExpression(resolvedExpr);
        }
      }
    }
  }

  if (!hasDefaultExport) {
    throw new Error(
      "Template must use export default defineScene({ ... }). Named exports are no longer supported."
    );
  }

  return {
    hasRenderExport,
    hasDefaultExport,
    config,
  };
}
