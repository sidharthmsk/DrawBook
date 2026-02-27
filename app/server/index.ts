import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import { createStorageAdapter, DocumentType, Folder } from "./storage.js";

function typeFromId(id: string): DocumentType {
  if (id.startsWith("excalidraw-")) return "excalidraw";
  if (id.startsWith("drawio-")) return "drawio";
  if (id.startsWith("markdown-")) return "markdown";
  if (id.startsWith("pdf-")) return "pdf";
  return "tldraw";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env file in both dev and production runs.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
if (!process.env.MINIO_ENDPOINT_URL && !process.env.MINIO_ENDPOINT) {
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
}

const APP_PASSWORD = process.env.APP_PASSWORD || "";
const AUTH_TOKEN = APP_PASSWORD
  ? crypto.createHash("sha256").update(APP_PASSWORD).digest("hex")
  : "";

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!AUTH_TOKEN) return next();
  const header = req.headers.authorization;
  if (header === `Bearer ${AUTH_TOKEN}`) return next();
  res.status(401).json({ error: "Unauthorized" });
}

const app = express();
const server = createServer(app);

// WebSocket server for live sync
const wss = new WebSocketServer({ server, path: "/ws" });

// Store connections per document
const rooms = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const documentId = url.searchParams.get("doc");

  if (AUTH_TOKEN) {
    const token = url.searchParams.get("token");
    if (token !== AUTH_TOKEN) {
      ws.close(1008, "Unauthorized");
      return;
    }
  }

  if (!documentId) {
    ws.close(1008, "Document ID required");
    return;
  }

  // Join room
  if (!rooms.has(documentId)) {
    rooms.set(documentId, new Set());
  }
  rooms.get(documentId)!.add(ws);

  console.log(
    `[WS] Client joined room: ${documentId} (${rooms.get(documentId)!.size} clients)`,
  );

  ws.on("message", (data) => {
    // Broadcast to all other clients in the same room
    const room = rooms.get(documentId);
    if (room) {
      room.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data.toString());
        }
      });
    }
  });

  ws.on("close", () => {
    const room = rooms.get(documentId);
    if (room) {
      room.delete(ws);
      console.log(
        `[WS] Client left room: ${documentId} (${room.size} clients)`,
      );
      if (room.size === 0) {
        rooms.delete(documentId);
      }
    }
  });

  ws.on("error", (error) => {
    console.error("[WS] Error:", error);
  });
});

// CORS - open for internal network use
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ============ AUTH ENDPOINTS (public) ============

app.post("/api/auth/login", (req, res) => {
  if (!AUTH_TOKEN) {
    return res.json({ success: true, token: "" });
  }
  const { password } = req.body;
  if (!password || password !== APP_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }
  res.json({ success: true, token: AUTH_TOKEN });
});

app.get("/api/auth/check", (req, res) => {
  if (!AUTH_TOKEN) {
    return res.json({ authenticated: true, required: false });
  }
  const header = req.headers.authorization;
  const valid = header === `Bearer ${AUTH_TOKEN}`;
  res.json({ authenticated: valid, required: true });
});

// Protect all other /api routes
app.use("/api", requireAuth);

const storage = createStorageAdapter();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function loadFolders(): Promise<Folder[]> {
  return storage.loadFolders();
}

async function saveFolders(folders: Folder[]) {
  await storage.saveFolders(folders);
}

// ============ FOLDER ENDPOINTS ============

// List all folders
app.get("/api/folders", async (_req, res) => {
  try {
    const folders = await loadFolders();
    res.json({ folders });
  } catch (error) {
    console.error("[Server] List folders error:", error);
    res.status(500).json({ error: "Failed to list folders" });
  }
});

