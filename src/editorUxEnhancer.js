const keyMap = new Map([
  ['Space', { code: 'Space', key: ' ' }],
  ['V', { key: 'v' }], ['C', { key: 'c' }], ['K', { key: 'k' }], ['Delete', { key: 'Delete' }],
  ['Q', { key: 'q' }], ['W', { key: 'w' }], ['M', { key: 'm' }],
  ['+', { key: '+' }], ['-', { key: '-' }], ['[', { key: '[' }], [']', { key: ']' }],
  ['←', { key: 'ArrowLeft' }], ['→', { key: 'ArrowRight' }],
  ['Ctrl+C', { key: 'c', ctrlKey: true }], ['Ctrl+V', { key: 'v', ctrlKey: true }], ['Ctrl+D', { key: 'd', ctrlKey: true }],
  ['Ctrl+Z', { key: 'z', ctrlKey: true }], ['Ctrl+Shift+Z', { key: 'z', ctrlKey: true, shiftKey: true }], ['Ctrl+S', { key: 's', ctrlKey: true }],
])

function normalize(label) { return label.replace(/\s+/g, '') }

function dispatchShortcut(label) {
  const clean = normalize(label)
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

function runShortcutLabel(key) {
  const clean = normalize(key)
  if (clean === 'Ctrl+C/V') return dispatchShortcut('Ctrl+C')
  if (clean === '←/→') return dispatchShortcut('→')
  if (clean === '+/-') return dispatchShortcut('+')
  if (clean === '[/]') return dispatchShortcut(']')
  return dispatchShortcut(key)
}

function enhanceShortcutModal() {
  document.querySelectorAll('.shortcut-row').forEach((row) => {
    if (row.dataset.clickable === '2') return
    const key = row.querySelector('kbd')?.textContent?.trim()
    if (!key) return
    row.dataset.clickable = '2'
    row.tabIndex = 0
    row.title = `Click to run ${key}`

    const run = () => runShortcutLabel(key)
    row.addEventListener('click', (event) => {
      if (event.target.closest('.shortcut-inline-action')) return
      run()
    })
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); run() }
    })

    const clean = normalize(key)
    if (clean === 'Ctrl+C/V') {
      const copy = makeTool('Copy', () => dispatchShortcut('Ctrl+C'), 'Copy selected clips')
      const paste = makeTool('Paste', () => dispatchShortcut('Ctrl+V'), 'Paste copied clips')
      copy.classList.add('shortcut-inline-action'); paste.classList.add('shortcut-inline-action')
      row.append(copy, paste)
    } else if (clean === '←/→') {
      const prev = makeTool('◀', () => dispatchShortcut('←'), 'Previous frame')
      const next = makeTool('▶', () => dispatchShortcut('→'), 'Next frame')
      prev.classList.add('shortcut-inline-action'); next.classList.add('shortcut-inline-action')
      row.append(prev, next)
    }
  })
}

function enhanceEditingTools() {
  const labels = [...document.querySelectorAll('.section-label')]
  const toolLabel = labels.find((node) => node.textContent?.trim() === 'EDITING TOOLS')
  const grid = toolLabel?.parentElement?.querySelector('.option-grid')
  if (!grid || grid.dataset.uxEnhanced === '2') return
  grid.dataset.uxEnhanced = '2'
  grid.append(
    makeTool('Duplicate', () => dispatchShortcut('Ctrl+D'), 'Duplicate selected clips'),
    makeTool('Copy', () => dispatchShortcut('Ctrl+C'), 'Copy selected clips'),
    makeTool('Paste', () => dispatchShortcut('Ctrl+V'), 'Paste copied clips'),
    makeTool('Undo', () => dispatchShortcut('Ctrl+Z'), 'Undo last edit'),
    makeTool('Redo', () => dispatchShortcut('Ctrl+Shift+Z'), 'Redo last edit'),
    makeTool('Delete', () => dispatchShortcut('Delete'), 'Delete selected clips'),
    makeTool('Prev Frame', () => dispatchShortcut('←'), 'Move playhead one frame backward'),
    makeTool('Next Frame', () => dispatchShortcut('→'), 'Move playhead one frame forward'),
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
    node.style.willChange = 'left, transform'
    node.style.transition = 'none'
    node.style.pointerEvents = 'none'
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
