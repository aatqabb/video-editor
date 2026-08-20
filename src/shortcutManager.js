const STORAGE_KEY = 'video-editor-shortcuts-v1'

const COMMANDS = [
  { id: 'playPause', label: 'Play / Pause preview', chord: 'Space', event: { key: ' ', code: 'Space' } },
  { id: 'cursor', label: 'Cursor / Selection tool', chord: 'V', event: { key: 'v', code: 'KeyV' } },
  { id: 'cut', label: 'Cut / Razor tool', chord: 'C', event: { key: 'c', code: 'KeyC' } },
  { id: 'backwardCut', label: 'Backward cut / ripple trim', chord: 'Q', event: { key: 'q', code: 'KeyQ' } },
  { id: 'forwardCut', label: 'Forward cut / ripple trim', chord: 'W', event: { key: 'w', code: 'KeyW' } },
  { id: 'split', label: 'Split selected clip at playhead', chord: 'K', event: { key: 'k', code: 'KeyK' } },
  { id: 'delete', label: 'Delete selected clip', chord: 'Delete', event: { key: 'Delete', code: 'Delete' } },
  { id: 'zoomIn', label: 'Timeline zoom in', chord: '+', event: { key: '+', code: 'Equal' } },
  { id: 'zoomOut', label: 'Timeline zoom out', chord: '-', event: { key: '-', code: 'Minus' } },
  { id: 'trackShorter', label: 'Make tracks shorter', chord: '[', event: { key: '[', code: 'BracketLeft' } },
  { id: 'trackTaller', label: 'Make tracks taller', chord: ']', event: { key: ']', code: 'BracketRight' } },
  { id: 'marker', label: 'Add marker', chord: 'M', event: { key: 'm', code: 'KeyM' } },
  { id: 'frameBack', label: 'Move playhead one frame back', chord: 'ArrowLeft', event: { key: 'ArrowLeft', code: 'ArrowLeft' } },
  { id: 'frameForward', label: 'Move playhead one frame forward', chord: 'ArrowRight', event: { key: 'ArrowRight', code: 'ArrowRight' } },
  { id: 'undo', label: 'Undo', chord: 'Ctrl+Z', event: { key: 'z', code: 'KeyZ', ctrlKey: true } },
  { id: 'redo', label: 'Redo', chord: 'Ctrl+Shift+Z', event: { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true } },
  { id: 'copy', label: 'Copy selected clips', chord: 'Ctrl+C', event: { key: 'c', code: 'KeyC', ctrlKey: true } },
  { id: 'paste', label: 'Paste clips', chord: 'Ctrl+V', event: { key: 'v', code: 'KeyV', ctrlKey: true } },
  { id: 'duplicate', label: 'Duplicate selected clips', chord: 'Ctrl+D', event: { key: 'd', code: 'KeyD', ctrlKey: true } },
  { id: 'save', label: 'Save project', chord: 'Ctrl+S', event: { key: 's', code: 'KeyS', ctrlKey: true } },
]

const commandMap = new Map(COMMANDS.map((command) => [command.id, command]))
const canonicalChordMap = new Map(COMMANDS.map((command) => [command.chord.toLowerCase(), command.id]))

function defaults() {
  return COMMANDS.map((command) => ({ id: `default-${command.id}`, label: command.label, action: command.id, chord: command.chord, custom: false }))
}

function loadMappings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(stored) && stored.length) return stored
  } catch { /* use defaults */ }
  return defaults()
}

function saveMappings(mappings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings))
}

function eventChord(event) {
  const parts = []
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey && !['+', '_'].includes(event.key)) parts.push('Shift')
  let key = event.key
  if (event.code === 'Space') key = 'Space'
  else if (key.length === 1 && /^[a-z]$/i.test(key)) key = key.toUpperCase()
  parts.push(key)
  return parts.join('+')
}

function replayCommand(actionId) {
  const command = commandMap.get(actionId)
  if (!command) return
  const replay = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: command.event.key,
    code: command.event.code,
    ctrlKey: Boolean(command.event.ctrlKey),
    shiftKey: Boolean(command.event.shiftKey),
    altKey: Boolean(command.event.altKey),
  })
  Object.defineProperty(replay, '__videoEditorShortcutReplay', { value: true })
  window.dispatchEvent(replay)
}

function captureShortcutKey(event) {
  const chord = eventChord(event)
  event.preventDefault()
  event.stopPropagation()
  return chord
}

