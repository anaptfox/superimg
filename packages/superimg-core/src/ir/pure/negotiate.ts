//! Pure render-path negotiation (browser-safe, no I/O).
//! Fail-fast before capture when requirements exceed capabilities.

import type {
  MediaIR,
  NegotiateRenderPathResult,
  RenderOutputFormat,
  RenderPath,
  RenderRequirements,
  RuntimeCapabilities,
  RuntimeProfileName,
  TemplatePackage,
  UnsupportedRequirement,
} from "@superimg/types";

/** Built-in capability snapshots for the four runtime profiles. */
export function capabilitiesForProfile(
  profile: RuntimeProfileName,
  versions?: RuntimeCapabilities["versions"],
): RuntimeCapabilities {
  const ffmpegPresent = Boolean(versions?.ffmpeg);

  switch (profile) {
    case "browser":
      return {
        schemaVersion: 0,
        profile: "browser",
        rasterizers: ["dom"],
        encoders: ["mediabunny-browser"],
        decoders: ["browser"],
        stitchers: [],
        processExecution: false,
        filesystem: "none",
        ...(versions !== undefined ? { versions } : {}),
      };
    case "edge":
      return {
        schemaVersion: 0,
        profile: "edge",
        rasterizers: ["resvg"],
        encoders: [],
        decoders: [],
        stitchers: [],
        processExecution: false,
        filesystem: "none",
        ...(versions !== undefined ? { versions } : {}),
      };
    case "node":
      return {
        schemaVersion: 0,
        profile: "node",
        rasterizers: ["playwright", "resvg", "blitz"],
        encoders: ["mediabunny-node"],
        decoders: [],
        stitchers: ["mediabunny-node"],
        processExecution: true,
        filesystem: "temporary",
        versions: { ...versions, ffmpeg: versions?.ffmpeg ?? null },
      };
    case "node-media":
      return {
        schemaVersion: 0,
        profile: "node-media",
        rasterizers: ["playwright", "resvg", "blitz"],
        encoders: ffmpegPresent
          ? ["mediabunny-node", "ffmpeg"]
          : ["mediabunny-node"],
        decoders: ffmpegPresent ? ["ffmpeg"] : [],
        stitchers: ffmpegPresent
          ? ["mediabunny-node", "ffmpeg"]
          : ["mediabunny-node"],
        processExecution: true,
        filesystem: "temporary",
        ...(versions !== undefined ? { versions } : {}),
      };
  }
}

/**
 * Derive render requirements from Media IR (or a template package).
 * Unknown/opaque features are treated conservatively (e.g. HTML implies scripts).
 */
export function inspectRenderRequirements(
  media: MediaIR | TemplatePackage,
): RenderRequirements {
  const ir: MediaIR =
    "kind" in media && media.kind === "@foxworth/superimg/template-package"
      ? media.media
      : (media as MediaIR);

  const hasAudioTrack = ir.tracks.some((t) => t.kind === "audio");
  const hasVideoSync = ir.tracks.some((t) => t.kind === "video-sync");

  const outputs: RenderOutputFormat[] = [];
  if (ir.medium === "svg") {
    outputs.push("svg", "png");
  } else if (ir.animated) {
    outputs.push("mp4", "webm", "mov", "mkv", "png", "gif");
  } else {
    outputs.push("png", "html");
  }

  return {
    schemaVersion: 0,
    medium: ir.medium,
    outputs,
    animated: ir.animated,
    features: {
      scripts: ir.medium === "html",
      audio: hasAudioTrack,
      embeddedVideo: hasVideoSync,
      gif: ir.animated && ir.medium === "html",
      distributedStitching: false,
    },
  };
}

function push(
  list: UnsupportedRequirement[],
  code: UnsupportedRequirement["code"],
  message: string,
  detail?: string,
): void {
  list.push(detail ? { code, message, detail } : { code, message });
}

function requestedOutputs(
  requirements: RenderRequirements,
  requested?: RenderOutputFormat[],
): RenderOutputFormat[] {
  if (requested && requested.length > 0) return requested;
  return requirements.outputs;
}

/**
 * Negotiate a concrete render path, or return unsupported requirements.
 * Always fail closed before capture when a required capability is missing.
 */
