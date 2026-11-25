//! Compile-time probes for media-first data inference. Not a vitest file.

import {
  image,
  type CheckOptions,
  type ExportOptions,
  type ExportableMedia,
  type InspectOptions,
  type MediaRenderOptions,
} from "./index.js";
import { MEDIA_ELEMENT, type MediaElement } from "./media-node.js";

function Html(html: string): MediaElement {
  return {
    $$typeof: MEDIA_ELEMENT,
    type: "Html",
    props: { width: "fill", height: "fill", html },
    children: [],
  };
}

const media = image<{ title: string }>({
  render: ({ data }) => Html(data.title),
});

declare function render<D>(
  value: ExportableMedia<D>,
  options: MediaRenderOptions<D>,
): void;
declare function check<D>(
  value: ExportableMedia<D>,
  options?: CheckOptions<D>,
): void;
declare function inspect<D>(
  value: ExportableMedia<D>,
  options?: InspectOptions<D>,
): void;
declare function exportMedia<D>(
  value: ExportableMedia<D>,
  options: ExportOptions<D>,
): void;

render(media, { as: "png", data: { title: "x" } });
check(media, { data: { title: "x" } });
inspect(media, { data: { title: "x" } });
exportMedia(media, { for: ["open-graph"], data: { title: "x" } });

// @ts-expect-error titel is not a field of the media data
render(media, { as: "png", data: { titel: "x" } });
// @ts-expect-error title is a string
render(media, { as: "png", data: { title: 1 } });
// @ts-expect-error titel is not a field of the media data
check(media, { data: { titel: "x" } });
// @ts-expect-error title is a string
exportMedia(media, { for: ["open-graph"], data: { title: 1 } });
