import type { DocumentType } from "./types";
import { TYPE_CONFIG } from "./DashboardIcons";

export function TrashView({
  trashDocs,
  emptyTrash,
  restoreFromTrash,
  permanentDelete,
}: {
  trashDocs: Array<{
    id: string;
    name: string;
    type: string;
    deletedAt: string;
  }>;
  emptyTrash: () => void;
  restoreFromTrash: (docId: string) => void;
  permanentDelete: (docId: string) => void;
}) {
  return (
    <section className="trash-view">
      <div className="trash-view__header">
        <h3>Trash</h3>
        {trashDocs.length > 0 && (
          <button className="danger-btn" onClick={emptyTrash}>
            Empty Trash
          </button>
        )}
      </div>
      {trashDocs.length === 0 ? (
        <div className="empty-state">
          <p>Trash is empty</p>
        </div>
      ) : (
        <div className="trash-list">
          {trashDocs.map((doc) => {
            const typeConf =
              TYPE_CONFIG[doc.type as DocumentType] || TYPE_CONFIG.tldraw;
            return (
              <div key={doc.id} className="trash-item">
                <span
                  className="trash-item__icon"
                  style={{ color: typeConf.color }}
                >
                  {typeConf.label}
                </span>
                <span className="trash-item__name">{doc.name}</span>
                <span className="trash-item__date">
                  Deleted {new Date(doc.deletedAt).toLocaleDateString()}
                </span>
                <button
                  className="trash-item__restore"
                  onClick={() => restoreFromTrash(doc.id)}
                >
                  Restore
                </button>
                <button
                  className="trash-item__delete"
                  onClick={() => permanentDelete(doc.id)}
                >
                  Delete Forever
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
