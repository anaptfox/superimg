import { defineConfig } from "vite";
import { revisionReviewPlugin } from "./server.js";
export default defineConfig({
  plugins: [revisionReviewPlugin()],
  server: { host: "127.0.0.1", port: 4192, strictPort: true },
});
