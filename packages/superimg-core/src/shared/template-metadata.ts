import { parseSync } from "oxc-parser";
import { TemplateCompilationError } from "@superimg/types";
import type { AstExpr, AstNode, AstObjectExpression } from "./ast.js";
import {
  isArrayExpression,
  isCallExpression,
  isIdentifier,
  isLiteral,
  isMemberExpression,
  isObjectExpression,
  isTemplateLiteral,
  isUnaryExpression,
} from "./ast.js";

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
  /** Playback intent for animated templates. */
  temporal?: "once" | "loop";
  fonts?: string[];
  inlineCss?: string[];
  stylesheets?: string[];
  tailwind?: boolean | TailwindMetadataConfig;
  type?: string;
  watermark?: import("@superimg/types").WatermarkValue;
  background?: import("@superimg/types").BackgroundValue;
  audio?: AudioMetadataConfig | { clips: AudioMetadataConfig[] };
  assets?: Record<string, import("@superimg/types").AssetDeclaration>;
}

export interface TemplateMetadata {
  hasRenderExport: boolean;
  hasDefaultExport: boolean;
  /** The `medium` field on the define() argument (string literal), default "html". */
  medium?: "html" | "svg";
  config?: TemplateMetadataConfig;
}

type VariableInitMap = Map<string, AstExpr | null>;

function getIdentifierName(node: AstNode): string | undefined {
  if (!node || !isIdentifier(node)) return undefined;
  return node.name;
}

