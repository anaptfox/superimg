import { describe, expect, it } from "vitest";
import {
  EXTERNAL_EMBED_ATTR,
  MEDIA_ATTR,
  extractYoutubeId,
  video,
  youtube,
} from "./media.js";
import { CLIP_SYNC_ATTR } from "./video.js";

function attr(html: string, name: string): string | undefined {
  return html.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

describe("std.media.video", () => {
  it("emits native video markup with deterministic clip markers", () => {
    const result = video(
      { src: "/clip.mp4", at: 1.5, start: 0.2, width: 640, height: 360, fit: "contain" },
      30,
    );

    expect(result.html).toContain("<video");
    expect(result.html).toContain(MEDIA_ATTR);
    expect(result.html).toContain(CLIP_SYNC_ATTR);
    expect(result.html).toContain('data-kind="video"');
    expect(result.html).toContain('data-src="/clip.mp4"');
    expect(result.html).toContain('src="/clip.mp4"');
    expect(result.style).toContain("width:640px");
    expect(result.style).toContain("height:360px");
    expect(result.style).toContain("object-fit:contain");
    expect(Number(attr(result.html, "data-t"))).toBeCloseTo(result.time, 10);
    expect(Number(attr(result.html, "data-frame"))).toBe(result.frameIndex);
  });

  it("escapes attribute values", () => {
    const result = video({ src: '/clip-"bad"&<.mp4', at: 0 }, 30);
    expect(result.html).toContain("/clip-&quot;bad&quot;&amp;&lt;.mp4");
  });
});

describe("std.media.youtube", () => {
  it("normalizes common YouTube URL forms", () => {
    expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("emits external embed markers without clip extraction markers", () => {
    const result = youtube(
      { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", at: 2.4, start: 60 },
      30,
    );

    expect(result.html).toContain("<iframe");
    expect(result.html).toContain(MEDIA_ATTR);
    expect(result.html).toContain(EXTERNAL_EMBED_ATTR);
    expect(result.html).toContain('data-provider="youtube"');
    expect(result.html).toContain('data-video-id="dQw4w9WgXcQ"');
    expect(result.html).not.toContain(CLIP_SYNC_ATTR);
    expect(result.embedUrl).toContain("youtube.com/embed/dQw4w9WgXcQ");
    expect(result.embedUrl).toContain("start=62");
    expect(Number(attr(result.html, "data-frame"))).toBe(result.frameIndex);
  });

  it("rejects invalid YouTube input", () => {
    expect(() => youtube({ url: "https://example.com/video" }, 30)).toThrow(/YouTube url or videoId/);
  });
});
