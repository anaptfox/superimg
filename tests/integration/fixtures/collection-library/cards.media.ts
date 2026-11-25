import { collection, Fill, Frame, image, Stack, Text } from "@foxworth/superimg";
import { loadEntries } from "./entries.server.mjs";

interface CardEntry {
  id: string;
  title: string;
  color: string;
}

export default collection({
  entries: loadEntries,
  media: image<CardEntry>({
    size: { width: 160, height: 90 },
    render(ctx) {
      return Frame(
        { width: "fill", height: "fill" },
        Fill({ color: ctx.data.color }),
        Stack(
          { width: "fill", height: "fill", align: "center", justify: "center" },
          Text({ color: "#111827", size: 18, weight: 600 }, ctx.data.title),
        ),
      );
    },
  }),
});
