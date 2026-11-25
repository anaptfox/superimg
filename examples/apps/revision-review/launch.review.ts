import type { ReviewPlan } from "@foxworth/superimg";
import { observeBounds, observePresence } from "@foxworth/superimg/review";
import { launchLayout } from "./layout.js";

export default {
  schemaVersion: 1,
  beats: [{ id: "hold", label: "Title and product settle", at: "1s" }],
  observe(ctx) {
    const { product } = launchLayout(ctx.width, ctx.height);
    return {
      title: { withinCopyBudget: typeof ctx.data.title === "string" && ctx.data.title.length <= 30 },
      product: {
        ...observePresence(ctx.data.productAvailable === false ? [] : ["product"], "product", "complete"),
        ...observeBounds(product, { width: ctx.width, height: ctx.height }),
      },
      // A geometry observation cannot establish whether text is readable in pixels.
    };
  },
  checks: [
    { id: "copy-budget", label: "Title stays within the authored copy budget", metric: "title.withinCopyBudget", equals: true },
    { id: "product-present", label: "The product is supplied", metric: "product.present", equals: true },
    { id: "product-contained", label: "The authored product box stays on stage", metric: "product.contained", equals: true },
    { id: "readability", label: "Readability needs captured evidence", metric: "title.pixelReadability", equals: true },
  ],
} satisfies ReviewPlan;
