/** Detached facts from the committed browser document. No source or clock authority. */
export interface BrowserProbeBounds { x: number; y: number; width: number; height: number }
export interface BrowserNodeObservation {
  id: string | null;
  occurrence: string | null;
  tag: string;
  /** Parent in this bounded observation's nodes array; absent in legacy observations. */
  parentIndex?: number | null;
  bounds: BrowserProbeBounds;
  text: string;
  /** Browser-measured visual lines for direct text, or null when unavailable. */
  textLineCount?: number | null;
  /** Union of direct text range rectangles in viewport coordinates. */
  textBounds?: BrowserProbeBounds | null;
  /** A pattern may explicitly declare that clipping this text is intentional. */
  textClippingAllowed?: boolean;
  typography: Record<string, string> | null;
  clipping?: Record<string, string>;
  svg: { coordinateSpace: "svg-user-space"; bounds: BrowserProbeBounds | null; textLength: number | null } | null;
}
export interface BrowserDocumentObservation {
  coordinateSpace: "document-viewport";
  nodes: readonly BrowserNodeObservation[];
  coverage: { sampledNodes: number; truncated: boolean; maxNodes: number; maxTextLength: number; opaque: readonly { kind: string; bounds: BrowserProbeBounds }[] };
}
export interface BrowserProbeTarget { document?: Document; root?: Element; rootId?: string }
export interface BrowserResourceProbeInput extends BrowserProbeTarget {
  timeoutMs: number;
  waitFonts?: boolean;
  waitImages?: boolean;
  waitVideos?: boolean;
  /** The host resets/runs scripts before invoking this observer. */
  waitAttr?: string;
  signal?: AbortSignal;
}
export interface BrowserResourceProbeResult { ok: boolean; open: string[]; error?: string; aborted?: boolean }

