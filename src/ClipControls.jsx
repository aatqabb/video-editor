import { useRef, useState } from 'react'
import './ClipControls.css'

const defaultKeyframes = {
  positionX: { enabled: false, to: 50, easing: 'linear' },
  positionY: { enabled: false, to: 50, easing: 'linear' },
  scale: { enabled: false, to: 100, easing: 'linear' },
  opacity: { enabled: false, to: 100, easing: 'linear' },
  rotation: { enabled: false, to: 0, easing: 'linear' },
}

const EASING_OPTIONS = [
  ['linear', 'Linear'],
  ['easeIn', 'Ease In'],
  ['easeOut', 'Ease Out'],
  ['easeInOut', 'Ease In-Out'],
]

const defaultVideo = {
  positionX: 50,
  positionY: 50,
  scale: 100,
  rotation: 0,
  opacity: 100,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  cropLeft: 0,
  fitMode: 'Fit',
  speed: 1,
  freezeFrame: false,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  keyframes: defaultKeyframes,
}

// Combines a static value with a "animate to" end value — the clip's actual
// duration is what drives the interpolation (see resolveVideoKeyframeValue in
// App.jsx for preview, and keyframeLerpExpression in exportEngine.cjs for the
// real FFmpeg export), so presets only need to set the two endpoints.
const VIDEO_PRESETS = [
  { name: 'Slow Zoom In', apply: (transform) => ({ scale: 100, keyframes: { ...transform.keyframes, scale: { enabled: true, to: 118 } } }) },
  { name: 'Slow Zoom Out', apply: (transform) => ({ scale: 118, keyframes: { ...transform.keyframes, scale: { enabled: true, to: 100 } } }) },
  { name: 'Pan Left → Right', apply: (transform) => ({ positionX: 35, keyframes: { ...transform.keyframes, positionX: { enabled: true, to: 65 } } }) },
  { name: 'Pan Right → Left', apply: (transform) => ({ positionX: 65, keyframes: { ...transform.keyframes, positionX: { enabled: true, to: 35 } } }) },
  { name: 'Fade In', apply: (transform) => ({ opacity: 0, keyframes: { ...transform.keyframes, opacity: { enabled: true, to: 100 } } }) },
  { name: 'Fade Out', apply: (transform) => ({ opacity: 100, keyframes: { ...transform.keyframes, opacity: { enabled: true, to: 0 } } }) },
]

const KEYFRAME_FIELDS = [
  { key: 'positionX', label: 'Position X', min: 0, max: 100, step: .1, suffix: '%' },
  { key: 'positionY', label: 'Position Y', min: 0, max: 100, step: .1, suffix: '%' },
  { key: 'scale', label: 'Scale', min: 1, max: 400, step: 1, suffix: '%' },
  { key: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1, suffix: '%' },
  { key: 'rotation', label: 'Rotation', min: -720, max: 720, step: 1, suffix: '°' },
]

// Module-level so it survives switching between selected clips (a fresh copy
// is taken from whichever clip's "Copy Effect" was last clicked).
let copiedVideoEffect = null

const defaultAudio = {
  volume: 100,
  fadeIn: 0,
  fadeOut: 0,
}

function EffectSection({ title, hint, onReset, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`effect-section ${open ? 'open' : ''}`}>
      <div className="effect-section-head">
        <button className="effect-section-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? '▾' : '▸'}</button>
        <button className="effect-section-title" onClick={() => setOpen((value) => !value)}>{title}</button>
        {hint && <span className="effect-section-hint">{hint}</span>}
        {onReset && <button className="effect-reset" onClick={onReset} title={`Reset ${title}`}>↶</button>}
      </div>
      {open && <div className="effect-section-body">{children}</div>}
    </section>
  )
}

function NumericControl({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <label className="clip-control-row">
      <span className="clip-control-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="clip-control-value">
        <input className="clip-control-number" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  )
}

