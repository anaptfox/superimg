// "The Persistence of Vision" — a five-scene documentary reel.
//
// The music bed and chapter voiceovers live on the timed composition, positioned
// with `atScene` so the bed ducks under each chapter. Chapters share one film
// stock via `./reel.ts`.
import { sequence, time } from "@foxworth/superimg";
import { SCRIPTS, voiceClip } from "./reel.js";
import hook from "./hook.media.js";
import zoetrope from "./zoetrope.media.js";
import muybridge from "./muybridge.media.js";
import fusion from "./fusion.media.js";
import outro from "./outro.media.js";

const BED = "../../_assets/lofi-bg.mp3";

const documentary = sequence([
  { id: "title", content: hook },
  { id: "zoetrope", content: zoetrope },
  { id: "muybridge", content: muybridge },
  { id: "fusion", content: fusion },
  { id: "colophon", content: outro },
]);

export default time(documentary, {
  size: { width: 1920, height: 1080 },
  fps: 30,
  audio: {
    clips: [
      {
        id: "bed",
        label: "Music bed",
        src: BED,
        role: "music",
        volume: 0.32,
        fadeIn: "1s",
        fadeOut: "2s",
        loop: true,
      },
      { ...voiceClip(SCRIPTS.ch1), atScene: "zoetrope" },
      { ...voiceClip(SCRIPTS.ch2), atScene: "muybridge" },
      { ...voiceClip(SCRIPTS.ch3), atScene: "fusion" },
    ],
    mix: { ducking: true, duckingLevel: 0.25 },
  },
});
