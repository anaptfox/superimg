import { defineConfig } from "superimg";

export default defineConfig({
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 7, // intro 2s + content 3s + outro 2s
  fonts: ["IBM+Plex+Sans:wght@400;700"],
});