/** Self-contained so Playwright can serialize this same function into its page. */
export async function waitForBrowserResources(input: BrowserResourceProbeInput): Promise<BrowserResourceProbeResult> {
  const doc = input.document ?? input.root?.ownerDocument ?? document;
  const view = doc.defaultView;
  const root = input.root ?? doc.getElementById(input.rootId ?? "frame");
  if (!view || !root) return { ok: false, open: [], error: "Committed browser root unavailable" };
  const cleanups = new Set<() => void>();
  let stopped = false;
  const running = () => { if (stopped || input.signal?.aborted) throw new Error("Browser resource probe stopped"); };
  const open = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const track = async (label: string, task: Promise<unknown>) => {
    running();
    open.add(label);
    await task;
    running();
    open.delete(label);
  };
  const event = (target: EventTarget, name: string, label: string, errorMessage = `Resource failed: ${label}`) => new Promise<void>((resolve, reject) => {
    const cleanup = () => { target.removeEventListener(name, loaded); target.removeEventListener("error", failed); cleanups.delete(cancelled); };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error(errorMessage)); };
    const cancelled = () => { cleanup(); reject(new Error("Browser resource probe stopped")); };
    running();
    cleanups.add(cancelled);
    target.addEventListener(name, loaded, { once: true });
    target.addEventListener("error", failed, { once: true });
  });
  const decode = async (image: HTMLImageElement) => {
    running();
    if (!image.currentSrc && !image.getAttribute("src") && !image.getAttribute("srcset")) return;
    const url = image.currentSrc || image.src;
    if (!image.complete) await event(image, "load", url, `Image failed to load: ${url}`);
    running();
    if (!image.naturalWidth) throw new Error(`Image failed to load: ${url}`);
    if (typeof image.decode === "function") await image.decode();
    running();
  };
  const delay = () => new Promise<void>((resolve, reject) => {
    running();
    const cancelled = () => { clearTimeout(id); cleanups.delete(cancelled); reject(new Error("Browser resource probe stopped")); };
    const id = setTimeout(() => { cleanups.delete(cancelled); resolve(); }, 16);
    cleanups.add(cancelled);
  });
  const work = async () => {
    running();
    const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')).filter(link => link.href && !link.disabled);
    await Promise.all(links.map(link => link.sheet ? Promise.resolve() : track(`stylesheet: ${link.href}`, event(link, "load", link.href))));
    running();
    void (root as HTMLElement).offsetWidth;
    const tasks: Promise<unknown>[] = [];
    if (input.waitFonts !== false && doc.fonts?.ready) tasks.push(track("fonts", doc.fonts.ready.then(() => {
      running();
      doc.fonts.forEach(face => { if (face.status === "error") throw new Error(`Font failed to load: ${face.family}`); });
    })));
    const elements = [root, ...root.querySelectorAll("*")];
    const decoded = new Set<Element>();
    const ready = (view as unknown as { __superimgReady?: { done(label: string): void; fail(label: string, error: string): void; __wait(labels: string[], timeoutMs: number): Promise<{ ok: boolean; open: string[]; error?: string }> } }).__superimgReady;
    const labels = new Set<string>();
    if (input.waitAttr) {
      if (!ready) throw new Error("window.__superimgReady missing — page shell not loaded");
      for (const el of elements) {
        const label = el.getAttribute(input.waitAttr)?.trim();
        if (!label) continue;
        labels.add(label);
        let task: Promise<unknown> | undefined;
        if (el.localName === "img") { decoded.add(el); task = decode(el as HTMLImageElement); }
        else if (el.localName === "video") {
          const video = el as HTMLVideoElement;
          task = video.error ? Promise.reject(new Error(`Video failed to load: ${video.currentSrc || video.src}`)) : video.readyState >= 2 ? Promise.resolve() : event(video, "loadeddata", video.currentSrc || video.src);
        }
        if (task) tasks.push(track(label, task.then(() => { running(); ready.done(label); }, error => { if (!stopped && !input.signal?.aborted) ready.fail(label, error instanceof Error ? error.message : String(error)); throw error; })));
      }
      if (labels.size) tasks.push(track([...labels].join(", "), ready.__wait([...labels], input.timeoutMs).then(result => {
        running();
        if (!result.ok) throw new Error(result.error === "timeout" ? `Still waiting: ${result.open.join(", ")}` : result.error ?? "Readiness token failed");
      })));
    }
    if (input.waitImages !== false) {
      const urls = new Set<string>();
      const collect = (value: string) => {
        for (const match of value.matchAll(/url\(\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^)]*))\s*\)/g)) {
          const url = (match[1] ?? match[2] ?? match[3] ?? "").trim();
          if (url && !url.startsWith("#")) urls.add(new URL(url, doc.baseURI).href);
        }
      };
      for (const el of elements) {
        if (el.localName === "img" && !decoded.has(el)) tasks.push(track(`image: ${(el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src}`, decode(el as HTMLImageElement)));
        if (el.namespaceURI === "http://www.w3.org/2000/svg" && el.localName === "image") {
          const href = el.getAttribute("href") || el.getAttribute("xlink:href");
          if (href && !href.startsWith("#")) urls.add(new URL(href, doc.baseURI).href);
        }
        for (const pseudo of [null, "::before", "::after"]) {
          const style = view.getComputedStyle(el, pseudo);
          for (const property of ["background-image", "border-image-source", "mask-image", "list-style-image", "content"]) collect(style.getPropertyValue(property));
        }
      }
      for (const url of urls) {
        const image = doc.createElement("img");
        image.src = url;
        tasks.push(track(`image: ${url}`, decode(image)));
      }
    }
    if (input.waitVideos) for (const el of elements) {
      if (el.localName !== "video") continue;
      const video = el as HTMLVideoElement;
      if (!video.getAttribute("src") && !video.querySelector("source")) continue;
      const label = `video: ${video.currentSrc || video.src}`;
      tasks.push(track(label, (async () => {
        while (true) {
          running();
          if (video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - Number(video.getAttribute("data-t") ?? video.currentTime)) <= 0.002) break;
          if (video.error) throw new Error(`Video failed to load: ${video.currentSrc || video.src}`);
          await delay();
        }
        running();
        if (video.error) throw new Error(`Video failed to load: ${video.currentSrc || video.src}`);
      })()));
    }
    await Promise.all(tasks);
    return { ok: true, open: [] };
  };
  try {
    if (input.signal?.aborted) return { ok: false, open: [], error: "aborted", aborted: true };
    const interrupted = new Promise<BrowserResourceProbeResult>(resolve => {
      timer = setTimeout(() => resolve({ ok: false, open: [...open], error: "timeout" }), input.timeoutMs);
      if (input.signal) {
        const aborted = () => resolve({ ok: false, open: [...open], error: "aborted", aborted: true });
        input.signal.addEventListener("abort", aborted, { once: true });
        cleanups.add(() => input.signal!.removeEventListener("abort", aborted));
      }
    });
    return await Promise.race([work().catch(error => ({ ok: false, open: [...open], error: error instanceof Error ? error.message : String(error) })), interrupted]);
  } finally { stopped = true; clearTimeout(timer); for (const cleanup of cleanups) cleanup(); cleanups.clear(); }
}

