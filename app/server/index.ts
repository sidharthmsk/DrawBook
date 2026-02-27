import express from "express";
import cors from "cors";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import AdmZip from "adm-zip";
import {
  createStorageAdapter,
  sanitizeDocumentId,
  DocumentType,
  Folder,
  Template,
  FleetingNote,
} from "./storage.js";
import { createAiRouter } from "./ai.js";

function typeFromId(id: string): DocumentType {
  if (id.startsWith("excalidraw-")) return "excalidraw";
  if (id.startsWith("drawio-")) return "drawio";
  if (id.startsWith("markdown-")) return "markdown";
  if (id.startsWith("pdf-")) return "pdf";
  if (id.startsWith("spreadsheet-")) return "spreadsheet";
  if (id.startsWith("grid-")) return "grid";
  if (id.startsWith("kanban-")) return "kanban";
  return "tldraw";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env file in web/Docker mode only -- Electron sets its own env vars.
if (!process.env.ELECTRON) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  if (!process.env.MINIO_ENDPOINT_URL && !process.env.MINIO_ENDPOINT) {
    dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
  }
}

const APP_PASSWORD = process.env.APP_PASSWORD || "";
const AUTH_TOKEN = APP_PASSWORD
  ? crypto.createHash("sha256").update(APP_PASSWORD).digest("hex")
  : "";

const ENABLE_TLDRAW =
  (process.env.ENABLE_TLDRAW || "false").toLowerCase() === "true";
const ENABLE_LINKING =
  (process.env.ENABLE_LINKING || "false").toLowerCase() === "true";

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
app.set("trust proxy", 1);
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

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

const corsOrigins = process.env.CORS_ORIGINS?.split(",").filter(Boolean);
app.use(
  cors(
    corsOrigins?.length
      ? {
          origin: corsOrigins,
          credentials: true,
        }
      : undefined,
  ),
);
app.use(express.json({ limit: "50mb" }));

// ============ AUTH ENDPOINTS (public) ============

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/auth/login", loginLimiter, (req, res) => {
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

const ENV_FILE_PATH = process.env.ELECTRON
  ? path.resolve(process.env.DATA_DIR || ".", "..", ".env")
  : fs.existsSync(path.resolve(process.cwd(), ".env"))
    ? path.resolve(process.cwd(), ".env")
    : path.resolve(process.cwd(), "../.env");

const STORAGE_BACKEND =
  process.env.STORAGE_BACKEND?.toLowerCase() ||
  (process.env.MINIO_ACCESS_KEY &&
  process.env.MINIO_SECRET_KEY &&
  (process.env.MINIO_ENDPOINT_URL || process.env.MINIO_ENDPOINT)
    ? "minio"
    : "local");

app.get("/api/config", (_req, res) => {
  res.json({
    enableTldraw: ENABLE_TLDRAW,
    enableLinking: ENABLE_LINKING,
    storageBackend: STORAGE_BACKEND,
    isElectron: !!process.env.ELECTRON,
  });
});

// Protect all other /api routes
app.use("/api", requireAuth);

// ============ SETTINGS ENDPOINTS ============

const ENV_KEY_MAP: Record<string, string> = {
  appPassword: "APP_PASSWORD",
  enableTldraw: "ENABLE_TLDRAW",
  enableLinking: "ENABLE_LINKING",
  corsOrigins: "CORS_ORIGINS",
  storageBackend: "STORAGE_BACKEND",
  minioEndpointUrl: "MINIO_ENDPOINT_URL",
  minioAccessKey: "MINIO_ACCESS_KEY",
  minioSecretKey: "MINIO_SECRET_KEY",
  minioBucket: "MINIO_BUCKET",
  minioRegion: "MINIO_REGION",
  minioPrefix: "MINIO_PREFIX",
  groqApiKey: "GROQ_API_KEY",
};

const SECRET_FIELDS = new Set([
  "appPassword",
  "minioAccessKey",
  "minioSecretKey",
  "groqApiKey",
]);

function maskSecret(val: string): string {
  if (!val || val.length <= 4) return val ? "****" : "";
  return "****" + val.slice(-4);
}

function parseEnvFile(content: string): {
  lines: string[];
  vars: Record<string, string>;
} {
  const lines = content.split("\n");
  const vars: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    vars[key] = val;
  }
  return { lines, vars };
}

function writeEnvFile(
  filePath: string,
  existingContent: string,
  updates: Record<string, string>,
): string {
  const lines = existingContent.split("\n");
  const written = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      // Check if the next uncommented key is one we're updating
      // If this is a "# KEY=" comment and we have an update, uncomment it
      const commentMatch = trimmed.match(/^#\s*([A-Z_]+)\s*=/);
      if (commentMatch && commentMatch[1] in updates) {
        const key = commentMatch[1];
        result.push(`${key}=${updates[key]}`);
        written.add(key);
      } else {
        result.push(line);
      }
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      result.push(line);
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    if (key in updates) {
      result.push(`${key}=${updates[key]}`);
      written.add(key);
    } else {
      result.push(line);
    }
  }

  // Append any keys not already in the file
  for (const [key, val] of Object.entries(updates)) {
    if (!written.has(key)) {
      result.push(`${key}=${val}`);
    }
  }

  return result.join("\n");
}

app.get("/api/settings", (req, res) => {
  try {
    let envContent = "";
    try {
      envContent = fs.readFileSync(ENV_FILE_PATH, "utf-8");
    } catch {
      // .env may not exist yet
    }
    const { vars } = parseEnvFile(envContent);

    const settings: Record<string, string> = {};
    for (const [camelKey, envKey] of Object.entries(ENV_KEY_MAP)) {
      const raw = vars[envKey] ?? process.env[envKey] ?? "";
      settings[camelKey] = SECRET_FIELDS.has(camelKey) ? maskSecret(raw) : raw;
    }

    res.json({
      ...settings,
      hasPassword: !!APP_PASSWORD,
      hasGroqKey: !!process.env.GROQ_API_KEY,
      hasMinioCredentials: !!(
        process.env.MINIO_ACCESS_KEY &&
        process.env.MINIO_SECRET_KEY &&
        (process.env.MINIO_ENDPOINT_URL || process.env.MINIO_ENDPOINT)
      ),
    });
  } catch (error) {
    console.error("[Server] Settings read error:", error);
    res.status(500).json({ error: "Failed to read settings" });
  }
});

