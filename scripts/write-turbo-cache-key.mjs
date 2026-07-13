import { writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { resolve } from "node:path";

const key = {
  platform: platform(),
  architecture: arch(),
  osRelease: release(),
  node: process.versions.node,
  modules: process.versions.modules,
};

writeFileSync(
  resolve(import.meta.dirname, "..", ".turbo-platform.json"),
  `${JSON.stringify(key, null, 2)}\n`,
);
