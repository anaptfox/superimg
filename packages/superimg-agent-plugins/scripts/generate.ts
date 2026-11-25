//! Generate every agent-distribution artifact from the canonical root sources.
//!
//! Canonical inputs (hand-edited):
//!   skills/<name>/**            — skill content (SKILL.md + references/examples)
//!   agents/*.md                 — subagent definitions
//!   commands/*.md               — slash commands
//!   packages/superimg-agent-plugins/assets/* — brand assets
//!
//! Generated outputs (never hand-edited; `--check` fails CI on drift):
//!   skills/<name>/SKILL.md      — `version:` frontmatter stamped in place
//!   skills/<name>/agents/openai.yaml + assets/icon.svg — Codex/OpenAI surface metadata
//!   skills/superimg-pipeline/<name>/** — embedded REFERENCE.md copies (router pattern)
//!   commands/*.toml             — Codex prompt variants of commands/*.md
//!   packages/superimg-agent-plugins/grok/**  — Grok Build plugin tree
//!   packages/superimg-agent-plugins/grok-bot/** — Grok Bot / Cursor plugin (arrangements only)
//!   packages/superimg-agent-plugins/codex/** — Codex plugin tree
//!
//! The Claude Code plugin is served straight from the repo root
//! (.claude-plugin/ + skills/ + agents/ + commands/) and needs no generation.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG = join(__dirname, "..");
const REPO = join(PKG, "..", "..");
const SKILLS = join(REPO, "skills");
const AGENTS = join(REPO, "agents");
const COMMANDS = join(REPO, "commands");
const ASSETS = join(PKG, "assets");
const GROK = join(PKG, "grok");
const CODEX = join(PKG, "codex");
const GROK_BOT = join(PKG, "grok-bot");
const BOT_SKILLS = ["superimg-arrangements"] as const;

const ROUTER = "superimg-pipeline";
const BRAND_COLOR = "#667eea";
const VERSION: string = JSON.parse(
  readFileSync(join(REPO, "packages", "superimg", "package.json"), "utf8"),
).version;

const DEFAULT_PROMPTS: Record<string, string> = {
  superimg: "$superimg: Create a 6s launch video template",
  "superimg-pipeline": "$superimg-pipeline: Make a product launch video from scratch",
  "superimg-brief": "$superimg-brief: Outline a 20s feature announcement reel",
  "superimg-review": "$superimg-review: Review my template before I ship it",
  "superimg-ship": "$superimg-ship: Export for YouTube and Instagram square",
  "superimg-variants": "$superimg-variants: Deliver this video as reel + OG image",
  animator: "$animator: This animation feels stiff — fix the motion",
  "video-designer": "$video-designer: Redesign this scene as a technical diagram",
  "animation-vocabulary": "$animation-vocabulary: What is the bouncy popover effect called?",
  "superimg-arrangements":
    "$superimg-arrangements: Should this be a picture, and which arrangement earns it?",
};

// ── Output collection ──────────────────────────────────────────────────────
// Everything is emitted into a map first; write vs check is decided at the end.
const out = new Map<string, string>();
// Directories whose committed contents must exactly equal the emitted set —
// files found on disk but absent from `out` are stale.
const managedRoots: string[] = [GROK, CODEX, GROK_BOT];

function emit(path: string, content: string) {
  out.set(path, content);
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) files.push(...listFiles(p));
    else files.push(p);
  }
  return files;
}

// ── Frontmatter ────────────────────────────────────────────────────────────
interface Frontmatter {
  name: string;
  description: string;
}

function parseFrontmatter(raw: string, file: string): Frontmatter {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`missing frontmatter: ${file}`);
  const lines = (match[1] ?? "").split("\n");
  const fields: Record<string, string> = {};
  let key: string | null = null;
  let value = "";
  for (const line of lines) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv) {
      if (key) fields[key] = value.trim();
      key = kv[1] ?? null;
      const rest = kv[2] ?? "";
      value = rest === ">" || rest === "|" ? "" : rest;
    } else if (key && line.trim()) {
      value += (value ? " " : "") + line.trim();
    }
  }
  if (key) fields[key] = value.trim();
  if (!fields.name || !fields.description) {
    throw new Error(`frontmatter needs name + description: ${file}`);
  }
  return { name: fields.name, description: fields.description };
}

