import fs from "fs/promises";
import path from "path";
import { CopyObjectCommand, CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, } from "@aws-sdk/client-s3";
const VALID_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const VALID_EXT_RE = /^[a-z0-9]+$/;
export function sanitizeDocumentId(id) {
    if (!id || id.includes("..") || !VALID_ID_RE.test(id)) {
        throw new Error(`Invalid document ID: ${id}`);
    }
    return id;
}
function sanitizeExtension(ext) {
    if (!ext || !VALID_EXT_RE.test(ext)) {
        throw new Error(`Invalid file extension: ${ext}`);
    }
    return ext;
}
// ─── Local Filesystem ───
class LocalStorageAdapter {
    dataDir;
    constructor(dataDir) {
        this.dataDir = dataDir;
    }
    foldersFilePath() {
        return path.join(this.dataDir, "_folders.json");
    }
    templatesFilePath() {
        return path.join(this.dataDir, "_templates.json");
    }
    fleetingFilePath() {
        return path.join(this.dataDir, "_fleeting.json");
    }
    docFilePath(documentId) {
        return path.join(this.dataDir, `${sanitizeDocumentId(documentId)}.json`);
    }
    metaDir() {
        return path.join(this.dataDir, "_docmeta");
    }
    metaFilePath(documentId) {
        return path.join(this.metaDir(), `${sanitizeDocumentId(documentId)}.json`);
    }
    legacyMetadataPath() {
        return path.join(this.dataDir, "_metadata.json");
    }
    oldMetaFilePath(documentId) {
        return path.join(this.dataDir, `${documentId}.meta.json`);
    }
    async init() {
        await fs.mkdir(this.dataDir, { recursive: true });
        await fs.mkdir(this.metaDir(), { recursive: true });
        await this.migrateFromLegacy();
    }
    async migrateFromLegacy() {
        // Phase 1: migrate from global _metadata.json
        try {
            const raw = await fs.readFile(this.legacyMetadataPath(), "utf-8");
            const metadata = JSON.parse(raw);
            let migrated = 0;
            for (const [docId, meta] of Object.entries(metadata)) {
                try {
                    await fs.access(this.metaFilePath(docId));
                }
                catch {
                    await fs.writeFile(this.metaFilePath(docId), JSON.stringify(meta, null, 2), "utf-8");
                    migrated++;
                }
            }
            if (migrated > 0) {
                console.log(`[Storage] Migrated ${migrated} entries from _metadata.json to _docmeta/`);
            }
            await fs.rename(this.legacyMetadataPath(), this.legacyMetadataPath() + ".bak");
        }
        catch {
            // no legacy file
        }
        // Phase 2: migrate from old *.meta.json in data dir
        try {
            const files = await fs.readdir(this.dataDir);
            let migrated = 0;
            for (const f of files) {
                if (!f.endsWith(".meta.json"))
                    continue;
                const docId = f.replace(/\.meta\.json$/, "");
                const oldPath = this.oldMetaFilePath(docId);
                const newPath = this.metaFilePath(docId);
                try {
                    await fs.access(newPath);
                }
                catch {
                    try {
                        const raw = await fs.readFile(oldPath, "utf-8");
                        await fs.writeFile(newPath, raw, "utf-8");
                        migrated++;
                    }
                    catch {
                        // ignore read errors
                    }
                }
                try {
                    await fs.unlink(oldPath);
                }
                catch {
                    // ignore
                }
            }
            if (migrated > 0) {
                console.log(`[Storage] Migrated ${migrated} entries from *.meta.json to _docmeta/`);
            }
        }
        catch {
            // ignore
        }
    }
    async loadFolders() {
        try {
            const content = await fs.readFile(this.foldersFilePath(), "utf-8");
            return JSON.parse(content);
        }
        catch {
            return [];
        }
    }
    async saveFolders(folders) {
        await fs.writeFile(this.foldersFilePath(), JSON.stringify(folders, null, 2), "utf-8");
    }
    async loadTemplates() {
        try {
            const content = await fs.readFile(this.templatesFilePath(), "utf-8");
            return JSON.parse(content);
        }
        catch {
            return [];
        }
    }
    async saveTemplates(templates) {
        await fs.writeFile(this.templatesFilePath(), JSON.stringify(templates, null, 2), "utf-8");
    }
    async loadFleetingNotes() {
        try {
            const content = await fs.readFile(this.fleetingFilePath(), "utf-8");
            return JSON.parse(content);
        }
        catch {
            return [];
        }
    }
    async saveFleetingNotes(notes) {
        await fs.writeFile(this.fleetingFilePath(), JSON.stringify(notes, null, 2), "utf-8");
    }
    async loadDocMeta(documentId) {
        try {
            const content = await fs.readFile(this.metaFilePath(documentId), "utf-8");
            return JSON.parse(content);
        }
        catch {
            return { folderId: null };
        }
    }
    async saveDocMeta(documentId, meta) {
        await fs.writeFile(this.metaFilePath(documentId), JSON.stringify(meta, null, 2), "utf-8");
    }
    async deleteDocMeta(documentId) {
        try {
            await fs.unlink(this.metaFilePath(documentId));
        }
        catch {
            // ignore
        }
    }
    async saveDocument(documentId, snapshot) {
        await fs.writeFile(this.docFilePath(documentId), JSON.stringify(snapshot, null, 2), "utf-8");
    }
    async loadDocument(documentId) {
        try {
            const content = await fs.readFile(this.docFilePath(documentId), "utf-8");
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    async listDocumentsWithMeta() {
        const [files, metaFiles] = await Promise.all([
            fs.readdir(this.dataDir),
            fs.readdir(this.metaDir()).catch(() => []),
        ]);
        const metaCache = new Map();
        const metaContents = await Promise.all(metaFiles
            .filter((f) => f.endsWith(".json"))
            .map(async (f) => {
            const id = f.replace(".json", "");
            try {
                const raw = await fs.readFile(path.join(this.metaDir(), f), "utf-8");
                return { id, meta: JSON.parse(raw) };
            }
            catch {
                return { id, meta: { folderId: null } };
            }
        }));
        for (const { id, meta } of metaContents) {
            metaCache.set(id, meta);
        }
        const docFiles = files.filter((f) => f.endsWith(".json") && !f.startsWith("_"));
        return Promise.all(docFiles.map(async (file) => {
            const id = file.replace(".json", "");
            const stats = await fs.stat(path.join(this.dataDir, file));
            const meta = metaCache.get(id) || { folderId: null };
            return { id, modifiedAt: stats.mtime.toISOString(), meta };
        }));
    }
    async deleteDocument(documentId) {
        try {
            await fs.unlink(this.docFilePath(documentId));
            await this.deleteDocMeta(documentId);
            return true;
        }
        catch {
            return false;
        }
    }
    async existsDocument(documentId) {
        try {
            await fs.access(this.docFilePath(documentId));
            return true;
        }
        catch {
            return false;
        }
    }
    async renameDocument(oldDocumentId, newDocumentId) {
        if (oldDocumentId === newDocumentId)
            return;
        await fs.rename(this.docFilePath(oldDocumentId), this.docFilePath(newDocumentId));
        const meta = await this.loadDocMeta(oldDocumentId);
        await this.saveDocMeta(newDocumentId, meta);
        await this.deleteDocMeta(oldDocumentId);
    }
    rawFilePath(documentId, extension) {
        return path.join(this.dataDir, `${sanitizeDocumentId(documentId)}.${sanitizeExtension(extension)}`);
    }
    async saveFile(documentId, buffer, extension) {
        await fs.writeFile(this.rawFilePath(documentId, extension), buffer);
    }
    async loadFile(documentId, extension) {
        try {
            return await fs.readFile(this.rawFilePath(documentId, extension));
        }
        catch {
            return null;
        }
    }
    async deleteFile(documentId, extension) {
        try {
            await fs.unlink(this.rawFilePath(documentId, extension));
            await this.deleteDocMeta(documentId);
            return true;
        }
        catch {
            return false;
        }
    }
}
// ─── MinIO / S3 ───
class MinioStorageAdapter {
    client;
    bucket;
    prefix;
    constructor(config) {
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
    keyFor(relativeKey) {
        return this.prefix ? `${this.prefix}/${relativeKey}` : relativeKey;
    }
    docsPrefix() {
        return this.keyFor("docs/");
    }
    docKey(documentId) {
        return this.keyFor(`docs/${sanitizeDocumentId(documentId)}.json`);
    }
    docMetaPrefix() {
        return this.keyFor("docmeta/");
    }
    docMetaKey(documentId) {
        return this.keyFor(`docmeta/${sanitizeDocumentId(documentId)}.json`);
    }
    foldersKey() {
        return this.keyFor("meta/folders.json");
    }
    templatesKey() {
        return this.keyFor("meta/templates.json");
    }
    fleetingKey() {
        return this.keyFor("meta/fleeting.json");
    }
    legacyMetadataKey() {
        return this.keyFor("meta/metadata.json");
    }
    fileKey(documentId, extension) {
        return this.keyFor(`files/${sanitizeDocumentId(documentId)}.${sanitizeExtension(extension)}`);
    }
    async init() {
        try {
            await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        }
        catch {
            await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        }
        await this.migrateFromLegacy();
    }
    async migrateFromLegacy() {
        // Phase 1: migrate from global meta/metadata.json
        const metadata = await this.getJson(this.legacyMetadataKey(), null);
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
                console.log(`[Storage] Migrated ${migrated} entries from metadata.json to docmeta/`);
            }
            try {
                await this.client.send(new CopyObjectCommand({
                    Bucket: this.bucket,
                    CopySource: `${this.bucket}/${this.legacyMetadataKey()}`,
                    Key: this.legacyMetadataKey() + ".bak",
                }));
                await this.client.send(new DeleteObjectCommand({
                    Bucket: this.bucket,
                    Key: this.legacyMetadataKey(),
                }));
            }
            catch {
                // ignore cleanup errors
            }
        }
        // Phase 2: migrate from old docs/*.meta.json to docmeta/*.json
        await this.migrateOldDocsMeta();
    }
    async migrateOldDocsMeta() {
        const prefix = this.docsPrefix();
        let continuationToken;
        let migrated = 0;
        do {
            const response = await this.client.send(new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }));
            for (const item of response.Contents || []) {
                if (!item.Key)
                    continue;
                const rel = item.Key.replace(prefix, "");
                if (!rel.endsWith(".meta.json"))
                    continue;
                const docId = rel.replace(/\.meta\.json$/, "");
                const newKey = this.docMetaKey(docId);
                // Only migrate if the new key doesn't already exist
                const exists = await this.keyExists(newKey);
                if (!exists) {
                    const data = await this.getJson(item.Key, {
                        folderId: null,
                    });
                    await this.putJson(newKey, data);
                    migrated++;
                }
                // Delete the old docs/*.meta.json file
                try {
                    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: item.Key }));
                }
                catch {
                    // ignore
                }
            }
            continuationToken = response.IsTruncated
                ? response.NextContinuationToken
                : undefined;
        } while (continuationToken);
        if (migrated > 0) {
            console.log(`[Storage] Migrated ${migrated} entries from docs/*.meta.json to docmeta/`);
        }
    }
    async keyExists(key) {
        try {
            await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            return true;
        }
        catch {
            return false;
        }
    }
    async getJson(key, fallback) {
        try {
            const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
            if (!response.Body)
                return fallback;
            const body = await response.Body.transformToString();
            return JSON.parse(body);
        }
        catch {
            return fallback;
        }
    }
    async putJson(key, value) {
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: JSON.stringify(value, null, 2),
            ContentType: "application/json",
        }));
    }
    async loadFolders() {
        return this.getJson(this.foldersKey(), []);
    }
    async saveFolders(folders) {
        await this.putJson(this.foldersKey(), folders);
    }
    async loadTemplates() {
        return this.getJson(this.templatesKey(), []);
    }
    async saveTemplates(templates) {
        await this.putJson(this.templatesKey(), templates);
    }
    async loadFleetingNotes() {
        return this.getJson(this.fleetingKey(), []);
    }
    async saveFleetingNotes(notes) {
        await this.putJson(this.fleetingKey(), notes);
    }
    async loadDocMeta(documentId) {
        return this.getJson(this.docMetaKey(documentId), {
            folderId: null,
        });
    }
    async saveDocMeta(documentId, meta) {
        await this.putJson(this.docMetaKey(documentId), meta);
    }
    async deleteDocMeta(documentId) {
        try {
            await this.client.send(new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: this.docMetaKey(documentId),
            }));
        }
        catch {
            // ignore
        }
    }
    async saveDocument(documentId, snapshot) {
        await this.putJson(this.docKey(documentId), snapshot);
    }
    async loadDocument(documentId) {
        return this.getJson(this.docKey(documentId), null);
    }
    async listDocumentsWithMeta() {
        const prefix = this.docsPrefix();
        let continuationToken;
        const contentKeys = [];
        do {
            const response = await this.client.send(new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }));
            for (const item of response.Contents || []) {
                if (!item.Key || !item.Key.endsWith(".json"))
                    continue;
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
        const results = await Promise.all(contentKeys.map(async (item) => {
            const meta = await this.loadDocMeta(item.id);
            return { ...item, meta };
        }));
        return results;
    }
    async deleteDocument(documentId) {
        const exists = await this.existsDocument(documentId);
        if (!exists)
            return false;
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: this.docKey(documentId),
        }));
        await this.deleteDocMeta(documentId);
        return true;
    }
    async existsDocument(documentId) {
        return this.keyExists(this.docKey(documentId));
    }
    async renameDocument(oldDocumentId, newDocumentId) {
        if (oldDocumentId === newDocumentId)
            return;
        // Copy content
        await this.client.send(new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${this.docKey(oldDocumentId)}`,
            Key: this.docKey(newDocumentId),
        }));
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: this.docKey(oldDocumentId),
        }));
        // Move meta
        const meta = await this.loadDocMeta(oldDocumentId);
        await this.saveDocMeta(newDocumentId, meta);
        await this.deleteDocMeta(oldDocumentId);
    }
    async saveFile(documentId, buffer, extension) {
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: this.fileKey(documentId, extension),
            Body: buffer,
            ContentType: extension === "pdf" ? "application/pdf" : "application/octet-stream",
        }));
    }
    async loadFile(documentId, extension) {
        try {
            const response = await this.client.send(new GetObjectCommand({
                Bucket: this.bucket,
                Key: this.fileKey(documentId, extension),
            }));
            if (!response.Body)
                return null;
            const bytes = await response.Body.transformToByteArray();
            return Buffer.from(bytes);
        }
        catch {
            return null;
        }
    }
    async deleteFile(documentId, extension) {
        try {
            await this.client.send(new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: this.fileKey(documentId, extension),
            }));
            await this.deleteDocMeta(documentId);
            return true;
        }
        catch {
            return false;
        }
    }
}
// ─── Caching Wrapper ───
class CachedStorageAdapter {
    inner;
    docListCache = null;
    docListCacheTime = 0;
    metaCache = new Map();
    docCache = new Map();
    static DOC_LIST_TTL = 30_000; // 30s
    static META_TTL = 60_000;
    static DOC_TTL = 60_000;
    static MAX_DOC_CACHE = 50;
    constructor(inner) {
        this.inner = inner;
    }
    async init() {
        await this.inner.init();
    }
    invalidateDocList() {
        this.docListCache = null;
    }
    async loadFolders() {
        return this.inner.loadFolders();
    }
    async saveFolders(folders) {
        return this.inner.saveFolders(folders);
    }
    async loadTemplates() {
        return this.inner.loadTemplates();
    }
    async saveTemplates(templates) {
        return this.inner.saveTemplates(templates);
    }
    async loadFleetingNotes() {
        return this.inner.loadFleetingNotes();
    }
    async saveFleetingNotes(notes) {
        return this.inner.saveFleetingNotes(notes);
    }
    async loadDocMeta(documentId) {
        const cached = this.metaCache.get(documentId);
        if (cached && Date.now() - cached.time < CachedStorageAdapter.META_TTL) {
            return cached.data;
        }
        const meta = await this.inner.loadDocMeta(documentId);
        this.metaCache.set(documentId, { data: meta, time: Date.now() });
        return meta;
    }
    async saveDocMeta(documentId, meta) {
        await this.inner.saveDocMeta(documentId, meta);
        this.metaCache.set(documentId, { data: meta, time: Date.now() });
        this.invalidateDocList();
    }
    async deleteDocMeta(documentId) {
        await this.inner.deleteDocMeta(documentId);
        this.metaCache.delete(documentId);
        this.invalidateDocList();
    }
    async saveDocument(documentId, snapshot) {
        await this.inner.saveDocument(documentId, snapshot);
        this.docCache.set(documentId, { data: snapshot, time: Date.now() });
        this.invalidateDocList();
        // Evict oldest if cache is too large
        if (this.docCache.size > CachedStorageAdapter.MAX_DOC_CACHE) {
            let oldestKey = "";
            let oldestTime = Infinity;
            for (const [k, v] of this.docCache) {
                if (v.time < oldestTime) {
                    oldestTime = v.time;
                    oldestKey = k;
                }
            }
            if (oldestKey)
                this.docCache.delete(oldestKey);
        }
    }
    async loadDocument(documentId) {
        const cached = this.docCache.get(documentId);
        if (cached && Date.now() - cached.time < CachedStorageAdapter.DOC_TTL) {
            return cached.data;
        }
        const doc = await this.inner.loadDocument(documentId);
        if (doc !== null) {
            this.docCache.set(documentId, { data: doc, time: Date.now() });
        }
        return doc;
    }
    async listDocumentsWithMeta() {
        if (this.docListCache &&
            Date.now() - this.docListCacheTime < CachedStorageAdapter.DOC_LIST_TTL) {
            return this.docListCache;
        }
        const list = await this.inner.listDocumentsWithMeta();
        this.docListCache = list;
        this.docListCacheTime = Date.now();
        // Warm meta cache from the list results
        for (const item of list) {
            this.metaCache.set(item.id, { data: item.meta, time: Date.now() });
        }
        return list;
    }
    async deleteDocument(documentId) {
        const result = await this.inner.deleteDocument(documentId);
        this.docCache.delete(documentId);
        this.metaCache.delete(documentId);
        this.invalidateDocList();
        return result;
    }
    async existsDocument(documentId) {
        return this.inner.existsDocument(documentId);
    }
    async renameDocument(oldDocumentId, newDocumentId) {
        await this.inner.renameDocument(oldDocumentId, newDocumentId);
        // Move caches
        const oldDoc = this.docCache.get(oldDocumentId);
        if (oldDoc) {
            this.docCache.set(newDocumentId, oldDoc);
            this.docCache.delete(oldDocumentId);
        }
        const oldMeta = this.metaCache.get(oldDocumentId);
        if (oldMeta) {
            this.metaCache.set(newDocumentId, oldMeta);
            this.metaCache.delete(oldDocumentId);
        }
        this.invalidateDocList();
    }
    async saveFile(documentId, buffer, extension) {
        return this.inner.saveFile(documentId, buffer, extension);
    }
    async loadFile(documentId, extension) {
        return this.inner.loadFile(documentId, extension);
    }
    async deleteFile(documentId, extension) {
        return this.inner.deleteFile(documentId, extension);
    }
}
// ─── Factory ───
function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required env var: ${name}`);
    return value;
}
function resolveMinioEndpoint() {
    const explicit = process.env.MINIO_ENDPOINT_URL;
    if (explicit)
        return explicit;
    const host = process.env.MINIO_ENDPOINT || "localhost";
    const port = process.env.MINIO_PORT || "9000";
    const useSsl = (process.env.MINIO_USE_SSL || "false").toLowerCase() === "true";
    return `${useSsl ? "https" : "http"}://${host}:${port}`;
}
export function createStorageAdapter() {
    const backendOverride = process.env.STORAGE_BACKEND?.toLowerCase();
    const hasMinioKeys = Boolean(process.env.MINIO_ACCESS_KEY) &&
        Boolean(process.env.MINIO_SECRET_KEY) &&
        Boolean(process.env.MINIO_ENDPOINT_URL || process.env.MINIO_ENDPOINT);
    let inner;
    if (backendOverride === "minio" || (!backendOverride && hasMinioKeys)) {
        inner = new MinioStorageAdapter({
            endpoint: resolveMinioEndpoint(),
            accessKeyId: getRequiredEnv("MINIO_ACCESS_KEY"),
            secretAccessKey: getRequiredEnv("MINIO_SECRET_KEY"),
            bucket: process.env.MINIO_BUCKET || "tldraw",
            region: process.env.MINIO_REGION || "us-east-1",
            prefix: process.env.MINIO_PREFIX,
        });
    }
    else if (backendOverride && backendOverride !== "local") {
        throw new Error(`Unsupported STORAGE_BACKEND: ${backendOverride}`);
    }
    else {
        const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
        inner = new LocalStorageAdapter(dataDir);
    }
    return new CachedStorageAdapter(inner);
}
