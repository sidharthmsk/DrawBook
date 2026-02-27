import type { FolderNode } from "./types";
import { IconFolder } from "./DashboardIcons";

export function FolderTreeMenu({
  folders,
  onSelect,
  depth,
}: {
  folders: FolderNode[];
  onSelect: (folderId: string | null) => void;
  depth: number;
}) {
  return (
    <>
      {folders.map((node) => (
        <div key={node.folder.id}>
          <button
            style={{ paddingLeft: 10 + depth * 14 }}
            onClick={() => onSelect(node.folder.id)}
          >
            <IconFolder />
            <span style={{ marginLeft: 6 }}>{node.folder.name}</span>
          </button>
          {node.children.length > 0 && (
            <FolderTreeMenu
              folders={node.children}
              onSelect={onSelect}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  );
}

export function FilteredFolderTreeMenu({
  folders,
  excludeIds,
  onSelect,
  depth,
}: {
  folders: FolderNode[];
  excludeIds: Set<string>;
  onSelect: (folderId: string | null) => void;
  depth: number;
}) {
  return (
    <>
      {folders
        .filter((node) => !excludeIds.has(node.folder.id))
        .map((node) => (
          <div key={node.folder.id}>
            <button
              style={{ paddingLeft: 10 + depth * 14 }}
              onClick={() => onSelect(node.folder.id)}
            >
              <IconFolder />
              <span style={{ marginLeft: 6 }}>{node.folder.name}</span>
            </button>
            {node.children.length > 0 && (
              <FilteredFolderTreeMenu
                folders={node.children}
                excludeIds={excludeIds}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        ))}
    </>
  );
}
