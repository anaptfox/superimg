import type { CSSProperties } from "react";
import type { SceneBranch, SceneIndex } from "../kit/scene-index";

interface SemanticTreeProps {
  index: SceneIndex | null;
  selectedId: string | null;
  visibleIds: ReadonlySet<string> | null;
  onSelect: (id: string) => void;
}

function TreeNode({
  branch,
  selectedId,
  visibleIds,
  onSelect,
  depth,
}: {
  branch: SceneBranch;
  selectedId: string | null;
  visibleIds: ReadonlySet<string> | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const { node } = branch;
  if (visibleIds && !visibleIds.has(node.id)) return null;

  return (
    <li>
      <button
        type="button"
        className="tree-node"
        data-node-id={node.id}
        aria-pressed={selectedId === node.id}
        style={{ "--tree-depth": depth } as CSSProperties}
        onClick={() => onSelect(node.id)}
      >
        <span className={`tree-kind tree-kind-${node.space}`} aria-hidden="true" />
        <span className="tree-id">{node.id}</span>
        <span className="tree-role">{node.role ?? node.kind}</span>
      </button>
      {branch.children.length > 0 ? (
        <ul>
          {branch.children.map(child => (
            <TreeNode
              key={child.node.id}
              branch={child}
              selectedId={selectedId}
              visibleIds={visibleIds}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SemanticTree({ index, selectedId, visibleIds, onSelect }: SemanticTreeProps) {
  if (!index) {
    return <div className="tree-loading">Reading semantic scene…</div>;
  }

  return (
    <ul className="semantic-tree" aria-label="Semantic scene graph">
      {index.roots.map(branch => (
        <TreeNode
          key={branch.node.id}
          branch={branch}
          selectedId={selectedId}
          visibleIds={visibleIds}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </ul>
  );
}
