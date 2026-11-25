//! Trusted host-prepared native surface. Public source-module preparation and
//! host admission remain separate from this low-level rendering primitive.
import { Html, type HtmlProps } from "./primitives.js";
import { token } from "../ready.js";
import { retainedResourcesScript } from "../viz/retained.js";

export interface PreparedNativeSurface {
  readonly identity: string;
  readonly moduleUrl: string;
  readonly bridgeUrl: string;
}

function json(value: unknown): string {
  const ancestors = new Set<object>();
  function validate(input: unknown): void {
    if (input === null || typeof input === "string" || typeof input === "boolean") return;
    if (typeof input === "number" && Number.isFinite(input)) return;
    if (typeof input !== "object") throw new TypeError("NativeSurface data must contain only JSON values");
    if (ancestors.has(input)) throw new TypeError("NativeSurface data cannot contain cycles");
    if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) throw new TypeError("NativeSurface data must contain plain objects");
    if (Object.getOwnPropertySymbols(input).length) throw new TypeError("NativeSurface data cannot contain symbol keys");
    ancestors.add(input);
    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
        if (!descriptor) throw new TypeError("NativeSurface data cannot contain array holes");
        if (!("value" in descriptor)) throw new TypeError("NativeSurface data cannot contain accessors");
        validate(descriptor.value);
      }
      if (Object.keys(input).some(key => !/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= input.length)) throw new TypeError("NativeSurface arrays cannot contain extra properties");
    } else {
      for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(input))) {
        if (!descriptor.enumerable) continue;
        if (!("value" in descriptor)) throw new TypeError("NativeSurface data cannot contain accessors");
        validate(descriptor.value);
      }
    }
    ancestors.delete(input);
  }
  validate(value);
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError("NativeSurface data must be JSON serializable");
  return encoded.replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function NativeSurface<Data = unknown>(options: Readonly<{ id: string; module: PreparedNativeSurface; width: number; height: number; seconds: number; data: Data; assets?: Readonly<Record<string, string>>; semantic?: HtmlProps["semantic"]; wait?: string | false }>) {
  if (!/^[A-Za-z][\w-]*$/.test(options.id)) throw new TypeError("NativeSurface id must be a plain identifier");
  if (![options.width, options.height].every(value => Number.isFinite(value) && value > 0) || !Number.isFinite(options.seconds) || options.seconds < 0) throw new TypeError("NativeSurface requires positive dimensions and nonnegative time");
  if (!options.module.identity || !options.module.moduleUrl || !options.module.bridgeUrl) throw new TypeError("NativeSurface requires a prepared module and bridge");
  const key = `native-${options.id}`;
  const label = typeof options.wait === "string" ? options.wait.trim() : key;
  if (!/^[A-Za-z][\w-]*$/.test(label)) throw new TypeError("NativeSurface readiness label must be a plain identifier");
  const wait = options.wait === false ? undefined : token(label);
  const script = `(async function() {
    const canvas = document.currentScript.previousElementSibling;
    let state, owner;
    try {
      ${retainedResourcesScript}
      owner = resources;
      const dpr = window.__SUPERIMG_CAPTURE_DPR__ || window.devicePixelRatio || 1;
      const assets = ${json(options.assets ?? {})};
      const signature = JSON.stringify([${json(options.module.identity)}, ${json(options.module.moduleUrl)}, ${json(options.module.bridgeUrl)}, ${options.width}, ${options.height}, dpr, Object.entries(assets).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)]);
      state = resources.retain(${json(key)}, signature, () => {
        const controller = new AbortController();
        const ready = Promise.all([import(${json(options.module.moduleUrl)}), import(${json(options.module.bridgeUrl)})]).then(([module, bridge]) => {
          controller.signal.throwIfAborted();
          return bridge.createNativeSurfaceLifecycle(module.default, { canvas, width: ${options.width}, height: ${options.height}, dpr, signal: controller.signal, assets });
        });
        ready.catch(() => {});
        return { canvas, get disposed() { return controller.signal.aborted; },
          async sample(frame) { const lifecycle = await ready; controller.signal.throwIfAborted(); await lifecycle.sample(frame); },
          async dispose() { controller.abort(); let lifecycle; try { lifecycle = await ready; } catch (error) { if (controller.signal.aborted) return; throw error; } await lifecycle.dispose(); }
        };
      });
      if (state.canvas !== canvas) canvas.replaceWith(state.canvas);
      await state.sample({ seconds: ${options.seconds}, data: ${json(options.data)} });
      ${wait?.done ?? ""}
    } catch (error) { if (state?.disposed) return; if (state) owner.discard(state); ${wait?.fail("native surface failed") ?? ""} throw error; }
  })();`;
  return Html({ id: options.id, width: options.width, height: options.height, ...(options.semantic === undefined ? {} : { semantic: options.semantic }), html: `<canvas${wait ? ` ${wait.attr}` : ""} width="${options.width}" height="${options.height}" style="width:${options.width}px;height:${options.height}px"></canvas><script data-superimg-native>${script}</script>` });
}
