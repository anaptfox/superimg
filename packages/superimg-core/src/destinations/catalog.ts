import type { AudioCodecPreference, OutputFormat, VideoCodecPreference } from "@superimg/types";
import type {
  DestinationCanvas,
  DestinationClaim,
  DestinationDefinition,
  DestinationId,
  DestinationMedium,
  DestinationPlatform,
  DestinationProvenance,
} from "./types.js";
import { createDestinationRegistry } from "./registry.js";

const CHECKED_AT = "2026-08-09";

function platformRequirement<T>(value: T, provenanceId: string): DestinationClaim<T> {
  return { value, authority: "platform", status: "requirement", provenanceId };
}

function platformRecommendation<T>(value: T, provenanceId: string): DestinationClaim<T> {
  return { value, authority: "platform", status: "recommendation", provenanceId };
}

function superimgRecommendation<T>(value: T): DestinationClaim<T> {
  return { value, authority: "superimg", status: "recommendation" };
}

const defaultVideo = (overrides: Partial<{
  format: DestinationClaim<Extract<OutputFormat, "mp4" | "webm" | "mov" | "mkv">>;
  codec: DestinationClaim<VideoCodecPreference>;
  audioCodec: DestinationClaim<AudioCodecPreference>;
  fps: DestinationClaim<number>;
}> = {}) => ({
  format: superimgRecommendation<"mp4">("mp4"),
  codec: superimgRecommendation<"avc">("avc"),
  audioCodec: superimgRecommendation<"aac">("aac"),
  fps: superimgRecommendation(30),
  ...overrides,
});

const defaultImage = (format: "png" | "jpeg" | "webp" = "png") => ({
  format: superimgRecommendation(format),
});

function source(id: string, label: string, url: string): DestinationProvenance {
  return { id, label, url };
}

function destination(input: Omit<DestinationDefinition, "schemaVersion" | "surface" | "checkedAt">): DestinationDefinition {
  return {
    schemaVersion: 0,
    surface: "organic",
    checkedAt: CHECKED_AT,
    ...input,
  };
}

