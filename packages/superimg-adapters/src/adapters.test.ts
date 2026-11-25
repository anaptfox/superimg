import { describe, expect, it } from "vitest";
import { createMediaIR, type MediaIR } from "@superimg/types";
import {
  assertSerializablePayload,
  createMediaPoster,
  createSkeletonMarkup,
  createSkeletonPosterFromIR,
  materializeDeployPlan,
  mediaAspectRatio,
  mediaStageStyle,
  mediaStageStyleAttr,
  payloadFromMediaIR,
  planDeploy,
  renderMediaStage,
  renderPosterMarkup,
  renderPosterStage,
  renderSkeletonStage,
  superimg,
  superimgViteConfig,
  joinBasePath,
  SUPERIMG_CLIENT_IMPORTS,
  SUPERIMG_SERVER_ONLY_IMPORTS,
  SUPERIMG_APP_FORBIDDEN_IMPORTS,
} from "./index.js";

function sampleIR(over: Partial<MediaIR> = {}): MediaIR {
  return createMediaIR({
    sourceId: "hello",
    width: 1280,
    height: 720,
    durationSeconds: 2,
    totalFrames: 60,
    phases: [],
    override: over,
  });
}

describe("poster + serializable payload", () => {
  it("builds fixed-dimension SSR poster without functions", () => {
    const ir = sampleIR();
    const poster = createMediaPoster(ir, { alt: "Hello" });
    expect(poster.width).toBe(1280);
    const html = renderPosterMarkup(poster);
    expect(html).toContain("data-superimg-poster");
    const payload = payloadFromMediaIR(ir, {
      data: { title: "x" },
    });
    expect(payload.schemaVersion).toBe(0);
    expect(() => assertSerializablePayload(payload)).not.toThrow();
  });

  it("payload poster markup is SSR-safe strings", () => {
    const payload = payloadFromMediaIR(sampleIR(), {
      includeMedia: true,
    });
    expect(renderPosterMarkup(payload.poster).length).toBeGreaterThan(20);
  });
});

describe("stage + skeleton (aspect ratio)", () => {
  it("mediaAspectRatio and stage style reserve canvas ratio", () => {
    expect(mediaAspectRatio(1920, 1080)).toBe("1920 / 1080");
    const style = mediaStageStyle(1280, 720);
    expect(style.aspectRatio).toBe("1280 / 720");
    expect(style.width).toBe("100%");
    expect(mediaStageStyleAttr(800, 450)).toContain("aspect-ratio:800 / 450");
  });

  it("rejects invalid sizes", () => {
    expect(() => mediaAspectRatio(0, 1080)).toThrow(/invalid size/);
    expect(() => createSkeletonMarkup({ width: -1, height: 10 })).toThrow(
      /invalid size/,
    );
  });

  it("skeleton is generic shimmer only — no bones, no painted words", () => {
    const html = createSkeletonMarkup({
      width: 1920,
      height: 1080,
      alt: "Loading board preview",
    });
    expect(html).toContain("data-superimg-skeleton");
    expect(html).not.toContain("data-superimg-skeleton-bone");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("superimg-shimmer");
    expect(html).toContain("position:absolute");
    // label must not be painted as visible text
    expect(html).not.toMatch(
      /data-superimg-skeleton-label|>board<|>BOARD</i,
    );
    expect(html).toContain('aria-label="Loading board preview"');
  });

  it("renderMediaStage wraps content in ratio shell", () => {
    const stage = renderMediaStage({
      width: 1920,
      height: 1080,
      sourceId: "board",
      content: createSkeletonMarkup({ width: 1920, height: 1080 }),
    });
    expect(stage).toContain('data-superimg-stage="1"');
    expect(stage).toContain('data-superimg-width="1920"');
    expect(stage).toContain("aspect-ratio:1920 / 1080");
    expect(stage).toContain("data-superimg-stage-fill");
    expect(stage).toContain('data-source-id="board"');
  });

  it("renderPosterStage can emit skeleton or poster content", () => {
    const poster = createMediaPoster(sampleIR(), { alt: "Hello" });
    const withPoster = renderPosterStage(poster, { sourceId: "hello" });
    expect(withPoster).toContain("data-superimg-stage");
    expect(withPoster).toContain("Hello");

    const skeleton = renderPosterStage(poster, {
      skeleton: true,
      skeletonLabel: "Loading",
    });
    expect(skeleton).toContain("data-superimg-skeleton");
    expect(skeleton).toContain("aspect-ratio:1280 / 720");
  });

  it("createSkeletonPosterFromIR uses canvas size", () => {
    const sk = createSkeletonPosterFromIR(sampleIR());
    expect(sk.width).toBe(1280);
    expect(sk.height).toBe(720);
    expect(sk.html).toContain("data-superimg-skeleton");
    expect(renderSkeletonStage({ width: 100, height: 50 })).toContain(
      "aspect-ratio:100 / 50",
    );
  });
});

