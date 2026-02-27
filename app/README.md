# tldraw Self-Hosted

A simple self-hosted tldraw instance with persistent storage.

## Features

- **Persistent Storage**: Documents are saved to disk automatically
- **Multiple Documents**: Access different documents via URL parameter `?doc=<name>`
- **Auto-save**: Changes are automatically saved 2 seconds after editing

## Quick Start

### Docker

```bash
docker compose up -d
```

Access at `http://localhost:3045`

### Development

```bash
cd app
npm install
npm run dev
```

## Usage

- Default document: `http://localhost:3045`
- Named document: `http://localhost:3045/?doc=my-project`

By default, documents are stored in `./app/data/` as JSON files.

## Storage Backends

The server supports two persistence backends:

- `local` (default): JSON files on disk
- `minio`: S3-compatible object storage (MinIO)

Backend selection behavior:

- If `STORAGE_BACKEND=minio`, MinIO is always used.
- If `STORAGE_BACKEND=local`, local files are always used.
- If `STORAGE_BACKEND` is unset, MinIO is used automatically when MinIO credentials/config are present; otherwise local is used.

### MinIO Configuration

Set these environment variables and restart the server:

```bash
STORAGE_BACKEND=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=tldraw
MINIO_REGION=us-east-1
# optional
MINIO_PREFIX=tldraw
```

Notes:

- `MINIO_ENDPOINT_URL` can be used instead of `MINIO_ENDPOINT` + `MINIO_PORT`.
- The server auto-creates the bucket if it does not exist.
- Folder/metadata files are stored as JSON objects in MinIO under the configured prefix.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/documents` - List all documents
- `GET /api/load/:documentId` - Load a document
- `POST /api/save/:documentId` - Save a document