const catalog = [
  destination({
    id: "youtube",
    platform: "youtube",
    label: "YouTube video",
    supportedMedia: [platformRequirement<DestinationMedium>("video", "youtube-upload")],
    recommendedCanvas: platformRecommendation<DestinationCanvas>({ width: 1920, height: 1080 }, "youtube-upload"),
    encoding: {
      video: defaultVideo({
        format: platformRecommendation<"mp4">("mp4", "youtube-upload"),
        codec: platformRecommendation<"avc">("avc", "youtube-upload"),
        audioCodec: platformRecommendation<"aac">("aac", "youtube-upload"),
        fps: superimgRecommendation(30),
      }),
    },
    provenance: [source(
      "youtube-upload",
      "YouTube recommended upload encoding settings",
      "https://support.google.com/youtube/answer/1722171",
    )],
  }),
  destination({
    id: "instagram-square",
    platform: "instagram",
    label: "Instagram square feed",
    supportedMedia: [
      platformRequirement<DestinationMedium>("image", "instagram-publishing"),
      platformRequirement<DestinationMedium>("video", "instagram-publishing"),
    ],
    recommendedCanvas: superimgRecommendation<DestinationCanvas>({ width: 1080, height: 1080 }),
    encoding: { image: defaultImage(), video: defaultVideo() },
    provenance: [source(
      "instagram-publishing",
      "Instagram Platform content publishing",
      "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing",
    )],
  }),
  destination({
    id: "tiktok",
    platform: "tiktok",
    label: "TikTok post",
    supportedMedia: [
      platformRequirement<DestinationMedium>("image", "tiktok-posting"),
      platformRequirement<DestinationMedium>("video", "tiktok-posting"),
    ],
    recommendedCanvas: superimgRecommendation<DestinationCanvas>({ width: 1080, height: 1920 }),
    encoding: {
      image: defaultImage("jpeg"),
      video: defaultVideo({
        format: platformRecommendation<"mp4">("mp4", "tiktok-posting"),
        codec: platformRecommendation<"avc">("avc", "tiktok-posting"),
      }),
    },
    provenance: [source(
      "tiktok-posting",
      "TikTok Content Posting API media restrictions",
      "https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide",
    )],
  }),
  destination({
    id: "linkedin",
    platform: "linkedin",
    label: "LinkedIn video",
    supportedMedia: [platformRequirement<DestinationMedium>("video", "linkedin-video")],
    recommendedCanvas: superimgRecommendation<DestinationCanvas>({ width: 1920, height: 1080 }),
    encoding: { video: defaultVideo() },
    provenance: [source(
      "linkedin-video",
      "LinkedIn Page video specifications",
      "https://www.linkedin.com/help/linkedin/answer/a7174587",
    )],
  }),
  destination({
    id: "facebook",
    platform: "facebook",
    label: "Facebook post",
    supportedMedia: [
      platformRequirement<DestinationMedium>("image", "facebook-media"),
      platformRequirement<DestinationMedium>("video", "facebook-media"),
    ],
    recommendedCanvas: superimgRecommendation<DestinationCanvas>({ width: 1080, height: 1080 }),
    encoding: { image: defaultImage(), video: defaultVideo() },
    provenance: [source(
      "facebook-media",
      "Facebook Help Center photos and videos",
      "https://www.facebook.com/help/121317464722113",
    )],
  }),
  destination({
    id: "x",
    platform: "x",
    label: "X video",
    supportedMedia: [platformRequirement<DestinationMedium>("video", "x-media-studio")],
    recommendedCanvas: platformRecommendation<DestinationCanvas>({ width: 1280, height: 720 }, "x-media-studio"),
    encoding: {
      video: defaultVideo({
        format: superimgRecommendation<"mp4">("mp4"),
        codec: platformRequirement<"avc">("avc", "x-media-studio"),
      }),
    },
    provenance: [source(
      "x-media-studio",
      "X Media Studio Library specifications",
      "https://help.x.com/en/using-x/media-studio-faqs",
    )],
  }),
  destination({
    id: "pinterest",
    platform: "pinterest",
    label: "Pinterest Pin",
    supportedMedia: [
      platformRequirement<DestinationMedium>("image", "pinterest-pins"),
      platformRequirement<DestinationMedium>("video", "pinterest-pins"),
    ],
    recommendedCanvas: superimgRecommendation<DestinationCanvas>({ width: 1000, height: 1500 }),
    encoding: { image: defaultImage(), video: defaultVideo() },
    provenance: [source(
      "pinterest-pins",
      "Pinterest organic Pin specifications",
      "https://help.pinterest.com/en/article/review-pin-specs",
    )],
  }),
  destination({
    id: "threads",
    platform: "threads",
    label: "Threads post",
    supportedMedia: [
      platformRequirement<DestinationMedium>("image", "threads-publishing"),
      platformRequirement<DestinationMedium>("video", "threads-publishing"),
    ],
    recommendedCanvas: superimgRecommendation<DestinationCanvas>({ width: 1080, height: 1350 }),
    encoding: { image: defaultImage("jpeg"), video: defaultVideo() },
    provenance: [source(
      "threads-publishing",
      "Threads API post publishing",
      "https://developers.facebook.com/docs/threads/posts",
    )],
  }),
  destination({
    id: "reddit",
    platform: "reddit",
    label: "Reddit media post",
    supportedMedia: [
      platformRequirement<DestinationMedium>("image", "reddit-community-media"),
      platformRequirement<DestinationMedium>("video", "reddit-community-media"),
    ],
    recommendedCanvas: superimgRecommendation<DestinationCanvas>({ width: 1080, height: 1080 }),
    encoding: { image: defaultImage(), video: defaultVideo() },
    provenance: [source(
      "reddit-community-media",
      "Reddit community media post settings",
      "https://support.reddithelp.com/hc/en-us/articles/15484546290068-Community-settings",
    )],
  }),
] as const satisfies readonly DestinationDefinition[];

export const ORGANIC_DESTINATIONS: Readonly<Record<DestinationId, DestinationDefinition>> =
  createDestinationRegistry(catalog);

export const ORGANIC_DESTINATION_IDS = Object.freeze(catalog.map((entry) => entry.id)) as readonly DestinationId[];

export const ORGANIC_DESTINATION_PLATFORMS = Object.freeze(catalog.map((entry) => entry.platform)) as readonly DestinationPlatform[];

export function getDestination(id: string): DestinationDefinition | undefined {
  return ORGANIC_DESTINATIONS[id as DestinationId];
}
