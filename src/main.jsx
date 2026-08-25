import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './timelineEnhancements.css'
import './editorUxEnhancer.css'
import './PremierePanelResize.css'
import App from './App.jsx'
import { installControlTooltips } from './controlTooltips.js'
import { installTransitionPreviews } from './transitionPreviewEnhancer.js'
import { installTimelineSelectionEnhancer } from './timelineSelectionEnhancer.js'
import { installEditorUxEnhancer } from './editorUxEnhancer.js'
import { installTimelineScrubLock } from './timelineScrubLock.js'
import { installShortcutManager } from './shortcutManager.js'

const removeTooltips = installControlTooltips()
const removeTransitionPreviews = installTransitionPreviews()
const removeTimelineSelection = installTimelineSelectionEnhancer()
const removeEditorUx = installEditorUxEnhancer()
const removeTimelineScrubLock = installTimelineScrubLock()
const removeShortcutManager = installShortcutManager()
window.addEventListener('beforeunload', () => {
  removeTooltips()
  removeTransitionPreviews()
  removeTimelineSelection()
  removeEditorUx()
  removeTimelineScrubLock()
  removeShortcutManager()
}, { once: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
