const AUTOSAVE_KEY = 'video-editor.autosave.v1'
const RECENTS_KEY = 'video-editor.recent-projects.v1'
const MAX_RECENTS = 8

function stripTransientClipData(clip) {
  const next = { ...clip }
  if (next.localUrl?.startsWith('blob:')) {
    next.localUrl = null
    next.mediaRelinkRequired = true
  }
  return next
}

export function buildProjectDocument({ name, settings, clips, tracks, markers, playhead }) {
  return {
    app: 'VideoEditor',
    version: 1,
    savedAt: new Date().toISOString(),
    name: name || 'Untitled Project',
    settings,
    timeline: {
      clips: clips.map(stripTransientClipData),
      tracks,
      markers,
      playhead,
    },
  }
}

export function validateProjectDocument(document) {
  if (!document || document.app !== 'VideoEditor') throw new Error('This is not a VideoEditor project file')
  if (!document.timeline || !Array.isArray(document.timeline.clips) || !Array.isArray(document.timeline.tracks)) {
    throw new Error('Project file is missing timeline data')
  }
  return document
}

export function writeAutosave(project) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project))
    return true
  } catch {
    return false
  }
}

export function readAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return validateProjectDocument(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    // Ignore restricted storage.
  }
}

export function getRecentProjects() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]')
  } catch {
    return []
  }
}

export function rememberProject(project, mode = 'saved') {
  try {
    const current = getRecentProjects()
    const entry = {
      name: project.name,
      savedAt: project.savedAt || new Date().toISOString(),
      width: project.settings?.width,
      height: project.settings?.height,
      mode,
    }
    const next = [entry, ...current.filter((item) => item.name !== entry.name)].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
    return next
  } catch {
    return []
  }
}

export async function saveProjectFile(project, existingHandle = null, forceNewLocation = false) {
  const text = JSON.stringify(project, null, 2)

  if (window.showSaveFilePicker) {
    const handle = !forceNewLocation && existingHandle
      ? existingHandle
      : await window.showSaveFilePicker({
        suggestedName: `${safeFileName(project.name)}.vedit.json`,
        types: [{ description: 'VideoEditor Project', accept: { 'application/json': ['.json'] } }],
      })
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    return { handle, method: 'picker' }
  }

  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFileName(project.name)}.vedit.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return { handle: null, method: 'download' }
}

export async function readProjectFile(file) {
  const text = await file.text()
  return validateProjectDocument(JSON.parse(text))
}

function safeFileName(value) {
  return String(value || 'Untitled Project')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Untitled Project'
}