export function negotiateRenderPath(
  requirements: RenderRequirements,
  capabilities: RuntimeCapabilities,
  options?: {
    preferredProfile?: RuntimeProfileName;
    requestedOutputs?: RenderOutputFormat[];
  },
): NegotiateRenderPathResult {
  const unsupported: UnsupportedRequirement[] = [];
  const outs = requestedOutputs(requirements, options?.requestedOutputs);
  const profile = options?.preferredProfile ?? capabilities.profile;

  if (options?.preferredProfile && options.preferredProfile !== capabilities.profile) {
    // Preferred profile must match the runtime's advertised profile for fail-fast clarity
    // unless the runtime is a superset (node-media satisfies node).
    const okSuperset =
      capabilities.profile === "node-media" && options.preferredProfile === "node";
    if (!okSuperset && options.preferredProfile !== capabilities.profile) {
      // Still attempt capability-based negotiation; profile mismatch noted if medium fails
    }
  }

  // Medium / rasterizer. An html still is content-dependent: resvg can paint
  // trees that do not need a browser, and the runtime rejects the rest.
  const contentDependentStill = requirements.medium === "html" && !requirements.animated;
  if (requirements.medium === "svg") {
    if (
      !capabilities.rasterizers.includes("resvg") &&
      !capabilities.rasterizers.includes("dom")
    ) {
      push(
        unsupported,
        "missing_rasterizer",
        "SVG rendering requires resvg or dom rasterizer",
      );
    }
  } else if (requirements.medium === "html") {
    if (capabilities.profile === "edge" && !contentDependentStill) {
      push(
        unsupported,
        "unsupported_medium",
        "HTML rendering is not supported on edge profile",
        "Use node or browser profile for HTML templates",
      );
    }
    if (contentDependentStill) {
      const hasStillRaster =
        capabilities.rasterizers.includes("resvg") ||
        capabilities.rasterizers.includes("playwright") ||
        capabilities.rasterizers.includes("dom");
      if (!hasStillRaster) {
        push(
          unsupported,
          "missing_rasterizer",
          "HTML stills need resvg or a browser rasterizer",
        );
      }
    } else {
      const hasHtmlRaster =
        capabilities.rasterizers.includes("playwright") ||
        capabilities.rasterizers.includes("dom");
      if (!hasHtmlRaster) {
        push(
          unsupported,
          "missing_rasterizer",
          "HTML rendering requires playwright or dom rasterizer",
        );
      }
    }
  }

  for (const format of outs) {
    if (format === "gif") {
      if (!capabilities.encoders.includes("ffmpeg")) {
        push(
          unsupported,
          "ffmpeg_required",
          "GIF encoding requires FFmpeg (node-media profile)",
          format,
        );
      }
    } else if (format === "mp4" || format === "webm" || format === "mov" || format === "mkv") {
      const hasEncoder =
        capabilities.encoders.includes("mediabunny-node") ||
        capabilities.encoders.includes("mediabunny-browser") ||
        capabilities.encoders.includes("ffmpeg");
      if (!hasEncoder) {
        push(
          unsupported,
          "missing_encoder",
          `No encoder available for ${format}`,
          format,
        );
      }
    }
  }

  if (requirements.features.embeddedVideo) {
    if (
      !capabilities.decoders.includes("ffmpeg") &&
      !capabilities.decoders.includes("browser")
    ) {
      push(
        unsupported,
        "missing_decoder",
        "Embedded video extraction requires FFmpeg or browser decoder",
      );
    }
  }

  if (requirements.features.gif && outs.includes("gif")) {
    if (!capabilities.encoders.includes("ffmpeg")) {
      push(
        unsupported,
        "ffmpeg_required",
        "GIF feature requires FFmpeg (node-media profile)",
      );
    }
  }

  if (requirements.features.distributedStitching) {
    if (
      !capabilities.stitchers.includes("ffmpeg") &&
      !capabilities.stitchers.includes("mediabunny-node")
    ) {
      push(
        unsupported,
        "missing_stitcher",
        "Distributed stitching requires ffmpeg or mediabunny-node stitcher",
      );
    }
  }

  if (requirements.features.audio && capabilities.profile === "edge") {
    push(
      unsupported,
      "audio_unsupported",
      "Audio mixing is not supported on edge profile",
    );
  }

  if (
    (options?.preferredProfile === "edge" || capabilities.profile === "edge") &&
    requirements.medium === "html" &&
    requirements.animated
  ) {
    if (!unsupported.some((u) => u.code === "unsupported_medium")) {
      push(
        unsupported,
        "profile_mismatch",
        "edge profile cannot render HTML templates",
      );
    }
  }

  if (unsupported.length > 0) {
    return { ok: false, unsupported };
  }

  return {
    ok: true,
    path: buildPath(profile, requirements, capabilities, outs),
  };
}

function buildPath(
  profile: RuntimeProfileName,
  requirements: RenderRequirements,
  capabilities: RuntimeCapabilities,
  outs: RenderOutputFormat[],
): RenderPath {
  let rasterizer: RenderPath["rasterizer"] = "playwright";
  if (
    requirements.medium === "svg" &&
    capabilities.rasterizers.includes("resvg")
  ) {
    rasterizer = "resvg";
  } else if (capabilities.rasterizers.includes("dom")) {
    rasterizer = "dom";
  } else if (capabilities.rasterizers.includes("playwright")) {
    rasterizer = "playwright";
  } else if (capabilities.rasterizers.includes("resvg")) {
    rasterizer = "resvg";
  }

  let encoder: RenderPath["encoder"];
  if (outs.includes("gif") && capabilities.encoders.includes("ffmpeg")) {
    encoder = "ffmpeg";
  } else if (capabilities.encoders.includes("mediabunny-node")) {
    encoder = "mediabunny-node";
  } else if (capabilities.encoders.includes("mediabunny-browser")) {
    encoder = "mediabunny-browser";
  } else if (capabilities.encoders.includes("ffmpeg")) {
    encoder = "ffmpeg";
  }

  const decoder = capabilities.decoders[0];
  const stitcher = capabilities.stitchers[0];

  const contentDependentStill = requirements.medium === "html" && !requirements.animated;
  const description = [
    profile,
    contentDependentStill ? "content-dependent" : rasterizer,
    encoder ?? "still",
    outs.join("+") || "default",
  ].join("/");

  return {
    schemaVersion: 0,
    profile,
    rasterizer,
    ...(encoder ? { encoder } : {}),
    ...(decoder ? { decoder } : {}),
    ...(stitcher ? { stitcher } : {}),
    ...(contentDependentStill ? { lane: "content-dependent" as const } : {}),
    description,
  };
}
