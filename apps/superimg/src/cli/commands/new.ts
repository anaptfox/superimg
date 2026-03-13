//! New command - scaffold a new video inside an existing SuperImg project

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { findProjectRoot } from "../utils/find-project-root.js";

// ── Template strings ──

function singleSceneTS(name: string, tailwind: boolean): string {
  if (tailwind) {
    return `import { defineScene } from "superimg";

export default defineScene({
  defaults: {
    title: "${titleCase(name)}",
    subtitle: "Built with SuperImg",
  },

  config: {
    durationSeconds: 5,
    tailwind: true,
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, data } = ctx;

    const enterProgress = std.math.clamp(time / 1.0, 0, 1);
    const opacity = std.tween(0, 1, enterProgress, "easeOutCubic");
    const scale = std.tween(0.9, 1, enterProgress, "easeOutCubic");
    const subtitleOpacity = std.tween(0, 0.7, std.math.clamp((time - 0.3) / 1.0, 0, 1), "easeOutCubic");

    return \`
      <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <h1 class="text-8xl font-bold text-white tracking-tight" style="\${std.css({ opacity, transform: \`scale(\${scale})\` })}">
          \${data.title}
        </h1>
        <p class="mt-6 text-2xl text-white/70 font-medium" style="opacity: \${subtitleOpacity}">
          \${data.subtitle}
        </p>
      </div>
    \`;
  },
});
`;
  }

  return `import { defineScene } from "superimg";

export default defineScene({
  defaults: {
    title: "${titleCase(name)}",
    subtitle: "Built with SuperImg",
  },

  config: {
    durationSeconds: 5,
    fonts: ["Inter:wght@400;700"],
    inlineCss: [\`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f0f23; font-family: 'Inter', sans-serif; overflow: hidden; }
      .title { font-size: 88px; font-weight: 700; color: #667eea; }
      .subtitle { font-size: 28px; color: white; opacity: 0.7; margin-top: 16px; }
    \`],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;

    const enterProgress = std.math.clamp(time / 1.0, 0, 1);
    const opacity = std.tween(0, 1, enterProgress, "easeOutCubic");
    const y = std.tween(30, 0, enterProgress, "easeOutCubic");
    const subtitleOpacity = std.tween(0, 0.7, std.math.clamp((time - 0.3) / 1.0, 0, 1), "easeOutCubic");

    return \`
      <div style="\${std.css({ width, height })};\${std.css.center()}; flex-direction: column;">
        <h1 class="title" style="\${std.css({ opacity, transform: "translateY(" + y + "px)" })}">
          \${data.title}
        </h1>
        <p class="subtitle" style="opacity: \${subtitleOpacity}; transform: translateY(\${y}px);">
          \${data.subtitle}
        </p>
      </div>
    \`;
  },
});
`;
}

function singleSceneJS(name: string, tailwind: boolean): string {
  // Same as TS but without type annotations (templates have none anyway)
  return singleSceneTS(name, tailwind);
}

// ── Compose templates ──

function composeEntryTS(name: string, ext: string): string {
  return `import { compose } from "superimg";
import intro from "./intro.video.${ext}";
import content from "./content.video.${ext}";
import outro from "./outro.video.${ext}";

export default compose([intro, content, outro]);
`;
}

function composeIntroTS(tailwind: boolean): string {
  if (tailwind) {
    return `import { defineScene } from "superimg";

export default defineScene({
  config: { duration: "2s", tailwind: true },
  defaults: { title: "Welcome" },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress, "easeOutCubic");
    const scale = ctx.std.tween(0.8, 1, ctx.sceneProgress, "easeOutCubic");
    return \`
      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
        <h1 class="text-9xl font-black text-white tracking-tight drop-shadow-2xl"
            style="\${ctx.std.css({ opacity, transform: \`scale(\${scale})\` })}">
          \${ctx.data.title}
        </h1>
      </div>
    \`;
  },
});
`;
  }

  return `import { defineScene } from "superimg";

export default defineScene({
  config: {
    duration: "2s",
    fonts: ["Inter:wght@400;700"],
    inlineCss: [\`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: white; overflow: hidden; }
      .title { font-size: 96px; font-weight: 700; text-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    \`],
  },
  defaults: { title: "Welcome" },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress, "easeOutCubic");
    const scale = ctx.std.tween(0.8, 1, ctx.sceneProgress, "easeOutCubic");
    return \`
      <div style="\${ctx.std.css.fill()};\${ctx.std.css.center()};
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h1 class="title" style="\${ctx.std.css({ opacity, transform: "scale(" + scale + ")" })}">
          \${ctx.data.title}
        </h1>
      </div>
    \`;
  },
});
`;
}