describe("vite substrate", () => {
  it("excludes server-only packages from client optimize graph", () => {
    const cfg = superimgViteConfig({ base: "/app/" }) as {
      base: string;
      optimizeDeps: { include: string[]; exclude: string[] };
    };
    expect(cfg.base).toBe("/app/");
    // Workspace adapters are excluded from prebundle (live dist) — not force-included.
    expect(cfg.optimizeDeps.include).toContain("@foxworth/superimg");
    expect(cfg.optimizeDeps.include).toContain("@foxworth/superimg/runtime");
    expect(cfg.optimizeDeps.include).toContain("@foxworth/superimg/player");
    expect(cfg.optimizeDeps.include).not.toContain("@superimg/adapters");
    expect(cfg.optimizeDeps.exclude).toContain("@superimg/adapters");
    expect(cfg.optimizeDeps.exclude).toContain("@superimg/adapters/stage");
    for (const id of SUPERIMG_SERVER_ONLY_IMPORTS) {
      expect(cfg.optimizeDeps.exclude).toContain(id);
    }
    expect(SUPERIMG_APP_FORBIDDEN_IMPORTS).toContain("@foxworth/superimg-cli");
    // Fixture map still lists adapters for docs/assertions.
    expect(SUPERIMG_CLIENT_IMPORTS).toContain("@foxworth/superimg");
    expect(SUPERIMG_CLIENT_IMPORTS).toContain("@superimg/adapters");
  });

  it("superimg() plugin exposes name and base-aware config", () => {
    const plugin = superimg({ base: "/docs/" });
    expect(plugin.name).toBe("superimg");
    const cfg = (plugin.config as (c: unknown) => Record<string, unknown>)({});
    expect(cfg.base).toBe("/docs/");
    expect(joinBasePath("/docs/", "/poster.png")).toBe("/docs/poster.png");
  });

  it("strict transform rejects @foxworth/superimg-cli imports in app client sources", () => {
    const plugin = superimg({ strictServerImports: true });
    (plugin.configResolved as (c: { root: string }) => void)({ root: "/app" });
    const transform = plugin.transform as (
      this: { error: (m: string) => void },
      code: string,
      id: string,
    ) => null;
    const ctx = {
      error(m: string) {
        throw new Error(m);
      },
    };
    expect(() =>
      transform.call(
        ctx,
        `import { x } from "@foxworth/superimg-cli/dev-server";\n`,
        "/app/src/Client.tsx",
      ),
    ).toThrow(/server-only package/);
    expect(() =>
      transform.call(
        ctx,
        `import { x } from "@foxworth/superimg-cli";\n`,
        "/app/src/Client.tsx",
      ),
    ).toThrow(/server-only package/);
    expect(
      transform.call(ctx, `import { x } from "@foxworth/superimg-cli/dev-server";`, "/app/node_modules/foo/index.js"),
    ).toBeNull();
    expect(SUPERIMG_APP_FORBIDDEN_IMPORTS).toContain("@foxworth/superimg-cli");
  });
});

describe("OCI providers (Cloudflare-free core)", () => {
  it("plans generic OCI without wrangler/cloudflare files", () => {
    const plan = planDeploy({
      imageName: "superimg-render",
      profile: "node",
      nodeVersion: "26.13.1",
      playwrightVersion: "1.65.0",
      withFfmpeg: false,
    });
    const files = materializeDeployPlan(plan);
    expect(files["Dockerfile"]).toContain("FROM node:26.13.1-bookworm-slim");
    expect(files["Dockerfile"]).toContain("grep -Fqx 'v26.13.1'");
    expect(files["Dockerfile"]).toContain("FROM mcr.microsoft.com/playwright:v1.65.0-jammy");
    expect(files["Dockerfile"]).toContain("FFmpeg omitted");
    expect(files["Dockerfile"]!.match(/npm install/g)).toHaveLength(1);
    expect(files["Dockerfile"]).toContain('CMD ["node", "dist/container.js"]');
    expect(files["Dockerfile"]).not.toContain(
      "packages/superimg-cli/dist/container/handler.js",
    );
    expect(files["runtime-manifest.json"]).toContain('"ffmpeg": false');
    expect(files["wrangler.toml"]).toBeUndefined();
    expect(files["worker.ts"]).toBeUndefined();
    expect(plan.notes.join(" ")).not.toMatch(/[Ww]rangler/);
  });

  it("node-media profile includes ffmpeg install", () => {
    const plan = planDeploy({
      imageName: "superimg-render",
      profile: "node-media",
      nodeVersion: "26.13.1",
      playwrightVersion: "1.65.0",
      withFfmpeg: true,
    });
    const files = materializeDeployPlan(plan);
    expect(files["Dockerfile"]).toContain("ffmpeg");
    expect(files["runtime-manifest.json"]).toContain("node-media");
  });

  it("requires pinned image versions", () => {
    expect(() => planDeploy({
      imageName: "superimg-render",
      nodeVersion: "^26.13.1",
      playwrightVersion: "1.65.0",
    })).toThrow(/exact nodeVersion/);
    expect(() => planDeploy({
      imageName: "superimg-render",
      nodeVersion: "26.13.1",
      playwrightVersion: "latest",
    })).toThrow(/exact playwrightVersion/);
  });
});
