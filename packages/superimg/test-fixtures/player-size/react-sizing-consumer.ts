import { createElement, createRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Html, video } from "@foxworth/superimg";
import { Player, type CanvasSize, type PlayerRef } from "@foxworth/superimg/react/player";

const media = video({
  size: { width: 320, height: 180 },
  duration: "3s",
  fps: 30,
  sample: { label: "Original" },
  render(ctx) {
    if (ctx.width === 666) throw new Error("Fixture rejected dimensions");
    return Html({
      width: "fill", height: "fill",
      html: `<main style="box-sizing:border-box;width:100%;height:100%;padding:20px;background:#152e35;color:#e5f7d5;font:24px system-ui">
        <div id="label">${ctx.data.label}</div>
        <div id="dimensions">${ctx.width} × ${ctx.height}</div>
        <div id="frame">Frame ${ctx.timeline.frame}</div>
      </main>`,
    });
  },
});

const host = document.querySelector("#stage")!;
const root = createRoot(host);
const ref = createRef<PlayerRef>();
const identities = new WeakMap<object, number>();
let nextIdentity = 1;
let size: CanvasSize | undefined = { width: 320, height: 180 };
let data = { label: "Original" };
let loads = 0;
const errors: string[] = [];

function identity(value: object | null | undefined) {
  if (!value) return null;
  let id = identities.get(value);
  if (!id) { id = nextIdentity++; identities.set(value, id); }
  return id;
}

function paint() {
  flushSync(() => root.render(createElement(Player, {
    ref, media, data, ...(size ? { size } : {}),
    style: { width: "100%", height: "100%" },
    onLoad: (result) => { if (result.status === "success") loads++; },
    onError: (error) => { errors.push(error.message); },
  })));
}

function state() {
  const player = ref.current?.player;
  const iframe = host.querySelector("iframe");
  return {
    playerId: identity(player), iframeId: identity(iframe),
    iframeCount: host.querySelectorAll("iframe").length,
    loads, errors: [...errors],
    runtime: player?.isReady ? player.getState() : null,
    accepted: player?.getPresentation().accepted ?? null,
    html: iframe?.contentDocument?.querySelector("#root")?.innerHTML ?? null,
  };
}

const api = {
  state,
  async render(nextSize: CanvasSize | null, label?: string) {
    size = nextSize ?? undefined;
    if (label !== undefined) data = { label };
    paint();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return state();
  },
  async seek(frame: number) { await ref.current!.seek({ frame }); return state(); },
  play() { ref.current!.play(); },
  pause() { ref.current!.pause(); },
  unmount() { flushSync(() => root.unmount()); return state(); },
};

declare global { interface Window { __reactSizing: typeof api } }
window.__reactSizing = api;
paint();
