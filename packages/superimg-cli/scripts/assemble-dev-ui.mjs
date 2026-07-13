import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(
  import.meta.resolve("@superimg/dev-ui/package.json"),
);
const source = join(dirname(packageJsonPath), "dist");
const destination = fileURLToPath(new URL("../dist/dev-ui", import.meta.url));

try {
  const sourceStat = await stat(source);
  if (!sourceStat.isDirectory()) throw new Error("build output is not a directory");
  await stat(join(source, "index.html"));
} catch (error) {
  throw new Error(
    `@superimg/dev-ui has not been built; expected ${join(source, "index.html")}`,
    { cause: error },
  );
}

await rm(destination, { recursive: true, force: true });
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });
