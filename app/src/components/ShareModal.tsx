import { useState, useEffect } from "react";

interface ShareLink {
  id: string;
  token: string;
  permission: "view" | "edit";
  created_at: string;
  expires_at: string | null;
}

interface ShareModalProps {
  documentId: string;
  onClose: () => void;
}

export function ShareModal({ documentId, onClose }: ShareModalProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share/${documentId}`)
      .then((r) => r.json())
      .then((data) => setLinks(data.links || []))
      .catch(() => {});
  }, [documentId]);

  const createLink = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, permission }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinks((prev) => [
          { ...data, created_at: new Date().toISOString(), expires_at: null },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("Failed to create share link:", err);
    } finally {
      setCreating(false);
    }
  };

  const revokeLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/share/link/${linkId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
      }
    } catch (err) {
      console.error("Failed to revoke link:", err);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/?shared=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal__header">
          <h3>Share Document</h3>
          <button className="share-modal__close" onClick={onClose}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="share-modal__create">
          <select
            className="share-modal__select"
            value={permission}
            onChange={(e) => setPermission(e.target.value as "view" | "edit")}
          >
            <option value="view">Can view</option>
            <option value="edit">Can edit</option>
          </select>
          <button
            className="primary-btn"
            onClick={createLink}
            disabled={creating}
          >
            {creating ? "Creating..." : "Create Link"}
          </button>
        </div>

        {links.length > 0 && (
          <div className="share-modal__links">
            {links.map((link) => (
              <div key={link.id} className="share-modal__link">
                <div className="share-modal__link-info">
                  <span
                    className={`share-modal__perm share-modal__perm--${link.permission}`}
                  >
                    {link.permission}
                  </span>
                  <span className="share-modal__date">
                    {new Date(link.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="share-modal__link-actions">
                  <button
                    className="share-modal__copy"
                    onClick={() => copyLink(link.token)}
                  >
                    {copied === link.token ? "Copied!" : "Copy Link"}
                  </button>
                  <button
                    className="share-modal__revoke"
                    onClick={() => revokeLink(link.id)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {links.length === 0 && (
          <p className="share-modal__empty">
            No share links yet. Create one above.
          </p>
        )}
      </div>
    </div>
  );
}
