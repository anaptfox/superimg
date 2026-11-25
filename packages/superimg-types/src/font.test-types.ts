import { googleFont, image, type FontInput } from "./index.js";
import { MEDIA_ELEMENT, type MediaElement } from "./media-node.js";

function Html(html: string): MediaElement {
  return { $$typeof: MEDIA_ELEMENT, type: "Html", props: { html }, children: [] };
}

const declared: FontInput = googleFont("Anton");
image({ fonts: [declared, { family: "Local", src: "fonts/Local.ttf" }], render: () => Html("") });

image({
  // @ts-expect-error bare strings are not font declarations
  fonts: ["Anton"],
  render: () => Html(""),
});
