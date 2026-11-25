import {
  admitWhen, bindProjection, compileInteractions, defineInteraction,
  directRealizationIds, implementInteractions, installInteractions, projectInteractions,
} from "@foxworth/boundary";
import { portableSchema } from "@foxworth/boundary/program";
import { isWebMcpAvailable, registerWebMcpBinding, webMcpTools } from "@foxworth/boundary/webmcp";
import { Html, sequence, time, video } from "@foxworth/superimg";
import { Player } from "@foxworth/superimg/player";

const player = new Player({ container: document.querySelector<HTMLElement>("#primary")! });
const media = video({
  size: { width: 320, height: 180 }, fps: 25, duration: "7f",
  render: (ctx) => Html({
    width: "fill", height: "fill",
    html: `<div id="frame-marker" style="width:320px;height:180px;background:${ctx.timeline.frame === 6 ? "#e11d48" : "#10243c"};color:white;display:grid;place-items:center;font:32px system-ui">frame${ctx.timeline.frame}</div>`,
  }),
});

type Context = { permitted: boolean };
let permitted = true;
const definitions = {
  inspect: defineInteraction({
    id: "fixture.preview.inspect",
    input: portableSchema<{ surfaceId: string }>({ type: "object", properties: { surfaceId: { type: "string" } }, required: ["surfaceId"], additionalProperties: false }),
    output: portableSchema<{ surfaceId: string; frame: number; frameCount: number; fps: number }>({
      type: "object", properties: { surfaceId: { type: "string" }, frame: { type: "integer" }, frameCount: { type: "integer" }, fps: { type: "integer" } },
      required: ["surfaceId", "frame", "frameCount", "fps"], additionalProperties: false,
    }),
    reads: ["fixture.preview"], changes: [], summary: "Read the mounted seven-frame fixture",
  }),
};

try {
  const loaded = await player.load(time(sequence([{ id: "clip", content: media }]), { size: { width: 320, height: 180 }, fps: 25 }));
  if (loaded.status !== "success") throw new Error(`Fixture load failed: ${JSON.stringify(loaded)}`);
  const compiled = await compileInteractions(definitions);
  const implementations = implementInteractions<typeof definitions, Context>(definitions, {
    inspect: (input) => ({ surfaceId: input.surfaceId, frame: player.getState().currentFrame, frameCount: 7, fps: 25 }),
  });
  const installed = await installInteractions(compiled, {
    installationId: "fixture:native-preview:1", implementations,
    realizationIds: directRealizationIds(compiled, "fixture:1"),
  });
  const projection = await projectInteractions(compiled, { inspect: { interaction: compiled.handles.inspect, modes: ["direct"] } });
  const bound = await bindProjection(projection, installed.installation, { admit: admitWhen<Context>((context) => context.permitted, "The host denied this caller") });
  if (bound.status !== "bound") throw new Error(`Fixture binding failed: ${JSON.stringify(bound)}`);
  const available = isWebMcpAvailable();
  const registration = available ? await registerWebMcpBinding({
    binding: bound.binding, tools: webMcpTools(projection), context: () => ({ permitted }),
  }) : undefined;
  Object.assign(window, {
    __inspectionFixture: {
      available,
      sdkVersion: "0.1.0",
      inspect: () => ({ frame: player.getState().currentFrame, frameCount: 7, fps: 25 }),
      deny: () => { permitted = false; },
      allow: () => { permitted = true; },
      seek: (frame: number) => player.seek({ frame }),
      revoke: () => bound.controller.revoke(),
      withdraw: () => registration?.dispose(),
      dispose: () => { registration?.dispose(); bound.controller.revoke(); player.dispose(); },
    },
  });
  document.body.dataset.ready = "success";
} catch (error) {
  document.body.dataset.ready = "error";
  document.body.dataset.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
}
