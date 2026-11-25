import React, { createContext, useContext, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react";
import { accept, canvasSize, catalog, controlSpec, evaluate, fields, groups, labels, newLane, patch, requestSchema, validateControls, type Doc, type Example, type Field, type Lane } from "./model";
import "./style.css";
type Edit = (path: string, value: string | number) => void;
const Edits = createContext<Edit>(() => { });
function Input({ field, onEdit, prefix }: {
    field: Field;
    onEdit: Edit;
    prefix: string;
}) {
    const id = `${prefix}-${field.path}`;
    return <label className="field" htmlFor={id}><span>{field.label}</span>{field.kind === "select" ? <select id={id} value={field.value} onChange={e => onEdit(field.path, e.target.value)}>{field.options?.map(o => <option key={o}>{o}</option>)}</select> : <input id={id} type={field.kind === "number" ? "number" : "text"} step={field.kind === "number" ? "any" : undefined} value={field.value} onChange={e => onEdit(field.path, field.kind === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}/>}<small>{field.path}</small></label>;
}
const { registry } = defineRegistry(catalog, { components: {
        Controls: ({ children }) => <div className="fields">{children}</div>,
        Field: ({ props }) => { const edit = useContext(Edits); return <Input field={{ ...props, options: props.options ?? undefined }} onEdit={edit} prefix="catalog"/>; }
    } });
function Preview({ doc, name }: {
    doc: Doc;
    name: string;
}) {
    const check = useMemo(() => evaluate(doc), [doc]);
    const size = canvasSize(doc);
    const html = `<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#faf8f3}#canvas{width:${size.width}px;height:${size.height}px;transform-origin:top left}p{margin:0}</style></head><body><div id="canvas">${check.html ?? ""}</div><script>function fit(){document.getElementById('canvas').style.transform='scale('+Math.min(innerWidth/${size.width},innerHeight/${size.height})+')'}addEventListener('resize',fit);fit();</script></body></html>`;
    return <iframe title={`${name} arrangement preview`} sandbox="allow-scripts" srcDoc={html}/>;
}
function download(doc: Doc) { const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `${doc.pattern}.${doc.pattern === "brand-card" ? "recipe" : "arrange"}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function LanePanel({ kind, lane, setLane }: {
    kind: "schema" | "catalog";
    lane: Lane;
    setLane: React.Dispatch<React.SetStateAction<Lane>>;
}) {
    const size = canvasSize(lane.accepted);
    const [error, setError] = useState("");
    const [tab, setTab] = useState("request");
    const [json, setJson] = useState<string | null>(null);
    const check = useMemo(() => evaluate(lane.doc), [lane.doc]);
    const dirty = JSON.stringify(lane.doc) !== JSON.stringify(lane.accepted);
    const list = fields(lane.doc, lane.group);
    const spec = controlSpec(lane.doc, lane.group);
    let controlError = "";
    try {
        validateControls(spec, list);
    }
    catch (e) {
        controlError = String(e);
    }
    const edit: Edit = (path, value) => { setLane(old => ({ ...old, doc: patch(old.doc, path, value) })); setError(""); setJson(null); };
    const apply = () => { try {
        setLane(accept(lane, lane.revision));
        setError("");
    }
    catch (e) {
        setError(String(e));
    } };
    function useJson() { try {
        const doc: unknown = JSON.parse(json ?? JSON.stringify(lane.doc));
        const result = evaluate(doc);
        if (!result.ok)
            throw new Error(result.messages.join("\n"));
        if ((doc as Doc).pattern !== lane.doc.pattern)
            throw new Error("Choose the example above to change patterns.");
        setLane(old => ({ ...old, doc: doc as Doc, group: "message" }));
        setJson(null);
        setError("");
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    } }
    return <section className={`lane ${kind}`} aria-label={kind === "schema" ? "Arrangement schema lane" : "json-render lane"}>
  <div className="lane-heading"><div><h2>{kind === "schema" ? (lane.doc.pattern === "brand-card" ? "Authored card schema" : "Arrangement schemas") : "json-render catalog"}</h2><p>{kind === "schema" ? "Fields → native React controls" : "Fields → catalog spec → React renderer"}</p></div><span className="revision">r{lane.revision}</span></div>
  <div className="preview" style={{ aspectRatio: `${size.width}/${size.height}` }}><Preview doc={lane.accepted} name={kind}/></div>
  <div className="preview-caption"><span>SuperImg · {size.width} × {size.height}</span><span>{dirty ? "Unapplied draft" : "Preview matches accepted request"}</span></div>
  <div className="editor"><div className="editor-heading"><h3>Contextual controls</h3><label className="sr-only" htmlFor={`${kind}-group`}>Edit section in {kind} lane</label><select id={`${kind}-group`} value={lane.group} onChange={e => setLane(old => ({ ...old, group: e.target.value }))}>{groups(lane.doc).map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
   {kind === "schema" ? <div className="fields">{list.map(field => <Input key={field.path} field={field} onEdit={edit} prefix="schema"/>)}</div> : controlError ? <p role="alert">{controlError}</p> : <Edits.Provider value={edit}><JSONUIProvider registry={registry}><Renderer spec={spec} registry={registry}/></JSONUIProvider></Edits.Provider>}
   <div className="validation" role="status" aria-live="polite" data-valid={check.ok}>{check.ok ? (dirty ? "Draft passes admission. Apply to update preview." : "Accepted · schema and admission checks passed") : "Draft blocked · preview keeps the accepted revision"}</div>
   {!check.ok && <ul className="errors">{check.messages.map(m => <li key={m}>{m}</li>)}</ul>}
   {error && <p className="errors" role="alert">{error}</p>}
   <div className="actions"><button onClick={apply} disabled={!dirty || !check.ok}>Apply draft</button><button className="secondary" disabled={!dirty} onClick={() => { setLane(old => ({ ...old, doc: structuredClone(old.accepted) })); setError(""); setJson(null); }}>Discard draft</button><button className="text-button" onClick={() => download(lane.accepted)}>Save JSON</button></div>
   <details><summary>Inspect contracts & edit JSON</summary><div className="tabs" role="group" aria-label="Contract view">{["request", "schema", ...(kind === "catalog" ? ["controls", "prompt"] : [])].map(t => <button key={t} className="secondary" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
   {tab === "request" ? <><label htmlFor={`${kind}-json`} className="sr-only">Draft JSON in {kind} lane</label><textarea id={`${kind}-json`} spellCheck={false} value={json ?? JSON.stringify(lane.doc, null, 2)} onChange={e => setJson(e.target.value)}/><button className="secondary" onClick={useJson}>Validate JSON as draft</button></> : <pre>{tab === "schema" ? JSON.stringify(requestSchema(lane.doc), null, 2) : tab === "controls" ? JSON.stringify(spec, null, 2) : catalog.prompt({ system: "Build contextual controls for accepted SuperImg arrangement fields. Do not invent field bindings." })}</pre>}
   </details>
  </div>
 </section>;
}
function App() {
    const [resetEpoch, setResetEpoch] = useState(0);
    const [rightEpoch, setRightEpoch] = useState(0);
    const [example, setExample] = useState<Example>("overlap");
    const [left, setLeft] = useState(() => newLane("overlap"));
    const [right, setRight] = useState(() => newLane("overlap"));
    const [notice, setNotice] = useState("");
    const same = JSON.stringify(left.accepted) === JSON.stringify(right.accepted);
    function select(value: Example) { setResetEpoch(e => e + 1); setExample(value); setLeft(newLane(value)); setRight(newLane(value)); setNotice("Loaded the same illustrative input in both lanes."); }
    function sync() { setRightEpoch(e => e + 1); setRight(old => ({ ...old, doc: structuredClone(left.accepted), accepted: structuredClone(left.accepted), revision: old.revision + 1, group: "message" })); setNotice("Copied the accepted schema request to the catalog lane."); }
    return <main><header><a href="/" className="wordmark">SuperImg <span>/ Arrangement Lab</span></a><span className="local">Local prototype</span></header>
 <div className="intro"><h1>One arrangement.<br />Two ways to edit.</h1><p>Compare direct schema controls with a json-render catalog.<br />Both paths use the same SuperImg renderer and admission checks.</p></div>
 <div className="toolbar"><label>Example<select value={example} onChange={e => select(e.target.value as Example)}>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><div className="toolbar-actions"><span className="parity" data-same={same}>{same ? "Accepted requests match" : "Accepted requests differ"}</span><button className="secondary" onClick={sync}>Copy schema → catalog</button><button className="text-button" onClick={() => select(example)}>Reset both</button></div></div>
 {example === "brand" && <p className="recipe-note">New square card recipe · illustrative Northstar brand · this schema is separate from the existing arrangement catalog.</p>}
 <p className="notice" role="status">{notice || "Illustrative fixtures · no model calls · edits stay in this page"}</p>
 <div className="comparison"><LanePanel key={`left-${example}-${resetEpoch}`} kind="schema" lane={left} setLane={setLeft}/><LanePanel key={`right-${example}-${resetEpoch}-${rightEpoch}`} kind="catalog" lane={right} setLane={setRight}/></div>
 <section className="method"><div><h2>What is being compared?</h2><p>The baseline reads field types and enum options from the existing arrangement schemas. The catalog path uses those same fields to build a validated control spec, rendered by <code>@json-render/react</code>.</p></div><div><h2>Try a meaningful failure.</h2><p>Clear the question, or set an interval’s end before its start. For the card, try a headline longer than 72 characters. Admission blocks the draft while the accepted preview stays visible. Edit a single field and apply it to compare revisions.</p></div></section>
 <footer>Deterministic editor comparison, not an AI-generation benchmark. HTML preview uses SuperImg’s source renderer with heuristic text measurement; encoded export and visual acceptance are separate.</footer>
 </main>;
}
createRoot(document.getElementById("root")!).render(<App />);
