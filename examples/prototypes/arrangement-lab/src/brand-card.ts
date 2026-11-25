import { z } from "zod";
import { Frame, Fill, Text } from "../../../../packages/superimg-stdlib/src/tree/primitives";
export const brandProps = z.strictObject({
    headline: z.string().trim().min(1).max(72),
    detail: z.string().trim().min(1).max(160),
    cta: z.string().trim().min(1).max(36),
    theme: z.enum(["forest", "ink", "clay"]),
});
export const brandSchema = z.toJSONSchema(brandProps);
export const brandExample = { pattern: "brand-card", spec: { headline: "A little more room to think.", detail: "A fictional launch card for Northstar. Clear content, a fixed visual system, and room for your words.", cta: "Meet the new workspace", theme: "forest" } };
export function renderBrand(input: unknown) {
    const data = brandProps.parse(input);
    const themes = { forest: { bg: "#e2e9d8", ink: "#203c28", accent: "#315326" }, ink: { bg: "#e1e6ed", ink: "#23354e", accent: "#344f76" }, clay: { bg: "#f0e0d3", ink: "#613c2c", accent: "#8a4c34" } };
    const palette = themes[data.theme];
    return Frame({ id: "brand-card", width: 1080, height: 1080 }, Fill({ color: palette.bg }), Frame({ id: "brand", x: 80, y: 76, width: 920, height: 50 }, Text({ size: 26, weight: 650, color: palette.ink }, "Northstar")), Frame({ id: "headline", x: 80, y: 245, width: 900, height: 320 }, Text({ size: 86, weight: 600, lineHeight: 1.06, letterSpacing: -2, color: palette.ink }, data.headline)), Frame({ id: "detail", x: 84, y: 620, width: 800, height: 180 }, Text({ size: 30, lineHeight: 1.4, color: palette.ink }, data.detail)), Frame({ id: "cta-box", x: 80, y: 872, width: 920, height: 92 }, Fill({ color: palette.accent }), Frame({ id: "cta", x: 26, y: 25, width: 860, height: 50 }, Text({ size: 27, weight: 550, color: "#fffdf8" }, data.cta))), Frame({ id: "disclaimer", x: 80, y: 1005, width: 920, height: 40 }, Text({ size: 18, color: palette.ink }, "Illustrative brand · local prototype")));
}
