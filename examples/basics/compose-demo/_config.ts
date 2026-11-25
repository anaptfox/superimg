import { googleFont } from "@foxworth/superimg";
import type { ProjectConfig } from "@foxworth/superimg";

export default {
  width: 1920,
  height: 1080,
  fps: 30,
  fonts: [googleFont("Instrument+Serif:wght@400"), googleFont("DM+Mono:wght@400;500")],
} satisfies ProjectConfig;
