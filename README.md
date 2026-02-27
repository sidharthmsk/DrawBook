# tldraw

Self-hosted whiteboard and drawing application with file management.

## Overview

| Property | Value |
|----------|-------|
| **Image** | Custom build |
| **Port** | `3045:3000` |
| **Data Location** | `./app/data` |

## Quick Start

```bash
cd /home/sidharth/Documents/Docker/tldraw

# Build and start
docker compose build
docker compose up -d
```

## Build Process

This service uses a custom Dockerfile that builds the tldraw application:

```bash
# Rebuild after code changes
docker compose build --no-cache
docker compose up -d
```

## Reverse Proxy Setup

### Nginx Proxy Manager Configuration

| Setting | Value |
|---------|-------|
| **Scheme** | `http` |
| **Forward Hostname** | `tldraw` |
| **Forward Port** | `3000` |
| **Websockets Support** | ✅ Enable |

### Cloudflare Tunnel

```yaml
ingress:
  - hostname: tldraw.yourdomain.com
    service: http://tldraw:3000
```

## Directory Structure

```
tldraw/
├── docker-compose.yml
└── app/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── data/              # Persistent drawing storage
    ├── server/
    │   └── index.ts       # Express server
    └── src/
        ├── App.tsx
        ├── main.tsx
        └── components/
            ├── Dashboard.tsx
            └── TldrawEditor.tsx
```

## Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `TZ` | `Asia/Kolkata` | Timezone |
| `PORT` | `3000` | Server port |
| `DATA_DIR` | `/app/data` | Data storage path |

## Permissions

```bash
# Ensure data directory is writable
sudo chown -R 1000:1000 ./app/data
```

## Security Considerations

⚠️ **NO BUILT-IN AUTHENTICATION**

| Concern | Status | Notes |
|---------|--------|-------|
| **Authentication** | ❌ None | No login required |
| **Data Privacy** | ⚠️ Risk | Anyone can view/edit drawings |
| **Network** | ⚠️ Public port | Not bound to localhost |

### Required Security Measures

**Option 1: Cloudflare Access (Recommended)**

1. Go to Cloudflare Zero Trust → Access → Applications
2. Add application for `tldraw.yourdomain.com`
3. Create policy requiring authentication

**Option 2: OAuth2 Proxy**

See OAuth2 Proxy README for setup.

**Option 3: Tailscale Only**

- Don't expose via Cloudflare Tunnel
- Access only via Tailscale VPN
- Update port binding to `127.0.0.1:3045:3000`

### Bind to Localhost

For Tailscale-only access, update docker-compose.yml:

```yaml
ports:
  - "127.0.0.1:3045:3000"
```

## Features

- **Dashboard** - View and manage all drawings
- **Auto-save** - Drawings save automatically
- **Persistent storage** - Data survives container restarts
- **Mobile support** - Works on touch devices

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List all drawings |
| `/api/load/:id` | GET | Load a drawing |
| `/api/save/:id` | POST | Save a drawing |
| `/api/delete/:id` | DELETE | Delete a drawing |
| `/api/rename/:id` | POST | Rename a drawing |
| `/api/health` | GET | Health check |

## Backup

```bash
# Backup all drawings
tar -czvf tldraw-backup.tar.gz ./app/data
```

## Development

To modify the application:

```bash
cd app

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Troubleshooting

### Drawings Not Saving

```bash
# Check data directory permissions
ls -la ./app/data

# Check server logs
docker logs tldraw

# Verify DATA_DIR environment variable
docker exec tldraw env | grep DATA_DIR
```

### Build Fails

```bash
# Check build logs
docker compose build --no-cache 2>&1 | tee build.log

# Common issues:
# - npm install failures: check package.json
# - TypeScript errors: check source files
```

### Touch/Zoom Not Working

- Ensure no CSS overlays are blocking touch events
- Check browser console for JavaScript errors
- Verify tldraw CSS is loaded correctly

## Resource Limits

| Resource | Limit |
|----------|-------|
| Memory | 512MB |
| CPU | 1 core |
| PIDs | 128 |

## Comparison with Excalidraw

| Feature | tldraw | Excalidraw |
|---------|--------|------------|
| File Management | ✅ Built-in | ✅ Via Excalidash |
| Authentication | ❌ None | ❌ None |
| Real-time Collab | ❌ Removed | ✅ Available |
| Mobile Support | ✅ Good | ✅ Good |
| Self-hosted | ✅ Custom build | ✅ Docker image |

## Related Services

- **Excalidraw** - Alternative drawing tool
- **OAuth2 Proxy** - Add authentication
- **Cloudflare Access** - Zero Trust authentication
- **Nginx Proxy Manager** - Reverse proxy

---

*Last updated: January 2026*

