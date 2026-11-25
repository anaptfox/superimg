import { time } from "@foxworth/superimg";
import { Player } from "@foxworth/superimg/player";
import { lesson, lessonFps, lessonSize, type LessonPath } from "../../../composed/path-lesson/path-lesson.js";

const player = new Player({
  container: "#player",
  size: lessonSize,
  playbackMode: "once",
  hoverBehavior: "none",
  drive: "scroll",
});

const buttons: Record<LessonPath, HTMLButtonElement> = {
  beginner: document.querySelector<HTMLButtonElement>("#beginner")!,
  advanced: document.querySelector<HTMLButtonElement>("#advanced")!,
};
const status = document.querySelector<HTMLOutputElement>("#route-status")!;
let selectionGeneration = 0;

function requestedPath(): LessonPath {
  return new URLSearchParams(window.location.search).get("path") === "advanced"
    ? "advanced"
    : "beginner";
}

async function selectPath(path: LessonPath, updateAddress = true) {
  const generation = ++selectionGeneration;
  for (const candidate of ["beginner", "advanced"] as const) {
    buttons[candidate].setAttribute("aria-pressed", String(candidate === path));
  }

  if (updateAddress && requestedPath() !== path) {
    const url = new URL(window.location.href);
    url.searchParams.set("path", path);
    window.history.pushState(null, "", url);
  }

  const media = time(lesson, {
    size: lessonSize,
    fps: lessonFps,
    routes: { lesson: path },
  });
  const result = await player.load(media);
  if (generation !== selectionGeneration) return;
  if (result.status === "error") {
    status.textContent = result.message;
    return;
  }

  const closing = media.composition?.schedule.leaves.find((leaf) => leaf.path === "closing");
  status.textContent = `${path} · ${result.totalFrames} frames · closing at ${closing?.startFrame ?? "?"}`;
}

buttons.beginner.addEventListener("click", () => void selectPath("beginner"));
buttons.advanced.addEventListener("click", () => void selectPath("advanced"));
window.addEventListener("popstate", () => void selectPath(requestedPath(), false));
void selectPath(requestedPath());

if (import.meta.hot) import.meta.hot.dispose(() => player.dispose());
