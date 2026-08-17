import { useEffect, useMemo, useState } from 'react'
import './ExportWorkspace.css'

const videoResolutions = {
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '2K': [2560, 1440],
  '4K Ultra HD': [3840, 2160],
}

function safeExportName(name, extension) {
  const base = String(name || 'Untitled Project').replace(/[<>:"/\\|?*]/g, '-').trim() || 'Untitled Project'
  return `${base}.${extension}`
}

export default function ExportWorkspace({ projectName, projectSettings, clips, tracks, notify }) {
  const desktop = window.videoEditorDesktop
  const [format, setFormat] = useState('mp4')
  const [resolution, setResolution] = useState(projectSettings.width >= 3800 ? '4K Ultra HD' : projectSettings.width >= 2500 ? '2K' : '1080p')
  const [fps, setFps] = useState(projectSettings.fps || 30)
  const [quality, setQuality] = useState('High')
  const [renderMode, setRenderMode] = useState('Auto')
  const [outputPath, setOutputPath] = useState('')
  const [capabilities, setCapabilities] = useState(null)
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('Ready')

  useEffect(() => {
    let disposed = false
    if (desktop?.getExportCapabilities) {
      desktop.getExportCapabilities()
        .then((data) => !disposed && setCapabilities(data))
        .catch(() => !disposed && setCapabilities(null))
    }
    const unsubscribe = desktop?.onExportProgress?.((next) => {
      if (typeof next?.percent === 'number') setProgress(next.percent)
      if (next?.complete) setStatus('Export complete')
    })
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [desktop])

  const exportableClips = useMemo(() => clips.filter((clip) => clip.sourcePath || clip.remoteUrl), [clips])
  const missingSourceClips = useMemo(() => clips.filter((clip) => (clip.type === 'video' || clip.type === 'audio') && clip.kind !== 'text' && !clip.sourcePath && !clip.remoteUrl), [clips])

  const chooseLocation = async () => {
    if (!desktop?.chooseExportPath) return notify('Real export location picker is available in the Windows desktop app')
    const extension = format === 'mp3' ? 'mp3' : 'mp4'
    const path = await desktop.chooseExportPath({ format, extension, defaultName: safeExportName(projectName, extension) })
    if (path) setOutputPath(path)
    return path
  }

  const buildManifest = () => {
    const [width, height] = format === 'mp3'
      ? [projectSettings.width, projectSettings.height]
      : videoResolutions[resolution] || [projectSettings.width, projectSettings.height]
    const portrait = projectSettings.height > projectSettings.width
    const square = projectSettings.height === projectSettings.width
    const outputWidth = square ? Math.min(width, height) : portrait ? height : width
    const outputHeight = square ? Math.min(width, height) : portrait ? width : height

    return {
      name: projectName,
      settings: { ...projectSettings, width: outputWidth, height: outputHeight, fps },
      tracks,
      clips: clips.map((clip) => ({ ...clip })),
      options: { format, resolution, fps, quality, renderMode, audioBitrate: quality === 'High' ? '256k' : quality === 'Low' ? '128k' : '192k' },
    }
  }

  const start = async () => {
    if (!desktop?.startExport) return notify('Open the Windows desktop build to use real FFmpeg export')
    if (!capabilities?.ffmpeg?.available) return notify('FFmpeg is not bundled/detected yet — export engine cannot start')
    let path = outputPath
    if (!path) path = await chooseLocation()
    if (!path) return

    setRunning(true)
    setProgress(0)
    setStatus('Preparing export…')
    try {
      const result = await desktop.startExport({ manifest: buildManifest(), outputPath: path })
      setProgress(100)
      setStatus(`Complete · ${result?.encoder || 'encoder'}`)
      notify('Export complete')
    } catch (error) {
      setStatus(error?.message || 'Export failed')
      notify('Export failed — see Export status')
    } finally {
      setRunning(false)
    }
  }

  const cancel = async () => {
    await desktop?.cancelExport?.()
    setRunning(false)
    setStatus('Export cancelled')
    notify('Export cancelled')
  }

  const ffmpeg = capabilities?.ffmpeg
  const gpuEncoders = ffmpeg?.hardwareEncoders || []
  const hardwareVideo = capabilities?.gpuFeatureStatus?.video_encode

  return (
    <div className="export-workspace">
      <div className="export-heading"><strong>EXPORT</strong><span>{desktop?.isDesktop ? 'Windows desktop runtime' : 'Browser preview mode'}</span></div>

      <div className="export-grid two">
        <label>Format<select value={format} onChange={(event) => setFormat(event.target.value)}><option value="mp4">MP4 Video</option><option value="mp3">MP3 Audio Only</option></select></label>
        {format === 'mp4' && <label>Resolution<select value={resolution} onChange={(event) => setResolution(event.target.value)}>{Object.keys(videoResolutions).map((item) => <option key={item}>{item}</option>)}</select></label>}
        <label>FPS<select value={fps} onChange={(event) => setFps(Number(event.target.value))}>{[24, 25, 30, 50, 60].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Quality<select value={quality} onChange={(event) => setQuality(event.target.value)}><option>High</option><option>Balanced</option><option>Low</option></select></label>
        <label>Renderer<select value={renderMode} onChange={(event) => setRenderMode(event.target.value)}><option>Auto</option><option>GPU</option><option>CPU</option></select></label>
      </div>

      <div className="export-section-title">GPU / FFMPEG</div>
      <div className="export-capabilities">
        <div><span>Hardware acceleration</span><strong>{capabilities?.hardwareAcceleration ? 'Enabled' : desktop?.isDesktop ? 'Unavailable / checking' : 'Desktop only'}</strong></div>
        <div><span>Hardware video encode</span><strong>{hardwareVideo || 'Not checked'}</strong></div>
        <div><span>FFmpeg</span><strong className={ffmpeg?.available ? 'ok' : 'warn'}>{ffmpeg?.available ? 'Detected' : 'Not bundled/detected'}</strong></div>
        <div><span>GPU encoders</span><strong>{gpuEncoders.length ? gpuEncoders.join(', ') : 'None detected yet'}</strong></div>
      </div>

      <div className="export-section-title">OUTPUT</div>
      <div className="export-path-row"><input value={outputPath} readOnly placeholder="Choose export location…" /><button onClick={chooseLocation}>Browse…</button></div>

      <div className="export-source-status">
        <span>Exportable source clips: <strong>{exportableClips.length}</strong></span>
        {!!missingSourceClips.length && <span className="warning">{missingSourceClips.length} clip(s) need a real file path/relink before final export</span>}
      </div>

      <div className="export-progress-block">
        <div className="export-progress-head"><span>{status}</span><strong>{Math.round(progress)}%</strong></div>
        <progress max="100" value={progress} />
      </div>

      <div className="export-actions">
        <button className="primary" disabled={running} onClick={start}>{running ? 'Exporting…' : `Export ${format.toUpperCase()}`}</button>
        <button disabled={!running} onClick={cancel}>Cancel Export</button>
      </div>

      {!desktop?.isDesktop && <div className="export-note">The browser/Vite version is for UI development. Real GPU/CPU FFmpeg export runs in the Windows desktop runtime.</div>}
    </div>
  )
}
