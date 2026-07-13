import { chmod, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const runtimeFiles = [
  "check-externals.mjs",
  "check-no-react.mjs",
  "check-platform-self-contained.mjs",
  "check-workerd-compat.mjs",
  "generate-platform-manifest.mjs",
  "scan-imports.mjs",
];

await mkdir(output, { recursive: true });
await Promise.all(runtimeFiles.map((file) => copyFile(join(root, file), join(output, file))));
await Promise.all(
  runtimeFiles
    .filter((file) => file !== "scan-imports.mjs")
    .map((file) => chmod(join(output, file), 0o755)),
);