/** Precise DOM geometry; bounded diagnostic projection, independent of semantic IR. */
export function measureBrowserDocument(input: BrowserProbeTarget & { maxNodes?: number; maxTextLength?: number; measureTextPaint?: boolean }): BrowserDocumentObservation {
  const doc = input.document ?? input.root?.ownerDocument ?? document;
  const root = input.root ?? doc.getElementById(input.rootId ?? "frame");
  const maxNodes = input.maxNodes ?? 800;
  const maxTextLength = input.maxTextLength ?? 120;
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || !Number.isInteger(maxTextLength) || maxTextLength < 1) throw new RangeError("Browser observation limits must be positive integers");
  const nodes: BrowserNodeObservation[] = [];
  const indices = new WeakMap<Element, number>();
  const opaque: { kind: string; bounds: BrowserProbeBounds }[] = [];
  const rect = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x, y: box.y, width: box.width, height: box.height });
  let truncated = false;
  const bounded = (value: string) => {
    if (value.length <= maxTextLength) return value;
    truncated = true;
    return `${value.slice(0, maxTextLength - 1)}…`;
  };
  let visited = 0;
  if (root && doc.defaultView) {
    const walker = doc.createTreeWalker(root, 1);
    let el: Element | null = root;
    while (el) {
      if (visited++ >= maxNodes) { truncated = true; break; }
      if (!["script", "style", "link", "meta"].includes(el.localName)) {
        const bounds = rect(el.getBoundingClientRect());
        const style = doc.defaultView.getComputedStyle(el);
        const text = Array.from(el.childNodes).filter(node => node.nodeType === 3).map(node => node.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
        let textLineCount: number | null = null;
        let textBounds: BrowserProbeBounds | null = null;
        if (text) {
          try {
            const tops: number[] = [];
            for (const child of Array.from(el.childNodes)) {
              if (child.nodeType !== 3 || !child.textContent?.trim()) continue;
              const range = doc.createRange();
              range.selectNodeContents(child);
              for (const box of Array.from(range.getClientRects())) {
                if (box.width > 0 && box.height > 0) {
                  if (!tops.some(top => Math.abs(top - box.top) < 1)) tops.push(box.top);
                  if (textBounds === null) textBounds = rect(box);
                  else {
                    const left = Math.min(textBounds.x, box.x), top = Math.min(textBounds.y, box.y);
                    textBounds = { x: left, y: top, width: Math.max(textBounds.x + textBounds.width, box.x + box.width) - left, height: Math.max(textBounds.y + textBounds.height, box.y + box.height) - top };
                  }
                }
              }
              range.detach();
            }
            if (tops.length) textLineCount = tops.length;
          } catch { /* A missing layout API is unmeasured, never a single-line pass. */ }
        }
        let svg: BrowserNodeObservation["svg"] = null;
        if (el.namespaceURI === "http://www.w3.org/2000/svg" && ["text", "tspan"].includes(el.localName)) {
          svg = { coordinateSpace: "svg-user-space", bounds: null, textLength: null };
          try { svg.bounds = rect((el as SVGGraphicsElement).getBBox()); } catch { /* Detached/unsupported SVG is explicitly unmeasured. */ }
          try { svg.textLength = (el as SVGTextContentElement).getComputedTextLength(); } catch { /* No fabricated length. */ }
        }
        const parentIndex = el.parentElement ? indices.get(el.parentElement) ?? null : null;
        indices.set(el, nodes.length);
        nodes.push({ id: el.getAttribute("data-si-node") ?? (el.id || null), occurrence: el.closest("[data-si-occurrence]")?.getAttribute("data-si-occurrence") ?? null, tag: el.localName, parentIndex, bounds, text: bounded(text), ...(text ? { textLineCount, textBounds, textClippingAllowed: el.getAttribute("data-si-allow-text-clipping") === "true" } : {}),
          typography: text || svg ? { ...Object.fromEntries(["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color", "fill", "fill-opacity", "stroke", "stroke-width", "text-shadow", "text-decoration-line", "-webkit-text-stroke-width", "-webkit-text-fill-color"].map(name => [name, bounded(style.getPropertyValue(name))])), ...(input.measureTextPaint ? { firstLetterColor: bounded(doc.defaultView.getComputedStyle(el, "::first-letter").getPropertyValue("color")), firstLineColor: bounded(doc.defaultView.getComputedStyle(el, "::first-line").getPropertyValue("color")) } : {}) } : null,
          clipping: Object.fromEntries(["overflow-x", "overflow-y", "clip-path", "mask-image", "text-overflow", "white-space", "transform", "opacity", "visibility", "display", "filter", "mix-blend-mode"].map(name => [name, bounded(style.getPropertyValue(name))])), svg });
        if (["canvas", "iframe", "object", "embed"].includes(el.localName)) opaque.push({ kind: el.localName, bounds });
      }
      el = walker.nextNode() as Element | null;
    }
  }
  return { coordinateSpace: "document-viewport", nodes, coverage: { sampledNodes: nodes.length, truncated, maxNodes, maxTextLength, opaque } };
}