function composeContentTS(tailwind: boolean): string {
  if (tailwind) {
    return `import { defineScene } from "superimg";

export default defineScene({
  config: { duration: "3s", tailwind: true },
  defaults: {
    heading: "Main Content",
    body: "Add your content here.",
  },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress * 2, "easeOutCubic");
    return \`
      <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <h2 class="text-6xl font-bold text-white mb-6" style="opacity: \${opacity}">
          \${ctx.data.heading}
        </h2>
        <p class="text-2xl text-white/70" style="opacity: \${opacity}">
          \${ctx.data.body}
        </p>
      </div>
    \`;
  },
});
`;
  }

  return `import { defineScene } from "superimg";

export default defineScene({
  config: {
    duration: "3s",
    fonts: ["Inter:wght@400;700"],
    inlineCss: [\`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: white; overflow: hidden; }
      .heading { font-size: 64px; font-weight: 700; margin-bottom: 16px; }
      .body { font-size: 28px; opacity: 0.7; }
    \`],
  },
  defaults: {
    heading: "Main Content",
    body: "Add your content here.",
  },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress * 2, "easeOutCubic");
    return \`
      <div style="\${ctx.std.css.fill()};\${ctx.std.css.center()}; flex-direction: column;
        background: #0f0f23;">
        <h2 class="heading" style="opacity: \${opacity}">\${ctx.data.heading}</h2>
        <p class="body" style="opacity: \${opacity}">\${ctx.data.body}</p>
      </div>
    \`;
  },
});
`;
}

function composeOutroTS(tailwind: boolean): string {
  if (tailwind) {
    return `import { defineScene } from "superimg";

export default defineScene({
  config: { duration: "2s", tailwind: true },
  defaults: { cta: "Thanks for watching!" },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress * 2, "easeOutCubic");
    return \`
      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-cyan-600">
        <h1 class="text-7xl font-bold text-white" style="opacity: \${opacity}">
          \${ctx.data.cta}
        </h1>
      </div>
    \`;
  },
});
`;
  }

  return `import { defineScene } from "superimg";

export default defineScene({
  config: {
    duration: "2s",
    fonts: ["Inter:wght@400;700"],
    inlineCss: [\`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: white; overflow: hidden; }
      .cta { font-size: 64px; font-weight: 700; }
    \`],
  },
  defaults: { cta: "Thanks for watching!" },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress * 2, "easeOutCubic");
    return \`
      <div style="\${ctx.std.css.fill()};\${ctx.std.css.center()};
        background: linear-gradient(135deg, #059669 0%, #0891b2 100%);">
        <h1 class="cta" style="opacity: \${opacity}">\${ctx.data.cta}</h1>
      </div>
    \`;
  },
});
`;
}

function configTS(tailwind: boolean, isCompose: boolean): string {
  const duration = isCompose ? 7 : 5;
  const comment = isCompose ? " // intro 2s + content 3s + outro 2s" : "";
  const tailwindLine = tailwind ? "\n  tailwind: true," : "";

  return `import { defineConfig } from "superimg";

export default defineConfig({
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: ${duration},${comment}${tailwindLine}
});
`;
}

// ── Helpers ──

