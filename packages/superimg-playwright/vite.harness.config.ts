import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist/harness",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/harness/harness.ts"),
      formats: ["es"],
      fileName: () => "harness.js",
    },
    rollupOptions: {},
    copyPublicDir: false,
  },
  publicDir: false,
  // Copy index.html and embed source hash after build
  plugins: [
    {
      name: "copy-harness-html",
      closeBundle: async () => {
        const { copyFileSync } = await import("node:fs");
        copyFileSync(
          resolve(__dirname, "src/harness/index.html"),
          resolve(__dirname, "dist/harness/index.html")
        );
      },
    },
    {
      name: "embed-source-hash",
      closeBundle: async () => {
        const { execSync } = await import("node:child_process");
        try {
          execSync("npx tsx scripts/harness-integrity.ts embed", {
            cwd: __dirname,
            stdio: "inherit",
          });
        } catch (err) {
          console.error("Warning: Failed to embed source hash");
        }
      },
    },
  ],
});