function stampVersion(raw: string): string {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return raw;
  const fm = match[1] ?? "";
  const stamped = /^version:.*$/m.test(fm)
    ? fm.replace(/^version:.*$/m, `version: ${VERSION}`)
    : `${fm}\nversion: ${VERSION}`;
  return raw.replace(match[0], `---\n${stamped}\n---\n`);
}

function shortDescription(description: string): string {
  const flat = description.replace(/\s+/g, " ").trim();
  const sentence = flat.split(/(?<=\.)\s/)[0] ?? flat;
  const clean = sentence.replace(/\.$/, "");
  return clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
}

// ── Discover skills ────────────────────────────────────────────────────────
const skillNames = readdirSync(SKILLS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(SKILLS, e.name, "SKILL.md")))
  .map((e) => e.name)
  .sort();

const iconSvg = readFileSync(join(ASSETS, "icon.svg"), "utf8");
const logoSvg = readFileSync(join(ASSETS, "logo.svg"), "utf8");

// Per-skill: version stamp + openai.yaml + icon. Reads exclude previously
// generated embedded copies so the pipeline stays reproducible from source.
const skillFiles = new Map<string, Map<string, string>>();
for (const name of skillNames) {
  const root = join(SKILLS, name);
  const files = new Map<string, string>();
  for (const abs of listFiles(root)) {
    const rel = relative(root, abs);
    const top = rel.split(sep)[0] ?? "";
    // Skip generated artifacts and embedded skill copies within the router.
    if (rel === join("agents", "openai.yaml")) continue;
    if (rel === join("assets", "icon.svg")) continue;
    if (name === ROUTER && skillNames.includes(top)) continue;
    files.set(rel, readFileSync(abs, "utf8"));
  }
  const skillMd = files.get("SKILL.md");
  if (!skillMd) throw new Error(`missing SKILL.md: ${name}`);
  files.set("SKILL.md", stampVersion(skillMd));
  skillFiles.set(name, files);

  const fm = parseFrontmatter(skillMd, join(root, "SKILL.md"));
  emit(join(root, "SKILL.md"), files.get("SKILL.md")!);
  emit(join(root, "assets", "icon.svg"), iconSvg);
  emit(
    join(root, "agents", "openai.yaml"),
    [
      "interface:",
      `  display_name: '/${fm.name}'`,
      `  short_description: '${shortDescription(fm.description).replace(/'/g, "''")}'`,
      "  icon_small: './assets/icon.svg'",
      "  icon_large: './assets/icon.svg'",
      `  brand_color: '${BRAND_COLOR}'`,
      `  default_prompt: '${(DEFAULT_PROMPTS[fm.name] ?? `$${fm.name}: help me with SuperImg`).replace(/'/g, "''")}'`,
      "",
    ].join("\n"),
  );
}

// ── Embedded router copies (Remotion pattern) ──────────────────────────────
// Installing superimg-pipeline alone carries the whole knowledge tree:
// each sibling skill is embedded as <name>/REFERENCE.md so skill scanners
// don't register the copies twice.
const routerRoot = join(SKILLS, ROUTER);
for (const name of skillNames) {
  if (name === ROUTER) continue;
  managedRoots.push(join(routerRoot, name));
  for (const [rel, content] of skillFiles.get(name)!) {
    const target = rel === "SKILL.md" ? "REFERENCE.md" : rel;
    emit(join(routerRoot, name, target), content);
  }
}

// ── Codex command prompts (.toml beside each .md) ──────────────────────────
const commandNames = readdirSync(COMMANDS)
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""))
  .sort();
