import { parseSync } from "oxc-parser";
import { TemplateCompilationError } from "@superimg/types";
import type { AstExpr, AstNode, AstObjectExpression } from "./ast.js";

export interface TailwindMetadataConfig {
  css?: string;
}

export interface AudioMetadataConfig {
  id?: string;
  src: string;
  role?: string;
  loop?: boolean;
  volume?: number;
  fadeIn?: number | string;
  fadeOut?: number | string;
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
  outputs?: Record<string, { width?: number; height?: number; fps?: number; format?: string }>;
  responsive?: boolean;
  type?: string;
  watermark?: import("@superimg/types").WatermarkValue;
  background?: import("@superimg/types").BackgroundValue;
  audio?: AudioMetadataConfig | { clips: AudioMetadataConfig[] };
  assets?: Record<string, string | import("@superimg/types").AssetDeclaration>;
}

export interface TemplateMetadata {
  hasRenderExport: boolean;
  hasDefaultExport: boolean;
  /** True when the default export is compose() or composeSvg(). */
  isComposed?: boolean;
  /** The `medium` field on the define() argument (string literal), default "html". */
  medium?: "html" | "svg";
  config?: TemplateMetadataConfig;
}

type VariableInitMap = Map<string, AstExpr | null>;

function getIdentifierName(node: AstNode): string | undefined {
  if (!node || node.type !== "Identifier") return undefined;
  return node.name;
}

