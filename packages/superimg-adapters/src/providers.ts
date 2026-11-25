//! Provider-neutral OCI deploy plan generation.
//! No Cloudflare/Wrangler/Fly resource provisioning — image + runtime-manifest only.
//! @experimental Draft

import type { DeployRuntimeProfile } from "@superimg/types";

export interface OciRuntimeManifest {
  schemaVersion: 0;
  kind: "@foxworth/superimg/oci-runtime";
  profile: DeployRuntimeProfile;
  image: string;
  tag: string;
  capabilities: {
    ffmpeg: boolean;
    playwright: boolean;
    resvg: boolean;
  };
  /** Synchronous /render admission controls. */
  concurrency: number;
  maxQueue: number;
  labels: Record<string, string>;
}

export interface DeployArtifactFile {
  path: string;
  contents: string;
}

export interface DeployPlan {
  profile: DeployRuntimeProfile;
  image: string;
  tag: string;
  files: DeployArtifactFile[];
  notes: string[];
}

export interface PlanDeployOptions {
  profile?: DeployRuntimeProfile;
  imageName: string;
  tag?: string;
  nodeVersion: string;
  playwrightVersion: string;
  withFfmpeg?: boolean;
  concurrency?: number;
  maxQueue?: number;
  labels?: Record<string, string>;
}

/**
 * Build a provider-neutral OCI deploy plan (Dockerfile + runtime-manifest + README).
 * `superimg deploy` also emits content-addressed packages next to the image
 * context so a Boundary host can deploy them into its own PackageStore. The
 * synchronous image itself consumes only package.json, dist/, and the runtime
 * manifest.
 */
export function planDeploy(options: PlanDeployOptions): DeployPlan {
  const profile =
    options.profile ?? (options.withFfmpeg ? "node-media" : "node");
  const tag = options.tag ?? "latest";
  const imageName = options.imageName.replace(/[^a-zA-Z0-9._/-]/g, "-");
  const withFfmpeg = options.withFfmpeg ?? profile === "node-media";
  const concurrency = options.concurrency ?? 1;
  const maxQueue = options.maxQueue ?? 8;

  const runtime: OciRuntimeManifest = {
    schemaVersion: 0,
    kind: "@foxworth/superimg/oci-runtime",
    profile,
    image: imageName,
    tag,
    capabilities: {
      ffmpeg: withFfmpeg,
      playwright: profile === "node" || profile === "node-media",
      resvg: true,
    },
    concurrency,
    maxQueue,
    labels: {
      "org.superimg.profile": profile,
      ...options.labels,
    },
  };

  const { nodeVersion, playwrightVersion } = options;
  for (const [name, version] of Object.entries({ nodeVersion, playwrightVersion })) {
    if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) {
      throw new Error(`OCI deploy requires an exact ${name}`);
    }
  }
  const image = `${imageName}:${tag}`;

  return {
    profile,
    image: imageName,
    tag,
    files: [
      {
        path: "Dockerfile",
        contents: dockerfileForProfile(profile, nodeVersion, playwrightVersion),
      },
      {
        path: "runtime-manifest.json",
        contents: `${JSON.stringify(runtime, null, 2)}\n`,
      },
      {
        path: ".dockerignore",
        contents: ["node_modules", "**/.git", "**/*.map", "README.deploy.md"].join(
          "\n",
        ) + "\n",
      },
      {
        path: "README.deploy.md",
        contents:
          `# SuperImg OCI deploy\n\n` +
          `Profile: **${profile}** (ffmpeg=${withFfmpeg})\n\n` +
          `Build context (from \`superimg deploy\`):\n` +
          `- \`package.json\` + \`dist/\` — container runtime (assembled)\n` +
          `- \`packages/\` — host-deployable package artifacts (not an HTTP job queue)\n` +
          `- \`runtime-manifest.json\` — profile / capabilities\n\n` +
          `\`\`\`bash\n` +
          `docker build -t ${image} .\n` +
          `docker push ${image}   # optional --push\n` +
          `docker run --rm -p 8080:8080 ${image}\n` +
          `\`\`\`\n\n` +
          `This image exposes only synchronous /render. Durable package rendering is mounted by a host through the Boundary Render Program; there is no /jobs API.\n` +
          `Provider platforms consume this image + runtime-manifest.json.\n` +
          `The core CLI does not create Cloudflare, Fly, Railway, or other provider resources.\n`,
      },
    ],
    notes: [
      `Provider-neutral OCI image ${image}`,
      `Profile ${profile}; synchronous concurrency=${concurrency}; maxQueue=${maxQueue}`,
      "Runtime: package.json + dist/container.js installed via npm in the image",
      "Durable package execution requires a host-mounted Boundary Render Program",
      "Push with --push; wire any OCI-capable platform yourself",
    ],
  };
}

function dockerfileForProfile(
  profile: DeployRuntimeProfile,
  nodeVersion: string,
  playwrightVersion: string,
): string {
  const ffmpegLine =
    profile === "node-media"
      ? "RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 make g++ \\\n    && rm -rf /var/lib/apt/lists/*"
      : "RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \\\n    && rm -rf /var/lib/apt/lists/*\n# FFmpeg omitted (node/edge profile) — use --profile node-media for GIF / embedded video";

  return `# syntax=docker/dockerfile:1
# SuperImg OCI render image — profile=${profile}
# Build context: assembled by \`superimg deploy\` (package.json, dist/, runtime-manifest.json)
FROM node:${nodeVersion}-bookworm-slim AS node-runtime

FROM mcr.microsoft.com/playwright:v${playwrightVersion}-jammy

COPY --from=node-runtime /usr/local/ /usr/local/
RUN node --version | grep -Fqx 'v${nodeVersion}'

WORKDIR /app

${ffmpegLine}

# Use browsers shipped with this Playwright base image (not a host-mounted cache).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Production Node deps for the synchronous container entry (Linux-native sharp / oxc).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Assembled synchronous container runtime
COPY dist ./dist
COPY runtime-manifest.json ./runtime-manifest.json
# Sync template manifest for /render.
RUN echo '{}' > /app/manifest.json

ENV PORT=8080 \\
  HOST=0.0.0.0 \\
  SUPERIMG_PROFILE=${profile} \\
  SUPERIMG_MANIFEST_PATH=/app/manifest.json \\
  NODE_ENV=production

EXPOSE 8080
# Real entry: assembled CLI container bundle (not a monorepo path).
CMD ["node", "dist/container.js"]
`;
}

/** Apply a deploy plan to a virtual file map (for tests / dry-run writers). */
export function materializeDeployPlan(
  plan: DeployPlan,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of plan.files) {
    out[file.path] = file.contents;
  }
  return out;
}
