import { defineCatalog, validateSpec, type Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";
import { parseArrangeRequest, type ArrangeRequest } from "../../../../packages/superimg-stdlib/src/arrange/portable";
import { ARRANGE_PATTERNS, checkArrangeRequest, renderArrangeRequest } from "../../../../packages/superimg-stdlib/src/arrange/registry";
import { lower } from "../../../../packages/superimg-stdlib/src/tree/lower";
import { brandExample, brandSchema, renderBrand } from "./brand-card";
import overlap from "./overlap.json";
import comparison from "./comparison.json";
import process from "./process.json";
export type Json = string | number | boolean | null | Json[] | {
    [key: string]: Json;
};
export type Doc = {
    pattern: string;
    spec: Record<string, Json>;
};
export const examples = { overlap, comparison, process, brand: brandExample };
export type Example = keyof typeof examples;
export const labels = { overlap: "Event overlap", comparison: "Screenshot comparison", process: "Process diagram", brand: "Branded social card" };
export type Field = {
    path: string;
    label: string;
    kind: "text" | "number" | "select";
    options?: string[];
    value: string | number;
};
export function get(value: unknown, path: string): unknown { return path.split(".").reduce<unknown>((v, k) => v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined, value); }
export function patch(doc: Doc, path: string, value: Json): Doc {
    const next = structuredClone(doc);
    const parts = path.split(".");
    let cursor: Record<string, Json> = next as unknown as Record<string, Json>;
    for (const key of parts.slice(0, -1)) {
        if (!cursor[key] || typeof cursor[key] !== "object")
            throw new Error(`Missing path: ${path}`);
        cursor = cursor[key] as Record<string, Json>;
    }
    cursor[parts.at(-1)!] = value;
    return next;
}
export function seed(example: Example): Doc { return structuredClone(examples[example]) as Doc; }
export function groups(doc: Doc): {
    id: string;
    label: string;
    path: string;
}[] {
    if (doc.pattern === "brand-card")
        return [{ id: "message", label: "Card content", path: "spec" }, { id: "brand", label: "Brand treatment", path: "spec" }];
    const root = [{ id: "message", label: "Question & evidence", path: "spec" }];
    if (doc.pattern === "aligned-intervals")
        return [...root, { id: "clock", label: "Shared clock", path: "spec.timeRef" }, ...(doc.spec.tracks as Json[]).map((_, i) => ({ id: `track-${i}`, label: `Track ${i + 1}`, path: `spec.tracks.${i}` }))];
    if (doc.pattern === "registered-comparison")
        return [...root, { id: "frame", label: "Shared frame", path: "spec.frame" }, ...(doc.spec.states as Json[]).map((_, i) => ({ id: `state-${i}`, label: `Screenshot ${i + 1}`, path: `spec.states.${i}` }))];
    return [...root, ...(doc.spec.nodes as Json[]).map((_, i) => ({ id: `node-${i}`, label: `Step ${i + 1}`, path: `spec.nodes.${i}` })), ...(doc.spec.edges as Json[]).map((_, i) => ({ id: `edge-${i}`, label: `Connection ${i + 1}`, path: `spec.edges.${i}` }))];
}
type Shape = {
    properties?: Record<string, Shape>;
    items?: Shape;
    enum?: string[];
    type?: string;
    anyOf?: Shape[];
};
function shapeAt(doc: Doc, path: string): Shape {
    let shape = (doc.pattern === "brand-card" ? brandSchema : ARRANGE_PATTERNS.find(p => p.id === doc.pattern)!.schema) as Shape;
    for (const key of path.split(".").slice(1))
        shape = /^\d+$/.test(key) ? shape.items ?? {} : shape.properties?.[key] ?? {};
    return shape;
}
function title(key: string) { return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()); }
export function fields(doc: Doc, groupId: string): Field[] {
    const group = groups(doc).find(g => g.id === groupId) ?? groups(doc)[0]!;
    const output: Field[] = [];
    function visit(value: unknown, path: string, depth: number) {
        if (depth > 3)
            return;
        if (Array.isArray(value)) {
            value.forEach((v, i) => visit(v, `${path}.${i}`, depth + 1));
            return;
        }
        if (value && typeof value === "object") {
            for (const [key, v] of Object.entries(value)) {
                if (doc.pattern === "brand-card" && ((group.id === "message" && key === "theme") || (group.id === "brand" && key !== "theme")))
                    continue;
                if (key === "size" || key === "id" || (doc.pattern !== "brand-card" && group.id === "message" && !["question", "workRemoved", "evidence", "source"].includes(key)) || key === "src")
                    continue;
                visit(v, `${path}.${key}`, depth + 1);
            }
            return;
        }
        if (typeof value !== "string" && typeof value !== "number")
            return;
        const shape = shapeAt(doc, path);
        const key = path.split(".").at(-1)!;
        output.push({ path, label: title(key === "label" ? "Label" : key) + (/intervals/.test(path) ? ` · interval ${Number(path.split(".").at(-2)) + 1}` : ""), kind: shape.enum ? "select" : shape.type === "number" ? "number" : "text", options: shape.enum, value });
    }
    visit(get(doc, group.path), group.path, 0);
    return output;
}
export const controlDefinitions = {
    Controls: { props: z.strictObject({ title: z.string() }), slots: ["default"], description: "A contextual field group" },
    Field: { props: z.strictObject({ path: z.string(), label: z.string(), kind: z.enum(["text", "number", "select"]), options: z.array(z.string()).nullable(), value: z.union([z.string(), z.number()]) }), slots: [], description: "One approved arrangement field; dispatches a local draft edit" }
};
export const catalog = defineCatalog(schema, { components: controlDefinitions, actions: {} });
export function controlSpec(doc: Doc, groupId: string): Spec {
    const list = fields(doc, groupId);
    return { root: "controls", elements: { controls: { type: "Controls", props: { title: groups(doc).find(g => g.id === groupId)?.label ?? "Question & evidence" }, children: list.map(f => f.path) }, ...Object.fromEntries(list.map(f => [f.path, { type: "Field", props: { ...f, options: f.options ?? null }, children: [] }])) } };
}
export function validateControls(spec: Spec, allowedFields: Field[]): void {
    if (!catalog.validate(spec).success)
        throw new Error("Control catalog shape is invalid");
    const graph = validateSpec(spec);
    if (!graph.valid)
        throw new Error(graph.issues.map(i => i.message).join("; "));
    const allowed = new Map(allowedFields.map(f => [f.path, f]));
    for (const node of Object.values(spec.elements)) {
        if (node.type === "Controls")
            controlDefinitions.Controls.props.parse(node.props);
        else if (node.type === "Field") {
            const field = controlDefinitions.Field.props.parse(node.props);
            const approved = allowed.get(field.path);
            if (!approved || approved.kind !== field.kind || approved.label !== field.label || JSON.stringify(approved.options ?? null) !== JSON.stringify(field.options))
                throw new Error("Unapproved field binding");
        }
        else
            throw new Error("Unknown control component");
    }
}
export type Check = {
    ok: boolean;
    messages: string[];
    request?: ArrangeRequest;
    html?: string;
};
export function evaluate(doc: unknown): Check {
    try {
        if (doc && typeof doc === "object" && (doc as Doc).pattern === "brand-card") {
            const envelope = doc as Doc;
            if (Object.keys(envelope).some(k => !["pattern", "spec"].includes(k)))
                throw new Error("Unknown card field");
            return { ok: true, messages: [], html: lower(renderBrand(envelope.spec), { width: 1080, height: 1080 }) };
        }
        const request = parseArrangeRequest(doc);
        const failures = checkArrangeRequest(request);
        if (failures.length)
            return { ok: false, messages: failures.map(f => `${f.code}: ${f.message}`) };
        const tree = renderArrangeRequest(request);
        const dimensions = request.spec.size ?? { width: 1080, height: 720 };
        const markup = lower(tree, dimensions);
        return { ok: true, messages: [], request, html: markup };
    }
    catch (error) {
        return { ok: false, messages: [error instanceof Error ? error.message : String(error)] };
    }
}
export type Lane = {
    doc: Doc;
    accepted: Doc;
    revision: number;
    group: string;
};
export function newLane(example: Example): Lane { return { doc: seed(example), accepted: seed(example), revision: 0, group: "message" }; }
export function accept(lane: Lane, expected: number): Lane { if (lane.revision !== expected)
    throw new Error("Stale revision. Reload the current draft before applying."); const check = evaluate(lane.doc); if (!check.ok)
    throw new Error(check.messages.join("; ")); return { ...lane, accepted: structuredClone(lane.doc), revision: lane.revision + 1 }; }
export function requestSchema(doc: Doc) { return doc.pattern === "brand-card" ? brandSchema : ARRANGE_PATTERNS.find(p => p.id === doc.pattern)!.schema; }
export function canvasSize(doc: Doc) { if (doc.pattern === "brand-card")
    return { width: 1080, height: 1080 }; const size = doc.spec.size as {
    width: number;
    height: number;
} | undefined; return size ?? { width: 1080, height: 720 }; }
