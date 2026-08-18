import { useEffect, useMemo, useRef, useState } from 'react'
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

function formatRemaining(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const whole = Math.max(0, Math.round(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  if (hours) return `${hours}h ${minutes}m remaining`
  if (minutes) return `${minutes}m ${secs}s remaining`
  return `${secs}s remaining`
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
  const [remaining, setRemaining] = useState('')
  const exportStartedAtRef = useRef(0)
  const cancelRequestedRef = useRef(false)

  useEffect(() => {
    let disposed = false
    if (desktop?.getExportCapabilities) {
      desktop.getExportCapabilities()
        .then((data) => !disposed && setCapabilities(data))
        .catch(() => !disposed && setCapabilities(null))
    }
    const unsubscribe = desktop?.onExportProgress?.((next) => {
      if (cancelRequestedRef.current) return
      if (typeof next?.percent === 'number') {
        const nextPercent = Math.max(0, Math.min(100, next.percent))
        setProgress(nextPercent)
        if (nextPercent > 0 && nextPercent < 100 && exportStartedAtRef.current) {
          const elapsedSeconds = (Date.now() - exportStartedAtRef.current) / 1000
          const estimatedTotal = elapsedSeconds / (nextPercent / 100)
          setRemaining(formatRemaining(Math.max(0, estimatedTotal - elapsedSeconds)))
        }
      }
      if (next?.complete) {
        setStatus('Export complete')
        setRemaining('')
      }
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

  const ffmpeg = capabilities?.ffmpeg
  const detectedGpu = capabilities?.gpuCapabilities
  const gpuEncoders = detectedGpu?.availableHardwareEncoders || ffmpeg?.hardwareEncoders || []
  const activeGpu = detectedGpu?.activeAdapter
  const hardwareVideo = capabilities?.gpuFeatureStatus?.video_encode

  const start = async () => {
    if (!desktop?.startExport) return notify('Open the Windows desktop build to use real FFmpeg export')
    if (!ffmpeg?.available) return notify('FFmpeg is not bundled/detected yet — export engine cannot start')
    if (renderMode === 'GPU' && !gpuEncoders.length) {
      return notify('GPU renderer selected, but no detected GPU has a matching supported H.264 hardware encoder')
    }
    let path = outputPath
    if (!path) path = await chooseLocation()
    if (!path) return

    cancelRequestedRef.current = false
    setRunning(true)
    setProgress(0)
    setRemaining('Calculating remaining time…')
    setStatus('Preparing export…')
    exportStartedAtRef.current = Date.now()
    try {
      const result = await desktop.startExport({ manifest: buildManifest(), outputPath: path })
      if (cancelRequestedRef.current) return
      setProgress(100)
      setRemaining('')
      setStatus(`Complete · ${result?.encoder || 'encoder'}`)
      notify('Export complete')
    } catch (error) {
      setRemaining('')
      if (cancelRequestedRef.current) {
        setStatus('Export cancelled')
      } else {
        setStatus(error?.message || 'Export failed')
        notify('Export failed — see Export status')
      }
    } finally {
      exportStartedAtRef.current = 0
      setRunning(false)
    }
  }

  const cancel = async () => {
    if (!running) return
    cancelRequestedRef.current = true
    exportStartedAtRef.current = 0
    setRemaining('')
    setStatus('Cancelling export…')
    try {
      await desktop?.cancelExport?.()
      setStatus('Export cancelled')
      notify('Export cancelled')
    } catch (error) {
      cancelRequestedRef.current = false
      setStatus(error?.message || 'Could not cancel export')
      notify('Could not cancel export')
    } finally {
      setRunning(false)
    }
  }

  const rendererHint = renderMode === 'CPU'
    ? 'CPU forces libx264 when available.'
    : renderMode === 'GPU'
      ? gpuEncoders.length ? `GPU will use ${gpuEncoders[0]} on ${activeGpu?.vendorLabel || 'the detected adapter'}.` : 'GPU requires a detected NVIDIA, Intel, or AMD adapter with a matching NVENC, QSV, or AMF encoder.'
      : gpuEncoders.length ? `Auto prefers ${gpuEncoders[0]} and falls back to CPU if hardware export fails.` : 'Auto will use CPU when no detected GPU has a matching supported hardware encoder.'

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
      <div className="export-note">{rendererHint}</div>

      <div className="export-section-title">GPU / FFMPEG</div>
      <div className="export-capabilities">
        <div><span>Hardware acceleration</span><strong>{capabilities?.hardwareAcceleration ? 'Enabled' : desktop?.isDesktop ? 'Unavailable / checking' : 'Desktop only'}</strong></div>
        <div><span>Hardware video encode</span><strong>{hardwareVideo || 'Not checked'}</strong></div>
        <div><span>Active GPU</span><strong>{activeGpu ? `${activeGpu.vendorLabel} · ${activeGpu.device}` : desktop?.isDesktop ? 'No adapter identified yet' : 'Desktop only'}</strong></div>
        <div><span>Detected GPU vendors</span><strong>{detectedGpu?.recognizedVendors?.length ? detectedGpu.recognizedVendors.join(', ') : 'None identified yet'}</strong></div>
        <div><span>FFmpeg</span><strong className={ffmpeg?.available ? 'ok' : 'warn'}>{ffmpeg?.available ? 'Detected' : 'Not bundled/detected'}</strong></div>
        <div><span>Matched GPU encoders</span><strong>{gpuEncoders.length ? gpuEncoders.join(', ') : 'None matched yet'}</strong></div>
      </div>

      <div className="export-section-title">OUTPUT</div>
      <div className="export-path-row"><input value={outputPath} readOnly placeholder="Choose export location…" /><button onClick={chooseLocation}>Browse…</button></div>

      <div className="export-source-status">
        <span>Exportable source clips: <strong>{exportableClips.length}</strong></span>
        {!!missingSourceClips.length && <span className="warning">{missingSourceClips.length} clip(s) need a real file path/relink before final export</span>}
      </div>

      <div className="export-progress-block">
        <div className="export-progress-head"><span>{remaining ? `${status} · ${remaining}` : status}</span><strong>{Math.round(progress)}%</strong></div>
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
