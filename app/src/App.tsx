import { TldrawEditor } from './components/TldrawEditor'
import { Dashboard } from './components/Dashboard'

function App() {
  const urlParams = new URLSearchParams(window.location.search)
  const documentId = urlParams.get('doc')
  const folderId = urlParams.get('folder') ?? undefined

  // If doc param exists, show editor
  if (documentId) {
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <TldrawEditor documentId={documentId} initialFolderId={folderId} />
      </div>
    )
  }
  
  // Otherwise show dashboard
  return <Dashboard />
}

export default App
