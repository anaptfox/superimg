import { source, video, Html, choose, sequence } from "@foxworth/superimg";
import { Player } from "@foxworth/superimg/player";
import { present, type ProgramActionEvent } from "@foxworth/superimg/player/program";
import { prepareProgram } from "@foxworth/superimg/composition/prepare";
import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { directVideoBytes } from "./direct-video.js";

const size = { width: 320, height: 180 } as const;

function clip(label: string, color: string) {
  return video({
    size,
    fps: 10,
    duration: "10f",
    render: (ctx) => Html({
      width: "fill",
      height: "fill",
      html: `<div style="width:100%;height:100%;background:${color};color:white;display:grid;place-items:center;font:700 24px system-ui">${label}:${ctx.timeline.frame}</div>`,
    }),
  });
}

const lesson = defineInteractive({
  size,
  guide: { id: "acceptance", steps: [{ id: "answer", label: "Answer", duration: "1s", scene: { state: "answer" } }] },
  render(ctx) {
    ctx.scene.states({ answer: {}, selected: {} });
    const accept = ctx.scene.node("accept", { actions: ["accept"] });
    return Html({ width: "fill", height: "fill", html: `<div style="width:100%;height:100%;display:grid;place-items:center;background:#0f172a"><button id="accept" ${accept.attrs}>Accept</button></div>` });
  },
});

const story = sequence([
  { id: "intro", content: clip("INTRO", "#1d4ed8") },
  { id: "branch", content: choose({ basic: clip("BASIC", "#7c3aed"), advanced: clip("ADVANCED", "#b91c1c") }) },
  { id: "outro", content: clip("OUTRO", "#047857") },
  { id: "direct", content: source.video({ src: { bytes: directVideoBytes, mimeType: "video/mp4" }, size, fps: 10, duration: "1s" }) },
  { id: "lesson", content: lesson },
]);

const section = document.querySelector<HTMLElement>("#travel")!;
const mount = document.querySelector<HTMLElement>("#player")!;
const player = new Player({ container: mount, drive: "scroll" });
let playerError: { message: string; stack?: string } | undefined;
player.on("error", (error) => { playerError = { message: error.message, stack: error.stack }; });
const prepared = await prepareProgram(story, { size, fps: 10, routes: { branch: "basic" } });
const preparedRenders = prepared.plan.leaves.map((leaf) => ({
  path: leaf.path,
  render: typeof leaf.content.render,
  media: leaf.content.media,
}));
const programRenders = prepared.program.parts.map((part) => ({
  id: part.id,
  render: "op" in part.content
    ? part.content.op === "choose"
      ? Object.fromEntries(Object.entries(part.content.paths).map(([id, child]) => [id, "op" in child ? "program" : typeof child.render]))
      : "program"
    : typeof part.content.render,
}));
const session = present(player, prepared.program, { mode: "timeline", size, fps: 10, routes: { branch: "basic" } });
const actions: ProgramActionEvent[] = [];
session.on("action", (event) => { actions.push(event); });
let readyResult: Awaited<typeof session.ready> | undefined;

void session.ready.then((result) => {
  readyResult = result;
  document.body.dataset.ready = result.status;
  if (result.status === "error") document.body.dataset.error = result.message;
});
document.querySelector("#advanced")!.addEventListener("click", () => { void session.choose("branch", "advanced"); });
document.querySelector("#branch")!.addEventListener("click", () => { void session.go("branch"); });
document.querySelector("#direct")!.addEventListener("click", () => { void session.go("direct"); });
document.querySelector("#lesson")!.addEventListener("click", () => { void session.go("lesson"); });

Object.assign(window, {
  __compositionAcceptance: {
    state: () => ({
      currentFrame: player.getState().currentFrame,
      presentation: player.getPresentation(),
      session: session.snapshot(),
      currentId: session.currentId,
      preparedLeafPaths: prepared.plan.leaves.map((leaf) => leaf.path),
      actions: [...actions],
    }),
    diagnostic: () => ({ readyResult, playerError, preparedRenders, programRenders }),
    setScene: (path: string, scene: unknown) => session.setScene(path, scene),
    dispose: () => { session.dispose(); player.dispose(); },
  },
});

void section;
