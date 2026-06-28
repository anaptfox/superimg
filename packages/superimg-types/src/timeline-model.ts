//! Read-model for timeline UI and editor consumers

import type { AudioRole } from "./audio.js";

export type TimelineTrackKind = "video" | "audio" | "overlay";

export interface TimelineItemBase {
  id: string;
  label?: string;
  startSeconds: number;
  endSeconds: number;
  showInTimeline: boolean;
}

export interface VideoTimelineItem extends TimelineItemBase {
  type: "scene";
  sceneId: string;
  sceneIndex: number;
}

export interface AudioTimelineItem extends TimelineItemBase {
  type: "audio";
  role: AudioRole;
  src: string;
  clipId: string;
  loop?: boolean;
  volume?: number;
}

export type TimelineItem = VideoTimelineItem | AudioTimelineItem;

export interface TimelineTrack {
  id: string;
  kind: TimelineTrackKind;
  label: string;
  items: TimelineItem[];
}

export interface TimelineModel {
  durationSeconds: number;
  fps: number;
  tracks: TimelineTrack[];
}