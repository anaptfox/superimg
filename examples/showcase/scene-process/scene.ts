import { Fill, Frame, Instance, Scene, Text, Vector, vector, visual } from "@foxworth/superimg";
import { sampleProcess, type ProcessData } from "./model";

const palette = { bg: "#101a24", rail: "#354753", ink: "#eef5f3", muted: "#91a6af", mint: "#83e4c3", orange: "#efaf6d" };
const box = (width: number, height: number) => ({ x: 0, y: 0, width, height });
const path = (id: string, d: string, fill: string) => vector.path({ id, d, fill });

export const railVisual = visual<Record<string, never>>({
  id: "process.rail",
  render() {
    return { parts: [{ id: "belt", bounds: box(548, 42), content: Vector({ width: 548, height: 42 },
      path("base", "M0 0H548V20H0Z", palette.rail),
      path("feet", "M24 20H40V42H24ZM508 20H524V42H508Z", "#253641"),
      ...Array.from({ length: 23 }, (_, i) => path(`rib-${i}`, `M${12 + i * 24} 6h10v8h-10Z`, "#657b85")),
    ) }] };
  },
});

export const machineVisual = visual<{ toolY: number }>({
  id: "process.machine",
  render({ data }) {
    return {
      parts: [{ id: "frame", bounds: box(160, 155), content: Vector({ width: 160, height: 155 },
        path("gantry", "M0 155V0H160V155H140V20H20V155Z", palette.rail),
        path("head", "M58 20H102V44H58Z", palette.mint),
        path("piston", `M75 44H85V${data.toolY - 92}H75Z`, "#b6c9cc"),
      ) }],
      anchors: { chuck: { x: 80, y: data.toolY - 92 } },
    };
  },
});

export const toolVisual = visual<Record<string, never>>({
  id: "process.tool",
  render() {
    return { parts: [{ id: "stamp", bounds: box(52, 18), content: Vector({ width: 52, height: 18 },
      path("tool", "M0 0H52V12H36V18H16V12H0Z", palette.mint),
    ) }], anchors: { mount: { x: 26, y: 0 } } };
  },
});

export const workpieceVisual = visual<{ stamped: boolean }>({
  id: "process.workpiece",
  render({ data }) {
    return { parts: [{ id: "material", bounds: box(56, 24), content: Vector({ width: 56, height: 24 },
      path("slab", "M0 0H56V24H0Z", data.stamped ? palette.mint : palette.orange),
      ...(data.stamped ? [path("mark", "M20 11l5 5 11-11 3 3-14 14-8-8Z", "#163f35")] : []),
    ) }] };
  },
});

/** Identical object definitions and relationships for still, film and live hosts. */
export function processScene(data: ProcessData, width = 640, height = 360) {
  const pose = sampleProcess(data);
  const scale = Math.min(width / 640, height / 360);
  return Scene({ id: "process", width, height,
    projection: { x: [scale, 0], y: [0, scale], z: [0, -scale], depth: [0, 1, 0] },
    camera: { x: -(width - 640 * scale) / 2, y: -(height - 360 * scale) / 2 },
  },
    Instance({ id: "rail", of: railVisual, data: {}, at: { x: 46, y: 258, z: 0 }, transform: { scale } }),
    Instance({ id: "machine", of: machineVisual, data: { toolY: pose.toolY }, at: { x: 240, y: 92, z: 0 }, transform: { scale }, semantic: { kind: "machine", label: "Stamp press" } }),
    Instance({ id: "tool", of: toolVisual, data: {}, attachTo: { instance: "machine", anchor: "chuck" }, transform: { x: -26 }, semantic: { kind: "tool", label: "Attached stamp" } }),
    Instance({ id: "workpiece", entityId: "batch-01.part-01", of: workpieceVisual, data: { stamped: pose.stamped }, at: { x: pose.workpieceX - 28, y: 234, z: 0 }, transform: { scale }, semantic: { kind: "material", label: pose.stamped ? "Stamped part" : "Raw material", actions: ["select"] } }),
  );
}

export function renderProcess(data: ProcessData, width: number, height: number) {
  const scale = Math.min(width / 640, height / 360);
  const offsetX = (width - 640 * scale) / 2;
  const offsetY = (height - 360 * scale) / 2;
  const label = (id: string, x: number, y: number, size: number, text: string, color = palette.ink) => Frame(
    { id, x: offsetX + x * scale, y: offsetY + y * scale, width: 550 * scale, height: 35 * scale },
    Text({ size: size * scale, color, fontFamily: "system-ui", weight: 600 }, text),
  );
  return Frame({ id: "process-stage", width, height },
    Fill({ color: palette.bg }),
    processScene(data, width, height),
    label("eyebrow", 46, 28, 11, "CONNECTED PARTS  /  SHARED SCENE", palette.muted),
    label("title", 46, 49, 24, "A tool moves. Its attachment follows."),
    label("input-label", 46, 305, 12, "01  MATERIAL", palette.orange),
    label("machine-label", 255, 305, 12, "02  STAMP", palette.muted),
    label("output-label", 470, 305, 12, "03  FINISHED", palette.mint),
  );
}
