import fs from 'fs/promises'
import path from 'path'
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
} from '@aws-sdk/client-s3'

export interface Folder {
  id: string
  name: string
  createdAt: string
}

export interface DocMetadata {
  folderId: string | null
  name?: string
}

export interface StoredDocumentInfo {
  id: string
  modifiedAt: string
}

export interface StorageAdapter {
  init(): Promise<void>
  loadFolders(): Promise<Folder[]>
  saveFolders(folders: Folder[]): Promise<void>
  loadMetadata(): Promise<Record<string, DocMetadata>>
  saveMetadata(metadata: Record<string, DocMetadata>): Promise<void>
  saveDocument(documentId: string, snapshot: unknown): Promise<void>
  loadDocument(documentId: string): Promise<unknown | null>
  listDocuments(): Promise<StoredDocumentInfo[]>
  deleteDocument(documentId: string): Promise<boolean>
  existsDocument(documentId: string): Promise<boolean>
  renameDocument(oldDocumentId: string, newDocumentId: string): Promise<void>
}

class LocalStorageAdapter implements StorageAdapter {
  constructor(private dataDir: string) {}

  private foldersFilePath() {
    return path.join(this.dataDir, '_folders.json')
  }

  private metadataFilePath() {
    return path.join(this.dataDir, '_metadata.json')
  }