export function VideoControls({ clip, onUpdate, notify }) {
  if (!clip || clip.type !== 'video' || clip.kind === 'text') {
    return <div className="clip-controls-empty">Select a video clip on the timeline.</div>
  }

  const transform = { ...defaultVideo, ...(clip.video || {}) }
  const patch = (values) => onUpdate(clip.id, { video: { ...transform, ...values } })

  return (
    <div className="clip-controls-panel effect-controls-panel">
      <div className="clip-controls-heading">
        <div><strong>EFFECT CONTROLS</strong><small>Video</small></div>
        <span>{clip.name}</span>
      </div>

      <EffectSection title="Presets" hint="One-click looks" defaultOpen={false}>
        <div className="video-preset-grid">
          {VIDEO_PRESETS.map((preset) => (
            <button key={preset.name} onClick={() => { patch(preset.apply(transform)); notify(`${preset.name} applied — still fully customizable below`) }}>{preset.name}</button>
          ))}
        </div>
      </EffectSection>

      <EffectSection title="Motion" hint="Transform" onReset={() => patch({ positionX: 50, positionY: 50, scale: 100, rotation: 0 })}>
        <NumericControl label="Position X" value={transform.positionX} min={0} max={100} step={0.1} suffix="%" onChange={(value) => patch({ positionX: value })} />
        <NumericControl label="Position Y" value={transform.positionY} min={0} max={100} step={0.1} suffix="%" onChange={(value) => patch({ positionY: value })} />
        <NumericControl label="Scale" value={transform.scale} min={1} max={400} step={1} suffix="%" onChange={(value) => patch({ scale: value })} />
        <NumericControl label="Rotation" value={transform.rotation} min={-180} max={180} step={1} suffix="°" onChange={(value) => patch({ rotation: value })} />
        <div className="effect-quick-row">
          <button onClick={() => patch({ positionX: 50, positionY: 50 })}>Center</button>
          <button onClick={() => patch({ scale: 100 })}>100%</button>
          <button onClick={() => patch({ rotation: 0 })}>0°</button>
        </div>
      </EffectSection>

      <EffectSection title="Opacity" hint="Compositing" onReset={() => patch({ opacity: 100 })}>
        <NumericControl label="Opacity" value={transform.opacity} min={0} max={100} step={1} suffix="%" onChange={(value) => patch({ opacity: value })} />
        <div className="effect-quick-row">
          {[25, 50, 75, 100].map((value) => <button key={value} className={transform.opacity === value ? 'active' : ''} onClick={() => patch({ opacity: value })}>{value}%</button>)}
        </div>
      </EffectSection>

      <EffectSection title="Color" hint="Grading" defaultOpen={false} onReset={() => patch({ temperature: 0, tint: 0, vibrance: 0 })}>
        <NumericControl label="Temperature" value={transform.temperature} min={-100} max={100} step={1} onChange={(value) => patch({ temperature: value })} />
        <NumericControl label="Tint" value={transform.tint} min={-100} max={100} step={1} onChange={(value) => patch({ tint: value })} />
        <NumericControl label="Vibrance" value={transform.vibrance} min={-100} max={100} step={1} onChange={(value) => patch({ vibrance: value })} />
        <p className="color-grade-hint">Temperature: cool ↔ warm. Tint: green ↔ magenta. Vibrance boosts muted colors without blowing out ones already vivid.</p>
      </EffectSection>

      <EffectSection
        title="Animate Over Time"
        hint="Keyframes"
        defaultOpen={false}
        onReset={() => patch({ keyframes: { ...defaultKeyframes } })}
      >
        <p className="keyframe-hint">Static value upar wale controls se set hoti hai — yahan sirf "end value" do, clip ke start se end tak automatically animate ho jayega (preview aur final export dono mein).</p>
        {KEYFRAME_FIELDS.map(({ key, label, min, max, step, suffix }) => {
          const keyframe = transform.keyframes?.[key] || defaultKeyframes[key]
          return (
            <div className="keyframe-row" key={key}>
              <label className="keyframe-toggle">
                <input
                  type="checkbox"
                  checked={!!keyframe.enabled}
                  onChange={(event) => patch({ keyframes: { ...transform.keyframes, [key]: { ...keyframe, enabled: event.target.checked } } })}
                />
                Animate {label}
              </label>
              {keyframe.enabled && (
                <>
                  <NumericControl
                    label={`${label} end value`}
                    value={keyframe.to}
                    min={min}
                    max={max}
                    step={step}
                    suffix={suffix}
                    onChange={(value) => patch({ keyframes: { ...transform.keyframes, [key]: { ...keyframe, to: value } } })}
                  />
                  <label className="keyframe-easing-row">
                    <span className="clip-control-label">Easing</span>
                    <select
                      value={keyframe.easing || 'linear'}
                      onChange={(event) => patch({ keyframes: { ...transform.keyframes, [key]: { ...keyframe, easing: event.target.value } } })}
                    >
                      {EASING_OPTIONS.map(([value, optLabel]) => <option key={value} value={value}>{optLabel}</option>)}
                    </select>
                  </label>
                </>
              )}
            </div>
          )
        })}
      </EffectSection>

      <EffectSection title="Crop" hint="Edges" onReset={() => patch({ cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 })} defaultOpen={false}>
        <div className="crop-grid">
          {[
            ['Top', 'cropTop'], ['Right', 'cropRight'], ['Bottom', 'cropBottom'], ['Left', 'cropLeft'],
          ].map(([label, key]) => (
            <label key={key}><span>{label}</span><input type="number" min="0" max="49" value={transform[key]} onChange={(event) => patch({ [key]: Number(event.target.value) })} /><small>%</small></label>
          ))}
        </div>
      </EffectSection>

      <EffectSection title="Frame" hint="Fit mode" onReset={() => patch({ fitMode: 'Fit' })} defaultOpen={false}>
        <div className="clip-button-row segmented">
          {['Fit', 'Fill', 'Stretch'].map((mode) => <button key={mode} className={transform.fitMode === mode ? 'active' : ''} onClick={() => patch({ fitMode: mode })}>{mode}</button>)}
        </div>
      </EffectSection>

      <EffectSection title="Time Remapping" hint="Speed" onReset={() => patch({ speed: 1, freezeFrame: false })}>
        <NumericControl label="Speed" value={transform.speed} min={0.1} max={4} step={0.1} suffix="×" onChange={(value) => patch({ speed: value })} />
        <div className="effect-quick-row speed-presets">
          {[0.5, 1, 1.5, 2].map((value) => <button key={value} className={transform.speed === value ? 'active' : ''} onClick={() => patch({ speed: value })}>{value}×</button>)}
        </div>
        <div className="clip-button-row wide">
          <button className={transform.freezeFrame ? 'active' : ''} onClick={() => { patch({ freezeFrame: !transform.freezeFrame }); notify(transform.freezeFrame ? 'Freeze frame disabled' : 'Freeze frame enabled') }}>
            {transform.freezeFrame ? '❄ Freeze On' : '❄ Freeze Frame'}
          </button>
        </div>
      </EffectSection>

      <div className="effect-footer-actions">
        <button onClick={() => { copiedVideoEffect = { ...transform }; notify('Effect settings copied') }}>Copy Effect</button>
        <button onClick={() => { if (!copiedVideoEffect) return notify('Pehle kisi clip par Copy Effect karo'); patch({ ...copiedVideoEffect }); notify('Effect settings pasted') }}>Paste Effect</button>
        <button onClick={() => onUpdate(clip.id, { video: { ...defaultVideo } })}>Reset All Video Effects</button>
      </div>
    </div>
  )
}