// Create a folder
app.post("/api/folders", async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    const folders = await loadFolders();
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
    };
    folders.push(newFolder);
    await saveFolders(folders);

    console.log(`[Server] Created folder: ${newFolder.name}`);
    res.json({ success: true, folder: newFolder });
  } catch (error) {
    console.error("[Server] Create folder error:", error);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

// Rename a folder
app.post("/api/folders/:folderId/rename", async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    const folders = await loadFolders();
    const folder = folders.find((f) => f.id === folderId);

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    folder.name = name.trim();
    await saveFolders(folders);

    console.log(`[Server] Renamed folder: ${folderId} -> ${name}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Rename folder error:", error);
    res.status(500).json({ error: "Failed to rename folder" });
  }
});

// Delete a folder and all descendants (moves documents to root)
app.delete("/api/folders/:folderId", async (req, res) => {
  try {
    const { folderId } = req.params;

    let folders = await loadFolders();

    // Collect folder and all descendants
    const idsToDelete = new Set<string>();
    const collect = (id: string) => {
      idsToDelete.add(id);
      for (const f of folders) {
        if (f.parentId === id) collect(f.id);
      }
    };
    collect(folderId);

    folders = folders.filter((f) => !idsToDelete.has(f.id));
    await saveFolders(folders);

    // Move documents from deleted folders to root
    const allDocs = await storage.listDocumentsWithMeta();
    for (const doc of allDocs) {
      if (doc.meta.folderId && idsToDelete.has(doc.meta.folderId)) {
        doc.meta.folderId = null;
        await storage.saveDocMeta(doc.id, doc.meta);
      }
    }

    console.log(
      `[Server] Deleted folder tree: ${folderId} (${idsToDelete.size} folders)`,
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Delete folder error:", error);
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

// Move a folder to a new parent
app.post("/api/folders/:folderId/move", async (req, res) => {
  try {
    const { folderId } = req.params;
    const { parentId } = req.body;

    const folders = await loadFolders();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Prevent circular references
    if (parentId) {
      let cur = parentId;
      while (cur) {
        if (cur === folderId) {
          return res
            .status(400)
            .json({ error: "Cannot move folder into itself" });
        }
        const parent = folders.find((f) => f.id === cur);
        cur = parent?.parentId ?? null;
      }
    }

    folder.parentId = parentId || null;
    await saveFolders(folders);

    console.log(
      `[Server] Moved folder ${folderId} to parent ${parentId || "root"}`,
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Move folder error:", error);
    res.status(500).json({ error: "Failed to move folder" });
  }
});

// ============ DOCUMENT ENDPOINTS ============

// Save document endpoint
app.post("/api/save/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { snapshot, folderId, type } = req.body;

    if (!snapshot) {
      return res.status(400).json({ error: "Snapshot is required" });
    }

    await storage.saveDocument(documentId, snapshot);

    if (folderId !== undefined || type !== undefined) {
      const existing = await storage.loadDocMeta(documentId);
      if (folderId !== undefined) existing.folderId = folderId;
      if (type !== undefined) existing.type = type as DocumentType;
      await storage.saveDocMeta(documentId, existing);
    }

    console.log(`[Server] Saved document: ${documentId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Save error:", error);
    res.status(500).json({ error: "Failed to save document" });
  }
});

// Load document endpoint
app.get("/api/load/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const snapshot = await storage.loadDocument(documentId);
    if (snapshot) {
      const meta = await storage.loadDocMeta(documentId);
      console.log(`[Server] Loaded document: ${documentId}`);
      res.json({ snapshot, metadata: meta });
    } else {
      res.json({ snapshot: null, metadata: null });
    }
  } catch (error) {
    console.error("[Server] Load error:", error);
    res.status(500).json({ error: "Failed to load document" });
  }
});

