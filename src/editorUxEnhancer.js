const keyMap = new Map([
  ['Space', { code: 'Space', key: ' ' }], ['K', { key: 'k' }], ['D', { key: 'Delete' }], ['Q', { key: 'q' }], ['W', { key: 'w' }],
  ['M', { key: 'm' }], ['+', { key: '+' }], ['-', { key: '-' }], ['[', { key: '[' }], [']', { key: ']' }],
  ['Ctrl+C', { key: 'c', ctrlKey: true }], ['Ctrl+V', { key: 'v', ctrlKey: true }], ['Ctrl+D', { key: 'd', ctrlKey: true }],
  ['Ctrl+Z', { key: 'z', ctrlKey: true }], ['Ctrl+Shift+Z', { key: 'z', ctrlKey: true, shiftKey: true }],
])

function dispatchShortcut(label) {
  const clean = label.replace(/\s+/g, '')
  const spec = keyMap.get(label) || keyMap.get(clean)
  if (!spec) return false
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...spec }))
  return true
}

function makeTool(label, handler, title = '') {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.title = title || label
  button.className = 'ux-extra-tool'
  button.addEventListener('click', handler)
  return button
}

function enhanceShortcutModal() {
  document.querySelectorAll('.shortcut-row').forEach((row) => {
    if (row.dataset.clickable === '1') return
    const key = row.querySelector('kbd')?.textContent?.trim()
    if (!key) return
    row.dataset.clickable = '1'
    row.tabIndex = 0
    row.title = `Click to run ${key}`
    const run = () => dispatchShortcut(key)
    row.addEventListener('click', run)
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); run() }
    })
  })
}

function enhanceEditingTools() {
  const labels = [...document.querySelectorAll('.section-label')]
  const toolLabel = labels.find((node) => node.textContent?.trim() === 'EDITING TOOLS')
  const grid = toolLabel?.parentElement?.querySelector('.option-grid')
  if (!grid || grid.dataset.uxEnhanced === '1') return
  grid.dataset.uxEnhanced = '1'
  grid.append(
    makeTool('Duplicate', () => dispatchShortcut('Ctrl+D'), 'Duplicate selected clips'),
    makeTool('Copy', () => dispatchShortcut('Ctrl+C'), 'Copy selected clips'),
    makeTool('Paste', () => dispatchShortcut('Ctrl+V'), 'Paste copied clips'),
    makeTool('Undo', () => dispatchShortcut('Ctrl+Z'), 'Undo last edit'),
    makeTool('Redo', () => dispatchShortcut('Ctrl+Shift+Z'), 'Redo last edit'),
    makeTool('Delete', () => dispatchShortcut('D'), 'Delete selected clips'),
    makeTool('Zoom +', () => dispatchShortcut('+'), 'Zoom timeline in'),
    makeTool('Zoom −', () => dispatchShortcut('-'), 'Zoom timeline out'),
  )
}

function explainMarkers() {
  document.querySelectorAll('.timeline-marker').forEach((marker) => {
    marker.title = 'Timeline marker — click to jump, double-click to remove'
    marker.setAttribute('aria-label', 'Timeline marker')
  })
}

function smoothPlayhead() {
  document.querySelectorAll('.playhead').forEach((node) => {
    node.style.willChange = 'left'
  })
}

export function installEditorUxEnhancer() {
  const refresh = () => {
    enhanceShortcutModal()
    enhanceEditingTools()
    explainMarkers()
    smoothPlayhead()
  }
  const observer = new MutationObserver(refresh)
  observer.observe(document.documentElement, { subtree: true, childList: true })
  refresh()
  return () => observer.disconnect()
}
