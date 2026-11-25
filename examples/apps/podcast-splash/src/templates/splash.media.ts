import { collection, video, Frame, Fill, Image, Stack, Text } from "@foxworth/superimg";
import { loadSpeakers } from "../speakers.server";
import type { Speaker } from "../speaker";

// Data is frozen by the collection provider; frame evaluation only paints it.
const splash = video<Speaker>({
  duration: "7s",
  editions: { square: { size: { width: 1080, height: 1080 } } },
  sample: {
    slug: "sample", podcastName: "The Build Log", episodeNumber: "042",
    episodeTitle: "Why we ditched microservices", speakerName: "Jane Doe",
    speakerTitle: "Principal Engineer", speakerPhoto: "",
    brandColor: "#FF4D6D", accentColor: "#FFD166",
  },
  render(ctx) {
    const { width, height, data, std } = ctx;
    const column = width <= height;
    const scale = Math.min(width / (column ? 1080 : 1920), height / (column ? 1080 : 1080));
    const pad = 80 * scale;
    const photoSize = (column ? 290 : 420) * scale;
    const textWidth = column ? width - 2 * pad : Math.min(width * 0.5, width - photoSize - 3 * pad);
    const t = ctx.director({ enter: "1s", hold: "6s" });
    const enter = (id: string, at: `${number}s`) => t.motion({ id, during: "enter", at, for: "0.45s", y: 18 * scale });
    const initials = data.speakerName.trim().split(/\s+/).slice(0, 2).map(word => word[0] ?? "").join("");
    return Frame({ id: "stage", width, height },
      Fill({ id: "background", color: "#0B0F1A" }),
      Fill({ id: "brand-rule", width, height: 12 * scale, color: data.brandColor }),
      Stack({ id: "lockup", width: "fill", height: "fill", direction: column ? "column" : "row",
        align: "center", justify: "center", gap: 54 * scale, pad },
        Frame({ id: "portrait", width: photoSize, height: photoSize, radius: photoSize / 2, overflow: "hidden",
          motion: enter("portrait-enter", "0s") },
          Fill({ color: data.brandColor }),
          data.speakerPhoto ? Image({ id: "photo", src: data.speakerPhoto, fit: "cover" })
            : Stack({ width: "fill", height: "fill", align: "center", justify: "center" },
              Text({ id: "initials", size: photoSize * 0.34, color: "#0B0F1A", weight: 800 }, initials)),
        ),
        Stack({ id: "copy", width: textWidth, gap: 20 * scale, align: column ? "center" : "start" },
          Text({ id: "podcast", size: 28 * scale, weight: 700, color: "#D5DAE5", motion: enter("podcast-enter", "0.1s") }, data.podcastName),
          Text({ id: "episode", size: 24 * scale, weight: 700, color: data.accentColor, motion: enter("episode-enter", "0.2s") }, `EPISODE ${data.episodeNumber}`),
          Text({ id: "name", size: std.svg.fitText(data.speakerName, { width: textWidth, height: 180 * scale }, { minSize: 38 * scale, maxSize: 80 * scale }).fontSize,
            maxWidth: textWidth, color: "#FFFFFF", weight: 800, align: column ? "center" : "left", motion: enter("name-enter", "0.3s") }, data.speakerName),
          Text({ id: "role", size: 30 * scale, maxWidth: textWidth, color: "#B7C0D2", align: column ? "center" : "left", motion: enter("role-enter", "0.4s") }, data.speakerTitle),
          Text({ id: "title", size: 38 * scale, maxWidth: textWidth, color: "#FFFFFF", weight: 600, align: column ? "center" : "left", motion: enter("title-enter", "0.5s") }, data.episodeTitle),
        ),
      ),
    );
  },
});

export default collection({ entries: loadSpeakers, entryId: "slug", media: splash });
