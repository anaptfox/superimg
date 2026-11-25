import { describe, it, expect } from "vitest";
import type { MediaIR, TemplatePackage } from "@superimg/types";
import {
  validateMediaIR,
  computeMediaIRHashes,
  capabilitiesForProfile,
  inspectRenderRequirements,
  negotiateRenderPath,
  buildTemplatePackage,
  validateTemplatePackage,
  validatePackageManifestFiles,
  assertNoSourceUpload,
  assertSafePackagePath,
  MediaIRError,
  sha256Hex,
  validateJobDataAgainstSchema,
} from "../index.js";
import type { TemplatePackageManifest } from "@superimg/types";

function minimalIR(overrides: Partial<MediaIR> = {}): MediaIR {
  const base = {
    kind: "@foxworth/superimg/media-ir" as const,
    schemaVersion: 0 as const,
    identity: { sourceId: "demo", variantId: "default", editionId: "default" },
    medium: "html" as const,
    animated: true,
    canvas: { width: 100, height: 100 },
    renderConfig: {
      fonts: [],
      inlineCss: [],
      stylesheets: [],
      tailwind: null,
      background: null,
      watermark: null,
      readiness: null,
      mode: "frame" as const,
    },
    clock: { fps: 30, durationSeconds: 1, totalFrames: 30 },
    capabilities: {
      temporal: "canonical" as const,
      motion: "none" as const,
      visual: "opaque-html" as const,
      portability: "self-contained" as const,
      determinism: "unverified" as const,
      issues: [],
    },
    provenance: {
      programHash: "a".repeat(64),
      sourceId: "demo",
      compiler: "superimg" as const,
      compilerVersion: 0 as const,
    },
    scenes: [
      {
        id: "default",
        index: 0,
        range: { startFrame: 0, endFrame: 30 },
        phases: [],
        markers: [],
        transitions: [],
      },
    ],
    tracks: [],
    motions: [],
    assets: [],
    extensions: {},
    observations: {
      markupRuns: [
        { range: { startFrame: 0, endFrame: 30 }, hash: "b".repeat(64) },
      ],
      sceneRuns: [
        { range: { startFrame: 0, endFrame: 30 }, hash: "c".repeat(64) },
      ],
    },
    hashes: {
      intentHash: "d".repeat(64),
      markupHash: "e".repeat(64),
      programHash: "a".repeat(64),
    },
  };
  const merged = { ...base, ...overrides };
  const hashes = computeMediaIRHashes(merged, merged.provenance.programHash);
  return validateMediaIR({ ...merged, hashes });
}

function samplePackage(ir?: MediaIR): TemplatePackage {
  const media = ir ?? minimalIR();
  const programBytes = "export default {};";
  return buildTemplatePackage({
    sourceId: media.identity.sourceId,
    program: {
      path: "program.mjs",
      sha256: sha256Hex(programBytes),
      format: "esm",
      bytes: programBytes.length,
    },
    media,
    assets: [],
  });
}