function readPositiveNumberLiteral(node: AstNode): number | undefined {
  if (!node) return undefined;
  if (isLiteral(node) && typeof node.value === "number" && Number.isFinite(node.value) && node.value > 0) {
    return node.value;
  }
  if (
    isUnaryExpression(node) &&
    node.operator === "-" &&
    isLiteral(node.argument) &&
    typeof node.argument.value === "number"
  ) {
    const value = -node.argument.value;
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
}

function readAudioClipObject(node: AstNode): AudioMetadataConfig | undefined {
  if (!isObjectExpression(node)) return undefined;
  const config: AudioMetadataConfig = { src: "" };
  for (const prop of node.properties) {
    if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
    if (prop.computed) continue;
    const key = isIdentifier(prop.key) ? prop.key.name : undefined;
    if (key === "id" && isLiteral(prop.value) && typeof prop.value.value === "string") {
      config.id = prop.value.value;
    }
    if (key === "src" && isLiteral(prop.value) && typeof prop.value.value === "string") {
      config.src = prop.value.value;
    }
    if (key === "role" && isLiteral(prop.value) && typeof prop.value.value === "string") {
      config.role = prop.value.value;
    }
    if (key === "loop" && isLiteral(prop.value) && typeof prop.value.value === "boolean") {
      config.loop = prop.value.value;
    }
    if (key === "volume" && isLiteral(prop.value) && typeof prop.value.value === "number") {
      config.volume = prop.value.value;
    }
    if (key === "fadeIn" && isLiteral(prop.value)) {
      if (typeof prop.value.value === "number" || typeof prop.value.value === "string") {
        config.fadeIn = prop.value.value;
      }
    }
    if (key === "fadeOut" && isLiteral(prop.value)) {
      if (typeof prop.value.value === "number" || typeof prop.value.value === "string") {
        config.fadeOut = prop.value.value;
      }
    }
  }
  return config.src ? config : undefined;
}

function readFontSpecs(node: AstNode): string[] | undefined {
  if (!node || !isArrayExpression(node)) return undefined;
  const values: string[] = [];
  for (const el of node.elements) {
    if (!el) continue;
    if (isLiteral(el) && typeof el.value === "string" && el.value.trim().length > 0) {
      values.push(el.value);
      continue;
    }
    if (
      isCallExpression(el) &&
      isIdentifier(el.callee) &&
      el.callee.name === "googleFont" &&
      el.arguments.length >= 1
    ) {
      const arg = el.arguments[0];
      if (arg && isLiteral(arg) && typeof arg.value === "string" && arg.value.trim().length > 0) {
        values.push(arg.value);
      }
    }
  }
  return values.length > 0 ? values : undefined;
}

function readAudioConfig(node: AstNode): AudioMetadataConfig | { clips: AudioMetadataConfig[] } | undefined {
  // audio: { id, src, role, volume, fadeIn: "0.5s", ... }
  const clip = readAudioClipObject(node);
  if (clip) return clip;

  // audio: { clips: [...] }
  if (isObjectExpression(node)) {
    for (const prop of node.properties) {
      if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
      if (prop.computed) continue;
      const key = isIdentifier(prop.key) ? prop.key.name : undefined;
      if (key === "clips" && isArrayExpression(prop.value)) {
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
  if (isLiteral(node) && node.value === true) {
    return true;
  }
  // tailwind: { css: "..." }
  if (isObjectExpression(node)) {
    const config: TailwindMetadataConfig = {};
    for (const prop of node.properties) {
      if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
      if (prop.computed) continue;
      const key = isIdentifier(prop.key) ? prop.key.name : undefined;
      if (key === "css" && isLiteral(prop.value) && typeof prop.value.value === "string") {
        config.css = prop.value.value;
      }
      // Also handle template literals for css
      if (key === "css" && isTemplateLiteral(prop.value) && prop.value.quasis.length === 1) {
        const quasi = prop.value.quasis[0]!;
        config.css = quasi.value.cooked ?? quasi.value.raw;
      }
    }
    return Object.keys(config).length > 0 ? config : true; // Empty object = just enable tailwind
  }
  return undefined;
}

function readAssetsConfig(
  node: AstNode,
): Record<string, import("@superimg/types").AssetDeclaration> | undefined {
  if (!isObjectExpression(node)) return undefined;
  const assets: Record<string, import("@superimg/types").AssetDeclaration> = {};
  for (const prop of node.properties) {
    if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
    if (prop.computed) continue;
    let key: string | undefined;
    if (isIdentifier(prop.key)) key = prop.key.name;
    else if (isLiteral(prop.key) && typeof prop.key.value === "string") key = prop.key.value;
    if (!key) continue;

    if (isObjectExpression(prop.value)) {
      const decl: {
        url?: string;
        type?: import("@superimg/types").AssetDeclaration["type"];
      } = {};
      for (const field of prop.value.properties) {
        if (field.type !== "Property" && field.type !== "ObjectProperty") continue;
        if (field.computed) continue;
        let fieldKey: string | undefined;
        if (isIdentifier(field.key)) fieldKey = field.key.name;
        else if (isLiteral(field.key) && typeof field.key.value === "string") fieldKey = field.key.value;
        
        if (fieldKey === "url" && isLiteral(field.value) && typeof field.value.value === "string") {
          decl.url = field.value.value;
        }
        if (
          fieldKey === "type" &&
          isLiteral(field.value) &&
          (field.value.value === "image" ||
            field.value.value === "video" ||
            field.value.value === "audio")
        ) {
          decl.type = field.value.value;
        }
      }
      if (decl.url) {
        assets[key] = {
          url: decl.url,
          ...(decl.type !== undefined ? { type: decl.type } : {}),
        };
      }
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
  if (isIdentifier(node)) {
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
    if (isIdentifier(property.key)) {
      key = property.key.name;
    } else if (isLiteral(property.key) && typeof property.key.value === "string") {
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
      const fontsValue = readFontSpecs(property.value);
      if (fontsValue !== undefined) {
        config.fonts = fontsValue;
      }
      continue;
    }

    if (key === "type") {
      if (isLiteral(property.value) && typeof property.value.value === "string") {
        config.type = property.value.value;
      }
      continue;
    }

    if (key === "temporal") {
      if (isLiteral(property.value) && typeof property.value.value === "string") {
        if (property.value.value === "once" || property.value.value === "loop") {
          config.temporal = property.value.value;
        }
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
    const key = isIdentifier(property.key) ? property.key.name : undefined;
    if (key === "duration" && !config.duration) {
      const resolved = resolveConfigValue(property.value, variableInits);
      if (resolved && isLiteral(resolved) && typeof resolved.value === "string") {
        config.duration = resolved.value;
      }
    }
  }

  if (
    config.width === undefined &&
    config.height === undefined &&
    config.fps === undefined &&
    config.duration === undefined &&
    config.temporal === undefined &&
    config.tailwind === undefined &&
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

  if (isIdentifier(init)) {
    return resolveExpression(init.name, variableInits, visited);
  }

  return init;
}

function unwrapDefineTemplate(expr: AstExpr): AstExpr {
  if (
    isCallExpression(expr) &&
    expr.arguments.length === 1 &&
    isObjectExpression(expr.arguments[0]!)
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
  let config: TemplateMetadataConfig | undefined;
  let medium: "html" | "svg" | undefined;

  function analyzeExportedExpression(declExpr: AstExpr) {
    let expr: AstExpr | undefined;

    if (isIdentifier(declExpr)) {
      expr = resolveExpression(declExpr.name, variableInits);
      if (expr) expr = unwrapDefineTemplate(expr);
    } else {
      expr = unwrapDefineTemplate(declExpr);
    }

    if (expr && isObjectExpression(expr)) {
      for (const prop of expr.properties) {
        if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
        if (prop.computed) continue;
        const key = getIdentifierName(prop.key);
        // Note: oxc-parser groups methods on objects with Property but might have `method: true`
        if (key === "render") {
          hasRenderExport = true;
        } else if (key === "config") {
          const configExpr = resolveConfigValue(prop.value, variableInits);
          if (configExpr && isObjectExpression(configExpr)) {
            config = readConfigObject(configExpr, variableInits);
          }
        } else if (key === "medium") {
          // Top-level string literal: define({ medium: "svg", ... }).
          if (isLiteral(prop.value) && (prop.value.value === "svg" || prop.value.value === "html")) {
            medium = prop.value.value;
          }
        }
      }
    }
    // compose([...]) returns a TemplateModule with render
    if (expr && isCallExpression(expr)) {
      const callee = expr.callee;
      const calleeName =
        isIdentifier(callee)
          ? callee.name
          : isMemberExpression(callee) &&
            isIdentifier(callee.property)
          ? callee.property.name
          : undefined;
      if (calleeName === "compose") {
        hasRenderExport = true;
        const configArg = expr.arguments[1];
        if (configArg && isObjectExpression(configArg)) {
          const props = configArg.properties;
          for (const prop of props) {
            if (prop.type !== "Property" && prop.type !== "ObjectProperty") continue;
            const key = getIdentifierName(prop.key);
            if (key === "config") {
              const configExpr = resolveConfigValue(prop.value, variableInits);
              if (configExpr && isObjectExpression(configExpr)) {
                config = readConfigObject(configExpr, variableInits);
                if (config && !medium) {
                  for (const p2 of configExpr.properties) {
                    if (p2.type !== "Property" && p2.type !== "ObjectProperty") continue;
                    if (getIdentifierName(p2.key) === "medium" && isLiteral(p2.value) && p2.value.value === "svg") {
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
    ...(medium !== undefined ? { medium } : {}),
    ...(config !== undefined ? { config } : {}),
  };
}
