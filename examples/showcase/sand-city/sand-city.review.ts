import type { ReviewPlan } from "@foxworth/superimg";
import { inspectCity } from "./city-particles";

/** Observable intentions for the film; pixel evidence still needs visual review. */
export default {
  schemaVersion: 1,
  beats: [
    { id: "assembly", label: "Grains acquire the city silhouette", at: "2s" },
    { id: "overview", label: "City mass and cyan route are recognizable", at: "4.4s", crop: { x: 350, y: 160, width: 650, height: 410 } },
    { id: "street", label: "The route leads the eye into the street", at: "8s" },
    { id: "turn-one", label: "First left turn agrees with the map", at: "9.4s", range: ["9s", "10s"] },
    { id: "turn-two", label: "Next right turn keeps the corridor continuous", at: "10.5s" },
    { id: "turn-three", label: "The far right turn preserves orientation", at: "12.6s" },
    { id: "turn-four", label: "Final left turn follows the cyan route", at: "14.9s", range: ["14.4s", "15.4s"] },
    { id: "destination", label: "Final approach and distance remain understandable", at: "16.4s" },
    { id: "arrival", label: "The HUD and map report arrival", at: "17s" },
    { id: "lift", label: "Architecture stays in view as the camera rises", at: "17.7s", range: ["17s", "19s"] },
    { id: "rooftops", label: "The pullback reveals the rooftops", at: "18s" },
    { id: "collapse", label: "Structure progressively returns to grains", at: "20.5s", range: ["19s", "22s"] },
    { id: "rest", label: "Settled grains remain related to the city", at: "23.5s" },
  ],
  observe(ctx) {
    const seconds = ctx.timelineSeconds;
    const observation = inspectCity({
      seconds, width: ctx.width, height: ctx.height,
      assembly: Math.max(0, Math.min(1, (seconds - .5) / 3)),
      collapse: Math.max(0, Math.min(1, (seconds - 19) / 3)),
    });
    return {
      camera: { ...observation.camera, eye: { ...observation.camera.eye }, target: { ...observation.camera.target } },
      grains: { ...observation.grains },
      navigation: { ...observation.navigation, position: { ...observation.navigation.position } },
      material: { ...observation.material },
    };
  },
  checks: [
    { id: "camera-finite", label: "Camera basis is finite", metric: "camera.finite", equals: true },
    { id: "camera-clear", label: "Camera stays in open streets", metric: "camera.insideBuilding", equals: false },
    { id: "stable-grains", label: "The seeded material population is stable", metric: "grains.total", equals: 22_300 },
    { id: "overview-mass", label: "City grains project in the overview", beat: "overview", metric: "grains.visibleBuilding", min: 1_000 },
    { id: "street-route", label: "Route geometry projects during street travel", beat: "street", metric: "grains.visibleRoute", min: 20 },
    { id: "turn-route", label: "Route geometry projects through the final turn", beat: "turn-four", metric: "grains.visibleRoute", min: 10 },
    { id: "first-left", label: "The first turn instruction is left", beat: "turn-one", metric: "navigation.nextTurn", equals: "left" },
    { id: "next-right", label: "The next turn instruction is right", beat: "turn-two", metric: "navigation.nextTurn", equals: "right" },
    { id: "far-right", label: "The far turn instruction is right", beat: "turn-three", metric: "navigation.nextTurn", equals: "right" },
    { id: "final-left", label: "The final turn instruction is left", beat: "turn-four", metric: "navigation.nextTurn", equals: "left" },
    { id: "arrival-hud", label: "Navigation reaches the destination", beat: "arrival", metric: "navigation.nextTurn", equals: "arrived" },
    { id: "lift-architecture", label: "The lift keeps architecture in view", beat: "lift", metric: "grains.visibleBuilding", min: 100 },
    { id: "roof-reveal", label: "The rising view reveals roof grains", beat: "rooftops", metric: "grains.visibleRoof", min: 100 },
    { id: "settled-material", label: "The settled material has lost building height", beat: "rest", metric: "grains.maximumHeight", max: 2 },
    { id: "finished-collapse", label: "Deconstruction completes before the rest", beat: "rest", metric: "material.collapse", equals: 1 },
  ],
} satisfies ReviewPlan;
