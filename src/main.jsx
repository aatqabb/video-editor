import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './timelineEnhancements.css'
import './editorUxEnhancer.css'
import './PremiereWorkspaceController.css'
import './TimelineLayerSpacing.css'
import App from './App.jsx'
import { installControlTooltips } from './controlTooltips.js'
import { installTransitionPreviews } from './transitionPreviewEnhancer.js'
import { installTimelineSelectionEnhancer } from './timelineSelectionEnhancer.js'
import { installEditorUxEnhancer } from './editorUxEnhancer.js'
import { installTimelineScrubLock } from './timelineScrubLock.js'
import { installShortcutManager } from './shortcutManager.js'
import { installPremiereWorkspaceController } from './premiereWorkspaceController.js'
import { installTimelineLayerBalance } from './timelineLayerBalance.js'

const removeTooltips = installControlTooltips()
const removeTransitionPreviews = installTransitionPreviews()
const removeTimelineSelection = installTimelineSelectionEnhancer()
const removeEditorUx = installEditorUxEnhancer()
const removeTimelineScrubLock = installTimelineScrubLock()
const removeShortcutManager = installShortcutManager()
const removePremiereWorkspace = installPremiereWorkspaceController()
const removeTimelineLayerBalance = installTimelineLayerBalance()
window.addEventListener('beforeunload', () => {
  removeTooltips()
  removeTransitionPreviews()
  removeTimelineSelection()
  removeEditorUx()
  removeTimelineScrubLock()
  removeShortcutManager()
  removePremiereWorkspace()
  removeTimelineLayerBalance()
}, { once: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