export function AudioControls({ clip, onUpdate }) {
  if (!clip || clip.type !== 'audio') {
    return <div className="clip-controls-empty">Select an audio, music, voice-over, or SFX clip.</div>
  }

  const audio = { ...defaultAudio, ...(clip.audio || {}) }
  const patch = (values) => onUpdate(clip.id, { audio: { ...audio, ...values } })

  return (
    <div className="clip-controls-panel effect-controls-panel">
      <div className="clip-controls-heading"><div><strong>EFFECT CONTROLS</strong><small>Audio</small></div><span>{clip.name}</span></div>
      <EffectSection title="Volume" hint="Level" onReset={() => patch({ volume: 100 })}>
        <NumericControl label="Volume" value={audio.volume} min={0} max={200} step={1} suffix="%" onChange={(value) => patch({ volume: value })} />
        <div className="effect-quick-row">
          {[0, 50, 100, 150].map((value) => <button key={value} className={audio.volume === value ? 'active' : ''} onClick={() => patch({ volume: value })}>{value}%</button>)}
        </div>
      </EffectSection>
      <EffectSection title="Audio Transitions" hint="Fades" onReset={() => patch({ fadeIn: 0, fadeOut: 0 })}>
        <NumericControl label="Fade In" value={audio.fadeIn} min={0} max={10} step={0.1} suffix="s" onChange={(value) => patch({ fadeIn: value })} />
        <NumericControl label="Fade Out" value={audio.fadeOut} min={0} max={10} step={0.1} suffix="s" onChange={(value) => patch({ fadeOut: value })} />
        <div className="effect-quick-row">
          {[0, .5, 1, 2].map((value) => <button key={value} onClick={() => patch({ fadeIn: value, fadeOut: value })}>{value}s</button>)}
        </div>
      </EffectSection>
      <div className="effect-footer-actions"><button onClick={() => onUpdate(clip.id, { audio: { ...defaultAudio } })}>Reset All Audio Effects</button></div>
    </div>
  )
}

