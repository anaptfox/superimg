import { compose, scene } from "superimg";
import hook from "./hook.media.js";
import chapter from "./chapter.media.js";
import outro from "./outro.media.js";

const BED = "../../_assets/lofi-bg.mp3";

/** Placeholder voice segments — swap for real VO files or TTS output later */
const CH1_VO = BED;

export default compose(
  [
    scene(hook, { id: "hook", duration: "6s", label: "Hook" }),
    scene(chapter, {
      id: "ch1",
      duration: "20s",
      label: "Chapter 1",
      audio: {
        id: "ch1-vo",
        label: "Chapter narration",
        src: CH1_VO,
        role: "voice",
        trim: { in: "0s", out: "4s" },
        volume: 0.9,
        fadeIn: "0.2s",
        fadeOut: "0.3s",
        transcript: [
          { text: "SuperImg", start: 0.0, end: 0.6 },
          { text: "layers", start: 0.65, end: 1.0 },
          { text: "HTML", start: 1.05, end: 1.35 },
          { text: "templates", start: 1.4, end: 1.9 },
          { text: "into", start: 1.95, end: 2.1 },
          { text: "multi-track", start: 2.15, end: 2.7 },
          { text: "audio", start: 2.75, end: 3.05 },
          { text: "timelines.", start: 3.1, end: 3.6 },
        ],
      },
    }),
    scene(outro, { id: "outro", duration: "4s", label: "Outro" }),
  ],
  {
    config: {
      width: 1920,
      height: 1080,
      fps: 30,
      audio: {
        clips: [
          {
            id: "bed",
            label: "Music bed",
            src: BED,
            role: "music",
            volume: 0.35,
            fadeIn: "0.5s",
            fadeOut: "1.5s",
            loop: true,
          },
        ],
        mix: { ducking: true, duckingLevel: 0.25 },
      },
    },
  },
);