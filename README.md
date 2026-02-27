# Drawbook

A self-hosted workspace that brings multiple creative and productivity tools under one roof. Create drawings, diagrams, documents, spreadsheets, and kanban boards — all saved to local storage or S3-compatible object storage. Share any document by copying its URL.

## Tools Included

| Tool | Description |
|------|-------------|
| **tldraw** | Infinite canvas whiteboard with real-time collaboration |
| **Excalidraw** | Hand-drawn style diagrams |
| **Draw.io** | Flowcharts and technical diagrams |
| **Markdown** | Rich text editor (BlockNote) |
| **Spreadsheet** | Spreadsheet editor (Univer) |
| **Data Grid** | Tabular data editor (AG Grid) |
| **Kanban** | Drag-and-drop kanban board |
| **PDF Viewer** | Upload and view PDFs |

## Features

- **Dashboard** with folders, search, and bulk actions
- **Real-time collaboration** via WebSocket — open the same URL on two devices and edits sync live
- **Shareable URLs** — every document has a unique `?doc=` URL you can send to anyone
- **S3 / MinIO storage** — persist everything to any S3-compatible bucket
- **Local storage** fallback — works out of the box with zero config
- **Optional password protection**
- **Docker-ready** with health checks and resource limits
- **AI-powered features** — turn wireframes into working UI, chat with an AI assistant, get design suggestions, and describe canvas content (powered by Groq + Kimi K2)
- **[[Wiki-links]]** — optional inter-document linking with a link graph, backlinks, and `[[name]]` resolution (enable in Settings)
- **Desktop app** — runs as an Electron app with local data storage

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/<your-username>/drawbook.git
cd drawbook
docker compose up -d --build
```

Open `http://localhost:3000`.

### Local Development

```bash
cd app
cp env.example .env        # edit as needed
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API / WebSocket: `http://localhost:3000`

### Production Build

```bash
cd app
npm run build
npm start
```

### Desktop (Electron)

```bash
cd app
npm run electron:dev        # dev build + launch
npm run electron:pack       # package for macOS
```

The packaged app stores data in the OS user-data directory and runs its own local server.

## Configuration