// List documents endpoint (optionally filter by folder)
app.get("/api/documents", async (req, res) => {
  try {
    const folderId = req.query.folderId as string | undefined;
    const files = (await storage.listDocumentsWithMeta())
      .map((item) => ({
        id: item.id,
        name: item.meta.name || item.id,
        folderId: item.meta.folderId,
        type: item.meta.type || typeFromId(item.id),
        modifiedAt: item.modifiedAt,
      }))
      .filter((doc) => {
        // Filter by folder
        if (folderId === undefined) return true; // Return all
        if (folderId === "root") return doc.folderId === null;
        return doc.folderId === folderId;
      })
      .sort(
        (a, b) =>
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
      );

    res.json({ documents: files });
  } catch (error) {
    console.error("[Server] List error:", error);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

// Move document to folder
app.post("/api/documents/:documentId/move", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { folderId } = req.body;

    const meta = await storage.loadDocMeta(documentId);
    meta.folderId = folderId || null;
    await storage.saveDocMeta(documentId, meta);

    console.log(
      `[Server] Moved document ${documentId} to folder ${folderId || "root"}`,
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Move error:", error);
    res.status(500).json({ error: "Failed to move document" });
  }
});

// Delete document endpoint
app.delete("/api/delete/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const docMeta = await storage.loadDocMeta(documentId);
    const docType = docMeta.type || typeFromId(documentId);

    let deleted = false;
    if (docType === "pdf") {
      deleted = await storage.deleteFile(documentId, "pdf");
    } else {
      deleted = await storage.deleteDocument(documentId);
    }

    if (deleted) {
      await storage.deleteDocMeta(documentId);
      console.log(`[Server] Deleted document: ${documentId}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Document not found" });
    }
  } catch (error) {
    console.error("[Server] Delete error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Rename document endpoint
app.post("/api/rename/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({ error: "New name is required" });
    }

    const newDocumentId = newName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    if (!(await storage.existsDocument(documentId))) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (
      documentId !== newDocumentId &&
      (await storage.existsDocument(newDocumentId))
    ) {
      return res
        .status(400)
        .json({ error: "A document with that name already exists" });
    }

    // Rename file (renameDocument also moves the .meta.json)
    if (documentId !== newDocumentId) {
      await storage.renameDocument(documentId, newDocumentId);
    }

    // Update the name in metadata
    const meta = await storage.loadDocMeta(newDocumentId);
    meta.name = newName.trim();
    await storage.saveDocMeta(newDocumentId, meta);

    console.log(`[Server] Renamed document: ${documentId} -> ${newDocumentId}`);
    res.json({ success: true, newDocumentId });
  } catch (error) {
    console.error("[Server] Rename error:", error);
    res.status(500).json({ error: "Failed to rename document" });
  }
});

// ============ BULK ENDPOINTS ============

app.post("/api/bulk/move", async (req, res) => {
  try {
    const { documentIds, folderId } = req.body;
    if (!Array.isArray(documentIds)) {
      return res.status(400).json({ error: "documentIds array is required" });
    }
    for (const docId of documentIds) {
      const meta = await storage.loadDocMeta(docId);
      meta.folderId = folderId || null;
      await storage.saveDocMeta(docId, meta);
    }
    console.log(
      `[Server] Bulk moved ${documentIds.length} docs to ${folderId || "root"}`,
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Bulk move error:", error);
    res.status(500).json({ error: "Failed to bulk move" });
  }
});

app.post("/api/bulk/delete", async (req, res) => {
  try {
    const { documentIds } = req.body;
    if (!Array.isArray(documentIds)) {
      return res.status(400).json({ error: "documentIds array is required" });
    }
    for (const docId of documentIds) {
      const docMeta = await storage.loadDocMeta(docId);
      const docType = docMeta.type || typeFromId(docId);
      if (docType === "pdf") {
        await storage.deleteFile(docId, "pdf");
      } else {
        await storage.deleteDocument(docId);
      }
      await storage.deleteDocMeta(docId);
    }
    console.log(`[Server] Bulk deleted ${documentIds.length} docs`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Bulk delete error:", error);
    res.status(500).json({ error: "Failed to bulk delete" });
  }
});

// ============ FILE ENDPOINTS ============

// Upload a file (PDF)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const folderId = (req.body.folderId as string) || null;
    const originalName = file.originalname.replace(/\.[^.]+$/, "");
    const docId = `pdf-${Date.now()}`;
    const extension = "pdf";

    await storage.saveFile(docId, file.buffer, extension);

    await storage.saveDocMeta(docId, {
      folderId,
      name: originalName,
      type: "pdf",
    });

    console.log(`[Server] Uploaded file: ${docId} (${originalName})`);
    res.json({ success: true, documentId: docId, name: originalName });
  } catch (error) {
    console.error("[Server] Upload error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// Serve a raw file (PDF)
app.get("/api/file/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const buffer = await storage.loadFile(documentId, "pdf");
    if (!buffer) {
      return res.status(404).json({ error: "File not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${documentId}.pdf"`,
    );
    res.send(buffer);
  } catch (error) {
    console.error("[Server] File serve error:", error);
    res.status(500).json({ error: "Failed to serve file" });
  }
});

// Get document metadata (type lookup)
app.get("/api/meta/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const docMeta = await storage.loadDocMeta(documentId);
    res.json({
      type: docMeta.type || typeFromId(documentId),
      name: docMeta.name,
      folderId: docMeta.folderId,
    });
  } catch (error) {
    console.error("[Server] Meta error:", error);
    res.status(500).json({ error: "Failed to get metadata" });
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Serve static files in production
const clientPath = path.join(__dirname, "../client");
app.use(express.static(clientPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
const storageBackend =
  process.env.STORAGE_BACKEND?.toLowerCase() ||
  (process.env.MINIO_ACCESS_KEY &&
  process.env.MINIO_SECRET_KEY &&
  (process.env.MINIO_ENDPOINT_URL || process.env.MINIO_ENDPOINT)
    ? "minio(auto)"
    : "local(auto)");

storage
  .init()
  .then(() => {
    console.log(`[Server] Storage backend: ${storageBackend}`);
    server.listen(PORT, () => {
      console.log(
        `[Server] Drawbook server running on http://localhost:${PORT}`,
      );
      console.log(
        `[Server] WebSocket server running on ws://localhost:${PORT}/ws`,
      );
    });
  })
  .catch((error) => {
    console.error("[Server] Failed to initialize storage:", error);
    process.exit(1);
  });
