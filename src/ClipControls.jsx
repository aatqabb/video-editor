import { useRef, useState } from 'react'
import './ClipControls.css'

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
}

const defaultAudio = {
  volume: 100,
  fadeIn: 0,
  fadeOut: 0,
}

function NumericControl({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <label className="clip-control-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <input className="clip-control-number" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      {suffix && <small>{suffix}</small>}
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
    <div className="clip-controls-panel">
      <div className="clip-controls-heading"><strong>VIDEO CONTROLS</strong><span>{clip.name}</span></div>
      <NumericControl label="Position X" value={transform.positionX} min={0} max={100} step={0.1} suffix="%" onChange={(value) => patch({ positionX: value })} />
      <NumericControl label="Position Y" value={transform.positionY} min={0} max={100} step={0.1} suffix="%" onChange={(value) => patch({ positionY: value })} />
      <NumericControl label="Scale" value={transform.scale} min={1} max={400} step={1} suffix="%" onChange={(value) => patch({ scale: value })} />
      <NumericControl label="Rotation" value={transform.rotation} min={-180} max={180} step={1} suffix="°" onChange={(value) => patch({ rotation: value })} />
      <NumericControl label="Opacity" value={transform.opacity} min={0} max={100} step={1} suffix="%" onChange={(value) => patch({ opacity: value })} />

      <div className="clip-control-section">CROP</div>
      <div className="crop-grid">
        {[
          ['Top', 'cropTop'], ['Right', 'cropRight'], ['Bottom', 'cropBottom'], ['Left', 'cropLeft'],
        ].map(([label, key]) => (
          <label key={key}><span>{label}</span><input type="number" min="0" max="49" value={transform[key]} onChange={(event) => patch({ [key]: Number(event.target.value) })} /><small>%</small></label>
        ))}
      </div>

      <div className="clip-control-section">FRAME</div>
      <div className="clip-button-row">
        {['Fit', 'Fill', 'Stretch'].map((mode) => <button key={mode} className={transform.fitMode === mode ? 'active' : ''} onClick={() => patch({ fitMode: mode })}>{mode}</button>)}
      </div>

      <NumericControl label="Speed" value={transform.speed} min={0.1} max={4} step={0.1} suffix="×" onChange={(value) => patch({ speed: value })} />

      <div className="clip-button-row wide">
        <button className={transform.freezeFrame ? 'active' : ''} onClick={() => { patch({ freezeFrame: !transform.freezeFrame }); notify(transform.freezeFrame ? 'Freeze frame disabled' : 'Freeze frame enabled') }}>
          {transform.freezeFrame ? '❄ Freeze On' : '❄ Freeze Frame'}
        </button>
        <button onClick={() => onUpdate(clip.id, { video: { ...defaultVideo } })}>Reset Video</button>
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
    <div className="clip-controls-panel">
      <div className="clip-controls-heading"><strong>AUDIO CONTROLS</strong><span>{clip.name}</span></div>
      <NumericControl label="Volume" value={audio.volume} min={0} max={200} step={1} suffix="%" onChange={(value) => patch({ volume: value })} />
      <NumericControl label="Fade In" value={audio.fadeIn} min={0} max={10} step={0.1} suffix="s" onChange={(value) => patch({ fadeIn: value })} />
      <NumericControl label="Fade Out" value={audio.fadeOut} min={0} max={10} step={0.1} suffix="s" onChange={(value) => patch({ fadeOut: value })} />
      <div className="clip-button-row wide"><button onClick={() => onUpdate(clip.id, { audio: { ...defaultAudio } })}>Reset Audio</button></div>
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
      recorder.addEventListener('stop', () => {
        const duration = Math.max(0.2, (Date.now() - startedAtRef.current) / 1000)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        onAddAudio({ id: `voiceover-${Date.now()}`, name: `Voiceover ${new Date().toLocaleTimeString()}`, duration, url, kind: 'voiceover' }, 'A1')
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        notify('Voice-over added to timeline')
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
    const audio = new Audio(url)
    audio.addEventListener('loadedmetadata', () => {
      onAddAudio({ id: `${kind}-${Date.now()}`, name: file.name, duration: Number.isFinite(audio.duration) ? audio.duration : 5, url, kind }, kind === 'music' ? 'A2' : 'A1')
      notify(`${file.name} added to timeline`)
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