export function VoiceoverWorkspace({ onAddAudio, notify }) {
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const startedAtRef = useRef(0)
  const fileRef = useRef(null)
  const [recording, setRecording] = useState(false)

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return notify('Microphone recording is not available here')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      startedAtRef.current = Date.now()
      recorder.addEventListener('dataavailable', (event) => event.data.size && chunksRef.current.push(event.data))
      recorder.addEventListener('stop', async () => {
        const duration = Math.max(0.2, (Date.now() - startedAtRef.current) / 1000)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        // A MediaRecorder blob has no real file on disk (unlike a picked
        // file), so it has no path export could ever use — write it out via
        // the same desktop:save-temp-media bridge already in main.cjs (it
        // existed but was never wired up to the renderer before this fix).
        let sourcePath = ''
        if (window.videoEditorDesktop?.saveTempMedia) {
          try {
            const bytes = await blob.arrayBuffer()
            sourcePath = await window.videoEditorDesktop.saveTempMedia(bytes, 'webm') || ''
          } catch { /* falls back to preview-only below */ }
        }
        onAddAudio({ id: `voiceover-${Date.now()}`, name: `Voiceover ${new Date().toLocaleTimeString()}`, duration, url, sourcePath, kind: 'voiceover' }, 'A1')
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        notify(sourcePath ? 'Voice-over added to timeline' : 'Voice-over added — preview only, will be skipped in export')
      }, { once: true })
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      notify('Voice-over recording started')
    } catch {
      notify('Microphone permission was not granted')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const importAudio = (file, kind = 'music') => {
    if (!file) return
    const url = URL.createObjectURL(file)
    // A blob: URL only works for the live preview — export needs a real
    // filesystem path, captured here the same way custom fonts/media already
    // do (webUtils.getPathForFile via the desktop bridge).
    const sourcePath = window.videoEditorDesktop?.getPathForFile?.(file) || ''
    const audio = new Audio(url)
    audio.addEventListener('loadedmetadata', () => {
      onAddAudio({ id: `${kind}-${Date.now()}`, name: file.name, duration: Number.isFinite(audio.duration) ? audio.duration : 5, url, sourcePath, kind }, kind === 'music' ? 'A2' : 'A1')
      notify(sourcePath ? `${file.name} added to timeline` : `${file.name} added — preview only, will be skipped in export`)
    }, { once: true })
    audio.addEventListener('error', () => notify('Could not read that audio file'), { once: true })
  }

  return (
    <div className="voiceover-workspace">
      <div className="clip-controls-heading"><strong>VOICE / MUSIC</strong><span>Audio workflow</span></div>
      <div className="voiceover-actions">
        {!recording ? <button className="record-btn" onClick={startRecording}>● Record Voice-over</button> : <button className="record-btn active" onClick={stopRecording}>■ Stop Recording</button>}
        <button onClick={() => fileRef.current?.click()}>＋ Import Music / Audio</button>
        <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(event) => importAudio(event.target.files?.[0], 'music')} />
      </div>
      <p>Voice-over defaults to A1. Music defaults to A2. SFX defaults to A3.</p>
    </div>
  )
}

export function getDefaultVideoControls() {
  return { ...defaultVideo }
}

export function getDefaultAudioControls() {
  return { ...defaultAudio }
}
