# tldraw Workspace (Self-Hosted)

Collaborative tldraw workspace with:

- multi-user live sync (WebSocket)
- persistent documents
- folders and document management
- mobile-friendly dashboard
- optional MinIO object storage backend

## Project Layout

```
tldraw/
├── app/                  # Main application (publish this directory)
│   ├── src/              # React UI
│   ├── server/           # Express + WebSocket backend
│   ├── data/             # Local storage (ignored in git)
│   ├── env.example       # Environment template
│   └── README.md         # App-level usage/config docs
├── docker-compose.yml
└── Dockerfile
```

## Run Without Docker

```bash
cd app
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API/WebSocket: `http://localhost:3000`

## Run With Docker

```bash
docker compose up -d --build
```

## Storage Backends

The backend supports:

- `local` (default): JSON files in `app/data`
- `minio`: S3-compatible object storage (MinIO)

Selection behavior:

- `STORAGE_BACKEND=minio` -> force MinIO
- `STORAGE_BACKEND=local` -> force local
- if unset, MinIO is auto-selected when MinIO env vars are present

See `app/env.example` for all variables.

## Security Notes

This project has no built-in authentication.

If exposing publicly, place it behind auth (for example: OAuth2 proxy, Cloudflare Access, VPN-only access).

## Publish Checklist (GitHub)

Before publishing:

- ensure `.env` is **not** committed
- ensure `app/data` is **not** committed
- ensure `app/dist` is **not** committed
- rotate/remove any real API keys if they were ever stored locally

The repository `.gitignore` already ignores these paths.

