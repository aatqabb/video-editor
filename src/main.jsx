import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installControlTooltips } from './controlTooltips.js'
import { installTransitionPreviews } from './transitionPreviewEnhancer.js'

const removeTooltips = installControlTooltips()
const removeTransitionPreviews = installTransitionPreviews()
window.addEventListener('beforeunload', () => {
  removeTooltips()
  removeTransitionPreviews()
}, { once: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