function readPositiveNumberLiteral(node: AstNode): number | undefined {
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

function readAudioClipObject(node: AstNode): AudioMetadataConfig | undefined {
  if (node.type !== "ObjectExpression") return undefined;
  const config: AudioMetadataConfig = { src: "" };
  for (const prop of node.properties) {
    if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
    if (prop.computed) continue;
    const key = prop.key.type === "Identifier" ? prop.key.name : undefined;
    if (key === "id" && prop.value.type === "Literal" && typeof prop.value.value === "string") {
      config.id = prop.value.value;
    }
    if (key === "src" && prop.value.type === "Literal" && typeof prop.value.value === "string") {
      config.src = prop.value.value;
    }
    if (key === "role" && prop.value.type === "Literal" && typeof prop.value.value === "string") {
      config.role = prop.value.value;
    }
    if (key === "loop" && prop.value.type === "Literal" && typeof prop.value.value === "boolean") {
      config.loop = prop.value.value;
    }
    if (key === "volume" && prop.value.type === "Literal" && typeof prop.value.value === "number") {
      config.volume = prop.value.value;
    }
    if (key === "fadeIn" && prop.value.type === "Literal") {
      if (typeof prop.value.value === "number" || typeof prop.value.value === "string") {
        config.fadeIn = prop.value.value;
      }
    }
    if (key === "fadeOut" && prop.value.type === "Literal") {
      if (typeof prop.value.value === "number" || typeof prop.value.value === "string") {
        config.fadeOut = prop.value.value;
      }
    }
  }
  return config.src ? config : undefined;
}

function readStringArrayLiteral(node: AstNode): string[] | undefined {
  if (!node || node.type !== "ArrayExpression") return undefined;
  const values: string[] = [];
  for (const el of node.elements) {
    if (el && el.type === "Literal" && typeof el.value === "string") {
      values.push(el.value);
    }
  }
  return values.length > 0 ? values : undefined;
}

function readAudioConfig(node: AstNode): AudioMetadataConfig | { clips: AudioMetadataConfig[] } | undefined {
  // audio: { id, src, role, volume, fadeIn: "0.5s", ... }
  const clip = readAudioClipObject(node);
  if (clip) return clip;

  // audio: { clips: [...] }
  if (node.type === "ObjectExpression") {
    for (const prop of node.properties) {
      if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
      if (prop.computed) continue;
      const key = prop.key.type === "Identifier" ? prop.key.name : undefined;
      if (key === "clips" && prop.value.type === "ArrayExpression") {
        const clips: AudioMetadataConfig[] = [];
        for (const el of prop.value.elements) {
          if (!el) continue;
          const parsed = readAudioClipObject(el);
          if (parsed) clips.push(parsed);
        }
        return clips.length > 0 ? { clips } : undefined;
      }
    }
  }
  return undefined;
}

function readTailwindConfig(node: AstNode): boolean | TailwindMetadataConfig | undefined {
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

function readAssetsConfig(
  node: AstNode,
): Record<string, string | import("@superimg/types").AssetDeclaration> | undefined {
  if (node.type !== "ObjectExpression") return undefined;
  const assets: Record<string, string | import("@superimg/types").AssetDeclaration> = {};
  for (const prop of node.properties) {
    if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
    if (prop.computed) continue;
    let key: string | undefined;
    if (prop.key.type === "Identifier") key = prop.key.name;
    else if (prop.key.type === "Literal" && typeof prop.key.value === "string") key = prop.key.value;
    if (!key) continue;

    if (prop.value.type === "Literal" && typeof prop.value.value === "string") {
      assets[key] = prop.value.value;
    } else if (prop.value.type === "ObjectExpression") {
      const decl: { src?: string; type?: string } = {};
      for (const field of prop.value.properties) {
        if (field.type !== "Property" && field.type !== "ObjectProperty") continue;
        if (field.computed) continue;
        let fieldKey: string | undefined;
        if (field.key.type === "Identifier") fieldKey = field.key.name;
        else if (field.key.type === "Literal" && typeof field.key.value === "string") fieldKey = field.key.value;
        
        if (fieldKey === "src" && field.value.type === "Literal" && typeof field.value.value === "string") {
          decl.src = field.value.value;
        }
        if (fieldKey === "type" && field.value.type === "Literal" && typeof field.value.value === "string") {
          decl.type = field.value.value;
        }
      }
      if (decl.src) assets[key] = decl;
    }
  }
  return Object.keys(assets).length > 0 ? assets : undefined;
}

/**
 * Resolve an AST expression value through const/let bindings (identifier chains only).
 * Does not evaluate binary expressions or imports — those need runtime/inspect.
 */
function resolveConfigValue(
  node: AstExpr,
  variableInits: VariableInitMap,
  visited: Set<string> = new Set(),
): AstExpr | undefined {
  if (node.type === "Identifier") {
    if (visited.has(node.name)) return undefined;
    visited.add(node.name);
    const init = variableInits.get(node.name);
    if (!init) return undefined;
    return resolveConfigValue(init, variableInits, visited);
  }
  return node;
}

function readPositiveNumber(
  node: AstExpr,
  variableInits: VariableInitMap,
): number | undefined {
  const resolved = resolveConfigValue(node, variableInits);
  if (!resolved) return undefined;
  return readPositiveNumberLiteral(resolved);
}

function readConfigObject(
  expr: AstObjectExpression,
  variableInits: VariableInitMap = new Map(),
): TemplateMetadataConfig | undefined {
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
      const outputsExpr = resolveConfigValue(property.value, variableInits);
      if (outputsExpr && outputsExpr.type === "ObjectExpression") {
        const outputs: Record<string, { width?: number; height?: number; fps?: number; format?: string }> = {};
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
          const preset: { width?: number; height?: number; fps?: number; format?: string } = {};
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
            if (fieldKey === "format" && field.value.type === "Literal" && typeof field.value.value === "string") {
              preset.format = field.value.value;
              continue;
            }
            const fieldValue = readPositiveNumber(field.value, variableInits);
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
      config.watermark = "extracted-by-bundler";
      continue;
    }

    if (key === "background") {
      config.background = "extracted-by-bundler";
      continue;
    }

    if (key === "audio") {
      const audioValue = readAudioConfig(property.value);
      if (audioValue !== undefined) {
        config.audio = audioValue;
      }
      continue;
    }

    if (key === "assets") {
      const assetsValue = readAssetsConfig(property.value);
      if (assetsValue !== undefined) {
        config.assets = assetsValue;
      }
      continue;
    }

    if (key === "fonts") {
      const fontsValue = readStringArrayLiteral(property.value);
      if (fontsValue !== undefined) {
        config.fonts = fontsValue;
      }
      continue;
    }

    if (key === "responsive") {
      if (property.value.type === "Literal" && typeof property.value.value === "boolean") {
        config.responsive = property.value.value;
      }
      continue;
    }

    if (key === "type") {
      if (property.value.type === "Literal" && typeof property.value.value === "string") {
        config.type = property.value.value;
      }
      continue;
    }

    const numericValue = readPositiveNumber(property.value, variableInits);
    if (numericValue === undefined) continue;

    if (key === "width") config.width = numericValue;
    if (key === "height") config.height = numericValue;
    if (key === "fps") config.fps = numericValue;
    if (key === "duration") {
      config.duration = numericValue;
    }
  }

  // Also check for string-valued duration (e.g. duration: "2s" or const D = "2s")
  for (const property of expr.properties) {
    if (property.type !== "Property" && property.type !== "ObjectProperty") continue;
    if (property.computed) continue;
    const key = property.key.type === "Identifier" ? property.key.name : undefined;
    if (key === "duration" && !config.duration) {
      const resolved = resolveConfigValue(property.value, variableInits);
      if (resolved && resolved.type === "Literal" && typeof resolved.value === "string") {
        config.duration = resolved.value;
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
    config.responsive === undefined &&
    config.type === undefined &&
    config.watermark === undefined &&
    config.background === undefined &&
    config.audio === undefined &&
    config.fonts === undefined
  ) {
    return undefined;
  }

  return config;
}

function resolveExpression(
  name: string,
  variableInits: VariableInitMap,
  visited: Set<string> = new Set()
): AstExpr | undefined {
  if (visited.has(name)) return undefined;
  visited.add(name);

  const init = variableInits.get(name);
  if (!init) return undefined;

  if (init.type === "Identifier") {
    return resolveExpression(init.name, variableInits, visited);
  }

  return init;
}

function unwrapDefineTemplate(expr: AstExpr): AstExpr {
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
/**
 * Convert a byte offset within `code` to a 1-indexed line and 0-indexed column.
 * Used to translate oxc-parser's `labels[].start` (byte offset) into the
 * line/column shape that `TemplateCompilationError` expects.
 */
function offsetToLineColumn(code: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastLineStart = 0;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code.charCodeAt(i) === 10 /* \n */) {
      line++;
      lastLineStart = i + 1;
    }
  }
  return { line, column: offset - lastLineStart };
}

export async function extractTemplateMetadata(code: string): Promise<TemplateMetadata> {
  // Parse directly using oxc-parser with TS support
  const astResult = parseSync("template.ts", code);
  // Surface parse-time syntax errors as TemplateCompilationError so the
  // formatter can render them with location + code frame.
  if (astResult.errors && astResult.errors.length > 0) {
    const first = astResult.errors[0]! as {
      message: string;
      labels?: { start: number; end: number }[];
      codeframe?: string | null;
    };
    const label = first.labels?.[0];
    const loc = label != null ? offsetToLineColumn(code, label.start) : undefined;
    const tce = new TemplateCompilationError({
      syntaxError: first.message ?? "Syntax error",
      ...(loc?.line !== undefined ? { line: loc.line } : {}),
      ...(loc?.column !== undefined ? { column: loc.column } : {}),
    });
    // oxc-parser already renders a Vite-style code frame; use it directly so
    // surfaces (CLI / dev UI) get a useful snippet without us reading the file.
    if (first.codeframe) tce.codeFrame = first.codeframe.trimEnd();
    throw tce;
  }
  const ast = astResult.program;

  const variableInits: VariableInitMap = new Map();
  let hasDefaultExport = false;
  let hasRenderExport = false;
  let isComposed = false;
  let config: TemplateMetadataConfig | undefined;
  let medium: "html" | "svg" | undefined;

  function analyzeExportedExpression(declExpr: AstExpr) {
    let expr: AstExpr | undefined;

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
          const configExpr = resolveConfigValue(prop.value, variableInits);
          if (configExpr && configExpr.type === "ObjectExpression") {
            config = readConfigObject(configExpr, variableInits);
          }
        } else if (key === "medium") {
          // Top-level string literal: define({ medium: "svg", ... }).
          if (prop.value.type === "Literal" && (prop.value.value === "svg" || prop.value.value === "html")) {
            medium = prop.value.value;
          }
        }
      }
    }
    // compose([...]) / composeSvg([...]) return a TemplateModule with render
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
        isComposed = true;
        const configArg = expr.arguments[1];
        if (configArg?.type === "ObjectExpression") {
          const props = configArg.properties;
          for (const prop of props) {
            if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
            const key = getIdentifierName(prop.key);
            if (key === "config") {
              const configExpr = resolveConfigValue(prop.value, variableInits);
              if (configExpr && configExpr.type === "ObjectExpression") {
                config = readConfigObject(configExpr, variableInits);
                if (config && !medium) {
                  for (const p2 of configExpr.properties) {
                    if (p2.type !== "Property" && p2.type !== "ObjectProperty") continue;
                    if (getIdentifierName(p2.key) === "medium" && p2.value.type === "Literal" && p2.value.value === "svg") {
                      medium = "svg";
                    }
                  }
                }
              }
            }
          }
          if (!config && configArg.properties) {
            config = readConfigObject(configArg, variableInits);
          }
        }
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
    throw new TemplateCompilationError({
      syntaxError: "Template must use `export default define({ ... })`. Named exports are no longer supported.",
      suggestion: "Change `export const myTemplate = define(...)` to `export default define(...)`. If you're seeing this on a file with a syntax error, fix the syntax first.",
    });
  }

  return {
    hasRenderExport,
    hasDefaultExport,
    ...(isComposed ? { isComposed } : {}),
    ...(medium !== undefined ? { medium } : {}),
    ...(config !== undefined ? { config } : {}),
  };
}
