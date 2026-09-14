import { useRef, useState } from 'react'
import { buildSrt, buildVtt, formatClockLabel, makeSegmentId, parseTimestampInput, saveTextFile, splitSegmentIntoChunks } from './captionEditor'
import './CaptionWorkspace.css'

const AI_MODEL_OPTIONS = [
  { id: 'Xenova/whisper-base', label: 'Base (better accuracy, ~145MB download, slower)' },
  { id: 'Xenova/whisper-tiny', label: 'Tiny (faster, smaller ~75MB download, less accurate)' },
]

export default function CaptionWorkspace({ notify, onAddCaptions }) {
  const [mediaUrl, setMediaUrl] = useState(null)
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaKind, setMediaKind] = useState('video')
  const [mediaName, setMediaName] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [draftText, setDraftText] = useState('')
  const [pendingStart, setPendingStart] = useState(null)
  const [segments, setSegments] = useState([])
  const [aiModel, setAiModel] = useState(AI_MODEL_OPTIONS[0].id)
  const [aiStatus, setAiStatus] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const fileInputRef = useRef(null)
  const mediaRef = useRef(null)

  const openFilePicker = () => fileInputRef.current?.click()

  const handleFile = (file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setMediaUrl(url)
    setMediaFile(file)
    setMediaName(file.name)
    setMediaKind(file.type.startsWith('audio/') ? 'audio' : 'video')
    setSegments([])
    setDraftText('')
    setPendingStart(null)
    notify(`${file.name} loaded — play it and type captions as it plays`)
  }

  const syncTime = () => {
    if (mediaRef.current) setCurrentTime(mediaRef.current.currentTime || 0)
  }

  const seekBy = (delta) => {
    if (!mediaRef.current) return
    mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime + delta)
    syncTime()
  }

  const togglePlay = () => {
    if (!mediaRef.current) return
    if (mediaRef.current.paused) mediaRef.current.play()
    else mediaRef.current.pause()
  }

  const handleDraftChange = (value) => {
    if (pendingStart === null && value.trim()) setPendingStart(currentTime)
    setDraftText(value)
  }

  const commitDraft = () => {
    const text = draftText.trim()
    if (!text) return
    const start = pendingStart ?? Math.max(0, currentTime - 2)
    const end = Math.max(start + 0.3, currentTime)
    setSegments((current) => [...current, { id: makeSegmentId(), start, end, text }].sort((a, b) => a.start - b.start))
    setDraftText('')
    setPendingStart(null)
  }

  const handleDraftKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      commitDraft()
    }
  }

  const addBlankSegment = () => {
    const start = currentTime
    setSegments((current) => [...current, { id: makeSegmentId(), start, end: start + 2, text: '' }].sort((a, b) => a.start - b.start))
  }

  const updateSegment = (id, patch) => {
    setSegments((current) => current.map((segment) => segment.id === id ? { ...segment, ...patch } : segment).sort((a, b) => a.start - b.start))
  }

  const deleteSegment = (id) => setSegments((current) => current.filter((segment) => segment.id !== id))

  const seekToSegment = (segment) => {
    if (!mediaRef.current) return
    mediaRef.current.currentTime = segment.start
    syncTime()
  }

  const autoSplitLongLines = () => {
    setSegments((current) => current.flatMap((segment) => splitSegmentIntoChunks(segment, 8)))
    notify('Long lines split into shorter caption chunks')
  }

  const exportAs = async (format) => {
    if (!segments.length) return notify('Add at least one caption first')
    const base = (mediaName || 'captions').replace(/\.[^.]+$/, '')
    if (format === 'srt') {
      await saveTextFile(buildSrt(segments), `${base}.srt`, 'text/srt')
    } else {
      await saveTextFile(buildVtt(segments), `${base}.vtt`, 'text/vtt')
    }
    notify(`Exported as .${format}`)
  }

  const addToTimeline = () => {
    if (!segments.length) return notify('Add at least one caption first')
    if (!onAddCaptions) return notify('Cannot add captions from here')
    onAddCaptions(segments)
  }

  const totalDuration = mediaRef.current?.duration || 0

  const runAiTranscribe = async () => {
    if (!mediaFile) return notify('Load a video or audio file first')
    setAiBusy(true)
    setAiStatus('Loading AI model (first time downloads it, then it is cached offline)...')
    try {
      const { pipeline } = await import('@xenova/transformers')
      const transcriber = await pipeline('automatic-speech-recognition', aiModel, {
        progress_callback: (progress) => {
          if (progress?.status === 'progress' && progress.file) {
            setAiStatus(`Downloading ${progress.file}: ${Math.round(progress.progress || 0)}%`)
          } else if (progress?.status) {
            setAiStatus(String(progress.status))
          }
        },
      })

      setAiStatus('Reading audio from file...')
      const audioData = await decodeToMono16k(mediaFile)

      setAiStatus('Transcribing... this can take a while on a longer file, please wait')
      const result = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      })

      const chunks = Array.isArray(result?.chunks) ? result.chunks : []
      if (!chunks.length) {
        setAiStatus('')
        return notify('AI could not find any speech in this file')
      }
      const aiSegments = chunks
        .filter((chunk) => chunk.text && chunk.text.trim())
        .map((chunk) => ({
          id: makeSegmentId(),
          start: Number(chunk.timestamp?.[0]) || 0,
          end: Number(chunk.timestamp?.[1]) || (Number(chunk.timestamp?.[0]) || 0) + 2,
          text: chunk.text.trim(),
        }))
      setSegments((current) => [...current, ...aiSegments].sort((a, b) => a.start - b.start))
      setAiStatus('')
      notify(`AI drafted ${aiSegments.length} caption(s) — check and fix them below, AI transcription is not perfect`)
    } catch (error) {
      setAiStatus('')
      notify(`AI transcription failed on this computer: ${error?.message || 'unknown error'}`)
    } finally {
      setAiBusy(false)
    }
  }

  const hasMedia = Boolean(mediaUrl)

  return (
    <div className="caption-workspace">
      <div className="clip-controls-heading">
        <div><strong>🗨️ CAPTIONS</strong><small>Manual + AI (beta)</small></div>
      </div>

      <div className="caption-body">
        <p className="caption-hint">
          Video ya voiceover file load karo, use play karo, aur jo bola ja raha hai wo type kar ke Enter dabao — timestamp apne aap lag jayega.
          Baad mein SRT/VTT export kar sakti ho ya seedha timeline pe caption clips add kar sakti ho.
        </p>

        <input ref={fileInputRef} type="file" accept="video/*,audio/*" hidden onChange={(event) => handleFile(event.target.files?.[0])} />

        {!hasMedia ? (
          <button className="caption-load-btn" onClick={openFilePicker}>+ Load Video / Audio File</button>
        ) : (
          <>
            <div className="caption-media-name">{mediaName} <button className="caption-swap-btn" onClick={openFilePicker}>Change file</button></div>
            {mediaKind === 'video' ? (
              <video ref={mediaRef} src={mediaUrl} className="caption-media-player" controls onTimeUpdate={syncTime} onLoadedMetadata={syncTime} />
            ) : (
              <audio ref={mediaRef} src={mediaUrl} className="caption-media-player audio" controls onTimeUpdate={syncTime} onLoadedMetadata={syncTime} />
            )}

            <div className="caption-transport">
              <button onClick={() => seekBy(-3)}>« 3s</button>
              <button onClick={togglePlay}>Play / Pause</button>
              <button onClick={() => seekBy(3)}>3s »</button>
              <span className="caption-time">{formatClockLabel(currentTime)} / {formatClockLabel(totalDuration)}</span>
            </div>

            <div className="caption-draft-row">
              <input
                className="caption-draft-input"
                value={draftText}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Type what is being said, then press Enter to mark it..."
              />
              <button className="primary" onClick={commitDraft}>+ Add</button>
            </div>
            {pendingStart !== null && <small className="caption-pending-hint">Start marked at {formatClockLabel(pendingStart)} — keep playing, Enter dabao jab line khatam ho</small>}

            <div className="caption-ai-box">
              <div className="caption-ai-row">
                <select value={aiModel} onChange={(event) => setAiModel(event.target.value)} disabled={aiBusy}>
                  {AI_MODEL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <button className="caption-ai-btn" onClick={runAiTranscribe} disabled={aiBusy}>
                  {aiBusy ? 'Transcribing...' : '🤖 Auto-Transcribe (Beta, offline AI)'}
                </button>
              </div>
              <small className="caption-ai-hint">
                Beta feature: pehli dafa internet chahiye hoga AI model download karne ke liye (~75-150MB, ek hi baar), phir offline chalta hai.
                Roman Urdu / mixed-language audio par accuracy kam ho sakti hai — result ko neeche check aur edit zaroor karo.
              </small>
              {aiStatus && <small className="caption-ai-status">{aiStatus}</small>}
            </div>
          </>
        )}

        {!!segments.length && (
          <>
            <div className="caption-list-toolbar">
              <strong>{segments.length} caption{segments.length === 1 ? '' : 's'}</strong>
              <button onClick={addBlankSegment}>+ Blank Segment</button>
              <button onClick={autoSplitLongLines}>Split Long Lines</button>
            </div>

            <div className="caption-list">
              {segments.map((segment) => (
                <div className="caption-row" key={segment.id}>
                  <div className="caption-row-times">
                    <input
                      value={formatClockLabel(segment.start)}
                      onChange={(event) => updateSegment(segment.id, { start: parseTimestampInput(event.target.value) })}
                    />
                    <span>→</span>
                    <input
                      value={formatClockLabel(segment.end)}
                      onChange={(event) => updateSegment(segment.id, { end: parseTimestampInput(event.target.value) })}
                    />
                    {hasMedia && <button className="caption-seek-btn" onClick={() => seekToSegment(segment)}>▶</button>}
                  </div>
                  <textarea
                    className="caption-row-text"
                    value={segment.text}
                    onChange={(event) => updateSegment(segment.id, { text: event.target.value })}
                  />
                  <button className="caption-delete-btn" onClick={() => deleteSegment(segment.id)}>✕</button>
                </div>
              ))}
            </div>

            <div className="creative-actions">
              <button onClick={() => exportAs('srt')}>Export .SRT</button>
              <button onClick={() => exportAs('vtt')}>Export .VTT</button>
              <button className="primary" onClick={addToTimeline}>+ Add Captions to Timeline</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Decodes any browser-readable audio/video file to mono 16kHz PCM Float32
// data — the input format Whisper (via transformers.js) expects.
async function decodeToMono16k(file) {
  const arrayBuffer = await file.arrayBuffer()
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  const decodeContext = new AudioContextClass()
  let decoded
  try {
    decoded = await decodeContext.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    decodeContext.close?.()
  }

  const targetRate = 16000
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate)
  const source = offline.createBufferSource()

  let monoBuffer = decoded
  if (decoded.numberOfChannels > 1) {
    monoBuffer = offline.createBuffer(1, decoded.length, decoded.sampleRate)
    const mixed = monoBuffer.getChannelData(0)
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel)
      for (let i = 0; i < data.length; i += 1) mixed[i] = (mixed[i] || 0) + data[i] / decoded.numberOfChannels
    }
  }

  source.buffer = monoBuffer
  source.connect(offline.destination)
  source.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}
