import { defineScene, defineBatch } from "superimg";

const template = defineScene({
  sample: { title: "Test" },
  render(ctx) {
    return `<div>${ctx.data.title}</div>`;
  },
});
export default template;

// Co-located batch → one output per entry (test-a, test-b). Data is typed
// against the template's `sample` shape via defineBatch.
export const batch = defineBatch(template, async () => [
  { slug: "a", sample: { title: "A" } },
  { slug: "b", sample: { title: "B" } },
]);
