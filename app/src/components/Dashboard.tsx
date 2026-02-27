import { useState, useEffect } from 'react'

interface Document {
  id: string
  name: string
  folderId: string | null
  modifiedAt: string
}

interface Folder {
  id: string
  name: string
  createdAt: string
}

export function Dashboard() {
  const [docs, setDocs] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [movingDoc, setMovingDoc] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [foldersRes, docsRes] = await Promise.all([
        fetch('/api/folders'),
        fetch(`/api/documents${currentFolder ? `?folderId=${currentFolder}` : '?folderId=root'}`)
      ])
      const foldersData = await foldersRes.json()
      const docsData = await docsRes.json()
      setFolders(foldersData.folders || [])
      setDocs(docsData.documents || [])
    } catch (e) {
      console.error('Failed to load data:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [currentFolder])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => {
      setMenuOpen(null)
      setMovingDoc(null)
    }
    if (menuOpen || movingDoc) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [menuOpen, movingDoc])

  const createNew = () => {
    const docId = `drawing-${Date.now()}`
    // Save with current folder
    if (currentFolder) {
      fetch(`/api/documents/${docId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: currentFolder })
      })
    }
    window.location.href = `/?doc=${docId}${currentFolder ? `&folder=${currentFolder}` : ''}`
  }

  const openDoc = (id: string) => {
    if (renaming === id) return
    window.location.href = `/?doc=${id}`
  }

  const openFolder = (folderId: string) => {
    setCurrentFolder(folderId)
  }

  const goToRoot = () => {
    setCurrentFolder(null)
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setShowNewFolderInput(false)
      return
    }
    
    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() })
      })
      setNewFolderName('')
      setShowNewFolderInput(false)
      loadData()
    } catch (e) {
      console.error('Failed to create folder:', e)
    }
  }

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this drawing?')) return
    
    try {
      await fetch(`/api/delete/${id}`, { method: 'DELETE' })
      setDocs(docs.filter(d => d.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
    setMenuOpen(null)
  }

  const deleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this folder? Drawings inside will be moved to root.')) return
    
    try {
      await fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
      loadData()
    } catch (err) {
      console.error('Failed to delete folder:', err)
    }
    setMenuOpen(null)
  }

  const startRename = (item: Document | Folder, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenaming(item.id)
    setRenameValue(item.name || item.id)
    setMenuOpen(null)
  }

  const finishRename = async (id: string, isFolder: boolean) => {
    if (!renameValue.trim()) {
      setRenaming(null)
      return
    }
    
    try {
      if (isFolder) {
        await fetch(`/api/folders/${id}/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: renameValue.trim() })
        })
      } else {
        await fetch(`/api/rename/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: renameValue.trim() })
        })
      }
      loadData()
    } catch (err) {
      console.error('Failed to rename:', err)
    }
    setRenaming(null)
  }

  const moveDocToFolder = async (docId: string, folderId: string | null) => {
    try {
      await fetch(`/api/documents/${docId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId })
      })
      loadData()
    } catch (e) {
      console.error('Failed to move document:', e)
    }
    setMovingDoc(null)
    setMenuOpen(null)
  }

  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(menuOpen === id ? null : id)
    setMovingDoc(null)
  }

  const showMoveMenu = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMovingDoc(docId)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    
    return date.toLocaleDateString()
  }

  const currentFolderName = currentFolder 
    ? folders.find(f => f.id === currentFolder)?.name || 'Folder'
    : null

  // All styles inline to avoid any CSS conflicts
  const styles = {
    container: {
      minHeight: '100vh',
      background: '#0d0d0d',
      color: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflowY: 'auto' as const,
      WebkitOverflowScrolling: 'touch' as const,
    } as React.CSSProperties,
    inner: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px',
    } as React.CSSProperties,
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '32px',
      flexWrap: 'wrap' as const,
      gap: '16px',
    } as React.CSSProperties,
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    } as React.CSSProperties,
    logoIcon: {
      width: '36px',
      height: '36px',
      background: '#1d1d1d',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    title: {
      margin: 0,
      fontSize: '22px',
      fontWeight: 600,
    } as React.CSSProperties,
    headerActions: {
      display: 'flex',
      gap: '12px',
    } as React.CSSProperties,
    newBtn: {
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: '12px 20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    } as React.CSSProperties,
    folderBtn: {
      background: '#2a2a2a',
      color: 'white',
      border: '1px solid #3a3a3a',
      padding: '12px 20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    } as React.CSSProperties,
    breadcrumb: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '24px',
      fontSize: '14px',
    } as React.CSSProperties,
    breadcrumbLink: {
      color: '#3b82f6',
      cursor: 'pointer',
      background: 'none',
      border: 'none',
      fontSize: '14px',
      padding: 0,
    } as React.CSSProperties,
    breadcrumbCurrent: {
      color: '#999',
    } as React.CSSProperties,
    sectionTitle: {
      fontSize: '14px',
      fontWeight: 600,
      marginBottom: '12px',
      color: '#666',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
    } as React.CSSProperties,
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '32px',
    } as React.CSSProperties,
    card: {
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: '12px',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
      position: 'relative' as const,
    } as React.CSSProperties,
    folderCard: {
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: '12px',
      padding: '16px',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
      position: 'relative' as const,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    } as React.CSSProperties,
    folderIcon: {
      width: '40px',
      height: '40px',
      background: '#2a2a2a',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f59e0b',
    } as React.CSSProperties,
    folderInfo: {
      flex: 1,
      minWidth: 0,
    } as React.CSSProperties,
    thumbnail: {
      aspectRatio: '16/10',
      background: '#252525',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#555',
    } as React.CSSProperties,
    cardInfo: {
      padding: '12px',
    } as React.CSSProperties,
    cardName: {
      fontSize: '14px',
      fontWeight: 500,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      marginBottom: '4px',
    } as React.CSSProperties,
    cardDate: {
      fontSize: '12px',
      color: '#666',
    } as React.CSSProperties,
    menuBtn: {
      position: 'absolute' as const,
      top: '8px',
      right: '8px',
      width: '32px',
      height: '32px',
      background: 'rgba(0,0,0,0.7)',
      border: 'none',
      borderRadius: '6px',
      color: '#aaa',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    menu: {
      position: 'absolute' as const,
      top: '44px',
      right: '8px',
      background: '#2a2a2a',
      border: '1px solid #3a3a3a',
      borderRadius: '8px',
      overflow: 'hidden',
      zIndex: 10,
      minWidth: '150px',
    } as React.CSSProperties,
    menuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 14px',
      border: 'none',
      background: 'transparent',
      color: '#f5f5f5',
      fontSize: '13px',
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left' as const,
    } as React.CSSProperties,
    menuItemDanger: {
      color: '#ef4444',
    } as React.CSSProperties,
    subMenu: {
      background: '#333',
      borderTop: '1px solid #444',
    } as React.CSSProperties,
    subMenuItem: {
      padding: '8px 14px 8px 28px',
      border: 'none',
      background: 'transparent',
      color: '#f5f5f5',
      fontSize: '12px',
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left' as const,
      display: 'block',
    } as React.CSSProperties,
    renameInput: {
      width: '100%',
      padding: '6px 8px',
      background: '#252525',
      border: '1px solid #3b82f6',
      borderRadius: '4px',
      color: '#fff',
      fontSize: '14px',
      outline: 'none',
    } as React.CSSProperties,
    empty: {
      textAlign: 'center' as const,
      padding: '60px 20px',
      color: '#666',
    } as React.CSSProperties,
    emptyTitle: {
      fontSize: '18px',
      color: '#999',
      marginBottom: '8px',
    } as React.CSSProperties,
    newFolderInput: {
      display: 'flex',
      gap: '8px',
      marginBottom: '16px',
    } as React.CSSProperties,
  }

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
              </svg>
            </div>
            <h1 style={styles.title}>tldraw</h1>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.folderBtn} onClick={() => setShowNewFolderInput(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                <path d="M12 11v6M9 14h6"/>
              </svg>
              New Folder
            </button>
            <button style={styles.newBtn} onClick={createNew}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              New Drawing
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        {currentFolder && (
          <div style={styles.breadcrumb}>
            <button style={styles.breadcrumbLink} onClick={goToRoot}>
              Home
            </button>
            <span style={{ color: '#555' }}>/</span>
            <span style={styles.breadcrumbCurrent}>{currentFolderName}</span>
          </div>
        )}

        {/* New folder input */}
        {showNewFolderInput && (
          <div style={styles.newFolderInput}>
            <input
              style={{ ...styles.renameInput, flex: 1 }}
              placeholder="Folder name..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createFolder()
                if (e.key === 'Escape') setShowNewFolderInput(false)
              }}
              autoFocus
            />
            <button style={styles.newBtn} onClick={createFolder}>Create</button>
            <button style={styles.folderBtn} onClick={() => setShowNewFolderInput(false)}>Cancel</button>
          </div>
        )}

        {loading ? (
          <div style={styles.empty}>Loading...</div>
        ) : (
          <>
            {/* Folders (only show at root) */}
            {!currentFolder && folders.length > 0 && (
              <>
                <h2 style={styles.sectionTitle}>Folders</h2>
                <div style={styles.grid}>
                  {folders.map(folder => (
                    <div
                      key={folder.id}
                      style={styles.folderCard}
                      onClick={() => openFolder(folder.id)}
                    >
                      <div style={styles.folderIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                        </svg>
                      </div>
                      <div style={styles.folderInfo}>
                        {renaming === folder.id ? (
                          <input
                            style={styles.renameInput}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') finishRename(folder.id, true)
                              if (e.key === 'Escape') setRenaming(null)
                            }}
                            onBlur={() => finishRename(folder.id, true)}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <div style={styles.cardName}>{folder.name}</div>
                        )}
                      </div>
                      
                      <button
                        style={{ ...styles.menuBtn, position: 'relative', top: 0, right: 0, background: 'transparent' }}
                        onClick={(e) => toggleMenu(folder.id, e)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2"/>
                          <circle cx="12" cy="12" r="2"/>
                          <circle cx="12" cy="19" r="2"/>
                        </svg>
                      </button>
                      
                      {menuOpen === folder.id && (
                        <div style={{ ...styles.menu, top: '50px', right: '0' }} onClick={e => e.stopPropagation()}>
                          <button
                            style={styles.menuItem}
                            onClick={(e) => startRename(folder, e)}
                            onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3a')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Rename
                          </button>
                          <button
                            style={{ ...styles.menuItem, ...styles.menuItemDanger }}
                            onClick={(e) => deleteFolder(folder.id, e)}
                            onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3a')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                              <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Drawings */}
            <h2 style={styles.sectionTitle}>
              {currentFolder ? 'Drawings in this folder' : 'Drawings'}
            </h2>

            {docs.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyTitle}>
                  {currentFolder ? 'No drawings in this folder' : 'No drawings yet'}
                </div>
                <p>Create your first drawing to get started</p>
              </div>
            ) : (
              <div style={styles.grid}>
                {docs.map(doc => (
                  <div
                    key={doc.id}
                    style={styles.card}
                    onClick={() => openDoc(doc.id)}
                  >
                    <div style={styles.thumbnail}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M3 9h18"/>
                      </svg>
                    </div>
                    <div style={styles.cardInfo}>
                      {renaming === doc.id ? (
                        <input
                          style={styles.renameInput}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') finishRename(doc.id, false)
                            if (e.key === 'Escape') setRenaming(null)
                          }}
                          onBlur={() => finishRename(doc.id, false)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div style={styles.cardName}>{doc.name || doc.id}</div>
                      )}
                      <div style={styles.cardDate}>{formatDate(doc.modifiedAt)}</div>
                    </div>
                    
                    {/* Menu button */}
                    <button
                      style={styles.menuBtn}
                      onClick={(e) => toggleMenu(doc.id, e)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>
                    
                    {/* Dropdown menu */}
                    {menuOpen === doc.id && (
                      <div style={styles.menu} onClick={e => e.stopPropagation()}>
                        <button
                          style={styles.menuItem}
                          onClick={(e) => startRename(doc, e)}
                          onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3a')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          Rename
                        </button>
                        <button
                          style={styles.menuItem}
                          onClick={(e) => showMoveMenu(doc.id, e)}
                          onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3a')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                          </svg>
                          Move to...
                        </button>
                        <button
                          style={{ ...styles.menuItem, ...styles.menuItemDanger }}
                          onClick={(e) => deleteDoc(doc.id, e)}
                          onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3a')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                            <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                          Delete
                        </button>
                        
                        {/* Move submenu */}
                        {movingDoc === doc.id && (
                          <div style={styles.subMenu}>
                            {currentFolder && (
                              <button
                                style={styles.subMenuItem}
                                onClick={() => moveDocToFolder(doc.id, null)}
                                onMouseEnter={e => (e.currentTarget.style.background = '#444')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                📁 Root (Home)
                              </button>
                            )}
                            {folders.filter(f => f.id !== currentFolder).map(folder => (
                              <button
                                key={folder.id}
                                style={styles.subMenuItem}
                                onClick={() => moveDocToFolder(doc.id, folder.id)}
                                onMouseEnter={e => (e.currentTarget.style.background = '#444')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                📁 {folder.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
