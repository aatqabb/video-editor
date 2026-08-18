import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './timelineEnhancements.css'
import App from './App.jsx'
import { installControlTooltips } from './controlTooltips.js'
import { installTransitionPreviews } from './transitionPreviewEnhancer.js'
import { installTimelineSelectionEnhancer } from './timelineSelectionEnhancer.js'

const removeTooltips = installControlTooltips()
const removeTransitionPreviews = installTransitionPreviews()
const removeTimelineSelection = installTimelineSelectionEnhancer()
window.addEventListener('beforeunload', () => {
  removeTooltips()
  removeTransitionPreviews()
  removeTimelineSelection()
}, { once: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