function openManager(getMappings, setMappings) {
  document.querySelector('.video-shortcut-manager')?.remove()
  const overlay = document.createElement('div')
  overlay.className = 'video-shortcut-manager'
  overlay.innerHTML = `
    <div class="video-shortcut-panel">
      <div class="video-shortcut-head"><strong>Shortcut Editor</strong><button data-close>✕</button></div>
      <p class="video-shortcut-help">Click a shortcut field, then press the key combination you want. Add custom commands by naming them and choosing which editor action they should run.</p>
      <div class="video-shortcut-list"></div>
      <div class="video-shortcut-add">
        <input data-new-label placeholder="New function name" />
        <select data-new-action>${COMMANDS.map((command) => `<option value="${command.id}">${command.label}</option>`).join('')}</select>
        <button data-add>Add function</button>
      </div>
      <div class="video-shortcut-foot"><button data-reset>Reset defaults</button><button data-done>Done</button></div>
    </div>`
  document.body.appendChild(overlay)

  const render = () => {
    const list = overlay.querySelector('.video-shortcut-list')
    const mappings = getMappings()
    list.innerHTML = mappings.map((mapping) => `
      <div class="video-shortcut-row" data-id="${mapping.id}">
        <input class="video-shortcut-label" value="${String(mapping.label).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" ${mapping.custom ? '' : 'readonly'} />
        <span>${commandMap.get(mapping.action)?.label || mapping.action}</span>
        <button class="video-shortcut-key" title="Click then press keys">${mapping.chord}</button>
        ${mapping.custom ? '<button class="video-shortcut-delete" title="Remove">✕</button>' : '<i></i>'}
      </div>`).join('')

    list.querySelectorAll('.video-shortcut-key').forEach((button) => {
      button.addEventListener('click', () => {
        button.textContent = 'Press keys…'
        const onKey = (event) => {
          if (event.key === 'Escape') { render(); return }
          const chord = captureShortcutKey(event)
          const id = button.closest('[data-id]').dataset.id
          setMappings(getMappings().map((item) => item.id === id ? { ...item, chord } : item))
          render()
        }
        window.addEventListener('keydown', onKey, { capture: true, once: true })
      })
    })

    list.querySelectorAll('.video-shortcut-label:not([readonly])').forEach((input) => {
      input.addEventListener('change', () => {
        const id = input.closest('[data-id]').dataset.id
        setMappings(getMappings().map((item) => item.id === id ? { ...item, label: input.value.trim() || item.label } : item))
      })
    })

    list.querySelectorAll('.video-shortcut-delete').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.closest('[data-id]').dataset.id
        setMappings(getMappings().filter((item) => item.id !== id))
        render()
      })
    })
  }

  overlay.querySelector('[data-add]').addEventListener('click', () => {
    const label = overlay.querySelector('[data-new-label]').value.trim()
    const action = overlay.querySelector('[data-new-action]').value
    if (!label) return
    setMappings([...getMappings(), { id: `custom-${Date.now()}`, label, action, chord: 'Unassigned', custom: true }])
    overlay.querySelector('[data-new-label]').value = ''
    render()
  })
  overlay.querySelector('[data-reset]').addEventListener('click', () => { setMappings(defaults()); render() })
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove())
  overlay.querySelector('[data-done]').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) overlay.remove() })
  render()
}

export function installShortcutManager() {
  let mappings = loadMappings()
  const getMappings = () => mappings
  const setMappings = (next) => { mappings = next; saveMappings(mappings) }

  const onKeyDown = (event) => {
    if (event.__videoEditorShortcutReplay) return
    const tag = event.target?.tagName?.toLowerCase()
    if (['input', 'textarea', 'select'].includes(tag)) return
    const chord = eventChord(event)
    const mapping = mappings.find((item) => item.chord?.toLowerCase() === chord.toLowerCase())
    const isCanonical = canonicalChordMap.has(chord.toLowerCase())
    if (!mapping && !isCanonical) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (mapping) replayCommand(mapping.action)
  }

  const addEditButton = () => {
    const head = document.querySelector('.shortcut-modal .modal-head')
    if (!head || head.querySelector('[data-edit-shortcuts]')) return
    const button = document.createElement('button')
    button.dataset.editShortcuts = 'true'
    button.textContent = '⚙ Edit Shortcuts'
    button.addEventListener('click', () => openManager(getMappings, setMappings))
    head.insertBefore(button, head.lastElementChild)
  }

  const observer = new MutationObserver(addEditButton)
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('keydown', onKeyDown, true)

  const style = document.createElement('style')
  style.dataset.shortcutManagerStyle = 'true'
  style.textContent = `
    .video-shortcut-manager{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:grid;place-items:center;font:13px Segoe UI,sans-serif;color:#ddd}
    .video-shortcut-panel{width:min(900px,92vw);max-height:84vh;overflow:auto;background:#202024;border:1px solid #45454d;border-radius:8px;box-shadow:0 20px 70px #000;padding:14px}
    .video-shortcut-head,.video-shortcut-foot,.video-shortcut-add,.video-shortcut-row{display:grid;gap:8px;align-items:center}
    .video-shortcut-head{grid-template-columns:1fr auto;font-size:16px}.video-shortcut-help{color:#aaa}
    .video-shortcut-row{grid-template-columns:minmax(160px,1fr) minmax(230px,1.4fr) 150px 34px;padding:6px 0;border-bottom:1px solid #333}
    .video-shortcut-row input,.video-shortcut-add input,.video-shortcut-add select{background:#151517;color:#eee;border:1px solid #45454d;border-radius:4px;padding:7px}
    .video-shortcut-row input[readonly]{border-color:transparent;background:transparent}.video-shortcut-key{font-family:Consolas,monospace}
    .video-shortcut-add{grid-template-columns:1fr 1.5fr auto;margin:14px 0}.video-shortcut-foot{grid-template-columns:1fr auto;margin-top:12px}
    .video-shortcut-panel button{background:#303038;color:#eee;border:1px solid #50505a;border-radius:4px;padding:7px 10px;cursor:pointer}.video-shortcut-panel button:hover{background:#3b3b45}
  `
  document.head.appendChild(style)
  addEditButton()

  return () => {
    observer.disconnect()
    window.removeEventListener('keydown', onKeyDown, true)
    document.querySelector('.video-shortcut-manager')?.remove()
    style.remove()
  }
}
