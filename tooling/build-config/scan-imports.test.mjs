import assert from "node:assert/strict";
import test from "node:test";

import { collectSourceImports } from "./scan-imports.mjs";

test("collects multiline static imports and re-exports", () => {
  const source = `
    import {
      alpha,
      beta,
    } from "multiline-package";

    export {
      gamma,
    } from "re-exported-package";
  `;

  assert.deepEqual(
    [...collectSourceImports(source)],
    ["multiline-package", "re-exported-package"],
  );
});

test("ignores import lookalikes inside multiline templates", () => {
  const source = `
    const embeddedSource = \`
      import "fake-static-package";
      export { fake } from "fake-re-export-package";
      import("fake-dynamic-package");
    \`;
  `;

  assert.deepEqual([...collectSourceImports(source)], []);
});

test("collects literal dynamic imports inside template substitutions", () => {
  const source = `
    const embeddedValue = \`prefix \${await import("real-dynamic-package")} suffix\`;
    const runtimeOnly = import(packageName);
    const metadata = import.meta.url;
  `;

  assert.deepEqual([...collectSourceImports(source)], ["real-dynamic-package"]);
});
