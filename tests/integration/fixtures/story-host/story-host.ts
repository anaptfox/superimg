import { Html, choose, sequence, time, video } from "@foxworth/superimg";
import { Player } from "@foxworth/superimg/player";
import { present } from "@foxworth/superimg/player/program";

const size = { width: 320, height: 180 } as const;
const fps = 10;

function clip(label: string, color: string) {
  return video({
    size,
    fps,
    duration: "10f",
    render: (ctx) => Html({
      width: "fill",
      height: "fill",
      html: `<main style="width:100%;height:100%;display:grid;place-items:center;background:${color};color:white;font:700 26px system-ui">${label}:${ctx.timeline.frame}</main>`,
    }),
  });
}

// One source Program is projected both as viewer-controlled pages and as a
// deterministic timeline. Its part, choice and route IDs are the host contract.
const story = sequence([
  { id: "opening", content: clip("OPENING", "#1d4ed8") },
  {
    id: "chapter",
    content: sequence([
      {
        id: "decision",
        content: choose({
          standard: clip("STANDARD", "#7c3aed"),
          highlight: clip("HIGHLIGHT", "#b91c1c"),
        }),
      },
      { id: "ending", content: clip("ENDING", "#047857") },
    ]),
  },
]);

const routePath = "chapter/decision";
const manualProgram = story;
const manualHost = document.querySelector<HTMLElement>("#manual")!;
const manualPlayer = new Player({ container: manualHost, size, playbackMode: "once", hoverBehavior: "none" });
let manualSelection = "standard";
let nestedProgramRetained = false;
const prepareManual: NonNullable<Parameters<typeof present>[2]["prepare"]> = (media, context) => {
  if (context.partId === "chapter") nestedProgramRetained = media.composition?.program === story.parts[1]?.content;
  return { media };
};
let deck = present(manualPlayer, manualProgram, {
    mode: "manual",
    prepare: prepareManual,
  size,
  fps,
  routes: { [routePath]: manualSelection },
});

const manualStatus = document.querySelector<HTMLElement>("#manual-status")!;
const manualPrevious = document.querySelector<HTMLButtonElement>("#manual-previous")!;
const manualNext = document.querySelector<HTMLButtonElement>("#manual-next")!;

function updateManual(result?: { status: string; message?: string }) {
  if (result) {
    document.body.dataset.manualReady = result.status;
    if (result.status === "error") document.body.dataset.manualError = result.message ?? "Could not load page";
  }
  manualStatus.textContent = result?.status === "error"
    ? result.message ?? "Could not load page"
    : `${deck.currentIndex + 1}/${deck.parts.length} ${deck.currentId ?? "loading"}`;
  manualPrevious.disabled = deck.currentIndex <= 0;
  manualNext.disabled = deck.currentIndex >= deck.parts.length - 1;
}

manualPrevious.addEventListener("click", () => { void deck.previous().then(updateManual); });
manualNext.addEventListener("click", () => { void deck.next().then(updateManual); });
void deck.ready.then(async (result) => {
  if (result.status === "success") {
    manualPlayer.pause();
    await manualPlayer.seek({ frame: 0 });
  }
  updateManual(result);
});

const timelineHost = document.querySelector<HTMLElement>("#timeline")!;
const timelinePlayer = new Player({
  container: timelineHost,
  size,
  drive: "scroll",
  playbackMode: "once",
  hoverBehavior: "none",
});
let timelineSelection = "standard";
let timelineMedia = project(timelineSelection);
let timelineLoad = timelinePlayer.load(timelineMedia);
void timelineLoad.then((result) => {
  document.body.dataset.timelineReady = result.status;
  if (result.status === "error") document.body.dataset.timelineError = result.message;
});

function project(selection: string) {
  return time(story, { size, fps, routes: { [routePath]: selection } });
}

async function replaceManual(selection: string) {
  deck.dispose();
  manualSelection = selection;
  deck = present(manualPlayer, manualProgram, {
    mode: "manual",
    prepare: prepareManual,
    size,
    fps,
    initialId: "chapter",
    routes: { [routePath]: selection },
  });
  const result = await deck.ready;
  updateManual(result);
  if (result.status === "success") {
    manualPlayer.pause();
    await manualPlayer.seek({ frame: 0 });
  }
  return result;
}

async function replaceTimeline(selection: string) {
  timelineSelection = selection;
  timelineMedia = project(selection);
  const result = await timelinePlayer.load(timelineMedia);
  if (result.status === "success") {
    timelinePlayer.pause();
    await timelinePlayer.seek({ frame: 0 });
  }
  return result;
}

document.querySelector<HTMLButtonElement>("#manual-highlight")!.addEventListener("click", () => {
  void replaceManual("highlight");
});
document.querySelector<HTMLButtonElement>("#timeline-highlight")!.addEventListener("click", () => {
  void replaceTimeline("highlight");
});

Object.assign(window, {
  __storyHost: {
    source: story,
    inspect: () => ({
      sourceIds: story.parts.map((part) => part.id),
      manual: {
        ids: deck.parts.map((part) => part.id),
        currentId: deck.currentId,
        generation: manualPlayer.getPresentation().generation,
        frame: manualPlayer.getState().currentFrame,
        routes: manualPlayer.getCompositionSchedule()?.selectedRoutes ?? {},
        leaves: manualPlayer.getCompositionSchedule()?.leaves.map((leaf) => leaf.path) ?? [],
        sameProgram: manualProgram === story,
        nestedProgramRetained,
      },
      timeline: {
        generation: timelinePlayer.getPresentation().generation,
        frame: timelinePlayer.getState().currentFrame,
        routes: timelinePlayer.getCompositionSchedule()?.selectedRoutes ?? {},
        leaves: timelinePlayer.getCompositionSchedule()?.leaves.map((leaf) => leaf.path) ?? [],
        sameProgram: timelineMedia.composition?.program === story,
      },
      selections: { manual: manualSelection, timeline: timelineSelection },
    }),
    async replaceManual(selection: string) { return (await replaceManual(selection)).status; },
    async replaceTimeline(selection: string) { return (await replaceTimeline(selection)).status; },
    async goManual(id: string) { return (await deck.go(id)).status; },
    disposeManual() { deck.dispose(); manualPlayer.dispose(); },
    disposeTimeline() { timelinePlayer.dispose(); },
  },
});

if (import.meta.hot) import.meta.hot.dispose(() => {
  deck.dispose();
  manualPlayer.dispose();
  timelinePlayer.dispose();
});
