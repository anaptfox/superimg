import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ root: undefined as string | undefined }));
vi.mock("execa", () => ({ execa: vi.fn().mockResolvedValue({ stdout: "ffmpeg test" }) }));
vi.mock("@superimg/node", () => ({
  getRuntimeStatus: vi.fn().mockResolvedValue({ browsersPath: "/browser", browsersPathSource: "test" }),
  chromiumHealth: vi.fn().mockReturnValue({ status: "ok" }),
}));
vi.mock("../utils/find-project-root.js", () => ({ findProjectRoot: () => { if (state.root === undefined) throw new Error("no project"); return state.root; } }));
vi.mock("../utils/discover-videos.js", () => ({ discoverVideos: () => ["clip.media.ts"] }));
vi.mock("node:fs", async (importOriginal) => ({ ...await importOriginal<typeof import("node:fs")>(), existsSync: vi.fn(() => false), mkdirSync: vi.fn(), writeFileSync: vi.fn(), unlinkSync: vi.fn() }));
import { doctorCommand } from "./doctor.js";

describe("standalone doctor", () => {
  it("reports environment and cwd output without a project", async () => {
    state.root = undefined;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await doctorCommand({ json: true });
      const report = JSON.parse(String(log.mock.calls[0]?.[0]));
      expect(report.summary.fails).toBe(0);
      expect(report.checks.map((check: { code: string }) => check.code)).toContain("CHROMIUM_OK");
      expect(report.checks.map((check: { code: string }) => check.code)).toContain("OUTPUT_WRITABLE");
      expect(report.checks.map((check: { code: string }) => check.code)).not.toContain("NO_PROJECT_ROOT");
      expect(report.checks.map((check: { code: string }) => check.code)).not.toContain("TEMPLATES");
    } finally { log.mockRestore(); }
  });
  it("keeps project-specific checks when a project is present", async () => {
    state.root = "/project";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await doctorCommand({ json: true });
      const report = JSON.parse(String(log.mock.calls[0]?.[0]));
      expect(report.checks.map((check: { code: string }) => check.code)).toContain("TEMPLATES");
      expect(report.checks.map((check: { code: string }) => check.code)).toContain("SUPERIMG_NOT_INSTALLED");
    } finally { log.mockRestore(); }
  });
});
