import { useRef } from 'react'
import './ProjectWorkspace.css'

const presets = [
  { label: '16:9', width: 1920, height: 1080 },
  { label: '9:16', width: 1080, height: 1920 },
  { label: '1:1', width: 1080, height: 1080 },
]

const resolutions = [
  { label: '1080p', width: 1920, height: 1080 },
  { label: '2K', width: 2560, height: 1440 },
  { label: '4K UHD', width: 3840, height: 2160 },
]

export default function ProjectWorkspace({
  name,
  setName,
  settings,
  setSettings,
  onSave,
  onSaveAs,
  onOpenProject,
  onRecover,
  recoveryAvailable,
  autosaveTime,
  recentProjects,
  notify,
}) {
  const openRef = useRef(null)

  const applyAspect = (preset) => {
    const orientation = preset.width >= preset.height ? 'landscape' : 'portrait'
    const currentLong = Math.max(settings.width, settings.height)
    if (preset.label === '1:1') {
      setSettings((current) => ({ ...current, aspect: '1:1', width: currentLong, height: currentLong }))
      return
    }
    const ratio = preset.width / preset.height
    if (orientation === 'portrait') {
      const width = Math.round(Math.min(settings.width, settings.height))
      setSettings((current) => ({ ...current, aspect: preset.label, width, height: Math.round(width / ratio) }))
    } else {
      const width = Math.round(Math.max(settings.width, settings.height))
      setSettings((current) => ({ ...current, aspect: preset.label, width, height: Math.round(width / ratio) }))
    }
  }

  const applyResolution = (preset) => {
    const portrait = settings.height > settings.width
    const square = settings.width === settings.height
    if (square) {
      const size = Math.min(preset.width, preset.height)
      setSettings((current) => ({ ...current, resolution: preset.label, width: size, height: size }))
      return
    }
    setSettings((current) => ({
      ...current,
      resolution: preset.label,
      width: portrait ? preset.height : preset.width,
      height: portrait ? preset.width : preset.height,
    }))
  }

  const setCustomDimension = (field, value) => {
    const number = Math.max(64, Math.min(8192, Number(value) || 64))
    setSettings((current) => ({ ...current, aspect: 'Custom', resolution: 'Custom', [field]: number }))
  }

  return (
    <div className="project-workspace">
      <div className="project-workspace-heading"><strong>PROJECT</strong><span>{settings.width} × {settings.height}</span></div>

      <label className="project-name-input">
        <span>Project name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Untitled Project" />
      </label>

      <div className="project-section-title">CANVAS</div>
      <div className="project-preset-grid">
        {presets.map((preset) => <button key={preset.label} className={settings.aspect === preset.label ? 'active' : ''} onClick={() => applyAspect(preset)}>{preset.label}</button>)}
      </div>

      <div className="project-preset-grid resolutions">
        {resolutions.map((preset) => <button key={preset.label} className={settings.resolution === preset.label ? 'active' : ''} onClick={() => applyResolution(preset)}>{preset.label}</button>)}
      </div>

      <div className="project-dimensions">
        <label><span>Width</span><input type="number" min="64" max="8192" value={settings.width} onChange={(event) => setCustomDimension('width', event.target.value)} /></label>
        <label><span>Height</span><input type="number" min="64" max="8192" value={settings.height} onChange={(event) => setCustomDimension('height', event.target.value)} /></label>
      </div>

      <div className="project-section-title">PROJECT FILE</div>
      <div className="project-file-actions">
        <button className="primary" onClick={onSave}>Save</button>
        <button onClick={onSaveAs}>Save As</button>
        <button onClick={() => openRef.current?.click()}>Open Project</button>
        <input ref={openRef} type="file" accept="application/json,.json" hidden onChange={(event) => onOpenProject(event.target.files?.[0])} />
      </div>

      <div className="autosave-status">
        <span>Auto Save</span>
        <strong>{autosaveTime ? `Saved ${new Date(autosaveTime).toLocaleTimeString()}` : 'Waiting for first autosave'}</strong>
      </div>

      {recoveryAvailable && (
        <button className="recovery-btn" onClick={onRecover}>↻ Recover latest autosave</button>
      )}

      <div className="project-section-title">RECENT PROJECTS</div>
      <div className="recent-projects-list">
        {!recentProjects.length && <div className="recent-empty">No recent projects yet.</div>}
        {recentProjects.map((project, index) => (
          <button key={`${project.name}-${project.savedAt}-${index}`} onClick={() => notify(`${project.name} was saved ${new Date(project.savedAt).toLocaleString()}`)}>
            <span>{project.name}</span>
            <small>{project.width}×{project.height} · {new Date(project.savedAt).toLocaleString()}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