for (const name of commandNames) {
  const raw = readFileSync(join(COMMANDS, `${name}.md`), "utf8");
  const fm = parseFrontmatter(raw, join(COMMANDS, `${name}.md`));
  const body = raw
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/^#.*$/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  emit(
    join(COMMANDS, `${name}.toml`),
    `description = ${JSON.stringify(fm.description)}\nprompt = ${JSON.stringify(body)}\n`,
  );
}

// ── Plugin trees ───────────────────────────────────────────────────────────
function emitSkillTree(pluginRoot: string) {
  for (const name of skillNames) {
    for (const [rel, content] of skillFiles.get(name)!) {
      if (rel === "agent.toml") continue;
      emit(join(pluginRoot, "skills", name, rel), content);
    }
    emit(join(pluginRoot, "skills", name, "assets", "icon.svg"), iconSvg);
    emit(
      join(pluginRoot, "skills", name, "agents", "openai.yaml"),
      out.get(join(SKILLS, name, "agents", "openai.yaml"))!,
    );
    if (name !== ROUTER) {
      for (const [rel, content] of skillFiles.get(name)!) {
        const target = rel === "SKILL.md" ? "REFERENCE.md" : rel;
        emit(join(pluginRoot, "skills", ROUTER, name, target), content);
      }
    }
  }
  emit(join(pluginRoot, "assets", "icon.svg"), iconSvg);
  emit(join(pluginRoot, "assets", "logo.svg"), logoSvg);
}

// Grok — near-clone of the Claude plugin layout.
emitSkillTree(GROK);
for (const f of readdirSync(AGENTS)) {
  emit(join(GROK, "agents", f), readFileSync(join(AGENTS, f), "utf8"));
}
for (const name of commandNames) {
  emit(join(GROK, "commands", `${name}.md`), readFileSync(join(COMMANDS, `${name}.md`), "utf8"));
}
emit(
  join(GROK, "plugin.json"),
  `${JSON.stringify(
    {
      name: "superimg",
      version: VERSION,
      description:
        "Programmatic video generation (HTML/CSS → MP4). Full lifecycle: brief, design, build, review, variants, ship.",
      skills: "./skills",
      agents: "./agents",
      commands: "./commands",
    },
    null,
    2,
  )}\n`,
);

// Codex — skills + interface metadata; commands ship as .toml prompts.
emitSkillTree(CODEX);
for (const name of commandNames) {
  emit(join(CODEX, "commands", `${name}.toml`), out.get(join(COMMANDS, `${name}.toml`))!);
}
emit(
  join(CODEX, ".codex-plugin", "plugin.json"),
  `${JSON.stringify(
    {
      name: "superimg",
      version: VERSION,
      description:
        "Programmatic video generation — HTML/CSS templates in *.media.ts rendered to MP4, images, GIFs, and SVGs.",
      skills: "./skills",
      interface: {
        displayName: "SuperImg",
        shortDescription: "HTML/CSS → MP4 video templates",
        longDescription:
          "SuperImg renders TypeScript media definitions into video files. This plugin carries the full authoring lifecycle: brief, design, build, motion craft, review, multi-format variants, ship.",
        developerName: "anaptfox",
        category: "developer-tools",
        capabilities: ["skills"],
        websiteUrl: "https://superimg.app",
        defaultPrompt: [
          "Create a SuperImg template that announces a launch",
          "Review my template before I ship it",
          "Export this video for YouTube and Instagram",
        ],
        brandColor: BRAND_COLOR,
        composerIcon: "./assets/icon.svg",
        logo: "./assets/logo.svg",
      },
    },
    null,
    2,
  )}\n`,
);

