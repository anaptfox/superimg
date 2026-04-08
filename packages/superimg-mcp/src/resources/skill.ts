//! MCP Resource: superimg://skill
//! Full skill guide from SKILL.md

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperimgMcpOptions } from "../server.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Paths to try for skills/superimg/SKILL.md */
const SKILL_PATHS = [
  join(__dirname, "..", "..", "skills", "superimg", "SKILL.md"),
  join(__dirname, "..", "..", "..", "skills", "superimg", "SKILL.md"),
  join(__dirname, "..", "..", "..", "..", "skills", "superimg", "SKILL.md"),
  join(__dirname, "..", "..", "..", "..", "..", "skills", "superimg", "SKILL.md"),
];

function loadSkillContent(customPath?: string): string {
  const paths = customPath ? [join(customPath, "SKILL.md"), ...SKILL_PATHS] : SKILL_PATHS;

  for (const p of paths) {
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf-8");
      // Strip YAML frontmatter
      return raw.replace(/^---\n[\s\S]*?\n---\n\n?/, "");
    }
  }

  return "# SuperImg Skill\n\nSkill content not found. Install the package or check skillsPath option.";
}

export function registerSkillResource(server: McpServer, options: SuperimgMcpOptions): void {
  server.registerResource(
    "skill",
    "superimg://skill",
    {
      description: "Complete SuperImg skill guide - mental model, patterns, cheat sheet",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [{
        uri: "superimg://skill",
        mimeType: "text/markdown",
        text: loadSkillContent(options.skillsPath),
      }],
    })
  );
}
