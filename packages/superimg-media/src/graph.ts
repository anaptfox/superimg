export type MediaNodeKind = "video" | "youtube" | "external";

export interface BaseMediaNode {
  id: string;
  kind: MediaNodeKind;
  tagName: string;
  src: string;
  time: number;
  frame: number;
  deterministic: boolean;
  attrs: Record<string, string>;
}

export interface VideoMediaNode extends BaseMediaNode {
  kind: "video";
  deterministic: true;
  playbackRate: number;
}

export interface ExternalEmbedNode extends BaseMediaNode {
  kind: "youtube" | "external";
  deterministic: false;
  provider: string;
  videoId?: string;
  poster?: string;
}

export type MediaGraphNode = VideoMediaNode | ExternalEmbedNode;

export interface MediaGraph {
  nodes: MediaGraphNode[];
  deterministicClips: VideoMediaNode[];
  externalEmbeds: ExternalEmbedNode[];
}

const MEDIA_TAG_RE = /<([a-z0-9-]+)\b(?=[^>]*\bdata-superimg-media\b)([^>]*)>(?:<\/\1>)?/gi;
const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function buildMediaGraph(html: string): MediaGraph {
  const nodes: MediaGraphNode[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = MEDIA_TAG_RE.exec(html)) !== null) {
    const tagName = (match[1] ?? "").toLowerCase();
    const attrs = parseAttrs(match[2] ?? "");
    const kind = attrs["data-kind"] ?? inferKind(tagName, attrs);
    const src = attrs["data-src"] ?? attrs.src ?? "";
    const time = numberAttr(attrs["data-t"]);
    const frame = numberAttr(attrs["data-frame"]);
    const id = attrs["data-media-id"] ?? `${kind}:${index++}`;

    if (kind === "video") {
      nodes.push({
        id,
        kind: "video",
        tagName,
        src,
        time,
        frame,
        deterministic: true,
        playbackRate: numberAttr(attrs["data-playback-rate"], 1),
        attrs,
      });
      continue;
    }

    if (attrs["data-superimg-external-embed"] !== undefined || kind === "youtube") {
      const node: ExternalEmbedNode = {
        id,
        kind: kind === "youtube" ? "youtube" : "external",
        tagName,
        src,
        time,
        frame,
        deterministic: false,
        provider: attrs["data-provider"] ?? kind,
        attrs,
      };
      if (attrs["data-video-id"]) node.videoId = attrs["data-video-id"];
      if (attrs["data-poster"]) node.poster = attrs["data-poster"];
      nodes.push(node);
    }
  }

  return {
    nodes,
    deterministicClips: nodes.filter((node): node is VideoMediaNode => node.kind === "video"),
    externalEmbeds: nodes.filter((node): node is ExternalEmbedNode => !node.deterministic),
  };
}

function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(input)) !== null) {
    const name = match[1];
    if (!name) continue;
    attrs[name] = decodeAttr(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function inferKind(tagName: string, attrs: Record<string, string>): MediaNodeKind {
  if (attrs["data-superimg-external-embed"] !== undefined) return "external";
  if (tagName === "video") return "video";
  return "external";
}

function numberAttr(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
