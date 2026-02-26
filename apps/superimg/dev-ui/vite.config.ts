import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "../dist/dev-ui",
    emptyOutDir: true,
  },
});
