import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  transpileWithSWC,
  transformImportPaths,
  generateImage,
  mergeConfigs,
} from "../superimg.ts";

let ensureDir: any;

Deno.test("transpileWithSWC - basic transpilation", async () => {
  const input = `
    const x: number = 5;
    console.log(x);
  `;
  const result = await transpileWithSWC(input);
  assertEquals(
    result.replace(/\s+/g, " ").trim(),
    "const x = 5; console.log(x);",
  );
});

// Deno.test("transformImportPaths - relative import", () => {
//   const input = `import { something } from './module';`;
//   const result = transformImportPaths(input, "/path/to/component");
//   assertEquals(
//     result,
//     `import { something } from '/path/to/component/module';`,
//   );
// });

Deno.test("mergeConfigs - overrides global config", () => {
  const globalConfig = {
    output: {
      formats: ["png"],
      sizes: [{ width: 1200, height: 630, suffix: "og" }],
    },
  };
  const localConfig = {
    output: {
      formats: ["jpeg"],
      sizes: [{ width: 800, height: 400, suffix: "small" }],
    },
  };
  const result = mergeConfigs(globalConfig, localConfig);
  assertEquals(result, localConfig);
});

Deno.test(
  "generateImage - throws error for non-existent component",
  async () => {
    await assertThrows(
      async () => {
        await generateImage("non-existent-component.tsx", "output.png");
      },
      Error,
      "Error reading component file",
    );
  },
);

// This test requires mocking file system operations
Deno.test("generateImage - generates image successfully", async () => {
  const mockReadTextFile = Deno.readTextFile;
  const mockWriteTextFile = Deno.writeTextFile;
  const mockEnsureDir = ensureDir;

  try {
    Deno.readTextFile = async () => `
      import React from "npm:react";
      export default function MockComponent() {
        return <div>Test Component</div>;
      }
      export const config = {
        output: {
          formats: ["png"],
          sizes: [{ width: 100, height: 100, suffix: "test" }],
        },
      };
    `;
    Deno.writeTextFile = async () => {};
    ensureDir = async () => {};

    await generateImage("mock-component.tsx", "output/mock");
    // If we reach this point without throwing, consider the test passed
    assertEquals(true, true);
  } finally {
    // Restore original functions
    Deno.readTextFile = mockReadTextFile;
    Deno.writeTextFile = mockWriteTextFile;
    ensureDir = mockEnsureDir;
  }
});