// Grok Bot (Cursor marketplace) — arrangements only. Not the video lifecycle pack.
for (const name of BOT_SKILLS) {
  const files = skillFiles.get(name);
  if (!files) throw new Error(`Grok Bot plugin missing skill: ${name}`);
  for (const [rel, content] of files) {
    emit(join(GROK_BOT, "skills", name, rel), content);
  }
  emit(join(GROK_BOT, "skills", name, "assets", "icon.svg"), iconSvg);
  emit(
    join(GROK_BOT, "skills", name, "agents", "openai.yaml"),
    out.get(join(SKILLS, name, "agents", "openai.yaml"))!,
  );
}
emit(join(GROK_BOT, "assets", "icon.svg"), iconSvg);
emit(join(GROK_BOT, "assets", "logo.svg"), logoSvg);
emit(
  join(GROK_BOT, "commands", "arrange.md"),
  [
    "---",
    "name: arrange",
    "description: Pick a perceptual arrangement that names the work it removes, or answer in text.",
    "---",
    "",
    "Name the reader's question and the work the picture would externalize.",
    "If you cannot, answer in text or a table.",
    "",
    "If you can, write the arrangement as JSON and use the door — you do not",
    "need to author a `*.media.ts` file:",
    "",
    "```bash",
    "superimg check spec.json                     # admission, no browser",
    "superimg export spec.json --for 1080x1080.png --json  # bytes on disk",
    "```",
    "",
    "Patterns: `point-with-context`, `registered-comparison`, `aligned-intervals`,",
    "`value-against-reference`, `mechanism-strip`.",
    "",
    "Always `--check` first. A refusal names the invariant that cannot hold —",
    "the pattern does not apply, so do not ship a generic card. Attach the",
    "reported artifact path. This plugin is knowledge; it does not dispatch.",
    "",
  ].join("\n"),
);
const grokBotManifest = {
  name: "superimg",
  version: VERSION,
  description:
    "Perceptual arrangements that externalize identifiable human work. Not a video template pack.",
  skills: "./skills",
  commands: "./commands",
  author: { name: "anaptfox", url: "https://github.com/anaptfox" },
  homepage: "https://superimg.app",
};
emit(join(GROK_BOT, "plugin.json"), `${JSON.stringify(grokBotManifest, null, 2)}\n`);
emit(
  join(GROK_BOT, ".cursor-plugin", "plugin.json"),
  `${JSON.stringify(
    {
      ...grokBotManifest,
      interface: {
        displayName: "SuperImg",
        shortDescription: "Arrangements that take work out of the reader's head",
        longDescription:
          "A library of perceptual arrangements for Grok Bot. Each pattern names the human work it removes and fails when its invariants cannot be met. The plugin is design knowledge, not a dispatcher. Grok Bot is a trusted native CLI caller on the Bot computer.",
        developerName: "anaptfox",
        category: "developer-tools",
        capabilities: ["skills"],
        websiteUrl: "https://superimg.app",
        defaultPrompt: [
          "Should this be a picture or a sentence?",
          "Draw how these services connect, with evidence on each edge",
          "Make a registered comparison that keeps the frame invariant",
          "Show whether these deploys overlap on one clock",
        ],
        brandColor: BRAND_COLOR,
        composerIcon: "./assets/icon.svg",
        logo: "./assets/logo.svg",
      },
    },
    null,
    2,
  )}\n`,
);

// ── Apply or check ─────────────────────────────────────────────────────────
const check = process.argv.includes("--check");
const stale: string[] = [];

for (const [path, content] of out) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === content) continue;
  if (check) {
    stale.push(`${current === null ? "missing" : "changed"}: ${relative(REPO, path)}`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

for (const root of managedRoots) {
  for (const abs of listFiles(root)) {
    if (out.has(abs)) continue;
    if (check) stale.push(`stale: ${relative(REPO, abs)}`);
    else rmSync(abs);
  }
}

if (check && stale.length > 0) {
  console.error(`agent-plugins drift (${stale.length} files) — run 'pnpm --filter @superimg/agent-plugins build':`);
  for (const s of stale.slice(0, 40)) console.error(`  ${s}`);
  process.exit(1);
}

console.log(
  check
    ? "agent-plugins: in sync"
    : `agent-plugins: generated ${out.size} files (v${VERSION}, ${skillNames.length} skills)`,
);
