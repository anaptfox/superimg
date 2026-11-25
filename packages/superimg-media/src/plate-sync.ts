//! Paint compiled atlas cells into [data-superimg-plate] boxes.

export interface PlateAtlasSheet {
  file: string;
  startFrame: number;
  frameCount: number;
}

export interface PlateManifest {
  schemaVersion: number;
  compiled: { fps: number; totalFrames: number; width: number; height: number };
  atlas: {
    tileWidth: number;
    tileHeight: number;
    columns: number;
    rows: number;
    sheets: PlateAtlasSheet[];
  };
}

interface CachedPlate {
  manifest: PlateManifest;
  images: HTMLImageElement[];
}

const cache = new Map<string, Promise<CachedPlate>>();
// A resolver/source can change while a manifest is loading. Only the most
// recent request for this DOM node owns its eventual paint.
interface PlatePaintRequest {
  href: string;
  src: string;
  frame: number;
  pending: boolean;
  plate?: CachedPlate;
}
const paints = new WeakMap<HTMLElement, PlatePaintRequest>();

export function plateManifestHref(
  src: string,
  resolve: ((filename: string) => string) | undefined,
): string {
  if (src.endsWith("manifest.json")) return resolve?.(src) ?? src;
  const name = src.replace(/\.[^/.]+$/, "").split("/").pop() ?? "plate";
  const path = `.superimg/plates/${name}/manifest.json`;
  return resolve?.(path) ?? resolve?.(src) ?? path;
}

export function syncPlateMedia(
  root: Document | Element,
  frame: number,
  resolve: ((filename: string) => string) | undefined,
  targets?: readonly HTMLElement[],
): void {
  const nodes = targets ?? root.querySelectorAll?.("[data-superimg-plate]");
  if (!nodes || nodes.length === 0) return;
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const src = node.getAttribute("data-superimg-plate");
    if (!src) continue;
    const href = plateManifestHref(src, resolve);
    let request = paints.get(node);
    if (!request || request.href !== href || request.src !== src) {
      request = { href, src, frame, pending: false };
      paints.set(node, request);
    }
    request.frame = frame;
    if (request.plate) {
      paintPlate(node, request.plate, frame);
      continue;
    }
    // Retain one waiter per node while loading, using its newest requested
    // frame when ready. A slow asset cannot accumulate one Promise per tick.
    if (request.pending) continue;
    request.pending = true;
    const current = request;
    void loadPlate(href).then((plate) => {
      current.pending = false;
      if (paints.get(node) !== current || node.getAttribute("data-superimg-plate") !== src) return;
      current.plate = plate;
      paintPlate(node, plate, current.frame);
    }).catch(() => { current.pending = false; });
  }
}

function loadPlate(href: string): Promise<CachedPlate> {
  const existing = cache.get(href);
  if (existing) return existing;
  const pending = (async () => {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`PLATE_NO_ASSET: ${href}`);
    const manifest = (await res.json()) as PlateManifest;
    const base = href.replace(/[^/]+$/, "");
    const images = await Promise.all(
      (manifest.atlas?.sheets ?? []).map((sheet) => loadImage(base + sheet.file)),
    );
    return { manifest, images };
  })();
  cache.set(href, pending);
  pending.catch(() => cache.delete(href));
  return pending;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`PLATE_NO_ASSET: ${src}`));
    img.src = src;
  });
}

function paintPlate(el: HTMLElement, plate: CachedPlate, frame: number): void {
  const { manifest, images } = plate;
  const atlas = manifest.atlas;
  if (!atlas || images.length === 0) return;
  const total = Math.max(manifest.compiled.totalFrames, 1);
  const index = Math.max(0, Math.min(frame, total - 1));
  const sheet = atlas.sheets.find((s) => index >= s.startFrame && index < s.startFrame + s.frameCount)
    ?? atlas.sheets[0];
  if (!sheet) return;
  const sheetIndex = atlas.sheets.indexOf(sheet);
  const img = images[sheetIndex];
  if (!img) return;
  const local = index - sheet.startFrame;
  const col = local % atlas.columns;
  const row = Math.floor(local / atlas.columns);
  el.style.backgroundImage = `url(${img.src})`;
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundSize = `${atlas.columns * 100}% ${atlas.rows * 100}%`;
  el.style.backgroundPosition = `${(-col * 100)}% ${(-row * 100)}%`;
}
