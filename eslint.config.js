import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "apps/**",
      "examples/**",
      "packages/**/dev-ui/**",
      "packages/**/scripts/**",
      "packages/**/harness/**",
      "packages/superimg-codex-plugin/**",
      "packages/superimg-core/src/generated/**",
      "**/*.config.ts",
      "**/vitest*.ts",
    ],
  },
  {
    files: ["packages/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);