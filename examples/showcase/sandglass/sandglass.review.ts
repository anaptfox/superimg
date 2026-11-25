import type { ReviewPlan } from "@foxworth/superimg";
import { INITIAL_SANDGLASS, sampleFilmClock, sampleSandglass, observeSandglass } from "./model";

/** Numeric probes establish model facts; captured film establishes readability. */
export default {
  schemaVersion: 1,
  beats: [
    { id: "supply", label: "Both systems exist before the first arrival", at: "1s" },
    { id: "first-service", label: "One cluster occupies one worker channel", at: "5s", range: ["5s", "7s"], crop: { x: 1650, y: 800, width: 540, height: 600 } },
    { id: "forming-queue", label: "Waiting accumulates in the slower vessel", at: "11s" },
    { id: "twelve", label: "Compare both systems at twelve simulated seconds", at: "16s", range: ["14s", "16s"] },
    { id: "selected", label: "Request seventeen has served after eight seconds waiting", at: "22s" },
    { id: "twenty-four", label: "All forty-eight requests have arrived", at: "26s" },
    { id: "fast-finish", label: "The faster vessel finishes and remains settled", at: "27.64s", range: ["27s", "29s"] },
    { id: "draining", label: "The slower queue drains after arrivals stop", at: "31s" },
    { id: "finish", label: "Both systems conserve forty-eight completed clusters", at: "35s", range: ["34s", "36s"] },
    { id: "completed-macro", label: "Completed clusters retain their rigid micrograins", at: "36s", crop: { x: 1300, y: 830, width: 1240, height: 700 } },
    { id: "rest", label: "The completed pair holds for reading", at: "39s" },
  ],
  observe(ctx) {
    return observeSandglass(sampleSandglass({ ...INITIAL_SANDGLASS }, sampleFilmClock(ctx.timelineSeconds)));
  },
  checks: [
    { id: "valid", label: "No duplication, premature states, or future wait color", metric: "valid", equals: true },
    { id: "population", label: "All logical grains remain present", metric: "logicalGrains", equals: 1152 },
    { id: "drawn-population", label: "Reduced never thins request clusters", metric: "drawnGrains", equals: 1152 },
    { id: "paired", label: "Both vessels are present", metric: "systems", equals: 2 },
    { id: "unarrived", label: "Supply starts outside the waiting chamber", beat: "supply", metric: "primary.supply", equals: 48 },
    { id: "slow-twelve-done", label: "Ten slow requests have finished at t12", beat: "twelve", metric: "primary.completed", equals: 10 },
    { id: "slow-twelve-wait", label: "Twelve slow requests wait at t12", beat: "twelve", metric: "primary.waiting", equals: 12 },
    { id: "fast-twelve-done", label: "Twenty fast requests have finished at t12", beat: "twelve", metric: "comparison.completed", equals: 20 },
    { id: "fast-twelve-wait", label: "No fast request waits at t12", beat: "twelve", metric: "comparison.waiting", equals: 0 },
    { id: "selected-wait", label: "The selected request retains its eight-second wait", beat: "selected", metric: "selected.visibleWait", equals: 8 },
    { id: "slow-t24", label: "Twenty-two slow requests finish at t24", beat: "twenty-four", metric: "primary.completed", equals: 22 },
    { id: "fast-t24", label: "Forty-four fast requests finish at t24", beat: "twenty-four", metric: "comparison.completed", equals: 44 },
    { id: "fast-settled", label: "The fast vessel stays completed during drain", beat: "draining", metric: "comparison.completed", equals: 48 },
    { id: "slow-finish", label: "The slow system finishes at forty-nine seconds", beat: "rest", metric: "primary.completed", equals: 48 },
    { id: "slow-mean", label: "The slow final mean wait is 11.5 seconds", beat: "rest", metric: "primary.meanWait", equals: 11.5 },
    { id: "fast-mean", label: "The fast final mean wait is zero", beat: "rest", metric: "comparison.meanWait", equals: 0 },
  ],
} satisfies ReviewPlan;
