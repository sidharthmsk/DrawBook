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

Documents are stored in `./app/data/` as JSON files.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/documents` - List all documents
- `GET /api/load/:documentId` - Load a document
- `POST /api/save/:documentId` - Save a document
