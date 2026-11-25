import { projectInteractiveSceneHtml, type SceneStyleRenderer, type SceneStyleRendererInput } from "@foxworth/superimg/interactive/define";

const SAFE_DELAY_KEY = /^[A-Za-z0-9._-]+$/;

export interface CreateSurfaceRendererOptions {
  id: string;
  profiles: Readonly<Record<string, string>>;
  defaultProfile?: string;
  delays?: Readonly<Record<string, number>>;
  debugNodeLabels?: boolean;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function delayCss(delays: Readonly<Record<string, number>> | undefined): string {
  if (!delays) return "";
  return Object.entries(delays)
    .flatMap(([key, delay]) => {
      if (!SAFE_DELAY_KEY.test(key) || !Number.isFinite(delay)) return [];
      const selector = key.endsWith(".")
        ? `[data-si-node^="${key}"]`
        : `[data-si-node="${key}"]`;
      return `${selector} { transition-delay: ${delay}ms; }`;
    })
    .join("\n");
}

function annotateAnimations(
  html: string,
  input: SceneStyleRendererInput,
): string {
  const animations = new Map(
    input.scene.nodes.flatMap((node) =>
      node.animation?.type ? [[node.id, node.animation.type] as const] : [],
    ),
  );
  return html.replace(
    /<[A-Za-z][\w:.-]*(?:\s[^<>]*?)?\sdata-si-node\s*=\s*(["'])(.*?)\1[^<>]*>/gi,
    (tag, _quote: string, encodedId: string) => {
      const animation = animations.get(encodedId);
      return animation
        ? tag.replace(/>$/, ` data-si-animation="${escapeAttribute(animation)}">`)
        : tag;
    },
  );
}

function appendStyle(openingTag: string, declarations: string): string {
  const style = /\sstyle\s*=\s*(["'])(.*?)\1/i.exec(openingTag);
  if (style?.index !== undefined) {
    const separator = style[2]?.trim().endsWith(";") ? "" : ";";
    const replacement = ` style=${style[1]}${style[2]}${separator}${declarations}${style[1]}`;
    return `${openingTag.slice(0, style.index)}${replacement}${openingTag.slice(style.index + style[0].length)}`;
  }
  return openingTag.replace(/>$/, ` style="${declarations}">`);
}

function applyCamera(
  html: string,
  input: SceneStyleRendererInput,
): string {
  const nodes = new Map(input.scene.nodes.map((node) => [node.id, node]));
  const worldRoots = new Set(
    input.scene.nodes
      .filter((node) => {
        if (node.space !== "world") return false;
        const parent = node.parentId ? nodes.get(node.parentId) : undefined;
        return !parent || parent.space !== "world";
      })
      .map((node) => node.id),
  );
  const camera = input.scene.camera;
  const cameraStyle = [
    "transform-origin:0 0",
    `translate:${camera.x}px ${camera.y}px`,
    `scale:${camera.zoom}`,
    `rotate:${camera.rotation}deg`,
  ].join(";");
  return html.replace(
    /<[A-Za-z][\w:.-]*(?:\s[^<>]*?)?\sdata-si-node\s*=\s*(["'])(.*?)\1[^<>]*>/gi,
    (tag, _quote: string, encodedId: string) =>
      worldRoots.has(encodedId)
        ? appendStyle(tag, cameraStyle).replace(/>$/, ' data-si-camera="1">')
        : tag,
  );
}

export function createSurfaceRenderer(
  options: CreateSurfaceRendererOptions,
): SceneStyleRenderer {
  const id = options.id.trim();
  if (!id) throw new Error("createSurfaceRenderer requires a non-empty id");
  const profileIds = Object.keys(options.profiles);
  if (profileIds.length === 0) {
    throw new Error("createSurfaceRenderer requires at least one profile");
  }
  const defaultProfile =
    options.defaultProfile && options.profiles[options.defaultProfile]
      ? options.defaultProfile
      : profileIds[0]!;
  const sharedCss = `
    [data-si-node], [data-si-camera] {
      transition: opacity 620ms cubic-bezier(.16, 1, .3, 1),
        transform 760ms cubic-bezier(.16, 1, .3, 1), filter 420ms ease;
    }
    ${delayCss(options.delays)}
    @keyframes si-surface-pulse {
      0%, 100% { filter: brightness(1); }
      48% { filter: brightness(1.42) drop-shadow(0 0 22px var(--art-glow, currentColor)); }
    }
    [data-si-animation="pulse"] {
      animation: si-surface-pulse 720ms cubic-bezier(.16, 1, .3, 1) both;
    }
    @keyframes si-surface-draw-ltr {
      from { clip-path: inset(-10% 100% -10% -10%); }
      to { clip-path: inset(-10% -10% -10% -10%); }
    }
    @keyframes si-surface-draw-rtl {
      from { clip-path: inset(-10% -10% -10% 100%); }
      to { clip-path: inset(-10% -10% -10% -10%); }
    }
    [data-si-animation="draw"] .art-trail-reveal-ltr {
      animation: si-surface-draw-ltr 950ms cubic-bezier(.33, 1, .68, 1) 220ms both;
    }
    [data-si-animation="draw"] .art-trail-reveal-rtl {
      animation: si-surface-draw-rtl 950ms cubic-bezier(.33, 1, .68, 1) 220ms both;
    }
    ${options.debugNodeLabels ? `
      .is-debug [data-si-node]::after {
        content: attr(data-si-node); position: absolute; inset: 0 auto auto 0;
        z-index: 9999; padding: 1px 4px; font: 10px/1.2 ui-monospace, monospace;
        color: #fff; background: rgba(0, 0, 0, .72); pointer-events: none;
      }
      .is-debug [data-si-node] { outline: 1px dashed rgba(255,255,255,.35); }
    ` : ""}
    @media (prefers-reduced-motion: reduce) {
      [data-si-node], [data-si-camera] {
        transition-duration: 1ms !important; transition-delay: 0ms !important;
      }
      [data-si-animation] { animation: none !important; }
    }
  `;

  return Object.freeze({
    id,
    render(input: SceneStyleRendererInput) {
      const profile =
        input.style && Object.hasOwn(options.profiles, input.style)
          ? input.style
          : defaultProfile;
      const projected = projectInteractiveSceneHtml(input.html, input.scene);
      const staged = applyCamera(projected, input);
      return `<style data-scene-renderer="${escapeAttribute(profile)}">${options.profiles[profile] ?? ""}${sharedCss}</style>${annotateAnimations(staged, input)}`;
    },
  });
}

export function assertSurfaceCssVarParity(
  profiles: Readonly<Record<string, string>>,
): void {
  const entries = Object.entries(profiles);
  if (entries.length < 2) return;
  const vars = (css: string) =>
    [...css.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)]
      .map((match) => `--${match[1]}`)
      .sort()
      .join("\0");
  const baseline = vars(entries[0]![1]);
  for (const [id, css] of entries.slice(1)) {
    if (vars(css) !== baseline) {
      throw new Error(`Surface profile ${id} does not declare the same CSS variables`);
    }
  }
}