  private docFilePath(documentId: string) {
    return path.join(this.dataDir, `${documentId}.json`)
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true })
  }

  async loadFolders() {
    try {
      const content = await fs.readFile(this.foldersFilePath(), 'utf-8')
      return JSON.parse(content) as Folder[]
    } catch {
      return []
    }
  }

  async saveFolders(folders: Folder[]) {
    await fs.writeFile(this.foldersFilePath(), JSON.stringify(folders, null, 2), 'utf-8')
  }

  async loadMetadata() {
    try {
      const content = await fs.readFile(this.metadataFilePath(), 'utf-8')
      return JSON.parse(content) as Record<string, DocMetadata>
    } catch {
      return {}
    }
  }

  async saveMetadata(metadata: Record<string, DocMetadata>) {
    await fs.writeFile(this.metadataFilePath(), JSON.stringify(metadata, null, 2), 'utf-8')
  }

  async saveDocument(documentId: string, snapshot: unknown) {
    await fs.writeFile(this.docFilePath(documentId), JSON.stringify(snapshot, null, 2), 'utf-8')
  }

  async loadDocument(documentId: string) {
    try {
      const content = await fs.readFile(this.docFilePath(documentId), 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  async listDocuments() {
    const files = await fs.readdir(this.dataDir)
    const documentFiles = files.filter((file) => file.endsWith('.json') && !file.startsWith('_'))
    const documents = await Promise.all(
      documentFiles.map(async (file) => {
        const filePath = path.join(this.dataDir, file)
        const stats = await fs.stat(filePath)
        return {
          id: file.replace('.json', ''),
          modifiedAt: stats.mtime.toISOString(),
        }
      })
    )
    return documents
  }

  async deleteDocument(documentId: string) {
    try {
      await fs.unlink(this.docFilePath(documentId))
      return true
    } catch {
      return false
    }
  }

  async existsDocument(documentId: string) {
    try {
      await fs.access(this.docFilePath(documentId))
      return true
    } catch {
      return false
    }
  }

  async renameDocument(oldDocumentId: string, newDocumentId: string) {
    if (oldDocumentId === newDocumentId) return
    await fs.rename(this.docFilePath(oldDocumentId), this.docFilePath(newDocumentId))
  }
}

class MinioStorageAdapter implements StorageAdapter {
  private client: S3Client
  private bucket: string
  private prefix: string

  constructor(config: {
    endpoint: string
    accessKeyId: string
    secretAccessKey: string
    bucket: string
    region: string
    prefix?: string
  }) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    this.bucket = config.bucket
    this.prefix = (config.prefix || '').replace(/^\/+|\/+$/g, '')
  }

  private keyFor(relativeKey: string) {
    return this.prefix ? `${this.prefix}/${relativeKey}` : relativeKey
  }

  private docsPrefix() {
    return this.keyFor('docs/')
  }

  private docKey(documentId: string) {
    return this.keyFor(`docs/${documentId}.json`)
  }

  private foldersKey() {
    return this.keyFor('meta/folders.json')
  }

  private metadataKey() {
    return this.keyFor('meta/metadata.json')
  }

  async init() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
    }
  }

  private async getJson<T>(key: string, fallback: T): Promise<T> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      )
      if (!response.Body) return fallback
      const body = await response.Body.transformToString()
      return JSON.parse(body) as T
    } catch {
      return fallback
    }
  }

  private async putJson(key: string, value: unknown) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(value, null, 2),
        ContentType: 'application/json',
      })
    )
  }

  async loadFolders() {
    return this.getJson<Folder[]>(this.foldersKey(), [])
  }

  async saveFolders(folders: Folder[]) {
    await this.putJson(this.foldersKey(), folders)
  }

  async loadMetadata() {
    return this.getJson<Record<string, DocMetadata>>(this.metadataKey(), {})
  }

  async saveMetadata(metadata: Record<string, DocMetadata>) {
    await this.putJson(this.metadataKey(), metadata)
  }

  async saveDocument(documentId: string, snapshot: unknown) {
    await this.putJson(this.docKey(documentId), snapshot)
  }

  async loadDocument(documentId: string) {
    return this.getJson(this.docKey(documentId), null)
  }

  async listDocuments() {
    const prefix = this.docsPrefix()
    let continuationToken: string | undefined
    const out: StoredDocumentInfo[] = []

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      )

      for (const item of response.Contents || []) {
        if (!item.Key || !item.Key.endsWith('.json')) continue
        const id = item.Key.replace(prefix, '').replace(/\.json$/, '')
        out.push({
          id,
          modifiedAt: (item.LastModified || new Date()).toISOString(),
        })
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)

    return out
  }

  async deleteDocument(documentId: string) {
    const exists = await this.existsDocument(documentId)
    if (!exists) return false
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.docKey(documentId),
      })
    )
    return true
  }

  async existsDocument(documentId: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.docKey(documentId),
        })
      )
      return true
    } catch {
      return false
    }
  }

  async renameDocument(oldDocumentId: string, newDocumentId: string) {
    if (oldDocumentId === newDocumentId) return
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${this.docKey(oldDocumentId)}`,
        Key: this.docKey(newDocumentId),
      })
    )
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.docKey(oldDocumentId),
      })
    )
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function resolveMinioEndpoint() {
  const explicit = process.env.MINIO_ENDPOINT_URL
  if (explicit) return explicit

  const host = process.env.MINIO_ENDPOINT || 'localhost'
  const port = process.env.MINIO_PORT || '9000'
  const useSsl = (process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true'
  return `${useSsl ? 'https' : 'http'}://${host}:${port}`
}

export function createStorageAdapter() {
  const backendOverride = process.env.STORAGE_BACKEND?.toLowerCase()
  const hasMinioKeys =
    Boolean(process.env.MINIO_ACCESS_KEY) &&
    Boolean(process.env.MINIO_SECRET_KEY) &&
    Boolean(process.env.MINIO_ENDPOINT_URL || process.env.MINIO_ENDPOINT)

  if (backendOverride === 'minio' || (!backendOverride && hasMinioKeys)) {
    return new MinioStorageAdapter({
      endpoint: resolveMinioEndpoint(),
      accessKeyId: getRequiredEnv('MINIO_ACCESS_KEY'),
      secretAccessKey: getRequiredEnv('MINIO_SECRET_KEY'),
      bucket: process.env.MINIO_BUCKET || 'tldraw',
      region: process.env.MINIO_REGION || 'us-east-1',
      prefix: process.env.MINIO_PREFIX,
    })
  }

  if (backendOverride && backendOverride !== 'local') {
    throw new Error(`Unsupported STORAGE_BACKEND: ${backendOverride}`)
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data')
  return new LocalStorageAdapter(dataDir)
}
