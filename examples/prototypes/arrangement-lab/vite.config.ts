import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
    resolve: { alias: { "@emotion/unitless": fileURLToPath(new URL("./node_modules/@emotion/unitless/dist/emotion-unitless.esm.js", import.meta.url)) } },
    server: { host: "127.0.0.1", port: 4196, strictPort: true, fs: { allow: [fileURLToPath(new URL("../../../", import.meta.url))] } },
});
