import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = createServer(app);
// WebSocket server for live sync
const wss = new WebSocketServer({ server, path: '/ws' });
// Store connections per document
const rooms = new Map();
wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const documentId = url.searchParams.get('doc');
    if (!documentId) {
        ws.close(1008, 'Document ID required');
        return;
    }
    // Join room
    if (!rooms.has(documentId)) {
        rooms.set(documentId, new Set());
    }
    rooms.get(documentId).add(ws);
    console.log(`[WS] Client joined room: ${documentId} (${rooms.get(documentId).size} clients)`);
    ws.on('message', (data) => {
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
    ws.on('close', () => {
        const room = rooms.get(documentId);
        if (room) {
            room.delete(ws);
            console.log(`[WS] Client left room: ${documentId} (${room.size} clients)`);
            if (room.size === 0) {
                rooms.delete(documentId);
            }
        }
    });
    ws.on('error', (error) => {
        console.error('[WS] Error:', error);
    });
});
// CORS - open for internal network use
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// Data directory for persistence - use env var for Docker, fallback for dev
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
// Metadata file paths
const FOLDERS_FILE = path.join(DATA_DIR, '_folders.json');
const METADATA_FILE = path.join(DATA_DIR, '_metadata.json');
function loadFolders() {
    try {
        if (fs.existsSync(FOLDERS_FILE)) {
            return JSON.parse(fs.readFileSync(FOLDERS_FILE, 'utf-8'));
        }
    }
    catch (e) {
        console.error('[Server] Error loading folders:', e);
    }
    return [];
}
function saveFolders(folders) {
    fs.writeFileSync(FOLDERS_FILE, JSON.stringify(folders, null, 2));
}
function loadMetadata() {
    try {
        if (fs.existsSync(METADATA_FILE)) {
            return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        }
    }
    catch (e) {
        console.error('[Server] Error loading metadata:', e);
    }
    return {};
}
function saveMetadata(metadata) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}
// ============ FOLDER ENDPOINTS ============
// List all folders
app.get('/api/folders', (_req, res) => {
    try {
        const folders = loadFolders();
        res.json({ folders });
    }
    catch (error) {
        console.error('[Server] List folders error:', error);
        res.status(500).json({ error: 'Failed to list folders' });
    }
});
// Create a folder
app.post('/api/folders', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        const folders = loadFolders();
        const newFolder = {
            id: `folder-${Date.now()}`,
            name: name.trim(),
            createdAt: new Date().toISOString()
        };
        folders.push(newFolder);
        saveFolders(folders);
        console.log(`[Server] Created folder: ${newFolder.name}`);
        res.json({ success: true, folder: newFolder });
    }
    catch (error) {
        console.error('[Server] Create folder error:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});
// Rename a folder
app.post('/api/folders/:folderId/rename', (req, res) => {
    try {
        const { folderId } = req.params;
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        const folders = loadFolders();
        const folder = folders.find(f => f.id === folderId);
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        folder.name = name.trim();
        saveFolders(folders);
        console.log(`[Server] Renamed folder: ${folderId} -> ${name}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Server] Rename folder error:', error);
        res.status(500).json({ error: 'Failed to rename folder' });
    }
});
// Delete a folder (moves documents to root)
app.delete('/api/folders/:folderId', (req, res) => {
    try {
        const { folderId } = req.params;
        // Remove folder
        let folders = loadFolders();
        folders = folders.filter(f => f.id !== folderId);
        saveFolders(folders);
        // Move documents from this folder to root
        const metadata = loadMetadata();
        for (const docId of Object.keys(metadata)) {
            if (metadata[docId].folderId === folderId) {
                metadata[docId].folderId = null;
            }
        }
        saveMetadata(metadata);
        console.log(`[Server] Deleted folder: ${folderId}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Server] Delete folder error:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});
// ============ DOCUMENT ENDPOINTS ============
// Save document endpoint
app.post('/api/save/:documentId', (req, res) => {
    try {
        const { documentId } = req.params;
        const { snapshot, folderId } = req.body;
        if (!snapshot) {
            return res.status(400).json({ error: 'Snapshot is required' });
        }
        const filePath = path.join(DATA_DIR, `${documentId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
        // Update metadata if folderId is provided
        if (folderId !== undefined) {
            const metadata = loadMetadata();
            metadata[documentId] = { ...metadata[documentId], folderId };
            saveMetadata(metadata);
        }
        console.log(`[Server] Saved document: ${documentId}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Server] Save error:', error);
        res.status(500).json({ error: 'Failed to save document' });
    }
});
// Load document endpoint
app.get('/api/load/:documentId', (req, res) => {
    try {
        const { documentId } = req.params;
        const filePath = path.join(DATA_DIR, `${documentId}.json`);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            const snapshot = JSON.parse(data);
            const metadata = loadMetadata();
            console.log(`[Server] Loaded document: ${documentId}`);
            res.json({ snapshot, metadata: metadata[documentId] || null });
        }
        else {
            res.json({ snapshot: null, metadata: null });
        }
    }
    catch (error) {
        console.error('[Server] Load error:', error);
        res.status(500).json({ error: 'Failed to load document' });
    }
});
// List documents endpoint (optionally filter by folder)
app.get('/api/documents', (req, res) => {
    try {
        const folderId = req.query.folderId;
        const metadata = loadMetadata();
        const files = fs.readdirSync(DATA_DIR)
            .filter(f => f.endsWith('.json') && !f.startsWith('_'))
            .map(f => {
            const filePath = path.join(DATA_DIR, f);
            const stats = fs.statSync(filePath);
            const docId = f.replace('.json', '');
            const docMeta = metadata[docId] || { folderId: null };
            return {
                id: docId,
                name: docMeta.name || docId,
                folderId: docMeta.folderId,
                modifiedAt: stats.mtime.toISOString()
            };
        })
            .filter(doc => {
            // Filter by folder
            if (folderId === undefined)
                return true; // Return all
            if (folderId === 'root')
                return doc.folderId === null;
            return doc.folderId === folderId;
        })
            .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
        res.json({ documents: files });
    }
    catch (error) {
        console.error('[Server] List error:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});
// Move document to folder
app.post('/api/documents/:documentId/move', (req, res) => {
    try {
        const { documentId } = req.params;
        const { folderId } = req.body;
        const metadata = loadMetadata();
        metadata[documentId] = { ...metadata[documentId], folderId: folderId || null };
        saveMetadata(metadata);
        console.log(`[Server] Moved document ${documentId} to folder ${folderId || 'root'}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Server] Move error:', error);
        res.status(500).json({ error: 'Failed to move document' });
    }
});
// Delete document endpoint
app.delete('/api/delete/:documentId', (req, res) => {
    try {
        const { documentId } = req.params;
        const filePath = path.join(DATA_DIR, `${documentId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            // Remove from metadata
            const metadata = loadMetadata();
            delete metadata[documentId];
            saveMetadata(metadata);
            console.log(`[Server] Deleted document: ${documentId}`);
            res.json({ success: true });
        }
        else {
            res.status(404).json({ error: 'Document not found' });
        }
    }
    catch (error) {
        console.error('[Server] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});
// Rename document endpoint
app.post('/api/rename/:documentId', (req, res) => {
    try {
        const { documentId } = req.params;
        const { newName } = req.body;
        if (!newName) {
            return res.status(400).json({ error: 'New name is required' });
        }
        const oldFilePath = path.join(DATA_DIR, `${documentId}.json`);
        const newDocumentId = newName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        const newFilePath = path.join(DATA_DIR, `${newDocumentId}.json`);
        if (!fs.existsSync(oldFilePath)) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (oldFilePath !== newFilePath && fs.existsSync(newFilePath)) {
            return res.status(400).json({ error: 'A document with that name already exists' });
        }
        // Rename file
        if (oldFilePath !== newFilePath) {
            fs.renameSync(oldFilePath, newFilePath);
        }
        // Update metadata
        const metadata = loadMetadata();
        if (metadata[documentId]) {
            metadata[newDocumentId] = { ...metadata[documentId], name: newName.trim() };
            delete metadata[documentId];
        }
        else {
            metadata[newDocumentId] = { folderId: null, name: newName.trim() };
        }
        saveMetadata(metadata);
        console.log(`[Server] Renamed document: ${documentId} -> ${newDocumentId}`);
        res.json({ success: true, newDocumentId });
    }
    catch (error) {
        console.error('[Server] Rename error:', error);
        res.status(500).json({ error: 'Failed to rename document' });
    }
});
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Serve static files in production
const clientPath = path.join(__dirname, '../client');
app.use(express.static(clientPath));
app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Server] tldraw server running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket server running on ws://localhost:${PORT}/ws`);
});
