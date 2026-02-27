import { TldrawEditor } from './components/TldrawEditor'
import { Dashboard } from './components/Dashboard'

// Check URL for doc parameter
const urlParams = new URLSearchParams(window.location.search)
const documentId = urlParams.get('doc')

function App() {
  // If doc param exists, show editor
  if (documentId) {
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <TldrawEditor documentId={documentId} />
      </div>
    )
  }
  
  // Otherwise show dashboard
  return <Dashboard />
}

export default App
