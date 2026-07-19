import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted variable Inter. Bundled rather than pulled from a CDN so the app
// has no third-party font request on the factory's network and no FOUT.
import '@fontsource-variable/inter'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
