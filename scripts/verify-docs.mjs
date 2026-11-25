import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tracked = execFileSync("git", ["ls-files", "*.md", "*.mdx"], {
  cwd: root,
  encoding: "utf8",
}).trim().split("\n").filter(Boolean);

const failures = [];

function targetExists(target) {
  if (existsSync(target)) return true;
  if (extname(target)) return false;
  return [
    `${target}.md`,
    `${target}.mdx`,
    join(target, "README.md"),
    join(target, "README.mdx"),
  ].some(existsSync);
}

for (const file of tracked) {
  const absolute = join(root, file);
  if (!existsSync(absolute)) continue;
  // Managed skills may be embedded into repository guidance files, but their
  // relative links belong to the installed skill root rather than the host
  // file. Validate the host-authored prose while ignoring that generated block.
  const source = readFileSync(absolute, "utf8").replace(
    /<!-- BEGIN superimg-skill v[^>]*-->[\s\S]*?<!-- END superimg-skill -->/g,
    "",
  );
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    const raw = match[1].trim().replace(/^<|>$/g, "");
    const href = raw.split(/\s+["']/)[0].split("#")[0];
    if (!href || href.startsWith("#") || href.startsWith("/") || /^[a-z][a-z+.-]*:/i.test(href)) {
      continue;
    }

    const target = normalize(resolve(dirname(absolute), decodeURIComponent(href)));
    if (!targetExists(target)) {
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${file}:${line}: broken relative link ${raw}`);
    }
  }
}

const docsDir = join(root, "apps/docs/content/docs");
const navSource = readFileSync(join(root, "apps/docs/lib/docs-nav.ts"), "utf8");
const navSlugs = new Set([...navSource.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]));
for (const slug of navSlugs) {
  if (!existsSync(join(docsDir, `${slug}.mdx`))) {
    failures.push(`apps/docs/lib/docs-nav.ts: missing content/docs/${slug}.mdx`);
  }
}
for (const file of tracked.filter((path) => path.startsWith("apps/docs/content/docs/") && path.endsWith(".mdx"))) {
  const slug = file.slice("apps/docs/content/docs/".length, -4);
  if (!navSlugs.has(slug)) failures.push(`${file}: missing from docs navigation`);
}

const currentDocs = tracked.filter((file) =>
  existsSync(join(root, file)) && (
  file === "README.md" ||
  file === "packages/superimg/README.md" ||
  file.startsWith("apps/docs/content/docs/") ||
  file.startsWith("skills/superimg/") ||
  file.startsWith("docs/")),
);

const removedApis = [
  ["std.cue.", "use ctx.track() or import a provider converter from @foxworth/superimg/transcript"],
  ["player.destroy()", "use player.dispose()"],
  ["std.springTween", "use std.spring(from, to, progress, spec)"],
  ["std.createSpring", "use a named spring or config with std.spring/director easing"],
  ["@foxworth/superimg/bundler-browser", "hosts compile *.media.ts with their own Rolldown/OXC"],
  ["@foxworth/superimg/bundler", "hosts compile *.media.ts with their own Rolldown/OXC"],
  ["@foxworth/superimg/compile", "hosts compile *.media.ts with their own Rolldown/OXC"],
];

for (const file of currentDocs) {
  const source = readFileSync(join(root, file), "utf8");
  for (const [token, replacement] of removedApis) {
    if (source.includes(token)) failures.push(`${file}: stale API ${token}; ${replacement}`);
  }
  for (const match of source.matchAll(/std\.video\.sync\([^\n]+,\s*(?:ctx\.)?fps\)/g)) {
    const line = source.slice(0, match.index).split("\n").length;
    failures.push(`${file}:${line}: std.video.sync is already bound to ctx.fps; remove the second argument`);
  }
}

if (failures.length > 0) {
  console.error(`Documentation verification failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation verification passed (${tracked.length} tracked Markdown files, ${navSlugs.size} docs routes).`);
