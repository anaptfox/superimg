import { describe, expect, it } from "vitest";
import { planDeploy, materializeDeployPlan } from "@superimg/adapters/providers";

describe("deploy OCI plan (cli integration surface)", () => {
  it("is provider-neutral and omits wrangler/cloudflare", () => {
    const plan = planDeploy({
      imageName: "superimg-render",
      profile: "node",
      nodeVersion: "26.13.1",
      playwrightVersion: "1.65.0",
    });
    const files = materializeDeployPlan(plan);
    expect(files["Dockerfile"]).toBeTruthy();
    expect(files["Dockerfile"]).toContain("dist/container.js");
    expect(files["Dockerfile"]).toContain("npm install");
    expect(files["runtime-manifest.json"]).toContain('"schemaVersion": 0');
    expect(files["wrangler.toml"]).toBeUndefined();
    expect(files["worker.ts"]).toBeUndefined();
    expect(files["README.deploy.md"]).not.toMatch(/wrangler/i);
  });


  it("node-media profile enables ffmpeg in Dockerfile", () => {
    const plan = planDeploy({
      imageName: "superimg-render",
      profile: "node-media",
      nodeVersion: "26.13.1",
      playwrightVersion: "1.65.0",
      withFfmpeg: true,
    });
    const files = materializeDeployPlan(plan);
    expect(files["Dockerfile"]).toMatch(/ffmpeg/i);
    expect(files["runtime-manifest.json"]).toContain("node-media");
  });
});
