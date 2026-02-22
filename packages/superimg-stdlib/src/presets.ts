/**
 * Platform presets for common social media dimensions
 *
 * Mirrors the Rust crates/superimg-core/src/presets/platforms.json
 * for use in browser/JS contexts.
 */

export interface Preset {
  width: number;
  height: number;
  aspect_ratio?: string;
  fps?: number;
  duration_max_seconds?: number;
  notes?: string;
}

export interface PlatformPresets {
  images?: Record<string, Preset>;
  video?: Record<string, Preset>;
}

export const platforms: Record<string, PlatformPresets> = {
  instagram: {
    images: {
      post: {
        width: 1080,
        height: 1080,
        aspect_ratio: "1:1",
        notes:
          "Feed shows vertical in grid; IG resizes >1080px down; keep between 320–1080px width",
      },
      story: { width: 1080, height: 1920, aspect_ratio: "9:16" },
      profile: { width: 320, height: 320, aspect_ratio: "1:1" },
    },
    video: {
      reel: {
        width: 1080,
        height: 1920,
        aspect_ratio: "9:16",
        duration_max_seconds: 60,
      },
      feed: {
        width: 1080,
        height: 1080,
        aspect_ratio: "1:1",
        notes: "Also supports 1.91:1 and 4:5",
      },
    },
  },
  facebook: {
    images: {
      feed: {
        width: 1080,
        height: 1080,
        aspect_ratio: "1:1",
        notes: "Also supports 4:5 and 16:9",
      },
      story: { width: 1440, height: 2560, aspect_ratio: "9:16" },
      event_cover: { width: 1920, height: 1005, aspect_ratio: "16:9" },
    },
    video: {
      feed: {
        width: 1280,
        height: 720,
        aspect_ratio: "16:9",
        notes: "Also supports 9:16",
      },
    },
  },
  x_twitter: {
    images: {
      post: { width: 1200, height: 675, aspect_ratio: "16:9" },
      card: {
        width: 800,
        height: 418,
        aspect_ratio: "1.91:1",
        notes: "Animated Twitter card - optimized for GIF",
      },
      profile: { width: 400, height: 400, aspect_ratio: "1:1" },
    },
    video: {
      post: {
        width: 1280,
        height: 720,
        aspect_ratio: "16:9",
        duration_max_seconds: 140,
        notes: "Max 512MB file size",
      },
    },
  },
  linkedin: {
    images: {
      post: { width: 1200, height: 627, aspect_ratio: "1.91:1" },
    },
    video: {
      post: {
        width: 1920,
        height: 1080,
        aspect_ratio: "16:9",
        duration_max_seconds: 600,
      },
      square: { width: 1920, height: 1920, aspect_ratio: "1:1" },
      vertical: { width: 1080, height: 1920, aspect_ratio: "9:16" },
    },
  },
  youtube: {
    images: {
      thumbnail: {
        width: 1280,
        height: 720,
        aspect_ratio: "16:9",
        notes: "Max 2MB file size",
      },
      channel_banner: { width: 2560, height: 1440, aspect_ratio: "16:9" },
    },
    video: {
      long: { width: 1920, height: 1080, aspect_ratio: "16:9" },
      short: {
        width: 1080,
        height: 1920,
        aspect_ratio: "9:16",
        duration_max_seconds: 60,
      },
    },
  },
  tiktok: {
    images: {
      ad: { width: 720, height: 1280, aspect_ratio: "9:16" },
    },
    video: {
      post: {
        width: 1080,
        height: 1920,
        aspect_ratio: "9:16",
        duration_max_seconds: 600,
        notes: "Max 500MB file size",
      },
    },
  },
  pinterest: {
    images: {
      standard: { width: 1000, height: 1500, aspect_ratio: "2:3" },
      square: { width: 1000, height: 1000, aspect_ratio: "1:1" },
    },
    video: {
      idea_pin: { width: 1080, height: 1920, aspect_ratio: "9:16" },
    },
  },
  snapchat: {
    images: {
      ad: { width: 720, height: 1280, aspect_ratio: "9:16" },
    },
    video: {
      ad: {
        width: 720,
        height: 1280,
        aspect_ratio: "9:16",
        duration_max_seconds: 180,
      },
    },
  },
  threads: {
    images: {
      post: { width: 1080, height: 1920, aspect_ratio: "9:16" },
      profile: { width: 320, height: 320, aspect_ratio: "1:1" },
    },
    video: {
      post: { width: 1080, height: 1920, aspect_ratio: "9:16" },
    },
  },
  reddit: {
    images: {
      post: {
        width: 1200,
        height: 628,
        aspect_ratio: "1.91:1",
        notes: "Max 3MB file size",
      },
    },
    video: {
      post: {
        width: 1280,
        height: 720,
        aspect_ratio: "16:9",
        fps: 30,
        notes: "Also supports 1:1, 4:5, 4:3, 1.9:1",
      },
    },
  },
};

/**
 * Get a preset by dot-notation path (e.g., "instagram.video.reel")
 */
export function getPreset(path: string): Preset | undefined {
  const [platform, category, name] = path.split(".");
  const p = platforms[platform];
  if (!p) return undefined;

  const cat = category as keyof PlatformPresets;
  const presets = p[cat];
  if (!presets) return undefined;

  return presets[name];
}

/**
 * Get a flat list of all presets with their full paths
 */
export function listPresets(): Array<{ path: string; preset: Preset }> {
  const result: Array<{ path: string; preset: Preset }> = [];

  for (const [platform, categories] of Object.entries(platforms)) {
    for (const [category, presets] of Object.entries(categories)) {
      for (const [name, preset] of Object.entries(presets as Record<string, Preset>)) {
        result.push({
          path: `${platform}.${category}.${name}`,
          preset,
        });
      }
    }
  }

  return result;
}

/**
 * Get video presets only (most useful for the editor)
 */
export function listVideoPresets(): Array<{ path: string; preset: Preset }> {
  const result: Array<{ path: string; preset: Preset }> = [];

  for (const [platform, categories] of Object.entries(platforms)) {
    if (!categories.video) continue;
    for (const [name, preset] of Object.entries(categories.video)) {
      result.push({
        path: `${platform}.video.${name}`,
        preset,
      });
    }
  }

  return result;
}

/**
 * Format preset path as display label (e.g., "Instagram Reel")
 */
export function formatPresetLabel(path: string): string {
  const [platform, , name] = path.split(".");
  const platformName = platform.replace("_", "/");
  const displayName = name.replace(/_/g, " ");
  return `${capitalize(platformName)} ${capitalize(displayName)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
