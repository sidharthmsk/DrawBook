import fs from "fs/promises";
import path from "path";
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "pdf"
  | "spreadsheet"
  | "grid"
  | "kanban";

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface DocMetadata {
  folderId: string | null;
  name?: string;
  type?: DocumentType;
}

export interface StoredDocumentInfo {
  id: string;
  modifiedAt: string;
}

export interface DocumentWithMeta extends StoredDocumentInfo {
  meta: DocMetadata;
}

const VALID_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const VALID_EXT_RE = /^[a-z0-9]+$/;

export function sanitizeDocumentId(id: string): string {
  if (!id || id.includes("..") || !VALID_ID_RE.test(id)) {
    throw new Error(`Invalid document ID: ${id}`);
  }
  return id;
}

function sanitizeExtension(ext: string): string {
  if (!ext || !VALID_EXT_RE.test(ext)) {
    throw new Error(`Invalid file extension: ${ext}`);
  }
  return ext;
}

export interface StorageAdapter {
  init(): Promise<void>;

  loadFolders(): Promise<Folder[]>;
  saveFolders(folders: Folder[]): Promise<void>;

  loadDocMeta(documentId: string): Promise<DocMetadata>;
  saveDocMeta(documentId: string, meta: DocMetadata): Promise<void>;
  deleteDocMeta(documentId: string): Promise<void>;

  saveDocument(documentId: string, snapshot: unknown): Promise<void>;
  loadDocument(documentId: string): Promise<unknown | null>;
  listDocumentsWithMeta(): Promise<DocumentWithMeta[]>;
  deleteDocument(documentId: string): Promise<boolean>;
  existsDocument(documentId: string): Promise<boolean>;
  renameDocument(oldDocumentId: string, newDocumentId: string): Promise<void>;

  saveFile(
    documentId: string,
    buffer: Buffer,
    extension: string,
  ): Promise<void>;
  loadFile(documentId: string, extension: string): Promise<Buffer | null>;
  deleteFile(documentId: string, extension: string): Promise<boolean>;
}

// ─── Local Filesystem ───

class LocalStorageAdapter implements StorageAdapter {
  constructor(private dataDir: string) {}

