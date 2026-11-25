import { createInteractivePlayer } from "@foxworth/superimg/interactive/player";
import lesson from "./request-journey.media.ts";

const controls = document.querySelector<HTMLElement>("#steps");
const status = document.querySelector<HTMLElement>("#status");
if (!controls || !status) throw new Error("Request journey host elements are missing");

const interactive = createInteractivePlayer<{ title: string }>({
  container: "#player",
  size: { width: 1920, height: 1080 },
  playbackMode: "once",
});

const buttons = lesson.guide.steps.map((step) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = step.label;
  button.disabled = true;
  controls.append(button);
  return { step, button };
});

function showError(error: unknown) {
  status!.textContent = error instanceof Error ? error.message : "Could not display this step.";
}

// Serialize navigation so quick clicks leave the last requested step visible.
let navigation = Promise.resolve();
for (const { step, button } of buttons) {
  button.addEventListener("click", () => {
    navigation = navigation.then(() => interactive.guide.goToStep(step.id)).catch(showError);
  });
}
interactive.on("stepchange", (step) => {
  for (const item of buttons) {
    if (item.step.id === step?.stepId) item.button.setAttribute("aria-current", "step");
    else item.button.removeAttribute("aria-current");
  }
  status.textContent = step?.note ?? "Choose a request step.";
});
interactive.on("error", showError);

async function start() {
  const result = await interactive.load(lesson, {
    data: { title: "How a web request becomes a page" },
  });
  if (result.status !== "success") throw new Error(result.message);
  await interactive.guide.goToStep(lesson.guide.steps[0]!.id);
  for (const { button } of buttons) button.disabled = false;
}
void start().catch(showError);
window.addEventListener("pagehide", () => interactive.dispose(), { once: true });