app.put("/api/settings", (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;

    // Password change validation
    if (body.appPassword !== undefined) {
      const newPassword = String(body.appPassword);
      const currentPassword = String(body.currentPassword || "");
      if (APP_PASSWORD && currentPassword !== APP_PASSWORD) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      body.appPassword = newPassword;
      delete body.currentPassword;
    }

    // Build env updates
    const envUpdates: Record<string, string> = {};
    for (const [camelKey, envKey] of Object.entries(ENV_KEY_MAP)) {
      if (camelKey in body) {
        const val = String(body[camelKey] ?? "");
        // Skip masked values (user didn't change the secret)
        if (SECRET_FIELDS.has(camelKey) && val.startsWith("****")) continue;
        envUpdates[envKey] = val;
      }
    }

    if (Object.keys(envUpdates).length === 0) {
      return res.json({ success: true, restart: false });
    }

    let existingContent = "";
    try {
      existingContent = fs.readFileSync(ENV_FILE_PATH, "utf-8");
    } catch {
      // .env may not exist yet
    }

    const newContent = writeEnvFile(ENV_FILE_PATH, existingContent, envUpdates);
    fs.writeFileSync(ENV_FILE_PATH, newContent, "utf-8");

    if (process.env.ELECTRON) {
      for (const [key, val] of Object.entries(envUpdates)) {
        process.env[key] = val;
      }
      console.log("[Server] Settings updated (applied in-process).");
      res.json({ success: true, restart: false });
    } else {
      console.log("[Server] Settings updated, restarting...");
      res.json({ success: true, restart: true });
      setTimeout(() => {
        process.exit(0);
      }, 500);
    }
  } catch (error) {
    console.error("[Server] Settings write error:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// AI routes
app.use("/api/ai", createAiRouter());

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

const MAX_VERSIONS = 10;
const versionStore = new Map<
  string,
  Array<{ timestamp: string; snapshot: unknown }>
>();

// Response cache for expensive endpoints (backlinks, link-graph, content search)
const responseCache = new Map<string, { data: unknown; time: number }>();
const RESPONSE_CACHE_TTL = 15_000; // 15 seconds

function getCachedResponse(key: string) {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.time < RESPONSE_CACHE_TTL) return entry.data;
  return null;
}

function setCachedResponse(key: string, data: unknown) {
  responseCache.set(key, { data, time: Date.now() });
}

function invalidateResponseCache() {
  responseCache.clear();
}

// Save document endpoint
app.post("/api/save/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { snapshot, folderId, type } = req.body;

    if (!snapshot) {
      return res.status(400).json({ error: "Snapshot is required" });
    }

    const prev = await storage.loadDocument(documentId);
    if (prev) {
      const versions = versionStore.get(documentId) || [];
      versions.push({ timestamp: new Date().toISOString(), snapshot: prev });
      if (versions.length > MAX_VERSIONS) versions.shift();
      versionStore.set(documentId, versions);
    }

    await storage.saveDocument(documentId, snapshot);

    const existing = await storage.loadDocMeta(documentId);
    if (!existing.createdAt) existing.createdAt = new Date().toISOString();
    if (folderId !== undefined) existing.folderId = folderId;
    if (type !== undefined) existing.type = type as DocumentType;
    await storage.saveDocMeta(documentId, existing);

    invalidateResponseCache();
    console.log(`[Server] Saved document: ${documentId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Save error:", error);
    res.status(500).json({ error: "Failed to save document" });
  }
});

// List version history
app.get("/api/versions/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const versions = versionStore.get(documentId) || [];
    res.json({
      versions: versions
        .map((v, i) => ({
          index: i,
          timestamp: v.timestamp,
        }))
        .reverse(),
    });
  } catch (error) {
    console.error("[Server] Version list error:", error);
    res.status(500).json({ error: "Failed to list versions" });
  }
});

// Restore a version
app.post("/api/versions/:documentId/restore", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { index } = req.body;
    const versions = versionStore.get(documentId) || [];
    if (index < 0 || index >= versions.length) {
      return res.status(404).json({ error: "Version not found" });
    }
    const current = await storage.loadDocument(documentId);
    if (current) {
      versions.push({ timestamp: new Date().toISOString(), snapshot: current });
      if (versions.length > MAX_VERSIONS) versions.shift();
      versionStore.set(documentId, versions);
    }
    await storage.saveDocument(documentId, versions[index].snapshot);
    console.log(`[Server] Restored version ${index} for ${documentId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Version restore error:", error);
    res.status(500).json({ error: "Failed to restore version" });
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
      .filter((item) => !item.meta.deletedAt)
      .map((item) => ({
        id: item.id,
        name: item.meta.name || item.id,
        folderId: item.meta.folderId,
        type: item.meta.type || typeFromId(item.id),
        modifiedAt: item.modifiedAt,
        createdAt: item.meta.createdAt || item.modifiedAt,
        starred: item.meta.starred || false,
        tags: item.meta.tags || [],
      }))
      .filter((doc) => {
        if (folderId === undefined) return true;
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

// Star/unstar document endpoint
app.post("/api/documents/:documentId/star", async (req, res) => {
  try {
    const { documentId } = req.params;
    const meta = await storage.loadDocMeta(documentId);
    meta.starred = !meta.starred;
    await storage.saveDocMeta(documentId, meta);
    res.json({ starred: !!meta.starred });
  } catch (error) {
    console.error("[Server] Star error:", error);
    res.status(500).json({ error: "Failed to toggle star" });
  }
});

// Set document tags endpoint
app.post("/api/documents/:documentId/tags", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { tags } = req.body as { tags: string[] };
    const meta = await storage.loadDocMeta(documentId);
    meta.tags = Array.isArray(tags) ? tags : [];
    await storage.saveDocMeta(documentId, meta);
    res.json({ tags: meta.tags });
  } catch (error) {
    console.error("[Server] Tags error:", error);
    res.status(500).json({ error: "Failed to update tags" });
  }
});

// Search documents endpoint
app.get("/api/documents/search", async (req, res) => {
  try {
    const q = ((req.query.q as string) || "").trim().toLowerCase();
    if (!q) {
      return res.json({ results: [] });
    }

    const all = await storage.listDocumentsWithMeta();
    const results = all
      .filter((item) => !item.meta.deletedAt)
      .filter((item) => {
        const name = (item.meta.name || item.id).toLowerCase();
        return name.includes(q);
      })
      .map((item) => ({
        id: item.id,
        name: item.meta.name || item.id,
        type: item.meta.type || typeFromId(item.id),
        folderId: item.meta.folderId,
        modifiedAt: item.modifiedAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
      );

    res.json({ results });
  } catch (error) {
    console.error("[Server] Search error:", error);
    res.status(500).json({ error: "Failed to search documents" });
  }
});

// Full-text search across document content
app.get("/api/search/content", async (req, res) => {
  try {
    const q = ((req.query.q as string) || "").trim().toLowerCase();
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const all = await storage.listDocumentsWithMeta();
    const active = all.filter((item) => !item.meta.deletedAt);
    const results: Array<{
      id: string;
      name: string;
      type: string;
      snippet: string;
      modifiedAt: string;
    }> = [];

    for (const item of active) {
      if (results.length >= 20) break;
      const name = (item.meta.name || item.id).toLowerCase();
      if (name.includes(q)) {
        results.push({
          id: item.id,
          name: item.meta.name || item.id,
          type: item.meta.type || typeFromId(item.id),
          snippet: `Name match: ${item.meta.name || item.id}`,
          modifiedAt: item.modifiedAt,
        });
        continue;
      }
      try {
        const doc = await storage.loadDocument(item.id);
        if (!doc) continue;
        const text = extractText(doc, item.meta.type || typeFromId(item.id));
        const idx = text.toLowerCase().indexOf(q);
        if (idx >= 0) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + q.length + 40);
          const snippet =
            (start > 0 ? "..." : "") +
            text.slice(start, end) +
            (end < text.length ? "..." : "");
          results.push({
            id: item.id,
            name: item.meta.name || item.id,
            type: item.meta.type || typeFromId(item.id),
            snippet,
            modifiedAt: item.modifiedAt,
          });
        }
      } catch {
        // skip unreadable docs
      }
    }

    res.json({ results });
  } catch (error) {
    console.error("[Server] Content search error:", error);
    res.status(500).json({ error: "Failed to search content" });
  }
});

// Resolve document name to ID (for [[links]])
app.get("/api/resolve", async (req, res) => {
  try {
    const name = ((req.query.name as string) || "").trim();
    if (!name) return res.json({ document: null });

    const all = await storage.listDocumentsWithMeta();
    const nameLower = name.toLowerCase();

    const exact = all.find(
      (item) =>
        !item.meta.deletedAt &&
        (item.meta.name || item.id).toLowerCase() === nameLower,
    );
    if (exact) {
      return res.json({
        document: {
          id: exact.id,
          name: exact.meta.name || exact.id,
          type: exact.meta.type || typeFromId(exact.id),
        },
      });
    }

    const partial = all.find(
      (item) =>
        !item.meta.deletedAt &&
        (item.meta.name || item.id).toLowerCase().includes(nameLower),
    );
    if (partial) {
      return res.json({
        document: {
          id: partial.id,
          name: partial.meta.name || partial.id,
          type: partial.meta.type || typeFromId(partial.id),
        },
      });
    }

    res.json({ document: null });
  } catch (error) {
    console.error("[Server] Resolve error:", error);
    res.status(500).json({ error: "Failed to resolve document" });
  }
});

// Get backlinks for a document (which docs link to this one)
app.get("/api/backlinks/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const cacheKey = `backlinks:${documentId}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) return res.json(cached);

    const meta = await storage.loadDocMeta(documentId);
    const docName = meta.name || documentId;
    const nameLower = docName.toLowerCase();

    const all = await storage.listDocumentsWithMeta();
    const backlinks: Array<{ id: string; name: string; type: string }> = [];

    for (const item of all) {
      if (item.meta.deletedAt || item.id === documentId) continue;
      try {
        const doc = await storage.loadDocument(item.id);
        if (!doc) continue;
        const text = extractText(doc, item.meta.type || typeFromId(item.id));
        const textLower = text.toLowerCase();
        if (
          textLower.includes(`[[${nameLower}]]`) ||
          textLower.includes(`[[${documentId.toLowerCase()}]]`)
        ) {
          backlinks.push({
            id: item.id,
            name: item.meta.name || item.id,
            type: item.meta.type || typeFromId(item.id),
          });
        }
      } catch {
        // skip unreadable docs
      }
    }

    const result = { backlinks };
    setCachedResponse(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error("[Server] Backlinks error:", error);
    res.status(500).json({ error: "Failed to get backlinks" });
  }
});

// List all document names (for autocomplete)
app.get("/api/documents/names", async (req, res) => {
  try {
    const all = await storage.listDocumentsWithMeta();
    const names = all
      .filter((item) => !item.meta.deletedAt)
      .map((item) => ({
        id: item.id,
        name: item.meta.name || item.id,
        type: item.meta.type || typeFromId(item.id),
      }));
    res.json({ documents: names });
  } catch (error) {
    console.error("[Server] Names error:", error);
    res.status(500).json({ error: "Failed to list names" });
  }
});

// Extract structured data from documents for flowchart generation
app.post("/api/extract-structure", async (req, res) => {
  try {
    const { documentIds } = req.body as { documentIds: string[] };
    if (!documentIds?.length)
      return res.status(400).json({ error: "No document IDs provided" });

    const results: Array<{
      id: string;
      name: string;
      type: string;
      nodes: Array<{ label: string; children?: string[] }>;
    }> = [];

    for (const docId of documentIds) {
      try {
        const meta = await storage.loadDocMeta(docId);
        const doc = await storage.loadDocument(docId);
        if (!doc) continue;
        const type = meta.type || typeFromId(docId);
        const name = meta.name || docId;
        const nodes: Array<{ label: string; children?: string[] }> = [];

        if (type === "markdown") {
          const content = (doc as any)?.content || "";
          const lines = content.split("\n");
          let currentSection: { label: string; children: string[] } | null =
            null;
          for (const line of lines) {
            const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
            if (headingMatch) {
              if (currentSection) nodes.push(currentSection);
              currentSection = { label: headingMatch[2].trim(), children: [] };
            } else if (currentSection && line.trim().startsWith("- ")) {
              currentSection.children.push(line.trim().slice(2));
            }
          }
          if (currentSection) nodes.push(currentSection);
          if (nodes.length === 0) {
            nodes.push({ label: name });
          }
        } else if (type === "kanban") {
          const columns = (doc as any)?.columns || [];
          const cards = (doc as any)?.cards || {};
          for (const col of columns) {
            const cardLabels = (col.cardIds || []).map((cid: string) => {
              const card = cards[cid];
              return card?.title || cid;
            });
            nodes.push({ label: col.title || "Column", children: cardLabels });
          }
        } else if (type === "spreadsheet") {
          nodes.push({ label: name, children: ["Spreadsheet data"] });
        } else {
          const text = extractText(doc, type);
          const words = text.split(/\s+/).filter(Boolean).slice(0, 20);
          nodes.push({
            label: name,
            children: words.length > 0 ? [words.join(" ")] : undefined,
          });
        }

        results.push({ id: docId, name, type, nodes });
      } catch {
        // skip unreadable docs
      }
    }

    res.json({ documents: results });
  } catch (error) {
    console.error("[Server] Extract structure error:", error);
    res.status(500).json({ error: "Failed to extract structure" });
  }
});

// Get the full link graph between documents
app.get("/api/link-graph", async (_req, res) => {
  try {
    const cached = getCachedResponse("link-graph");
    if (cached) return res.json(cached);

    const all = await storage.listDocumentsWithMeta();
    const active = all.filter((item) => !item.meta.deletedAt);
    const nameToId = new Map<string, string>();
    for (const item of active) {
      const name = (item.meta.name || item.id).toLowerCase();
      nameToId.set(name, item.id);
    }

    const LINK_RE = /\[\[([^\]]+)\]\]/g;
    const nodes: Array<{ id: string; name: string; type: string }> = [];
    const edges: Array<{ source: string; target: string }> = [];

    for (const item of active) {
      const type = item.meta.type || typeFromId(item.id);
      nodes.push({ id: item.id, name: item.meta.name || item.id, type });

      try {
        const doc = await storage.loadDocument(item.id);
        if (!doc) continue;
        const text = extractText(doc, type);
        let match: RegExpExecArray | null;
        const seen = new Set<string>();
        while ((match = LINK_RE.exec(text)) !== null) {
          const linkName = match[1].toLowerCase();
          const targetId = nameToId.get(linkName);
          if (targetId && targetId !== item.id && !seen.has(targetId)) {
            seen.add(targetId);
            edges.push({ source: item.id, target: targetId });
          }
        }
      } catch {
        // skip unreadable docs
      }
    }

    const result = { nodes, edges };
    setCachedResponse("link-graph", result);
    res.json(result);
  } catch (error) {
    console.error("[Server] Link graph error:", error);
    res.status(500).json({ error: "Failed to build link graph" });
  }
});

function extractText(doc: any, type: string): string {
  if (type === "markdown") {
    return doc?.content || "";
  }
  if (type === "kanban") {
    const parts: string[] = [];
    if (doc?.columns) {
      for (const col of doc.columns) {
        parts.push(col.title || "");
      }
    }
    if (doc?.cards) {
      for (const card of doc.cards) {
        parts.push(card.title || "");
        if (card.description) parts.push(card.description);
      }
    }
    return parts.join(" ");
  }
  if (type === "excalidraw") {
    const elements = doc?.elements || [];
    return elements
      .map((e: any) => e.text || "")
      .filter(Boolean)
      .join(" ");
  }
  if (type === "drawio") {
    return typeof doc === "string" ? doc : JSON.stringify(doc);
  }
  if (type === "code") {
    const lang = doc?.language || "code";
    return doc?.content ? `${lang} file:\n${doc.content}` : "";
  }
  if (type === "grid") {
    const cols: Array<{ id: string; name: string }> = doc?.columns || [];
    const rows: Array<{ id: string; cells: Record<string, unknown> }> =
      doc?.rows || [];
    if (cols.length === 0) return "";
    const header = cols.map((c) => c.name).join(" | ");
    const body = rows
      .slice(0, 100)
      .map((r) =>
        cols
          .map((c) => {
            const v = r.cells?.[c.id];
            if (v === null || v === undefined) return "";
            if (Array.isArray(v)) return v.join(", ");
            return String(v);
          })
          .join(" | "),
      )
      .join("\n");
    return `Table:\n${header}\n${body}`;
  }
  if (type === "spreadsheet") {
    const sheets = doc?.sheets;
    if (!sheets || typeof sheets !== "object") return "";
    const parts: string[] = [];
    for (const [, sheet] of Object.entries(sheets) as [string, any][]) {
      const cellData = sheet.cellData;
      if (!cellData) continue;
      for (const [rowIdx, row] of Object.entries(cellData) as [string, any][]) {
        if (!row) continue;
        for (const [colIdx, cell] of Object.entries(row) as [string, any][]) {
          const val = (cell as any)?.v;
          if (val !== undefined && val !== null && val !== "") {
            parts.push(`[${rowIdx},${colIdx}]: ${String(val).slice(0, 100)}`);
          }
        }
      }
      break;
    }
    return parts.length > 0 ? `Spreadsheet:\n${parts.join("\n")}` : "";
  }
  return "";
}

app.get("/api/document-context/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const meta = await storage.loadDocMeta(documentId);
    const type = meta.type || typeFromId(documentId);
    const name = meta.name || documentId;
    const doc = await storage.loadDocument(documentId);
    if (!doc) {
      return res.json({ name, type, context: "Document is empty." });
    }
    const text = extractText(doc, type);
    const context = text
      ? `[${type}: "${name}"]\n${text.slice(0, 5000)}`
      : `[${type}: "${name}"] (empty)`;
    res.json({ name, type, context });
  } catch (err) {
    console.error("[Server] Document context error:", err);
    res.status(500).json({ error: "Failed to load document context" });
  }
});

// Duplicate document endpoint
app.post("/api/duplicate/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const snapshot = await storage.loadDocument(documentId);
    if (!snapshot) {
      return res.status(404).json({ error: "Document not found" });
    }

    const meta = await storage.loadDocMeta(documentId);
    const docType = meta.type || typeFromId(documentId);
    const newId = `${docType}-${Date.now()}`;
    const newName = `${meta.name || documentId} (Copy)`;

    await storage.saveDocument(newId, snapshot);
    await storage.saveDocMeta(newId, {
      folderId: meta.folderId,
      name: newName,
      type: docType,
      createdAt: new Date().toISOString(),
    });

    console.log(`[Server] Duplicated document: ${documentId} -> ${newId}`);
    res.json({ success: true, documentId: newId, name: newName });
  } catch (error) {
    console.error("[Server] Duplicate error:", error);
    res.status(500).json({ error: "Failed to duplicate document" });
  }
});

