import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './timelineEnhancements.css'
import './editorUxEnhancer.css'
import App from './App.jsx'
import { installControlTooltips } from './controlTooltips.js'
import { installTransitionPreviews } from './transitionPreviewEnhancer.js'
import { installTimelineSelectionEnhancer } from './timelineSelectionEnhancer.js'
import { installEditorUxEnhancer } from './editorUxEnhancer.js'

const removeTooltips = installControlTooltips()
const removeTransitionPreviews = installTransitionPreviews()
const removeTimelineSelection = installTimelineSelectionEnhancer()
const removeEditorUx = installEditorUxEnhancer()
window.addEventListener('beforeunload', () => {
  removeTooltips()
  removeTransitionPreviews()
  removeTimelineSelection()
  removeEditorUx()
}, { once: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