Copy `app/env.example` to `app/.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATA_DIR` | `./data` | Local storage directory |
| `APP_PASSWORD` | *(unset)* | Set to enable password protection |
| `ENABLE_TLDRAW` | `false` | Set to `true` to enable the tldraw whiteboard (requires a [tldraw license](https://tldraw.dev) for production) |
| `ENABLE_LINKING` | `false` | Set to `true` to enable [[wiki-links]], link graph, and backlinks |
| `STORAGE_BACKEND` | *(auto)* | `local` or `minio` — auto-detects when MinIO vars are present |
| `MINIO_ENDPOINT_URL` | — | Full URL to S3/MinIO endpoint (e.g. `http://minio:9000`) |
| `MINIO_ACCESS_KEY` | — | S3 access key |
| `MINIO_SECRET_KEY` | — | S3 secret key |
| `MINIO_BUCKET` | `tldraw` | Bucket name |
| `MINIO_REGION` | `us-east-1` | Bucket region |
| `MINIO_PREFIX` | *(empty)* | Key prefix inside the bucket |
| `CORS_ORIGINS` | *(open)* | Comma-separated allowed origins (e.g. `https://draw.example.com`) |
| `GROQ_API_KEY` | — | For AI features: Make Real, chat assistant, suggestions (get key at [console.groq.com](https://console.groq.com)) |

## Storage Backends

**Local (default):** Documents are stored as JSON files in `DATA_DIR`. Zero setup required.

**MinIO / S3:** Set `STORAGE_BACKEND=minio` (or just provide the MinIO env vars) and the server will persist documents, metadata, and uploaded files to your S3-compatible bucket. The bucket is created automatically if it doesn't exist.

## Project Structure

```
drawbook/
├── app/
│   ├── src/                  # React frontend
│   │   ├── App.tsx           # Auth + routing
│   │   └── components/       # Dashboard, editors, AI tools
│   ├── server/
│   │   ├── index.ts          # Express + WebSocket server
│   │   ├── storage.ts        # Local & S3 storage adapters
│   │   └── ai.ts             # AI features (Groq + Kimi K2)
│   ├── electron/
│   │   ├── main.ts           # Electron main process
│   │   └── preload.cjs       # Preload script
│   ├── build/                # App icons (png, icns, ico)
│   ├── electron-builder.yml  # Electron packaging config
│   ├── Dockerfile
│   ├── env.example
│   └── package.json
└── docker-compose.yml
```

## API

All endpoints are prefixed with `/api` and protected by `APP_PASSWORD` when set.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/login` | Authenticate |
| `GET` | `/api/auth/check` | Check auth status |
| `GET` | `/api/documents` | List documents |
| `GET` | `/api/load/:id` | Load a document |
| `POST` | `/api/save/:id` | Save a document |
| `DELETE` | `/api/delete/:id` | Delete a document |
| `POST` | `/api/rename/:id` | Rename a document |
| `POST` | `/api/upload` | Upload a file (PDF) |
| `GET` | `/api/file/:id` | Serve an uploaded file |
| `GET/POST` | `/api/folders` | List / create folders |
| `POST` | `/api/bulk/move` | Bulk move documents |
| `POST` | `/api/bulk/delete` | Bulk delete documents |
| `GET` | `/api/resolve` | Resolve a document name to its ID (for [[links]]) |
| `GET` | `/api/backlinks/:id` | List documents that link to this one |
| `GET` | `/api/link-graph` | Full node/edge graph of inter-document links |
| `GET` | `/api/config` | Public app config (feature flags) |
| `GET/PUT` | `/api/settings` | Read / update server settings |
| `POST` | `/api/ai/generate-ui` | Generate UI prototype from wireframe descriptions |
| `POST` | `/api/ai/chat` | Chat with AI assistant |
| `POST` | `/api/ai/describe` | Describe canvas contents |
| `POST` | `/api/ai/suggest` | Get smart suggestions for canvas |

WebSocket endpoint: `ws://<host>/ws?doc=<documentId>`

## Security Notes

- **No built-in user management.** `APP_PASSWORD` is a single shared password. If you need per-user auth, put Drawbook behind an auth proxy (OAuth2 Proxy, Cloudflare Access, Authelia, etc.).
- **CORS is open by default** for ease of self-hosting. Set `CORS_ORIGINS` to restrict it in production.
- Login endpoint is rate-limited (10 attempts per 15 minutes).
- When exposing to the internet, use HTTPS (reverse proxy with TLS termination).

## Third-Party Licenses

Drawbook's own code is MIT-licensed, but it depends on libraries with different licenses. You are responsible for complying with each when you host or distribute this software.

| Library | License | Notes |
|---------|---------|-------|
| **tldraw** | [tldraw License](https://github.com/tldraw/tldraw/blob/main/LICENSE.md) (proprietary) | **Not MIT.** Production use requires a license key from [tldraw.dev](https://tldraw.dev). Dev/personal use is allowed. |
| **Excalidraw** | MIT | |
| **BlockNote** | MPL-2.0 | Modifications to BlockNote source must stay MPL-2.0. Using it as a dependency is fine. |
| **Univer** | Apache-2.0 | Community packages only. Pro features may show watermarks without a commercial license. |
| **AG Grid** | MIT (Community) | Only the Community Edition is used. Enterprise requires a separate license. |
| **Draw.io** | Apache-2.0 | Embedded via iframe from `embed.diagrams.net` (third-party hosted service). |
| **PDF.js** | Apache-2.0 | |
| **React, Express, etc.** | MIT | |

> **If you plan to deploy Drawbook in production**, you need a tldraw license key. Visit [tldraw.dev](https://tldraw.dev) to get a hobby (free, non-commercial) or commercial license.

## License

MIT — see [LICENSE](./LICENSE).

This license applies to the Drawbook application code only. Third-party dependencies have their own licenses as described above.
