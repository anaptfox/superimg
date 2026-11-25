import { measureBrowserDocument, type BrowserDocumentObservation } from "@superimg/core/html";
import type { PreviewBounds, PreviewNode, PreviewSnapshot } from "./types.js";

const bounds = (rect: DOMRect): PreviewBounds => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });

/** Resolve only the committed Player iframe, never a hidden candidate or another surface. */
export function surfaceDocument(container: HTMLElement): { frame: HTMLIFrameElement; document: Document } | null {
  for (const frame of container.querySelectorAll<HTMLIFrameElement>("iframe")) {
    const stage = frame.closest<HTMLElement>("[data-superimg-player-stage], [data-superimg-dom-stage], [data-superimg-stage]");
    if (stage?.style.visibility === "hidden") continue;
    try { if (frame.contentDocument?.getElementById("root")) return { frame, document: frame.contentDocument }; }
    catch { /* A cross-origin surface is explicitly opaque. */ }
  }
  return null;
}

export function measureSurface(container: HTMLElement, width: number, height: number): Pick<PreviewSnapshot, "nodes" | "geometry" | "coverage"> & { observations: BrowserDocumentObservation | null } {
  const surface = bounds(container.getBoundingClientRect());
  const target = surfaceDocument(container);
  const geometry: PreviewSnapshot["geometry"] = { coordinateSpace: "host-viewport", iframePath: [], dpr: container.ownerDocument.defaultView?.devicePixelRatio ?? 1, surface, frame: null, content: null };
  if (!target) return { nodes: [], geometry, observations: null, coverage: { dom: "unavailable", opaque: [{ kind: "surface", bounds: surface }] } };
  const { frame, document: doc } = target;
  const frameRect = frame.getBoundingClientRect();
  geometry.frame = bounds(frameRect);
  geometry.iframePath = ["player-iframe"];
  const sx = frame.clientWidth > 0 ? frameRect.width / frame.clientWidth : 1;
  const sy = frame.clientHeight > 0 ? frameRect.height / frame.clientHeight : 1;
  const wrapper = doc.getElementById("scale-wrapper")?.getBoundingClientRect();
  const content = wrapper ?? doc.getElementById("root")?.getBoundingClientRect();
  geometry.content = content ? { x: frameRect.x + content.x * sx, y: frameRect.y + content.y * sy, width: content.width * sx, height: content.height * sy } : null;
  const scaleX = wrapper && width > 0 ? wrapper.width / width : 0;
  const scaleY = wrapper && height > 0 ? wrapper.height / height : 0;
  const localBounds = (element: Element): PreviewBounds => {
    let rect = element.getBoundingClientRect();
    if (!rect.width && !rect.height && element.hasAttribute("data-si-occurrence")) {
      const children = Array.from(element.children).map((child) => child.getBoundingClientRect()).filter((box) => box.width || box.height);
      if (children.length) {
        const left = Math.min(...children.map((box) => box.left));
        const top = Math.min(...children.map((box) => box.top));
        rect = { x: left, y: top, width: Math.max(...children.map((box) => box.right)) - left, height: Math.max(...children.map((box) => box.bottom)) - top } as DOMRect;
      }
    }
    return bounds(rect);
  };
  const pageBounds = (element: Element): PreviewBounds => {
    const rect = localBounds(element);
    return { x: frameRect.x + rect.x * sx, y: frameRect.y + rect.y * sy, width: rect.width * sx, height: rect.height * sy };
  };
  const nodes = Array.from(doc.querySelectorAll("[data-si-node], [data-si-primitive], [data-si-occurrence]"), (element, index): PreviewNode => {
    const rect = localBounds(element);
    return {
      id: (element.getAttribute("data-si-node") ?? element.id) || `node:${index}`,
      occurrence: element.closest("[data-si-occurrence]")?.getAttribute("data-si-occurrence") ?? null,
      kind: element.getAttribute("data-si-primitive") ?? element.tagName.toLowerCase(),
      actions: (element.getAttribute("data-si-actions") ?? "").split(/\s+/).filter(Boolean),
      sceneId: element.closest("[data-si-scene-id]")?.getAttribute("data-si-scene-id") ?? null,
      bounds: pageBounds(element),
      authoredBounds: wrapper && scaleX && scaleY ? { x: (rect.x - wrapper.x) / scaleX, y: (rect.y - wrapper.y) / scaleY, width: rect.width / scaleX, height: rect.height / scaleY } : null,
    };
  });
  return { nodes, geometry, observations: measureBrowserDocument({ document: doc, root: doc.getElementById("root") ?? doc.body }), coverage: { dom: "measured", opaque: Array.from(doc.querySelectorAll("canvas, iframe"), (element) => ({ kind: element.tagName.toLowerCase(), bounds: pageBounds(element) })) } };
}