function titleCase(kebab: string): string {
  return kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Command ──

export async function newCommand(
  name: string | undefined,
  options: { yes?: boolean; js?: boolean; compose?: boolean; tailwind?: boolean }
) {
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch (err) {
    console.error(`\n  Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error("  Run this inside a SuperImg project, or use 'superimg init' first.\n");
    process.exit(1);
  }

  let videoName: string;
  let isCompose: boolean;
  let useTailwind: boolean;
  let useJs: boolean;

  if (options.yes) {
    // Non-interactive: use args + defaults
    if (!name?.trim()) {
      console.error("\n  Error: Video name is required with -y flag.");
      console.error("  Usage: superimg new <name> -y\n");
      process.exit(1);
    }
    videoName = toKebabCase(name);
    isCompose = options.compose ?? false;
    useTailwind = options.tailwind ?? false;
    useJs = options.js ?? !existsSync(join(projectRoot, "tsconfig.json"));
  } else {
    // Interactive mode
    p.intro("SuperImg — New Video");

    // 1. Video name
    if (name?.trim()) {
      videoName = toKebabCase(name);
    } else {
      const nameResult = await p.text({
        message: "Video name?",
        placeholder: "my-promo",
        validate(value: string | undefined) {
          const kebab = toKebabCase(value ?? "");
          if (!kebab) return "Name cannot be empty";
          if (kebab.length < 2) return "Name must be at least 2 characters";
          return undefined;
        },
      });
      if (p.isCancel(nameResult)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      videoName = toKebabCase(nameResult as string);
    }

    // 2. Video type
    if (options.compose != null) {
      isCompose = options.compose;
    } else {
      const typeResult = await p.select({
        message: "What kind of video?",
        options: [
          { value: "single", label: "Single scene", hint: "one defineScene file" },
          { value: "compose", label: "Composition", hint: "intro + content + outro with compose()" },
        ],
        initialValue: "single",
      });
      if (p.isCancel(typeResult)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      isCompose = typeResult === "compose";
    }

    // 3. Tailwind
    if (options.tailwind != null) {
      useTailwind = options.tailwind;
    } else {
      const tailwindResult = await p.confirm({
        message: "Enable Tailwind CSS?",
        initialValue: false,
      });
      if (p.isCancel(tailwindResult)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      useTailwind = tailwindResult;
    }

    // 4. Language (auto-detect default from tsconfig)
    if (options.js != null) {
      useJs = options.js;
    } else {
      const hasTs = existsSync(join(projectRoot, "tsconfig.json"));
      const langResult = await p.select({
        message: "TypeScript or JavaScript?",
        options: [
          { value: "ts", label: "TypeScript" },
          { value: "js", label: "JavaScript" },
        ],
        initialValue: hasTs ? "ts" : "js",
      });
      if (p.isCancel(langResult)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      useJs = langResult === "js";
    }
  }

  const ext = useJs ? "js" : "ts";
  const videoDir = join(projectRoot, "videos", videoName);

  // Check for existing video
  if (existsSync(videoDir)) {
    const mainFile = join(videoDir, `${videoName}.video.${ext}`);
    if (existsSync(mainFile)) {
      console.error(`\n  Error: videos/${videoName}/${videoName}.video.${ext} already exists.`);
      console.error("  Delete it first, or choose a different name.\n");
      process.exit(1);
    }
  }

  // Create directory
  mkdirSync(videoDir, { recursive: true });

  // Generate files
  const createdFiles: string[] = [];

  if (isCompose) {
    // Compose entry
    writeFileSync(join(videoDir, `${videoName}.video.${ext}`), composeEntryTS(videoName, ext));
    createdFiles.push(`videos/${videoName}/${videoName}.video.${ext}`);

    // Scene files
    writeFileSync(join(videoDir, `intro.video.${ext}`), composeIntroTS(useTailwind));
    createdFiles.push(`videos/${videoName}/intro.video.${ext}`);

    writeFileSync(join(videoDir, `content.video.${ext}`), composeContentTS(useTailwind));
    createdFiles.push(`videos/${videoName}/content.video.${ext}`);

    writeFileSync(join(videoDir, `outro.video.${ext}`), composeOutroTS(useTailwind));
    createdFiles.push(`videos/${videoName}/outro.video.${ext}`);
  } else {
    // Single scene
    const template = useJs ? singleSceneJS(videoName, useTailwind) : singleSceneTS(videoName, useTailwind);
    writeFileSync(join(videoDir, `${videoName}.video.${ext}`), template);
    createdFiles.push(`videos/${videoName}/${videoName}.video.${ext}`);
  }

  // Config file (always TS — defineConfig needs types)
  writeFileSync(join(videoDir, "_config.ts"), configTS(useTailwind, isCompose));
  createdFiles.push(`videos/${videoName}/_config.ts`);

  // Output summary
  if (!options.yes) {
    p.log.step(`Created ${createdFiles.length} files:`);
    for (const f of createdFiles) {
      p.log.message(f);
    }
    p.outro(`Run "superimg dev ${videoName}" to preview`);
  } else {
    console.log(`\n  Created ${createdFiles.length} files:`);
    for (const f of createdFiles) {
      console.log(`  ${f}`);
    }
    console.log(`\n  Run "superimg dev ${videoName}" to preview\n`);
  }
}
