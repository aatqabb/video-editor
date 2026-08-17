import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installControlTooltips } from './controlTooltips.js'

const removeTooltips = installControlTooltips()
window.addEventListener('beforeunload', removeTooltips, { once: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
