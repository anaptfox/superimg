#!/usr/bin/env node
// Keep native typechecking separate from TypeScript 6's compiler API and bin.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const packagePath = require.resolve("@typescript/native/package.json");
const { bin } = require(packagePath);
const child = spawn(process.execPath, [resolve(dirname(packagePath), bin.tsc), ...process.argv.slice(2)], {
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143);
});
