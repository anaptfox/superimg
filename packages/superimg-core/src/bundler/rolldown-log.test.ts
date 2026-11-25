import { expect, it } from "vitest";
import { rolldown } from "rolldown";
import { unresolvedImports } from "./rolldown-log.js";

it("permits a real declared external even when it survives in output", async () => {
  const unresolved = unresolvedImports(() => true);
  const bundle = await rolldown({
    input: "entry.js", external: ["host-provided"],
    plugins: [{ name: "fixture", resolveId(id) { if (id === "entry.js") return id; }, load(id) { if (id === "entry.js") return 'import { value } from "host-provided"; export default value;'; } }],
    onLog(_level, log) { unresolved.observe(log); },
  });
  try {
    const { output } = await bundle.generate({ format: "es" });
    expect(output[0]).toMatchObject({ imports: ["host-provided"] });
    expect(() => unresolved.assertResolved(output)).not.toThrow();
  } finally { await bundle.close(); }
});
