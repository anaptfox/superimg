import type { SceneNodeSnapshot } from "@foxworth/superimg/interactive/define";
import type { ArtworkRoleFilter } from "../kit/artwork";
import { SemanticTree } from "./SemanticTree";
import { useMemo } from "react";
import { visibleSceneIds, type SceneIndex } from "../kit/scene-index";

interface MeaningDrawerProps {
  index: SceneIndex | null;
  selected: SceneNodeSnapshot | null;
  selectedId: string | null;
  queryRole: string | null;
  queryMatches: readonly SceneNodeSnapshot[];
  roleFilters: ReadonlyArray<ArtworkRoleFilter>;
  onQuery: (role: string | null) => void;
  onSelect: (id: string) => void;
}

export function MeaningDrawer({
  index,
  selected,
  selectedId,
  queryRole,
  queryMatches,
  roleFilters,
  onQuery,
  onSelect,
}: MeaningDrawerProps) {
  const snapshot = index?.snapshot;
  const visibleIds = useMemo(
    () => index && queryRole !== null ? visibleSceneIds(index, queryMatches) : null,
    [index, queryRole, queryMatches],
  );

  return (
    <aside className="meaning-drawer" aria-label="Meaning inspector">
      <header className="drawer-header">
        <div>
          <span className="eyebrow">Live semantic graph</span>
          <h2>Meaning, addressable.</h2>
        </div>
        <span className="node-count" data-testid="node-count">
          {snapshot?.nodes.length ?? "—"} nodes
        </span>
      </header>

      <div className="query-section">
        <span className="section-label">Query by role</span>
        <div className="query-chips">
          <button type="button" aria-pressed={queryRole === null} onClick={() => onQuery(null)}>
            all
          </button>
          {roleFilters.map((filter) => (
            <button
              key={filter.role}
              type="button"
              data-query-role={filter.role}
              aria-pressed={queryRole === filter.role}
              onClick={() => onQuery(filter.role)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <code className="query-result" data-testid="query-result">
          scene.query({`{ role: "${queryRole ?? "*"}" }`}) → {queryRole ? queryMatches.length : snapshot?.nodes.length ?? 0}
        </code>
      </div>

      <div className="tree-scroll">
        <SemanticTree
          index={index}
          selectedId={selectedId}
          visibleIds={visibleIds}
          onSelect={onSelect}
        />
      </div>

      <section className="node-inspector" aria-label="Selected node">
        <span className="section-label">Selected meaning</span>
        {selected ? (
          <>
            <div className="selected-heading">
              <strong data-testid="selected-node-id">{selected.id}</strong>
              <span>{selected.kind}</span>
            </div>
            <p>{selected.label ?? "An addressable part of the scene."}</p>
            <dl>
              <div><dt>role</dt><dd>{selected.role ?? "—"}</dd></div>
              <div><dt>space</dt><dd>{selected.space}</dd></div>
              <div><dt>parent</dt><dd>{selected.parentId ?? "scene"}</dd></div>
              <div><dt>visible</dt><dd>{String(selected.visible)}</dd></div>
            </dl>
            <div className="tag-row">
              {selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
          </>
        ) : (
          <p>Select a node to inspect its role, hierarchy, and state.</p>
        )}
      </section>
    </aside>
  );
}
