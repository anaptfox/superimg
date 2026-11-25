import { describe, expect, it } from "vitest";
import { critiqueTemplate } from "./motion-critique.js";
import type { AnyTemplateModule } from "@superimg/types";
import { boxedHtml } from "../__tests__/__test-utils__/index.js";

describe("critiqueTemplate enter/exit names", () => {
  it("does not treat hook/cta as enter/exit", () => {
    const template = {
      config: { fps: 30, duration: "14s", width: 1920, height: 1080 },
      sample: { title: "Relay" },
      render(ctx: { director: (p: Record<string, string>) => unknown }) {
        ctx.director({ hook: "18%", app: "58%", cta: "24%" });
        return boxedHtml("<div>x</div>");
      },
    } as unknown as AnyTemplateModule;
    const report = critiqueTemplate(template);
    expect(report.issues.some((i) => i.code === "EXIT_SLOWER_THAN_ENTER")).toBe(false);
  });
});
