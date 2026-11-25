import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateCompilationError } from "@superimg/types";
const bundler = vi.hoisted(() => ({ initBundler: vi.fn(async () => {}), bundleTemplateBrowser: vi.fn() }));
vi.mock("./bundler-loader.js", () => ({ loadBundler: async () => bundler }));
vi.mock("@superimg/core", () => ({ compileTemplate: vi.fn(() => ({ media: { kind: "media", render: () => ({}) } })), validateTemplate: vi.fn() }));
vi.mock("@superimg/core/errors", async () => import(new URL("../../../../superimg-core/src/errors/compiler-diagnostics.ts", import.meta.url).pathname));
import { useCompiler } from "./useCompiler.js";

it("preserves typed browser compiler details and returns warning records on success", async () => {
  const failure = new TemplateCompilationError({ syntaxError: "missing export" });
  Object.assign(failure, { code: "TEMPLATE_MISSING_EXPORT" });
  failure.details.compilerDiagnostics = [{ code: "MISSING_EXPORT", severity: "error", stage: "resolve", message: "missing", labels: [{ start: 4, end: 8 }], help: "use Text" }];
  bundler.bundleTemplateBrowser.mockRejectedValueOnce(failure);
  const { result } = renderHook(() => useCompiler());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => { await result.current.compile("invalid"); });
  expect(result.current.error).toBe(failure);
  expect(result.current.diagnostics).toEqual(failure.details.compilerDiagnostics);
  const warnings = [{ code: "PLUGIN_WARNING", severity: "warning", stage: "transform", message: "warning" }];
  bundler.bundleTemplateBrowser.mockResolvedValueOnce({ code: "valid", diagnostics: warnings });
  await act(async () => { await result.current.compile("valid"); });
  expect(result.current.error).toBeNull();
  expect(result.current.diagnostics).toEqual(warnings);
  act(() => result.current.clear());
  expect(result.current.diagnostics).toEqual([]);
});

it("does not replace a newer successful compile with an older failure", async () => {
  let rejectOld!: (reason: Error) => void;
  bundler.bundleTemplateBrowser.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }));
  bundler.bundleTemplateBrowser.mockResolvedValueOnce({ code: "new", diagnostics: [] });
  const { result } = renderHook(() => useCompiler());
  await waitFor(() => expect(result.current.ready).toBe(true));
  let older!: Promise<unknown>;
  await act(async () => { older = result.current.compile("old"); });
  await act(async () => { await result.current.compile("new"); });
  const accepted = result.current.media;
  await act(async () => { rejectOld(new Error("old failure")); await older; });
  expect(result.current.media).toBe(accepted);
  expect(result.current.error).toBeNull();
  expect(result.current.diagnostics).toEqual([]);
});