// Soft-delete document (move to trash)
app.delete("/api/delete/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const permanent = req.query.permanent === "true";

    if (permanent) {
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
        invalidateResponseCache();
        console.log(`[Server] Permanently deleted: ${documentId}`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Document not found" });
      }
    } else {
      const meta = await storage.loadDocMeta(documentId);
      meta.deletedAt = new Date().toISOString();
      await storage.saveDocMeta(documentId, meta);
      invalidateResponseCache();
      console.log(`[Server] Moved to trash: ${documentId}`);
      res.json({ success: true });
    }
  } catch (error) {
    console.error("[Server] Delete error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Restore document from trash
app.post("/api/trash/:documentId/restore", async (req, res) => {
  try {
    const { documentId } = req.params;
    const meta = await storage.loadDocMeta(documentId);
    delete meta.deletedAt;
    await storage.saveDocMeta(documentId, meta);
    invalidateResponseCache();
    console.log(`[Server] Restored from trash: ${documentId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Restore error:", error);
    res.status(500).json({ error: "Failed to restore document" });
  }
});

// List trash
app.get("/api/trash", async (req, res) => {
  try {
    const all = await storage.listDocumentsWithMeta();
    const trashed = all
      .filter((item) => item.meta.deletedAt)
      .map((item) => ({
        id: item.id,
        name: item.meta.name || item.id,
        type: item.meta.type || typeFromId(item.id),
        deletedAt: item.meta.deletedAt,
        modifiedAt: item.modifiedAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime(),
      );
    res.json({ documents: trashed });
  } catch (error) {
    console.error("[Server] Trash list error:", error);
    res.status(500).json({ error: "Failed to list trash" });
  }
});

// Empty trash (permanently delete all trashed docs)
app.post("/api/trash/empty", async (req, res) => {
  try {
    const all = await storage.listDocumentsWithMeta();
    const trashed = all.filter((item) => item.meta.deletedAt);
    for (const item of trashed) {
      const docType = item.meta.type || typeFromId(item.id);
      if (docType === "pdf") {
        await storage.deleteFile(item.id, "pdf");
      } else {
        await storage.deleteDocument(item.id);
      }
      await storage.deleteDocMeta(item.id);
    }
    console.log(`[Server] Emptied trash: ${trashed.length} docs`);
    res.json({ success: true, count: trashed.length });
  } catch (error) {
    console.error("[Server] Empty trash error:", error);
    res.status(500).json({ error: "Failed to empty trash" });
  }
});

// Rename document endpoint
app.post("/api/rename/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: "New name is required" });
    }

    const newDocumentId =
      newName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "") || "untitled";

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

    invalidateResponseCache();
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
    const now = new Date().toISOString();
    for (const docId of documentIds) {
      const meta = await storage.loadDocMeta(docId);
      meta.deletedAt = now;
      await storage.saveDocMeta(docId, meta);
    }
    console.log(`[Server] Bulk trashed ${documentIds.length} docs`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Bulk delete error:", error);
    res.status(500).json({ error: "Failed to bulk delete" });
  }
});

// ============ FILE ENDPOINTS ============

// Upload a file (PDF)
const PDF_MAGIC = Buffer.from("%PDF", "utf8");

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const folderId = (req.body.folderId as string) || null;
    const originalName = file.originalname.replace(/\.[^.]+$/, "");

    if (ext === ".md") {
      const content = file.buffer.toString("utf-8");
      const docId = `markdown-${Date.now()}`;
      await storage.saveDocument(docId, { content });
      await storage.saveDocMeta(docId, {
        folderId,
        name: originalName,
        type: "markdown",
        createdAt: new Date().toISOString(),
      });
      console.log(`[Server] Imported markdown: ${docId} (${originalName})`);
      return res.json({ success: true, documentId: docId, name: originalName });
    }

    if (ext === ".csv") {
      const text = file.buffer.toString("utf-8");
      const rows = text.split("\n").map((line) => line.split(","));
      const cellData: Record<number, Record<number, { v: string }>> = {};
      rows.forEach((row, ri) => {
        cellData[ri] = {};
        row.forEach((cell, ci) => {
          const val = cell.trim().replace(/^"|"$/g, "");
          if (val) cellData[ri][ci] = { v: val };
        });
      });
      const snapshot = {
        sheets: {
          sheet1: {
            id: "sheet1",
            name: "Sheet1",
            cellData,
            rowCount: Math.max(rows.length, 20),
            columnCount: Math.max(...rows.map((r) => r.length), 10),
          },
        },
      };
      const docId = `spreadsheet-${Date.now()}`;
      await storage.saveDocument(docId, snapshot);
      await storage.saveDocMeta(docId, {
        folderId,
        name: originalName,
        type: "spreadsheet",
        createdAt: new Date().toISOString(),
      });
      console.log(`[Server] Imported CSV: ${docId} (${originalName})`);
      return res.json({ success: true, documentId: docId, name: originalName });
    }

    if (ext !== ".pdf") {
      return res
        .status(400)
        .json({ error: "Supported formats: .pdf, .md, .csv" });
    }
    if (!file.buffer.subarray(0, 4).equals(PDF_MAGIC)) {
      return res.status(400).json({ error: "File is not a valid PDF" });
    }

    const docId = `pdf-${Date.now()}`;
    await storage.saveFile(docId, file.buffer, "pdf");
    await storage.saveDocMeta(docId, {
      folderId,
      name: originalName,
      type: "pdf",
      createdAt: new Date().toISOString(),
    });

    console.log(`[Server] Uploaded file: ${docId} (${originalName})`);
    res.json({ success: true, documentId: docId, name: originalName });
  } catch (error) {
    console.error("[Server] Upload error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// Import Obsidian vault from zip
app.post("/api/import/obsidian", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".zip") {
      return res.status(400).json({ error: "Please upload a .zip file" });
    }

    const targetFolderId = (req.body.folderId as string) || null;
    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();

    // Build folder structure from zip paths
    const folderMap = new Map<string, string>(); // zip path -> folder id
    const existingFolders = await loadFolders();
    const newFolders: Folder[] = [];

    // Create a root folder for the vault
    const vaultName =
      file.originalname.replace(/\.zip$/i, "") || "Obsidian Vault";
    const vaultFolderId = `folder-${Date.now()}`;
    newFolders.push({
      id: vaultFolderId,
      name: vaultName,
      parentId: targetFolderId,
      createdAt: new Date().toISOString(),
    });
    folderMap.set("", vaultFolderId);

    // Collect all unique directory paths
    const dirPaths = new Set<string>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName;
      // Strip leading vault folder if all entries share one
      const parts = name.split("/");
      if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
          dirPaths.add(parts.slice(0, i).join("/"));
        }
      }
    }

    // Detect common root prefix (Obsidian exports often wrap in a folder)
    let commonPrefix = "";
    const allPaths = entries
      .filter((e) => !e.isDirectory)
      .map((e) => e.entryName);
    if (allPaths.length > 0) {
      const firstParts = allPaths[0].split("/");
      if (
        firstParts.length > 1 &&
        allPaths.every((p) => p.startsWith(firstParts[0] + "/"))
      ) {
        commonPrefix = firstParts[0] + "/";
      }
    }

    // Create folders
    const sortedDirs = [...dirPaths].sort();
    for (const dirPath of sortedDirs) {
      let relative = dirPath;
      if (commonPrefix && relative.startsWith(commonPrefix)) {
        relative = relative.slice(commonPrefix.length);
      }
      if (!relative || folderMap.has(relative)) continue;

      const parts = relative.split("/");
      const folderName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join("/");
      const parentId = folderMap.get(parentPath) || vaultFolderId;

      const folderId = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      newFolders.push({
        id: folderId,
        name: folderName,
        parentId,
        createdAt: new Date().toISOString(),
      });
      folderMap.set(relative, folderId);
    }

    await saveFolders([...existingFolders, ...newFolders]);

    // Import files
    let imported = 0;
    let skipped = 0;
    const importedDocs: Array<{ id: string; name: string; type: string }> = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      let entryName = entry.entryName;
      if (commonPrefix && entryName.startsWith(commonPrefix)) {
        entryName = entryName.slice(commonPrefix.length);
      }

      const entryExt = path.extname(entryName).toLowerCase();
      const baseName = path.basename(entryName, entryExt);
      const dirPart = path.dirname(entryName);
      const folderId =
        dirPart === "."
          ? vaultFolderId
          : folderMap.get(dirPart) || vaultFolderId;

      // Skip Obsidian config files
      if (
        entryName.startsWith(".obsidian/") ||
        entryName.startsWith(".obsidian\\") ||
        entryName.startsWith(".trash/")
      ) {
        skipped++;
        continue;
      }

      const buf = entry.getData();

      if (entryExt === ".md") {
        let content = buf.toString("utf-8");
        // Convert Obsidian wikilinks [[target]] are already in our format
        // Convert ![[embed]] image embeds to markdown image syntax
        content = content.replace(
          /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
          (_, target, alt) => `![${alt || target}](${target})`,
        );
        const docId = `markdown-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await storage.saveDocument(docId, { content });
        await storage.saveDocMeta(docId, {
          folderId,
          name: baseName,
          type: "markdown",
          createdAt: new Date().toISOString(),
        });
        importedDocs.push({ id: docId, name: baseName, type: "markdown" });
        imported++;
      } else if (entryExt === ".pdf") {
        const docId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await storage.saveFile(docId, buf, "pdf");
        await storage.saveDocMeta(docId, {
          folderId,
          name: baseName,
          type: "pdf",
          createdAt: new Date().toISOString(),
        });
        importedDocs.push({ id: docId, name: baseName, type: "pdf" });
        imported++;
      } else if (entryExt === ".csv") {
        const text = buf.toString("utf-8");
        const rows = text.split("\n").map((line: string) => line.split(","));
        const cellData: Record<number, Record<number, { v: string }>> = {};
        rows.forEach((row: string[], ri: number) => {
          cellData[ri] = {};
          row.forEach((cell: string, ci: number) => {
            const val = cell.trim().replace(/^"|"$/g, "");
            if (val) cellData[ri][ci] = { v: val };
          });
        });
        const snapshot = {
          sheets: {
            sheet1: {
              id: "sheet1",
              name: "Sheet1",
              cellData,
              rowCount: Math.max(rows.length, 20),
              columnCount: Math.max(...rows.map((r: string[]) => r.length), 10),
            },
          },
        };
        const docId = `spreadsheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await storage.saveDocument(docId, snapshot);
        await storage.saveDocMeta(docId, {
          folderId,
          name: baseName,
          type: "spreadsheet",
          createdAt: new Date().toISOString(),
        });
        importedDocs.push({
          id: docId,
          name: baseName,
          type: "spreadsheet",
        });
        imported++;
      } else if (
        [".json", ".canvas"].includes(entryExt) &&
        !entryName.includes(".obsidian")
      ) {
        // Obsidian canvas files or JSON data
        try {
          const text = buf.toString("utf-8");
          const content = `# ${baseName}\n\n\`\`\`json\n${text}\n\`\`\`\n`;
          const docId = `markdown-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await storage.saveDocument(docId, { content });
          await storage.saveDocMeta(docId, {
            folderId,
            name: baseName,
            type: "markdown",
            createdAt: new Date().toISOString(),
          });
          importedDocs.push({
            id: docId,
            name: baseName,
            type: "markdown",
          });
          imported++;
        } catch {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    invalidateResponseCache();
    console.log(
      `[Server] Obsidian import: ${imported} imported, ${skipped} skipped, ${newFolders.length} folders`,
    );
    res.json({
      success: true,
      imported,
      skipped,
      folders: newFolders.length,
      documents: importedDocs,
      vaultFolderId,
    });
  } catch (error) {
    console.error("[Server] Obsidian import error:", error);
    res.status(500).json({ error: "Failed to import Obsidian vault" });
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

    const safeFilename = documentId.replace(/[^\w.-]/g, "_") + ".pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
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

// ============ TEMPLATE ENDPOINTS ============

app.get("/api/templates", async (_req, res) => {
  try {
    const templates = await storage.loadTemplates();
    res.json({ templates });
  } catch (error) {
    console.error("[Server] Templates list error:", error);
    res.status(500).json({ error: "Failed to load templates" });
  }
});

app.post("/api/templates", async (req, res) => {
  try {
    const { name, type, snapshot } = req.body;
    if (!name || !type || !snapshot) {
      return res
        .status(400)
        .json({ error: "name, type, and snapshot are required" });
    }
    const template: Template = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      type: type as DocumentType,
      snapshot,
      createdAt: new Date().toISOString(),
    };
    const templates = await storage.loadTemplates();
    templates.push(template);
    await storage.saveTemplates(templates);
    console.log(`[Server] Created template: ${template.name}`);
    res.json({ template });
  } catch (error) {
    console.error("[Server] Template create error:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

app.post("/api/templates/:templateId/use", async (req, res) => {
  try {
    const { templateId } = req.params;
    const { folderId } = req.body;
    const templates = await storage.loadTemplates();
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return res.status(404).json({ error: "Template not found" });

    const docId = `${tpl.type}-${Date.now()}`;
    await storage.saveDocument(docId, tpl.snapshot);
    await storage.saveDocMeta(docId, {
      folderId: folderId || null,
      name: tpl.name,
      type: tpl.type,
      createdAt: new Date().toISOString(),
    });
    invalidateResponseCache();
    console.log(`[Server] Created doc from template: ${tpl.name} -> ${docId}`);
    res.json({ documentId: docId, type: tpl.type });
  } catch (error) {
    console.error("[Server] Template use error:", error);
    res.status(500).json({ error: "Failed to create from template" });
  }
});

app.delete("/api/templates/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;
    const templates = await storage.loadTemplates();
    const filtered = templates.filter((t) => t.id !== templateId);
    if (filtered.length === templates.length) {
      return res.status(404).json({ error: "Template not found" });
    }
    await storage.saveTemplates(filtered);
    console.log(`[Server] Deleted template: ${templateId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Template delete error:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

app.post("/api/templates/from-doc/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { name } = req.body;

    const meta = await storage.loadDocMeta(documentId);
    const docType = meta.type || typeFromId(documentId);
    let snapshot: unknown;
    if (docType === "pdf") {
      return res
        .status(400)
        .json({ error: "PDF documents cannot be saved as templates" });
    }
    snapshot = await storage.loadDocument(documentId);
    if (!snapshot) {
      return res.status(404).json({ error: "Document not found" });
    }

    const templateName = (name || meta.name || documentId).trim();
    const template: Template = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: templateName,
      type: docType,
      snapshot,
      createdAt: new Date().toISOString(),
    };
    const templates = await storage.loadTemplates();
    templates.push(template);
    await storage.saveTemplates(templates);
    console.log(
      `[Server] Saved doc as template: ${documentId} -> ${template.name}`,
    );
    res.json({ template });
  } catch (error) {
    console.error("[Server] Save as template error:", error);
    res.status(500).json({ error: "Failed to save as template" });
  }
});

// ============ DAILY NOTES ============

const DAILY_NOTE_PREFIX = "daily-";
const DAILY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dailyNoteId(date: string) {
  return `${DAILY_NOTE_PREFIX}${date}`;
}

function dailyNoteTemplate(date: string) {
  const d = new Date(date + "T00:00:00");
  const formatted = d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `# ${formatted}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n\n`;
}

app.get("/api/daily-note/:date", async (req, res) => {
  try {
    const { date } = req.params;
    if (!DAILY_DATE_RE.test(date)) {
      return res
        .status(400)
        .json({ error: "Invalid date format, use YYYY-MM-DD" });
    }

    const docId = dailyNoteId(date);
    const exists = await storage.existsDocument(docId);

    if (!exists) {
      const content = dailyNoteTemplate(date);
      await storage.saveDocument(docId, { content });
      await storage.saveDocMeta(docId, {
        folderId: null,
        name: date,
        type: "markdown",
        createdAt: new Date().toISOString(),
        tags: ["daily-note"],
      });
      invalidateResponseCache();
      console.log(`[Server] Created daily note: ${date}`);
    }

    res.json({ documentId: docId, date, created: !exists });
  } catch (error) {
    console.error("[Server] Daily note error:", error);
    res.status(500).json({ error: "Failed to get daily note" });
  }
});

app.get("/api/daily-notes", async (_req, res) => {
  try {
    const all = await storage.listDocumentsWithMeta();
    const notes = all
      .filter(
        (item) => !item.meta.deletedAt && item.id.startsWith(DAILY_NOTE_PREFIX),
      )
      .map((item) => ({
        id: item.id,
        date: item.id.replace(DAILY_NOTE_PREFIX, ""),
        name: item.meta.name || item.id,
        modifiedAt: item.modifiedAt,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json({ notes });
  } catch (error) {
    console.error("[Server] Daily notes list error:", error);
    res.status(500).json({ error: "Failed to list daily notes" });
  }
});

// ============ FLEETING NOTES ============

app.get("/api/fleeting", async (_req, res) => {
  try {
    const notes = await storage.loadFleetingNotes();
    res.json({ notes });
  } catch (error) {
    console.error("[Server] Fleeting notes list error:", error);
    res.status(500).json({ error: "Failed to load fleeting notes" });
  }
});

app.post("/api/fleeting", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }
    const note: FleetingNote = {
      id: `fn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: text.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    };
    const notes = await storage.loadFleetingNotes();
    notes.unshift(note);
    await storage.saveFleetingNotes(notes);
    res.json({ note });
  } catch (error) {
    console.error("[Server] Fleeting note create error:", error);
    res.status(500).json({ error: "Failed to create fleeting note" });
  }
});

app.patch("/api/fleeting/:noteId", async (req, res) => {
  try {
    const { noteId } = req.params;
    const { text, done } = req.body;
    const notes = await storage.loadFleetingNotes();
    const note = notes.find((n) => n.id === noteId);
    if (!note) return res.status(404).json({ error: "Note not found" });
    if (text !== undefined) note.text = text;
    if (done !== undefined) note.done = done;
    await storage.saveFleetingNotes(notes);
    res.json({ note });
  } catch (error) {
    console.error("[Server] Fleeting note update error:", error);
    res.status(500).json({ error: "Failed to update fleeting note" });
  }
});

app.delete("/api/fleeting/:noteId", async (req, res) => {
  try {
    const { noteId } = req.params;
    const notes = await storage.loadFleetingNotes();
    const filtered = notes.filter((n) => n.id !== noteId);
    if (filtered.length === notes.length) {
      return res.status(404).json({ error: "Note not found" });
    }
    await storage.saveFleetingNotes(filtered);
    res.json({ success: true });
  } catch (error) {
    console.error("[Server] Fleeting note delete error:", error);
    res.status(500).json({ error: "Failed to delete fleeting note" });
  }
});

app.post("/api/fleeting/:noteId/open-as", async (req, res) => {
  try {
    const { noteId } = req.params;
    const { type } = req.body;
    const docType = (type || "markdown") as DocumentType;
    const notes = await storage.loadFleetingNotes();
    const note = notes.find((n) => n.id === noteId);
    if (!note) return res.status(404).json({ error: "Note not found" });

    const prefix = docType === "tldraw" ? "drawing" : docType;
    const docId = `${prefix}-${Date.now()}`;
    const name = note.text.slice(0, 60);

    let snapshot: unknown;
    if (docType === "markdown") {
      snapshot = { content: `# ${name}\n\n${note.text}\n` };
    } else if (docType === "kanban") {
      snapshot = {
        columns: [
          { id: "col-todo", title: "To Do", cardIds: ["c1"] },
          { id: "col-progress", title: "In Progress", cardIds: [] },
          { id: "col-done", title: "Done", cardIds: [] },
        ],
        cards: [{ id: "c1", title: note.text, description: "" }],
      };
    } else {
      snapshot = {};
    }

    await storage.saveDocument(docId, snapshot);
    await storage.saveDocMeta(docId, {
      folderId: null,
      name,
      type: docType,
      createdAt: new Date().toISOString(),
    });

    note.done = true;
    note.documentId = docId;
    await storage.saveFleetingNotes(notes);
    invalidateResponseCache();

    res.json({ documentId: docId, type: docType });
  } catch (error) {
    console.error("[Server] Fleeting open-as error:", error);
    res.status(500).json({ error: "Failed to open as document" });
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

export async function startServer(overrides?: {
  port?: number;
  dataDir?: string;
}): Promise<number> {
  if (overrides?.port) process.env.PORT = String(overrides.port);
  if (overrides?.dataDir) process.env.DATA_DIR = overrides.dataDir;

  const port = Number(process.env.PORT) || 3000;

  await storage.init();
  console.log(`[Server] Storage backend: ${STORAGE_BACKEND}`);

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(
        `[Server] Drawbook server running on http://localhost:${port}`,
      );
      console.log(
        `[Server] WebSocket server running on ws://localhost:${port}/ws`,
      );
      resolve(port);
    });
    server.on("error", reject);
  });
}

if (!process.env.ELECTRON) {
  startServer().catch((error) => {
    console.error("[Server] Failed to initialize storage:", error);
    process.exit(1);
  });
}
