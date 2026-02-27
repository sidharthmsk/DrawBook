import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { Tldraw, Editor, TLStoreSnapshot, createTLStore, defaultShapeUtils, TLRecord } from 'tldraw'

interface TldrawEditorProps {
  documentId: string
}

export function TldrawEditor({ documentId }: TldrawEditorProps) {
  const [initialSnapshot, setInitialSnapshot] = useState<TLStoreSnapshot | null | undefined>(undefined)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'syncing'>('saved')
  const wsRef = useRef<WebSocket | null>(null)
  const isRemoteChange = useRef(false)
  const lastActiveTime = useRef<number>(Date.now())

  // Reload document from server
  const reloadFromServer = useCallback(async () => {
    if (!editor) return
    
    try {
      const response = await fetch(`/api/load/${documentId}`)
      const data = await response.json()
      
      if (data.snapshot) {
        isRemoteChange.current = true
        editor.store.loadSnapshot(data.snapshot)
        isRemoteChange.current = false
        console.log('[Sync] Reloaded document from server after inactive session')
      }
    } catch (error) {
      console.error('Failed to reload document:', error)
    }
  }, [editor, documentId])

  // Reload on visibility change (when tab becomes active after being inactive)
  useEffect(() => {
    if (!editor) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const inactiveTime = Date.now() - lastActiveTime.current
        // Reload if inactive for more than 5 seconds
        if (inactiveTime > 5000) {
          reloadFromServer()
        }
        // Reconnect WebSocket if it was closed
        if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
          // Force a page reload to reconnect cleanly
          window.location.reload()
        }
      } else {
        lastActiveTime.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [editor, reloadFromServer])

  // Load initial snapshot
  useEffect(() => {
    async function loadDocument() {
      try {
        const response = await fetch(`/api/load/${documentId}`)
        const data = await response.json()
        setInitialSnapshot(data.snapshot || null)
      } catch (error) {
        console.error('Failed to load document:', error)
        setInitialSnapshot(null)
      }
    }
    loadDocument()
  }, [documentId])

  // Create store with snapshot
  const store = useMemo(() => {
    if (initialSnapshot === undefined) return undefined
    
    const newStore = createTLStore({ shapeUtils: defaultShapeUtils })
    if (initialSnapshot) {
      newStore.loadSnapshot(initialSnapshot)
    }
    return newStore
  }, [initialSnapshot])

  // Connect to WebSocket for live sync
  useEffect(() => {
    if (!editor) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws?doc=${documentId}`
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[Sync] Connected to sync server')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        
        if (message.type === 'changes') {
          isRemoteChange.current = true
          
          // Apply remote changes
          const { added, updated, removed } = message.changes
          
          editor.store.mergeRemoteChanges(() => {
            // Handle removed - it's an object with record IDs as keys
            if (removed && Object.keys(removed).length > 0) {
              const idsToRemove = Object.keys(removed) as TLRecord['id'][]
              editor.store.remove(idsToRemove)
            }
            // Handle added - it's an object with record IDs as keys
            if (added && Object.keys(added).length > 0) {
              editor.store.put(Object.values(added) as TLRecord[])
            }
            // Handle updated - it's an object with [before, after] pairs
            if (updated && Object.keys(updated).length > 0) {
              const updates = Object.values(updated).map((u: any) => u[1])
              editor.store.put(updates as TLRecord[])
            }
          })
          
          isRemoteChange.current = false
        }
      } catch (error) {
        console.error('[Sync] Failed to parse message:', error)
      }
    }

    ws.onclose = () => {
      console.log('[Sync] Disconnected from sync server')
    }

    ws.onerror = (error) => {
      console.error('[Sync] WebSocket error:', error)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [editor, documentId])

  // Listen for local changes and broadcast
  useEffect(() => {
    if (!editor || !wsRef.current) return

    const unsubscribe = editor.store.listen(
      (entry) => {
        // Don't broadcast changes that came from remote
        if (isRemoteChange.current) return
        
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          const message = {
            type: 'changes',
            changes: entry.changes,
          }
          ws.send(JSON.stringify(message))
        }
      },
      { scope: 'document', source: 'user' }
    )

    return () => {
      unsubscribe()
    }
  }, [editor])

  // Save function
  const saveDocument = useCallback(async (editorInstance: Editor) => {
    setSaveStatus('saving')
    try {
      const snapshot = editorInstance.store.getSnapshot()
      const response = await fetch(`/api/save/${documentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      })
      
      if (response.ok) {
        setSaveStatus('saved')
      } else {
        setSaveStatus('error')
      }
    } catch (error) {
      console.error('Failed to save document:', error)
      setSaveStatus('error')
    }
  }, [documentId])

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!editor) return

    let saveTimeout: NodeJS.Timeout | null = null

    const unsubscribe = editor.store.listen(
      () => {
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
          saveDocument(editor)
        }, 2000)
      },
      { scope: 'document', source: 'user' }
    )

    return () => {
      unsubscribe()
      if (saveTimeout) clearTimeout(saveTimeout)
    }
  }, [editor, saveDocument])

  const handleMount = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance)
  }, [])

  if (store === undefined) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#1d1d1d',
        color: '#fff'
      }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Tldraw store={store} onMount={handleMount} autoFocus />
      
      {/* Save status indicator */}
      <div style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 12,
        background: 'rgba(0,0,0,0.7)',
        color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'saving' ? '#f59e0b' : '#ef4444',
        zIndex: 1000,
        pointerEvents: 'none',
      }}>
        {saveStatus === 'saved' && '✓ Saved'}
        {saveStatus === 'saving' && '⏳ Saving...'}
        {saveStatus === 'error' && '✗ Save failed'}
        {' • '}
        <span style={{ color: '#888' }}>{documentId}</span>
      </div>
    </div>
  )
}
