import { Player } from "@foxworth/superimg/player";
import tour from "../../../marketing/lockup-tour/lockup-tour.media.ts";

export const player = new Player({
  container: "#player",
  drive: "pointer",
  hoverBehavior: "none",
  playbackMode: "once",
});

const result = await player.load(tour);
if (result.status === "error") {
  const container = document.querySelector<HTMLElement>("#player");
  if (container) { container.setAttribute("role", "status"); container.textContent = result.message; }
}

if (import.meta.hot) import.meta.hot.dispose(() => player.dispose());