describe("draft naming / schemaVersion 0", () => {
  it("loads MediaIR under unsuffixed name with schemaVersion 0", () => {
    const ir = minimalIR();
    expect(ir.schemaVersion).toBe(0);
    expect(ir.kind).toBe("@foxworth/superimg/media-ir");
  });
});
describe("inspectRenderRequirements + negotiateRenderPath", () => {
  it("fails GIF without FFmpeg before capture", () => {
    const ir = minimalIR();
    const requirements = inspectRenderRequirements(ir);
    const caps = capabilitiesForProfile("node", { ffmpeg: null });
    const result = negotiateRenderPath(requirements, caps, {
      requestedOutputs: ["gif"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unsupported.some((u) => u.code === "ffmpeg_required")).toBe(
        true,
      );
    }
  });

  it("fails HTML on edge before capture", () => {
    const ir = minimalIR({ medium: "html" });
    const requirements = inspectRenderRequirements(ir);
    const caps = capabilitiesForProfile("edge");
    const result = negotiateRenderPath(requirements, caps, {
      preferredProfile: "edge",
      requestedOutputs: ["png"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.unsupported.some(
          (u) =>
            u.code === "unsupported_medium" || u.code === "profile_mismatch",
        ),
      ).toBe(true);
    }
  });

  it("treats an html still on edge as content-dependent", () => {
    const ir = minimalIR({ medium: "html", animated: false });
    const requirements = inspectRenderRequirements(ir);
    const caps = capabilitiesForProfile("edge");
    const result = negotiateRenderPath(requirements, caps, {
      preferredProfile: "edge",
      requestedOutputs: ["png"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path.lane).toBe("content-dependent");
      expect(result.path.rasterizer).toBe("resvg");
      expect(result.path.description).toContain("content-dependent");
    }
  });

  it("allows SVG on edge via resvg", () => {
    const ir = minimalIR({
      medium: "svg",
      animated: false,
      capabilities: {
        temporal: "canonical",
        motion: "none",
        visual: "opaque-svg",
        portability: "self-contained",
        determinism: "unverified",
        issues: [],
      },
    });
    const requirements = inspectRenderRequirements(ir);
    expect(requirements.medium).toBe("svg");
    const caps = capabilitiesForProfile("edge");
    const result = negotiateRenderPath(requirements, caps, {
      preferredProfile: "edge",
      requestedOutputs: ["png"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path.rasterizer).toBe("resvg");
      expect(result.path.profile).toBe("edge");
    }
  });

  it("allows HTML→MP4 on node without FFmpeg (Mediabunny)", () => {
    const ir = minimalIR();
    const requirements = inspectRenderRequirements(ir);
    const caps = capabilitiesForProfile("node", { ffmpeg: null });
    expect(caps.encoders).toContain("mediabunny-node");
    expect(caps.encoders).not.toContain("ffmpeg");
    const result = negotiateRenderPath(requirements, caps, {
      preferredProfile: "node",
      requestedOutputs: ["mp4"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path.encoder).toBe("mediabunny-node");
      expect(result.path.profile).toBe("node");
    }
  });

});

describe("TemplatePackage integrity", () => {
  it("builds and validates an integrity-checked package", () => {
    const pkg = samplePackage();
    expect(pkg.kind).toBe("@foxworth/superimg/template-package");
    expect(pkg.schemaVersion).toBe(0);
    expect(pkg.packageHash).toMatch(/^[a-f0-9]{64}$/);
    const again = validateTemplatePackage(pkg);
    expect(again.packageHash).toBe(pkg.packageHash);
  });

  it("fails closed on packageHash mismatch (tamper)", () => {
    const pkg = samplePackage();
    const tampered = { ...pkg, packageHash: "f".repeat(64) };
    expect(() => validateTemplatePackage(tampered)).toThrow(MediaIRError);
    try {
      validateTemplatePackage(tampered);
    } catch (e) {
      expect((e as MediaIRError).code).toBe("artifact_integrity");
    }
  });

  it("fails closed on path traversal", () => {
    expect(() => assertSafePackagePath("../etc/passwd")).toThrow(MediaIRError);
    expect(() => assertSafePackagePath("assets/../../x")).toThrow(MediaIRError);
    const pkg = samplePackage();
    const bad = {
      ...pkg,
      program: { ...pkg.program, path: "../evil.mjs" },
    };
    // recompute would fail on path before hash
    expect(() =>
      buildTemplatePackage({
        sourceId: pkg.sourceId,
        program: bad.program,
        media: pkg.media,
      }),
    ).toThrow(MediaIRError);
  });

  it("rejects remote assets by default", () => {
    const ir = minimalIR({
      assets: [
        {
          id: "logo",
          kind: "image",
          src: "https://evil.example/logo.png",
          remote: true,
        },
      ],
    });
    expect(() =>
      buildTemplatePackage({
        sourceId: "demo",
        program: {
          path: "program.mjs",
          sha256: "a".repeat(64),
          format: "esm",
          bytes: 1,
        },
        media: ir,
        assets: [
          {
            id: "logo",
            path: "assets/logo.png",
            sha256: "b".repeat(64),
            bytes: 10,
            kind: "image",
            remote: true,
          },
        ],
      }),
    ).toThrow(MediaIRError);
  });

  it("rejects source upload fields", () => {
    expect(() =>
      assertNoSourceUpload({ source: "export default {}", sourceId: "x" }),
    ).toThrow(MediaIRError);
    expect(() =>
      assertNoSourceUpload({ programCode: "x", packageHash: "a".repeat(64) }),
    ).toThrow(MediaIRError);
  });

  it("fails expectedPackageHash mismatch from job request", () => {
    const pkg = samplePackage();
    expect(() =>
      validateTemplatePackage(pkg, { expectedPackageHash: "0".repeat(64) }),
    ).toThrow(MediaIRError);
  });

  it("validatePackageManifestFiles fails closed on unknown present path", () => {
    const pkg = samplePackage();
    const manifest: TemplatePackageManifest = {
      kind: "@foxworth/superimg/template-package-manifest",
      schemaVersion: 0,
      sourceId: pkg.sourceId,
      packageHash: pkg.packageHash,
      files: [
        { path: "program.mjs", sha256: pkg.program.sha256, bytes: pkg.program.bytes },
        { path: "media.json", sha256: "c".repeat(64), bytes: 10 },
      ],
      requirements: pkg.requirements,
      identity: { sourceId: pkg.sourceId, variantId: "default", editionId: "default" },
    };
    expect(() =>
      validatePackageManifestFiles(manifest, [
        "program.mjs",
        "media.json",
        "evil-extra.mjs",
      ]),
    ).toThrow(MediaIRError);
    try {
      validatePackageManifestFiles(manifest, [
        "program.mjs",
        "media.json",
        "evil-extra.mjs",
      ]);
    } catch (e) {
      expect((e as MediaIRError).code).toBe("artifact_integrity");
      expect((e as MediaIRError).details?.code).toBe("unknown_file");
    }
  });

  it("validatePackageManifestFiles fails closed on missing declared path", () => {
    const pkg = samplePackage();
    const manifest: TemplatePackageManifest = {
      kind: "@foxworth/superimg/template-package-manifest",
      schemaVersion: 0,
      sourceId: pkg.sourceId,
      packageHash: pkg.packageHash,
      files: [
        { path: "program.mjs", sha256: pkg.program.sha256, bytes: pkg.program.bytes },
        { path: "media.json", sha256: "c".repeat(64), bytes: 10 },
        { path: "assets/logo.png", sha256: "d".repeat(64), bytes: 4 },
      ],
      requirements: pkg.requirements,
      identity: { sourceId: pkg.sourceId, variantId: "default", editionId: "default" },
    };
    expect(() =>
      validatePackageManifestFiles(manifest, ["program.mjs", "media.json"]),
    ).toThrow(MediaIRError);
    try {
      validatePackageManifestFiles(manifest, ["program.mjs", "media.json"]);
    } catch (e) {
      expect((e as MediaIRError).code).toBe("artifact_integrity");
      expect((e as MediaIRError).details?.code).toBe("missing_file");
    }
  });

  it("validatePackageManifestFiles accepts exact path set", () => {
    const pkg = samplePackage();
    const manifest: TemplatePackageManifest = {
      kind: "@foxworth/superimg/template-package-manifest",
      schemaVersion: 0,
      sourceId: pkg.sourceId,
      packageHash: pkg.packageHash,
      files: [
        { path: "program.mjs", sha256: pkg.program.sha256, bytes: pkg.program.bytes },
      ],
      requirements: pkg.requirements,
      identity: { sourceId: pkg.sourceId, variantId: "default", editionId: "default" },
    };
    expect(() =>
      validatePackageManifestFiles(manifest, ["program.mjs"]),
    ).not.toThrow();
  });
});