  private foldersFilePath() {
    return path.join(this.dataDir, "_folders.json");
  }
  private docFilePath(documentId: string) {
    return path.join(this.dataDir, `${sanitizeDocumentId(documentId)}.json`);
  }
  private metaDir() {
    return path.join(this.dataDir, "_docmeta");
  }
  private metaFilePath(documentId: string) {
    return path.join(this.metaDir(), `${sanitizeDocumentId(documentId)}.json`);
  }
  private legacyMetadataPath() {
    return path.join(this.dataDir, "_metadata.json");
  }
  private oldMetaFilePath(documentId: string) {
    return path.join(this.dataDir, `${documentId}.meta.json`);
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.metaDir(), { recursive: true });
    await this.migrateFromLegacy();
  }

  private async migrateFromLegacy() {
    // Phase 1: migrate from global _metadata.json
    try {
      const raw = await fs.readFile(this.legacyMetadataPath(), "utf-8");
      const metadata = JSON.parse(raw) as Record<string, DocMetadata>;
      let migrated = 0;
      for (const [docId, meta] of Object.entries(metadata)) {
        try {
          await fs.access(this.metaFilePath(docId));
        } catch {
          await fs.writeFile(
            this.metaFilePath(docId),
            JSON.stringify(meta, null, 2),
            "utf-8",
          );
          migrated++;
        }
      }
      if (migrated > 0) {
        console.log(
          `[Storage] Migrated ${migrated} entries from _metadata.json to _docmeta/`,
        );
      }
      await fs.rename(
        this.legacyMetadataPath(),
        this.legacyMetadataPath() + ".bak",
      );
    } catch {
      // no legacy file
    }

    // Phase 2: migrate from old *.meta.json in data dir
    try {
      const files = await fs.readdir(this.dataDir);
      let migrated = 0;
      for (const f of files) {
        if (!f.endsWith(".meta.json")) continue;
        const docId = f.replace(/\.meta\.json$/, "");
        const oldPath = this.oldMetaFilePath(docId);
        const newPath = this.metaFilePath(docId);
        try {
          await fs.access(newPath);
        } catch {
          try {
            const raw = await fs.readFile(oldPath, "utf-8");
            await fs.writeFile(newPath, raw, "utf-8");
            migrated++;
          } catch {
            // ignore read errors
          }
        }
        try {
          await fs.unlink(oldPath);
        } catch {
          // ignore
        }
      }
      if (migrated > 0) {
        console.log(
          `[Storage] Migrated ${migrated} entries from *.meta.json to _docmeta/`,
        );
      }
    } catch {
      // ignore
    }
  }

  async loadFolders() {
    try {
      const content = await fs.readFile(this.foldersFilePath(), "utf-8");
      return JSON.parse(content) as Folder[];
    } catch {
      return [];
    }
  }

  async saveFolders(folders: Folder[]) {
    await fs.writeFile(
      this.foldersFilePath(),
      JSON.stringify(folders, null, 2),
      "utf-8",
    );
  }

  async loadDocMeta(documentId: string): Promise<DocMetadata> {
    try {
      const content = await fs.readFile(this.metaFilePath(documentId), "utf-8");
      return JSON.parse(content) as DocMetadata;
    } catch {
      return { folderId: null };
    }
  }

  async saveDocMeta(documentId: string, meta: DocMetadata) {
    await fs.writeFile(
      this.metaFilePath(documentId),
      JSON.stringify(meta, null, 2),
      "utf-8",
    );
  }

  async deleteDocMeta(documentId: string) {
    try {
      await fs.unlink(this.metaFilePath(documentId));
    } catch {
      // ignore
    }
  }

  async saveDocument(documentId: string, snapshot: unknown) {
    await fs.writeFile(
      this.docFilePath(documentId),
      JSON.stringify(snapshot, null, 2),
      "utf-8",
    );
  }

  async loadDocument(documentId: string) {
    try {
      const content = await fs.readFile(this.docFilePath(documentId), "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async listDocumentsWithMeta(): Promise<DocumentWithMeta[]> {
    const [files, metaFiles] = await Promise.all([
      fs.readdir(this.dataDir),
      fs.readdir(this.metaDir()).catch(() => [] as string[]),
    ]);

    const metaCache = new Map<string, DocMetadata>();
    const metaContents = await Promise.all(
      metaFiles
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const id = f.replace(".json", "");
          try {
            const raw = await fs.readFile(
              path.join(this.metaDir(), f),
              "utf-8",
            );
            return { id, meta: JSON.parse(raw) as DocMetadata };
          } catch {
            return { id, meta: { folderId: null } as DocMetadata };
          }
        }),
    );
    for (const { id, meta } of metaContents) {
      metaCache.set(id, meta);
    }

    const docFiles = files.filter(
      (f) => f.endsWith(".json") && !f.startsWith("_"),
    );
    return Promise.all(
      docFiles.map(async (file) => {
        const id = file.replace(".json", "");
        const stats = await fs.stat(path.join(this.dataDir, file));
        const meta = metaCache.get(id) || { folderId: null };
        return { id, modifiedAt: stats.mtime.toISOString(), meta };
      }),
    );
  }

  async deleteDocument(documentId: string) {
    try {
      await fs.unlink(this.docFilePath(documentId));
      await this.deleteDocMeta(documentId);
      return true;
    } catch {
      return false;
    }
  }

  async existsDocument(documentId: string) {
    try {
      await fs.access(this.docFilePath(documentId));
      return true;
    } catch {
      return false;
    }
  }

  async renameDocument(oldDocumentId: string, newDocumentId: string) {
    if (oldDocumentId === newDocumentId) return;
    await fs.rename(
      this.docFilePath(oldDocumentId),
      this.docFilePath(newDocumentId),
    );
    const meta = await this.loadDocMeta(oldDocumentId);
    await this.saveDocMeta(newDocumentId, meta);
    await this.deleteDocMeta(oldDocumentId);
  }

  private rawFilePath(documentId: string, extension: string) {
    return path.join(
      this.dataDir,
      `${sanitizeDocumentId(documentId)}.${sanitizeExtension(extension)}`,
    );
  }

  async saveFile(documentId: string, buffer: Buffer, extension: string) {
    await fs.writeFile(this.rawFilePath(documentId, extension), buffer);
  }

  async loadFile(
    documentId: string,
    extension: string,
  ): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.rawFilePath(documentId, extension));
    } catch {
      return null;
    }
  }

  async deleteFile(documentId: string, extension: string): Promise<boolean> {
    try {
      await fs.unlink(this.rawFilePath(documentId, extension));
      await this.deleteDocMeta(documentId);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── MinIO / S3 ───

class MinioStorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(config: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    region: string;
    prefix?: string;
  }) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;
    this.prefix = (config.prefix || "").replace(/^\/+|\/+$/g, "");
  }

  private keyFor(relativeKey: string) {
    return this.prefix ? `${this.prefix}/${relativeKey}` : relativeKey;
  }

  private docsPrefix() {
    return this.keyFor("docs/");
  }
  private docKey(documentId: string) {
    return this.keyFor(`docs/${sanitizeDocumentId(documentId)}.json`);
  }
  private docMetaPrefix() {
    return this.keyFor("docmeta/");
  }
  private docMetaKey(documentId: string) {
    return this.keyFor(`docmeta/${sanitizeDocumentId(documentId)}.json`);
  }
  private foldersKey() {
    return this.keyFor("meta/folders.json");
  }
  private legacyMetadataKey() {
    return this.keyFor("meta/metadata.json");
  }
  private fileKey(documentId: string, extension: string) {
    return this.keyFor(
      `files/${sanitizeDocumentId(documentId)}.${sanitizeExtension(extension)}`,
    );
  }

  async init() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    await this.migrateFromLegacy();
  }

  private async migrateFromLegacy() {
    // Phase 1: migrate from global meta/metadata.json
    const metadata = await this.getJson<Record<string, DocMetadata> | null>(
      this.legacyMetadataKey(),
      null,
    );
    if (metadata) {
      let migrated = 0;
      for (const [docId, meta] of Object.entries(metadata)) {
        const exists = await this.keyExists(this.docMetaKey(docId));
        if (!exists) {
          await this.putJson(this.docMetaKey(docId), meta);
          migrated++;
        }
      }
      if (migrated > 0) {
        console.log(
          `[Storage] Migrated ${migrated} entries from metadata.json to docmeta/`,
        );
      }
      try {
        await this.client.send(
          new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${this.legacyMetadataKey()}`,
            Key: this.legacyMetadataKey() + ".bak",
          }),
        );
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: this.legacyMetadataKey(),
          }),
        );
      } catch {
        // ignore cleanup errors
      }
    }

    // Phase 2: migrate from old docs/*.meta.json to docmeta/*.json
    await this.migrateOldDocsMeta();
  }

  private async migrateOldDocsMeta() {
    const prefix = this.docsPrefix();
    let continuationToken: string | undefined;
    let migrated = 0;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of response.Contents || []) {
        if (!item.Key) continue;
        const rel = item.Key.replace(prefix, "");
        if (!rel.endsWith(".meta.json")) continue;

        const docId = rel.replace(/\.meta\.json$/, "");
        const newKey = this.docMetaKey(docId);

        // Only migrate if the new key doesn't already exist
        const exists = await this.keyExists(newKey);
        if (!exists) {
          const data = await this.getJson<DocMetadata>(item.Key, {
            folderId: null,
          });
          await this.putJson(newKey, data);
          migrated++;
        }

        // Delete the old docs/*.meta.json file
        try {
          await this.client.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: item.Key }),
          );
        } catch {
          // ignore
        }
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    if (migrated > 0) {
      console.log(
        `[Storage] Migrated ${migrated} entries from docs/*.meta.json to docmeta/`,
      );
    }
  }

  private async keyExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private async getJson<T>(key: string, fallback: T): Promise<T> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) return fallback;
      const body = await response.Body.transformToString();
      return JSON.parse(body) as T;
    } catch {
      return fallback;
    }
  }

  private async putJson(key: string, value: unknown) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(value, null, 2),
        ContentType: "application/json",
      }),
    );
  }

  async loadFolders() {
    return this.getJson<Folder[]>(this.foldersKey(), []);
  }

  async saveFolders(folders: Folder[]) {
    await this.putJson(this.foldersKey(), folders);
  }

  async loadDocMeta(documentId: string): Promise<DocMetadata> {
    return this.getJson<DocMetadata>(this.docMetaKey(documentId), {
      folderId: null,
    });
  }

  async saveDocMeta(documentId: string, meta: DocMetadata) {
    await this.putJson(this.docMetaKey(documentId), meta);
  }

  async deleteDocMeta(documentId: string) {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.docMetaKey(documentId),
        }),
      );
    } catch {
      // ignore
    }
  }

  async saveDocument(documentId: string, snapshot: unknown) {
    await this.putJson(this.docKey(documentId), snapshot);
  }

  async loadDocument(documentId: string) {
    return this.getJson(this.docKey(documentId), null);
  }

  async listDocumentsWithMeta(): Promise<DocumentWithMeta[]> {
    const prefix = this.docsPrefix();
    let continuationToken: string | undefined;
    const contentKeys: { id: string; modifiedAt: string }[] = [];

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of response.Contents || []) {
        if (!item.Key || !item.Key.endsWith(".json")) continue;
        const id = item.Key.replace(prefix, "").replace(/\.json$/, "");
        contentKeys.push({
          id,
          modifiedAt: (item.LastModified || new Date()).toISOString(),
        });
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    const results = await Promise.all(
      contentKeys.map(async (item) => {
        const meta = await this.loadDocMeta(item.id);
        return { ...item, meta };
      }),
    );
    return results;
  }

  async deleteDocument(documentId: string) {
    const exists = await this.existsDocument(documentId);
    if (!exists) return false;
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.docKey(documentId),
      }),
    );
    await this.deleteDocMeta(documentId);
    return true;
  }

  async existsDocument(documentId: string) {
    return this.keyExists(this.docKey(documentId));
  }

  async renameDocument(oldDocumentId: string, newDocumentId: string) {
    if (oldDocumentId === newDocumentId) return;
    // Copy content
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${this.docKey(oldDocumentId)}`,
        Key: this.docKey(newDocumentId),
      }),
    );
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.docKey(oldDocumentId),
      }),
    );
    // Move meta
    const meta = await this.loadDocMeta(oldDocumentId);
    await this.saveDocMeta(newDocumentId, meta);
    await this.deleteDocMeta(oldDocumentId);
  }

  async saveFile(documentId: string, buffer: Buffer, extension: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fileKey(documentId, extension),
        Body: buffer,
        ContentType:
          extension === "pdf" ? "application/pdf" : "application/octet-stream",
      }),
    );
  }

  async loadFile(
    documentId: string,
    extension: string,
  ): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.fileKey(documentId, extension),
        }),
      );
      if (!response.Body) return null;
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }

  async deleteFile(documentId: string, extension: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.fileKey(documentId, extension),
        }),
      );
      await this.deleteDocMeta(documentId);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Factory ───

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function resolveMinioEndpoint() {
  const explicit = process.env.MINIO_ENDPOINT_URL;
  if (explicit) return explicit;

  const host = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  const useSsl =
    (process.env.MINIO_USE_SSL || "false").toLowerCase() === "true";
  return `${useSsl ? "https" : "http"}://${host}:${port}`;
}

export function createStorageAdapter() {
  const backendOverride = process.env.STORAGE_BACKEND?.toLowerCase();
  const hasMinioKeys =
    Boolean(process.env.MINIO_ACCESS_KEY) &&
    Boolean(process.env.MINIO_SECRET_KEY) &&
    Boolean(process.env.MINIO_ENDPOINT_URL || process.env.MINIO_ENDPOINT);

  if (backendOverride === "minio" || (!backendOverride && hasMinioKeys)) {
    return new MinioStorageAdapter({
      endpoint: resolveMinioEndpoint(),
      accessKeyId: getRequiredEnv("MINIO_ACCESS_KEY"),
      secretAccessKey: getRequiredEnv("MINIO_SECRET_KEY"),
      bucket: process.env.MINIO_BUCKET || "tldraw",
      region: process.env.MINIO_REGION || "us-east-1",
      prefix: process.env.MINIO_PREFIX,
    });
  }

  if (backendOverride && backendOverride !== "local") {
    throw new Error(`Unsupported STORAGE_BACKEND: ${backendOverride}`);
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  return new LocalStorageAdapter(dataDir);
}
