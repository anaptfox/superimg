import { render } from "@foxworth/superimg/runtime";
import card from "./card.media";

document.querySelector("button")!.onclick = async () => {
  const webp = await render(card, { as: "webp", data: { title: "SuperImg" } });
  const url = URL.createObjectURL(await webp.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "card.webp";
  anchor.click();
  URL.revokeObjectURL(url);
};
