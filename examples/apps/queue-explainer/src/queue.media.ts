import { Frame, Text } from "@foxworth/superimg";
import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { INITIAL, sampleQueue, type QueueData } from "./model.ts";

const INK = "#20312e";
const MUTED = "#63746e";
const GREEN = "#24745f";
const AMBER = "#a85f1c";
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'SFMono-Regular', Consolas, monospace";

function label(id: string, x: number, y: number, content: string, size = 15, color = MUTED, width = 300, weight = 500) {
  return Frame(
    { id: `${id}-box`, x, y, width, height: size * 1.45 },
    Text({ id, size, weight, color, fontFamily: FONT, lineHeight: 1.25 }, content),
  );
}

function number(id: string, x: number, y: number, value: number, color = INK, size = 46) {
  return Frame(
    { id: `${id}-box`, x, y, width: 190, height: size * 1.4 },
    Text({ id, size, weight: 500, color, fontFamily: MONO, lineHeight: 1.2 }, String(value)),
  );
}

export default defineInteractive<QueueData>({
  size: { width: 1100, height: 620 },
  sample: INITIAL,
  guide: {
    id: "queue-explainer",
    steps: [
      { id: "observe", label: "Watch the queue", duration: "8s", scene: { state: "observe" }, note: "Every job takes two seconds. Watch how work builds up.", focusNodeId: "backlog" },
      { id: "compare", label: "Change the capacity", duration: "8s", scene: { state: "compare" }, note: "Try fewer workers or a slower arrival rate.", focusNodeId: "workers" },
      { id: "reflect", label: "Read the result", duration: "8s", scene: { state: "reflect" }, note: "Compare arrivals with the maximum completion rate.", focusNodeId: "completed" },
    ],
  },
  render(ctx) {
    const { data } = ctx;
    const seconds = ctx.timeline.seconds;
    const state = sampleQueue(seconds, data);
    const overloaded = data.arrivalRate > state.capacity;
    const waitingJobs = state.jobs.filter((job) => job.start > seconds + 1e-9);
    const highlighted = data.highlightBacklog;
    const backlogColor = highlighted ? AMBER : INK;

    ctx.scene.states({ observe: {}, compare: {}, reflect: {} });
    ctx.scene.register({ id: "arrivals", role: "source", label: "Arriving jobs", metadata: { rate: data.arrivalRate, count: state.arrived } });
    ctx.scene.register({ id: "backlog", role: "queue", label: "Waiting jobs", metadata: { count: state.waiting, highlighted } });
    ctx.scene.register({ id: "workers", role: "processor", label: "Workers", metadata: { count: data.workers, busy: state.busy, capacity: state.capacity } });
    ctx.scene.register({ id: "completed", role: "result", label: "Completed jobs", metadata: { count: state.completed } });

    // Keep the diagram fixed while its facts change. Only service progress moves.
    return Frame(
      { id: "queue-stage", width: ctx.width, height: ctx.height, fill: "#f8faf7" },
      label("eyebrow", 46, 32, "A SMALL SYSTEM, MADE VISIBLE", 12, GREEN, 500, 650),
      label("title", 46, 57, "When work arrives faster than it leaves", 32, INK, 1000, 600),
      label("subtitle", 46, 104, "One shared queue. Two seconds per job. Change an input and compare.", 16, MUTED, 1000),
      Frame({ id: "top-rule", x: 46, y: 148, width: 1008, height: 1, fill: "#dce4dd" }),

      Frame(
        { id: "arrival-card", x: 46, y: 184, width: 190, height: 224, fill: "#edf3ed", radius: 16 },
        label("arrival-label", 22, 20, "ARRIVAL RATE", 11, MUTED, 155, 650),
        number("arrival-rate", 22, 48, data.arrivalRate),
        label("arrival-unit", 22, 106, "jobs / second", 14, MUTED, 155),
        Frame({ id: "arrival-rule", x: 22, y: 151, width: 146, height: 1, fill: "#d4dfd4" }),
        label("arrived-label", 22, 170, `${state.arrived} arrived so far`, 14, INK, 155),
      ),
      label("arrival-arrow", 248, 269, "→", 27, MUTED, 40),

      Frame(
        { id: "backlog-card", x: 292, y: 184, width: 296, height: 224, fill: highlighted ? "#fff0d7" : "#ffffff", radius: 16,
          style: { border: `1px solid ${highlighted ? "#dba457" : "#dce4dd"}` } },
        label("backlog-label", 22, 20, "WAITING", 11, highlighted ? AMBER : MUTED, 220, 650),
        number("backlog-count", 22, 48, state.waiting, backlogColor),
        label("backlog-unit", 105, 73, state.waiting === 1 ? "job in queue" : "jobs in queue", 14, MUTED, 175),
        ...Array.from({ length: 18 }, (_, index) => {
          const job = waitingJobs[index];
          return Frame(
            { id: `queue-slot-${index}`, x: 22 + (index % 9) * 28, y: 122 + Math.floor(index / 9) * 27, width: 21, height: 20, radius: 5,
              fill: job ? (highlighted ? "#bf812f" : "#6e9b87") : "#edf1ed" },
          );
        }),
        label("queue-note", 22, 183, state.waiting > 18 ? `18 shown · ${state.waiting - 18} more waiting` : "First in, first out", 12, MUTED, 250),
      ),
      label("worker-arrow", 601, 269, "→", 27, MUTED, 40),

      Frame(
        { id: "worker-bank", x: 644, y: 184, width: 410, height: 224 },
        ...Array.from({ length: 6 }, (_, worker) => {
          const enabled = worker < data.workers;
          const job = enabled ? state.jobs.find((candidate) => candidate.worker === worker && candidate.start <= seconds + 1e-9 && candidate.end > seconds + 1e-9) : undefined;
          const progress = job ? Math.min(1, Math.max(0, (seconds - job.start) / (job.end - job.start))) : 0;
          return Frame(
            { id: `worker-${worker}`, x: (worker % 2) * 211, y: Math.floor(worker / 2) * 77, width: 199, height: 69, fill: enabled ? "#ffffff" : "#f0f3ee", radius: 10,
              style: { border: `1px solid ${enabled ? "#dce4dd" : "#e7ece5"}` } },
            label(`worker-${worker}-name`, 13, 11, `Worker ${worker + 1}`, 13, enabled ? INK : "#87968b", 130, 550),
            label(`worker-${worker}-job`, 13, 31, job ? `Job ${job.id} · processing` : enabled ? "Ready for work" : "Inactive", 10, MUTED, 172),
            Frame({ id: `worker-${worker}-track`, x: 13, y: 54, width: 173, height: 4, fill: "#e9eee8", radius: 2 }),
            ...(progress > 0 ? [Frame({ id: `worker-${worker}-progress`, x: 13, y: 54, width: Math.max(1, 173 * progress), height: 4, fill: GREEN, radius: 2 })] : []),
          );
        }),
      ),

      Frame(
        { id: "result-band", x: 46, y: 438, width: 1008, height: 80, fill: "#eaf2eb", radius: 12 },
        label("completed-label", 22, 15, "COMPLETED", 10, GREEN, 155, 650),
        number("completed-count", 22, 34, state.completed, GREEN, 26),
        label("busy-label", 226, 15, "PROCESSING", 10, MUTED, 155, 650),
        label("busy-count", 226, 41, `${state.busy} of ${data.workers} workers`, 18, INK, 220),
        label("capacity-label", 476, 15, "MAXIMUM COMPLETION RATE", 10, MUTED, 310, 650),
        label("capacity-count", 476, 41, `${state.capacity} jobs / second`, 18, INK, 280),
        label("clock-label", 848, 15, "SIMULATED TIME", 10, MUTED, 150, 650),
        label("clock-count", 848, 41, `${seconds.toFixed(1)} s`, 18, INK, 150),
      ),
      label("conclusion", 46, 547, overloaded
        ? `Arrivals exceed capacity by ${Number((data.arrivalRate - state.capacity).toFixed(2))} jobs / second.`
        : "Capacity can keep up with this arrival rate.", 19, overloaded ? AMBER : GREEN, 1010, 550),
      label("assumption", 46, 580, "Deterministic model · fixed service time · unlimited waiting space", 12, MUTED, 1000),
    );
  },
});
