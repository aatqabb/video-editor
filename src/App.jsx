import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ScriptWorkspace from './ScriptWorkspace'
import { EffectsWorkspace, SfxWorkspace, TextWorkspace, TransitionWorkspace } from './CreativePanels'
import { AudioControls, VideoControls, VoiceoverWorkspace } from './ClipControls'

const leftTabs = ['Project', 'Effect Controls', 'Effects', 'Tools', 'Text', 'Properties']
const centerTabs = ['Source', 'Script', 'Stock', 'SFX', 'Transitions', 'Essential Sound']

const mediaItems = [
  ['Voiceover.mp3', '01:09:14', 'audio'],
  ['Main Sequence', '00:43:24', 'sequence'],
  ['Music.wav', '03:35:23', 'audio'],
  ['Black Texture', '05:01', 'image'],
  ['B-roll 01.mp4', '00:02:22', 'video'],
  ['B-roll 02.mp4', '00:07:06', 'video'],
  ['Portrait.png', 'Still', 'image'],
  ['Adjustment Layer', '00:04:29', 'image'],
  ['B-roll 03.mp4', '00:06:11', 'video'],
]

const shortcutRows = [
  ['Space', 'Play / Pause preview'],
  ['V', 'Cursor / Selection tool'],
  ['C', 'Cut / Razor tool'],
  ['Q', 'Backward cut / ripple trim'],
  ['W', 'Forward cut / ripple trim'],
  ['K', 'Split selected clip at playhead'],
  ['Delete', 'Delete selected clip'],
  ['+ / -', 'Timeline zoom in / out'],
  ['[ / ]', 'Make tracks shorter / taller'],
  ['M', 'Add marker'],
  ['← / →', 'Move playhead frame by frame'],
  ['Ctrl + Z', 'Undo'],
  ['Ctrl + Shift + Z', 'Redo'],
  ['Ctrl + C / V', 'Copy / paste selected clips'],
  ['Ctrl + D', 'Duplicate selected clips'],
  ['Ctrl + S', 'Save project'],
]

const initialTracks = [
  { id: 'V5', type: 'video', locked: false, hidden: false, muted: false, solo: false },
  { id: 'V4', type: 'video', locked: false, hidden: false, muted: false, solo: false },
  { id: 'V3', type: 'video', locked: false, hidden: false, muted: false, solo: false },
  { id: 'V2', type: 'video', locked: false, hidden: false, muted: false, solo: false },
  { id: 'V1', type: 'video', locked: false, hidden: false, muted: false, solo: false },
  { id: 'A1', type: 'audio', locked: false, hidden: false, muted: false, solo: false },
  { id: 'A2', type: 'audio', locked: false, hidden: false, muted: false, solo: false },
  { id: 'A3', type: 'audio', locked: false, hidden: false, muted: false, solo: false },
]

const initialClips = [
  { id: 'clip-title', trackId: 'V3', name: 'Title', type: 'video', start: 11.2, duration: 3.4, color: 'title' },
  { id: 'clip-v2a', trackId: 'V2', name: 'B-roll 01.mp4', type: 'video', start: 5.4, duration: 5.3, color: 'purple' },
  { id: 'clip-v2b', trackId: 'V2', name: 'B-roll 02.mp4', type: 'video', start: 11, duration: 4.6, color: 'purple' },
  { id: 'clip-v1a', trackId: 'V1', name: 'Interview.mp4', type: 'video', start: 4, duration: 7, color: 'blue' },
  { id: 'clip-v1b', trackId: 'V1', name: 'Stock Clip.mp4', type: 'video', start: 11.2, duration: 3.7, color: 'cyan' },
  { id: 'clip-a1', trackId: 'A1', name: 'Voiceover.mp3', type: 'audio', start: 4, duration: 17, color: 'green' },
  { id: 'clip-a2', trackId: 'A2', name: 'Music.wav', type: 'audio', start: 4, duration: 17, color: 'yellow' },
]

const TIMELINE_SECONDS = 120
const MIN_CLIP_DURATION = 0.25

function cloneClips(clips) {
  return clips.map((clip) => ({ ...clip }))
}

function buildMonitorEffectStyle(effects = []) {
  const filters = []
  let boxShadow = ''
  effects.forEach(({ type, intensity = 50 }) => {
    if (type === 'Blur') filters.push(`blur(${Math.max(0, intensity / 22)}px)`)
    if (type === 'Grayscale') filters.push(`grayscale(${intensity}%)`)
    if (type === 'Brightness') filters.push(`brightness(${60 + intensity * 0.8}%)`)
    if (type === 'Contrast') filters.push(`contrast(${60 + intensity * 0.9}%)`)
    if (type === 'Saturate') filters.push(`saturate(${Math.max(0, intensity * 2)}%)`)
    if (type === 'Sepia') filters.push(`sepia(${intensity}%)`)
    if (type === 'Hue Rotate') filters.push(`hue-rotate(${intensity * 3.6}deg)`)
    if (type === 'Vignette') boxShadow = `inset 0 0 ${30 + intensity}px rgba(0,0,0,${Math.min(.85, intensity / 100)})`
  })
  return { filter: filters.join(' ') || undefined, boxShadow: boxShadow || undefined }
}

function getTextOverlayPresentation(clip, playhead) {
  const style = clip.textStyle || {}
  const local = Math.max(0, playhead - clip.start)
  const remaining = Math.max(0, clip.start + clip.duration - playhead)
  const animDuration = Math.max(.05, Number(style.animationDuration) || .45)
  let opacity = 1
  let dx = 0
  let dy = 0
  let scale = 1
  let blur = 0

  const applyAnimation = (name, progress, entering) => {
    const p = Math.max(0, Math.min(1, progress))
    const amount = entering ? 1 - p : p
    if (name.includes('Fade')) opacity = Math.min(opacity, 1 - amount)
    if (name.includes('Slide Up')) dy = 45 * amount
    if (name.includes('Slide Down')) dy = -45 * amount
    if (name.includes('Slide Left')) dx = 65 * amount
    if (name.includes('Slide Right')) dx = -65 * amount
    if (name.includes('Zoom In')) scale = .65 + .35 * p
    if (name.includes('Zoom Out') || name.includes('Shrink')) scale = 1 - .35 * amount
    if (name.includes('Pop')) scale = .65 + .35 * Math.min(1, p * 1.35)
    if (name.includes('Blur')) blur = 9 * amount
  }

  if (style.animationIn && style.animationIn !== 'None' && local < animDuration) applyAnimation(style.animationIn, local / animDuration, true)
  if (style.animationOut && style.animationOut !== 'None' && remaining < animDuration) applyAnimation(style.animationOut, 1 - remaining / animDuration, false)

  let displayText = clip.text || clip.name
  if (style.animationIn === 'Typewriter' && local < animDuration) {
    displayText = displayText.slice(0, Math.max(1, Math.ceil(displayText.length * local / animDuration)))
  }

  return {
    text: displayText,
    style: {
      left: `${style.x ?? 50}%`,
      top: `${style.y ?? 50}%`,
      fontFamily: style.fontFamily || 'Segoe UI',
      fontSize: `${Math.max(8, Number(style.fontSize) || 64)}px`,
      color: style.color || '#fff',
      background: style.background || 'transparent',
      textAlign: style.align || 'center',
      fontWeight: style.bold ? 700 : 400,
      fontStyle: style.italic ? 'italic' : 'normal',
      textDecoration: style.underline ? 'underline' : 'none',
      opacity,
      filter: blur ? `blur(${blur}px)` : undefined,
      transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${scale})`,
    },
  }
}

function App() {
  const [leftTab, setLeftTab] = useState('Project')
  const [centerTab, setCenterTab] = useState('Source')
  const [toast, setToast] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState(4)
  const [leftWidth, setLeftWidth] = useState(32)
  const [rightWidth, setRightWidth] = useState(33)
  const [timelineHeight, setTimelineHeight] = useState(42)

  const [tracks, setTracks] = useState(initialTracks)
  const [clips, setClips] = useState(initialClips)
  const [selectedClipIds, setSelectedClipIds] = useState(['clip-v1a'])
  const [playhead, setPlayhead] = useState(7.2)
  const [zoom, setZoom] = useState(100)
  const [trackHeight, setTrackHeight] = useState(38)
  const [snapping, setSnapping] = useState(true)
  const [markers, setMarkers] = useState([15.5])
  const [history, setHistory] = useState([])
  const [future, setFuture] = useState([])
  const [copiedClips, setCopiedClips] = useState([])
  const [contextMenu, setContextMenu] = useState(null)

  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const toastTimerRef = useRef(null)

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 1400)
  }

  const pushHistory = (snapshot) => {
    setHistory((items) => [...items.slice(-49), cloneClips(snapshot)])
    setFuture([])
  }

  const commitClips = (updater) => {
    setClips((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      if (next === current) return current
      pushHistory(current)
      return next
    })
  }

  const undo = () => {
    if (!history.length) return notify('Nothing to undo')
    const previous = history[history.length - 1]
    setFuture((items) => [cloneClips(clips), ...items].slice(0, 50))
    setClips(cloneClips(previous))
    setHistory((items) => items.slice(0, -1))
    notify('Undo')
  }

  const redo = () => {
    if (!future.length) return notify('Nothing to redo')
    const next = future[0]
    setHistory((items) => [...items, cloneClips(clips)].slice(-50))
    setClips(cloneClips(next))
    setFuture((items) => items.slice(1))
    notify('Redo')
  }

  const selectedClips = useMemo(
    () => clips.filter((clip) => selectedClipIds.includes(clip.id)),
    [clips, selectedClipIds],
  )

  const selectedTextClip = selectedClips.find((clip) => clip.kind === 'text') || null
  const selectedClip = selectedClips[0] || null

  const getTrack = (trackId) => tracks.find((track) => track.id === trackId)

  const snapTime = (value, movingClipId = null) => {
    const clamped = Math.max(0, Math.min(TIMELINE_SECONDS, value))
    if (!snapping) return clamped

    const candidates = [playhead, ...markers]
    clips.forEach((clip) => {
      if (clip.id === movingClipId) return
      candidates.push(clip.start, clip.start + clip.duration)
    })

    const nearby = candidates
      .map((candidate) => ({ candidate, distance: Math.abs(candidate - clamped) }))
      .sort((a, b) => a.distance - b.distance)[0]

    if (nearby && nearby.distance <= 0.18) return nearby.candidate
    return Math.round(clamped * 2) / 2
  }

  const deleteSelected = () => {
    if (!selectedClipIds.length) return notify('No clip selected')
    const deletable = selectedClips.filter((clip) => !getTrack(clip.trackId)?.locked)
    if (!deletable.length) return notify('Selected track is locked')
    const ids = new Set(deletable.map((clip) => clip.id))
    commitClips((current) => current.filter((clip) => !ids.has(clip.id)))
    setSelectedClipIds([])
    notify('Selected clip deleted')
  }

  const splitAtPlayhead = () => {
    const targets = selectedClips.filter((clip) => {
      const locked = getTrack(clip.trackId)?.locked
      return !locked && playhead > clip.start + MIN_CLIP_DURATION && playhead < clip.start + clip.duration - MIN_CLIP_DURATION
    })
    if (!targets.length) return notify('Move playhead inside a selected clip')

    const targetIds = new Set(targets.map((clip) => clip.id))
    const createdIds = []
    commitClips((current) => {
      const next = []
      current.forEach((clip) => {
        if (!targetIds.has(clip.id)) {
          next.push(clip)
          return
        }
        const leftDuration = playhead - clip.start
        const rightDuration = clip.duration - leftDuration
        const rightId = `${clip.id}-split-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
        createdIds.push(rightId)
        next.push(
          { ...clip, duration: leftDuration },
          { ...clip, id: rightId, name: `${clip.name} (2)`, start: playhead, duration: rightDuration },
        )
      })
      return next
    })
    setSelectedClipIds([...targetIds, ...createdIds])
    notify('Clip split at playhead')
  }

  const trimSelectedToPlayhead = (direction) => {
    const targets = selectedClips.filter((clip) => {
      const locked = getTrack(clip.trackId)?.locked
      return !locked && playhead > clip.start && playhead < clip.start + clip.duration
    })
    if (!targets.length) return notify('Playhead must be inside selected clip')

    const ids = new Set(targets.map((clip) => clip.id))
    commitClips((current) => current.map((clip) => {
      if (!ids.has(clip.id)) return clip
      const end = clip.start + clip.duration
      if (direction === 'backward') {
        return { ...clip, start: playhead, duration: Math.max(MIN_CLIP_DURATION, end - playhead) }
      }
      return { ...clip, duration: Math.max(MIN_CLIP_DURATION, playhead - clip.start) }
    }))
    notify(direction === 'backward' ? 'Backward cut to playhead' : 'Forward cut to playhead')
  }

  const duplicateSelected = () => {
    if (!selectedClips.length) return notify('No clip selected')
    const now = Date.now()
    const duplicates = selectedClips
      .filter((clip) => !getTrack(clip.trackId)?.locked)
      .map((clip, index) => ({
        ...clip,
        id: `${clip.id}-copy-${now}-${index}`,
        name: `${clip.name} copy`,
        start: snapTime(clip.start + 0.5, clip.id),
      }))
    if (!duplicates.length) return notify('Selected track is locked')
    commitClips((current) => [...current, ...duplicates])
    setSelectedClipIds(duplicates.map((clip) => clip.id))
    notify('Clip duplicated')
  }

  const copySelected = () => {
    if (!selectedClips.length) return notify('No clip selected')
    setCopiedClips(cloneClips(selectedClips))
    notify(`${selectedClips.length} clip${selectedClips.length > 1 ? 's' : ''} copied`)
  }

  const pasteCopied = () => {
    if (!copiedClips.length) return notify('Clipboard is empty')
    const earliest = Math.min(...copiedClips.map((clip) => clip.start))
    const now = Date.now()
    const pasted = copiedClips.map((clip, index) => ({
      ...clip,
      id: `${clip.id}-paste-${now}-${index}`,
      start: snapTime(playhead + (clip.start - earliest), clip.id),
    }))
    commitClips((current) => [...current, ...pasted])
    setSelectedClipIds(pasted.map((clip) => clip.id))
    notify('Clips pasted at playhead')
  }

  const addMarker = () => {
    setMarkers((items) => [...items, playhead].sort((a, b) => a - b))
    notify('Marker added')
  }

  const toggleTrack = (trackId, key) => {
    setTracks((current) => current.map((track) => track.id === trackId ? { ...track, [key]: !track[key] } : track))
    notify(`${trackId} ${key} toggled`)
  }

  const updateClipControls = (id, patch) => {
    commitClips((current) => current.map((clip) => {
      if (clip.id !== id) return clip
      const next = { ...clip, ...patch }
      if (patch.video) {
        const previousSpeed = Number(clip.video?.speed) || 1
        const nextSpeed = Math.max(.1, Number(patch.video.speed ?? previousSpeed))
        const sourceDuration = Number(clip.sourceDuration) || clip.duration * previousSpeed
        next.video = { ...(clip.video || {}), ...patch.video, speed: nextSpeed }
        next.sourceDuration = sourceDuration
        if (nextSpeed !== previousSpeed) next.duration = Math.max(MIN_CLIP_DURATION, sourceDuration / nextSpeed)
      }
      if (patch.audio) next.audio = { ...(clip.audio || {}), ...patch.audio }
      return next
    }))
  }

  const addAudioToTimeline = (audioInfo, targetTrackId = 'A1', startAt = playhead) => {
    const track = firstUnlockedTrack('audio', targetTrackId)
    if (!track) return notify('Unlock an audio track before adding audio')
    const duration = Math.max(.1, Math.min(TIMELINE_SECONDS, Number(audioInfo.duration) || 3))
    const id = audioInfo.id || `audio-${Date.now()}`
    commitClips((current) => [...current, {
      id, trackId: track.id, name: audioInfo.name || 'Audio', type: 'audio', kind: audioInfo.kind || 'audio', start: Math.max(0, Math.min(TIMELINE_SECONDS - duration, startAt)), duration, sourceDuration: duration, color: audioInfo.kind === 'voiceover' ? 'green' : 'yellow',
      localUrl: audioInfo.url || null, audio: { volume: 100, fadeIn: 0, fadeOut: 0 },
    }])
    setSelectedClipIds([id])
  }

  const firstUnlockedTrack = (type, preferredId) => tracks.find((track) => track.id === preferredId && track.type === type && !track.locked)
    || tracks.find((track) => track.type === type && !track.locked)

  const addTextLayer = (draft) => {
    const track = firstUnlockedTrack('video', 'V3')
    if (!track) return notify('Unlock a video track before adding text')
    const id = `text-${Date.now()}`
    const duration = Math.max(.5, Number(draft.duration) || 5)
    commitClips((current) => [...current, {
      id, trackId: track.id, name: draft.text || 'Text', type: 'video', kind: 'text', start: playhead, duration, color: 'title',
      text: draft.text || 'Text', textStyle: { ...draft },
    }])
    setSelectedClipIds([id])
    notify(`Text layer added to ${track.id}`)
  }

  const updateTextLayer = (id, draft) => {
    commitClips((current) => current.map((clip) => clip.id === id ? {
      ...clip, name: draft.text || clip.name, text: draft.text || clip.text, duration: Math.max(.5, Number(draft.duration) || clip.duration), textStyle: { ...draft },
    } : clip))
    notify('Text layer updated')
  }

  const applyTransition = (type, duration) => {
    const ids = new Set(selectedClips.filter((clip) => clip.type === 'video' && clip.kind !== 'text').map((clip) => clip.id))
    if (!ids.size) return notify('Select a video clip first')
    commitClips((current) => current.map((clip) => ids.has(clip.id) ? { ...clip, transition: { type, duration } } : clip))
  }

  const applyEffect = (type, intensity) => {
    const ids = new Set(selectedClips.filter((clip) => clip.type === 'video' && clip.kind !== 'text').map((clip) => clip.id))
    if (!ids.size) return notify('Select a video clip first')
    commitClips((current) => current.map((clip) => {
      if (!ids.has(clip.id)) return clip
      const effects = (clip.effects || []).filter((effect) => effect.type !== type)
      return { ...clip, effects: [...effects, { type, intensity }] }
    }))
  }

  const resetEffects = () => {
    const ids = new Set(selectedClips.filter((clip) => clip.type === 'video').map((clip) => clip.id))
    if (!ids.size) return notify('Select a video clip first')
    commitClips((current) => current.map((clip) => ids.has(clip.id) ? { ...clip, effects: [] } : clip))
  }

  const addSfxToTimeline = (sfx, targetTrackId = 'A3', startAt = playhead) => {
    const track = firstUnlockedTrack('audio', targetTrackId)
    if (!track) return notify('Unlock an audio track before adding SFX')
    const duration = Math.max(.1, Math.min(TIMELINE_SECONDS, Number(sfx.duration) || 1))
    const id = `sfx-${sfx.id}-${Date.now()}`
    commitClips((current) => [...current, {
      id, trackId: track.id, name: sfx.name, type: 'audio', kind: 'sfx', start: Math.max(0, Math.min(TIMELINE_SECONDS - duration, startAt)), duration, color: 'orange',
      sfxId: sfx.id, localUrl: sfx.url || null, customSfx: Boolean(sfx.custom),
    }])
    setSelectedClipIds([id])
    notify(`${sfx.name} added to ${track.id}`)
  }

  const addStockToTimeline = (result, sourceLineId, targetTrackId = 'V1', startAt = playhead) => {
    const preferredTrack = tracks.find((track) => track.id === targetTrackId && track.type === 'video' && !track.locked)
      || tracks.find((track) => track.type === 'video' && !track.locked)

    if (!preferredTrack) return notify('Unlock a video track before importing stock footage')

    const id = `stock-${result.provider.toLowerCase()}-${result.sourceId}-${Date.now()}`
    const duration = Math.max(2, Math.min(10, Number(result.duration) || 5))
    const start = Math.max(0, Math.min(TIMELINE_SECONDS - duration, snapTime(startAt)))

    commitClips((current) => [
      ...current,
      {
        id,
        trackId: preferredTrack.id,
        name: `${result.provider}: ${result.title}`,
        type: 'video',
        start,
        duration,
        color: result.provider === 'Pexels' ? 'cyan' : 'purple',
        thumbnail: result.thumbnail,
        remoteUrl: result.fileUrl,
        pageUrl: result.pageUrl,
        provider: result.provider,
        stockId: result.sourceId,
        sourceLineId,
      },
    ])
    setSelectedClipIds([id])
    notify(`${result.provider} video added to ${preferredTrack.id}`)
  }

  const startVerticalResize = (side, event) => {
    event.preventDefault()
    const startX = event.clientX
    const startLeft = leftWidth
    const startRight = rightWidth

    const onMove = (moveEvent) => {
      const width = editorRef.current?.getBoundingClientRect().width || window.innerWidth
      const delta = ((moveEvent.clientX - startX) / width) * 100
      if (side === 'left') setLeftWidth(Math.min(48, Math.max(18, startLeft + delta)))
      if (side === 'right') setRightWidth(Math.min(48, Math.max(18, startRight - delta)))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startTimelineResize = (event) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = timelineHeight

    const onMove = (moveEvent) => {
      const delta = ((startY - moveEvent.clientY) / window.innerHeight) * 100
      setTimelineHeight(Math.min(70, Math.max(25, startHeight + delta)))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onClipSelect = (event, clipId) => {
    event.stopPropagation()
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      setSelectedClipIds((ids) => ids.includes(clipId) ? ids.filter((id) => id !== clipId) : [...ids, clipId])
    } else {
      setSelectedClipIds([clipId])
    }
    setContextMenu(null)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase()
      if (['input', 'textarea', 'select'].includes(tag)) return

      if (event.key === 'Escape') {
        setShowShortcuts(false)
        setContextMenu(null)
      }
      if (event.code === 'Space') {
        event.preventDefault()
        setPlaying((value) => !value)
      }
      if (event.key.toLowerCase() === 'v') notify('Cursor tool active')
      if (event.key.toLowerCase() === 'c') notify('Cut tool active')
      if (event.key.toLowerCase() === 'q') trimSelectedToPlayhead('backward')
      if (event.key.toLowerCase() === 'w') trimSelectedToPlayhead('forward')
      if (event.key.toLowerCase() === 'k') splitAtPlayhead()
      if (event.key.toLowerCase() === 'm') addMarker()
      if (event.key === 'Delete') deleteSelected()

      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(180, value + 10))
      if (event.key === '-') setZoom((value) => Math.max(60, value - 10))
      if (event.key === '[') setTrackHeight((value) => Math.max(28, value - 4))
      if (event.key === ']') setTrackHeight((value) => Math.min(76, value + 4))
      if (event.key === 'ArrowLeft') setPlayhead((value) => Math.max(0, value - (event.shiftKey ? 1 : 1 / 30)))
      if (event.key === 'ArrowRight') setPlayhead((value) => Math.min(TIMELINE_SECONDS, value + (event.shiftKey ? 1 : 1 / 30)))

      if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        redo()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelected()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        pasteCopied()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelected()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        notify('Project saved')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const renderLeftBody = () => {
    if (leftTab === 'Project') {
      return (
        <>
          <div className="project-row">
            <button className="small-icon" onClick={() => notify('Project bin opened')}>▣</button>
            <span>Untitled Project</span>
            <span className="item-count">17 items</span>
          </div>
          <div className="project-search-row">
            <input placeholder="Search project" />
            <button onClick={() => fileInputRef.current?.click()}>＋</button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={() => notify('Media selected for import')} />
          </div>
          <div className="media-grid">
            {mediaItems.map(([name, meta, type], index) => (
              <button
                key={name}
                className={`media-card ${selectedMedia === index ? 'selected' : ''}`}
                onClick={() => { setSelectedMedia(index); notify(`${name} selected`) }}
              >
                <div className={`media-thumb ${type}`}><span>{type === 'audio' ? '▥' : type === 'sequence' ? '▦' : '▶'}</span></div>
                <div className="media-name">{name}</div>
                <div className="media-meta">{meta}</div>
              </button>
            ))}
          </div>
        </>
      )
    }

    if (leftTab === 'Effect Controls' || leftTab === 'Properties') {
      if (selectedClip?.type === 'audio') return <AudioControls clip={selectedClip} onUpdate={updateClipControls} />
      return <VideoControls clip={selectedClip} onUpdate={updateClipControls} notify={notify} />
    }

    if (leftTab === 'Effects') {
      return <EffectsWorkspace onApply={applyEffect} onReset={resetEffects} notify={notify} />
    }

    if (leftTab === 'Tools') {
      return (
        <div className="option-panel">
          <div className="section-label">EDITING TOOLS</div>
          <div className="option-grid">
            <button onClick={() => notify('Cursor tool active')}>Cursor (V)</button>
            <button onClick={splitAtPlayhead}>Split (K)</button>
            <button onClick={() => trimSelectedToPlayhead('backward')}>Backward Cut (Q)</button>
            <button onClick={() => trimSelectedToPlayhead('forward')}>Forward Cut (W)</button>
            <button onClick={addMarker}>Marker (M)</button>
            <button className={snapping ? 'option-active' : ''} onClick={() => { setSnapping((value) => !value); notify(`Snapping ${snapping ? 'off' : 'on'}`) }}>Snap {snapping ? 'On' : 'Off'}</button>
          </div>
        </div>
      )
    }

    if (leftTab === 'Text') {
      return <TextWorkspace selectedTextClip={selectedTextClip} onAddText={addTextLayer} onUpdateText={updateTextLayer} notify={notify} />
    }

    return <VideoControls clip={selectedClip} onUpdate={updateClipControls} notify={notify} />
  }

  const renderCenterBody = () => {
    if (centerTab === 'Source') return <Monitor playing={playing} setPlaying={setPlaying} notify={notify} empty />
    if (centerTab === 'Script') {
      return (
        <ScriptWorkspace
          notify={notify}
          onImportStock={(result, lineId) => addStockToTimeline(result, lineId)}
        />
      )
    }
    if (centerTab === 'Stock') return <OptionGrid title="PEXELS + PIXABAY" options={['Search Videos', 'Preview Result 1', 'Preview Result 2', 'Preview Result 3', 'Download', 'Drag to Timeline']} onClick={notify} />
    if (centerTab === 'SFX') return <SfxWorkspace onAddSfx={(sfx) => addSfxToTimeline(sfx)} notify={notify} />
    if (centerTab === 'Transitions') return <TransitionWorkspace onApply={applyTransition} notify={notify} />
    return <VoiceoverWorkspace onAddAudio={(audioInfo, trackId) => addAudioToTimeline(audioInfo, trackId)} notify={notify} />
  }

  return (
    <div className="editor" ref={editorRef} onMouseDown={() => contextMenu && setContextMenu(null)}>
      <header className="topbar">
        <button className="home-btn" onClick={() => notify('Home')}>⌂</button>
        <nav className="workspace-nav">
          {['Import', 'Edit', 'Export'].map((item) => (
            <button key={item} className={item === 'Edit' ? 'active' : ''} onClick={() => notify(`${item} workspace`)}>{item}</button>
          ))}
        </nav>
        <div className="project-title">Untitled Project</div>
        <div className="top-actions">
          <button onClick={() => setShowShortcuts(true)}>⌨</button>
          <button onClick={() => notify('Layout options')}>☷</button>
          <button onClick={() => document.documentElement.requestFullscreen?.()}>⛶</button>
        </div>
      </header>

      <main className="workspace-shell">
        <section className="upper-workspace" style={{ height: `${100 - timelineHeight}%` }}>
          <section className="panel left-panel" style={{ width: `${leftWidth}%` }}>
            <div className="tab-strip">
              {leftTabs.map((tab) => (
                <button key={tab} className={leftTab === tab ? 'active' : ''} onClick={() => setLeftTab(tab)}>{tab}</button>
              ))}
            </div>
            <div className="panel-body">{renderLeftBody()}</div>
          </section>

          <div className="resize-handle vertical" onMouseDown={(event) => startVerticalResize('left', event)} />

          <section className="panel center-panel">
            <div className="tab-strip">
              {centerTabs.map((tab) => (
                <button key={tab} className={centerTab === tab ? 'active' : ''} onClick={() => setCenterTab(tab)}>{tab}</button>
              ))}
            </div>
            <div className="panel-body center-body">{renderCenterBody()}</div>
          </section>

          <div className="resize-handle vertical" onMouseDown={(event) => startVerticalResize('right', event)} />

          <section className="panel right-panel" style={{ width: `${rightWidth}%` }}>
            <div className="tab-strip"><button className="active" onClick={() => notify('Program monitor')}>Program: Untitled Project</button></div>
            <div className="panel-body center-body"><Monitor playing={playing} setPlaying={setPlaying} notify={notify} timelineClips={clips} playhead={playhead} /></div>
          </section>
        </section>

        <div className="resize-handle horizontal" onMouseDown={startTimelineResize} />

        <Timeline
          height={timelineHeight}
          zoom={zoom}
          setZoom={setZoom}
          trackHeight={trackHeight}
          setTrackHeight={setTrackHeight}
          tracks={tracks}
          clips={clips}
          setClips={setClips}
          commitClips={commitClips}
          selectedClipIds={selectedClipIds}
          setSelectedClipIds={setSelectedClipIds}
          playhead={playhead}
          setPlayhead={setPlayhead}
          markers={markers}
          setMarkers={setMarkers}
          snapping={snapping}
          snapTime={snapTime}
          toggleTrack={toggleTrack}
          onClipSelect={onClipSelect}
          setContextMenu={setContextMenu}
          notify={notify}
          pushHistory={pushHistory}
          onStockDrop={(result, trackId, startAt) => addStockToTimeline(result, result.sourceLineId, trackId, startAt)}
          onSfxDrop={(sfx, trackId, startAt) => addSfxToTimeline(sfx, trackId, startAt)}
        />
      </main>

      <footer className="statusbar">
        <span>Ready</span><span>GPU: Auto</span><span>Preview: 1/2</span><span>Snap: {snapping ? 'On' : 'Off'}</span><span>Selected: {selectedClipIds.length}</span>
      </footer>

      {showShortcuts && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowShortcuts(false)}>
          <div className="shortcut-modal">
            <div className="modal-head"><strong>⌨ Keyboard Shortcuts</strong><button onClick={() => setShowShortcuts(false)}>✕ Close</button></div>
            {shortcutRows.map(([key, description]) => (
              <div className="shortcut-row" key={key}><kbd>{key}</kbd><span>{description}</span></div>
            ))}
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="clip-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(event) => event.stopPropagation()}>
          <button onClick={() => { splitAtPlayhead(); setContextMenu(null) }}>Split at Playhead</button>
          <button onClick={() => { duplicateSelected(); setContextMenu(null) }}>Duplicate</button>
          <button onClick={() => { copySelected(); setContextMenu(null) }}>Copy</button>
          <button onClick={() => { deleteSelected(); setContextMenu(null) }}>Delete</button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0 }) {
  const activeClips = empty ? [] : timelineClips.filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration)
  const textClips = activeClips.filter((clip) => clip.kind === 'text')
  const activeVideo = activeClips.find((clip) => clip.type === 'video' && clip.kind !== 'text')
  const effectStyle = buildMonitorEffectStyle(activeVideo?.effects || [])
  const videoControls = activeVideo?.video || {}
  const fitMode = videoControls.fitMode || 'Fit'
  const programVideoStyle = activeVideo ? {
    left: `${videoControls.positionX ?? 50}%`,
    top: `${videoControls.positionY ?? 50}%`,
    width: `${Math.max(1, Number(videoControls.scale) || 100)}%`,
    height: `${Math.max(1, Number(videoControls.scale) || 100)}%`,
    opacity: Math.max(0, Math.min(1, (videoControls.opacity ?? 100) / 100)),
    transform: `translate(-50%, -50%) rotate(${Number(videoControls.rotation) || 0}deg)`,
    clipPath: `inset(${videoControls.cropTop || 0}% ${videoControls.cropRight || 0}% ${videoControls.cropBottom || 0}% ${videoControls.cropLeft || 0}%)`,
    objectFit: fitMode === 'Fill' ? 'cover' : fitMode === 'Stretch' ? 'fill' : 'contain',
    ...effectStyle,
  } : undefined

  return (
    <div className="monitor">
      <div className={`monitor-screen ${empty ? 'empty' : 'program'}`} style={empty ? undefined : effectStyle}>
        <span className={activeVideo ? 'program-placeholder hidden' : 'program-placeholder'}>{empty ? 'SOURCE MONITOR' : 'PROGRAM PREVIEW'}</span>
        {!empty && activeVideo && (
          <div className="program-video-layer" style={programVideoStyle}>
            {activeVideo.video?.freezeFrame && activeVideo.thumbnail ? (
              <img src={activeVideo.thumbnail} alt="" style={{ objectFit: programVideoStyle.objectFit }} />
            ) : activeVideo.remoteUrl || activeVideo.localUrl ? (
              <video src={activeVideo.remoteUrl || activeVideo.localUrl} poster={activeVideo.thumbnail} muted playsInline autoPlay={playing && !activeVideo.video?.freezeFrame} loop style={{ objectFit: programVideoStyle.objectFit }} />
            ) : activeVideo.thumbnail ? (
              <img src={activeVideo.thumbnail} alt="" style={{ objectFit: programVideoStyle.objectFit }} />
            ) : (
              <div className="program-video-placeholder">{activeVideo.video?.freezeFrame ? '❄ ' : ''}{activeVideo.name}</div>
            )}
          </div>
        )}
        {!empty && textClips.map((clip) => {
          const presentation = getTextOverlayPresentation(clip, playhead)
          return <div className="program-text-overlay" key={clip.id} style={presentation.style}>{presentation.text}</div>
        })}
        {!empty && activeVideo?.transition && <span className="monitor-transition-label">{activeVideo.transition.type} · {activeVideo.transition.duration}s</span>}
      </div>
      <div className="monitor-info"><span>00:00:05:11</span><button onClick={() => notify('Fit menu')}>Fit ▾</button><button onClick={() => notify('Full resolution')}>Full ▾</button></div>
      <div className="monitor-controls">
        {['|◀', '◀', playing ? '❚❚' : '▶', '▶', '▶|', '▣'].map((label, index) => (
          <button key={`${label}-${index}`} onClick={() => index === 2 ? setPlaying((value) => !value) : notify(`Monitor control ${label}`)}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function OptionGrid({ title, options, onClick }) {
  return (
    <div className="option-panel">
      <div className="section-label">{title}</div>
      <input className="option-search" placeholder={`Search ${title.toLowerCase()}`} />
      <div className="option-grid">{options.map((option) => <button key={option} onClick={() => onClick(option)}>{option}</button>)}</div>
    </div>
  )
}

function Timeline({ height, zoom, setZoom, trackHeight, setTrackHeight, tracks, clips, setClips, commitClips, selectedClipIds, setSelectedClipIds, playhead, setPlayhead, markers, setMarkers, snapping, snapTime, toggleTrack, onClipSelect, setContextMenu, notify, pushHistory, onStockDrop, onSfxDrop }) {
  const scrollRef = useRef(null)
  const dragInfoRef = useRef(null)
  const pixelsPerSecond = 22 * (zoom / 100)
  const laneWidth = TIMELINE_SECONDS * pixelsPerSecond

  const pointerToTime = (event) => {
    const element = scrollRef.current
    if (!element) return 0
    const rect = element.getBoundingClientRect()
    const x = event.clientX - rect.left + element.scrollLeft
    return Math.max(0, Math.min(TIMELINE_SECONDS, x / pixelsPerSecond))
  }

  const scrubFromEvent = (event) => {
    if (event.target.closest('.timeline-clip')) return
    event.preventDefault()
    setPlayhead(pointerToTime(event))
    const onMove = (moveEvent) => setPlayhead(pointerToTime(moveEvent))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onDragStart = (event, clip) => {
    const track = tracks.find((item) => item.id === clip.trackId)
    if (track?.locked) {
      event.preventDefault()
      notify(`${clip.trackId} is locked`)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    dragInfoRef.current = { clipId: clip.id, offsetSeconds: (event.clientX - rect.left) / pixelsPerSecond }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', clip.id)
  }

  const onDrop = (event, trackId) => {
    event.preventDefault()
    const targetTrack = tracks.find((track) => track.id === trackId)
    if (targetTrack?.locked) return notify(`${trackId} is locked`)

    const sfxPayload = event.dataTransfer.getData('application/x-video-editor-sfx')
    if (sfxPayload) {
      if (targetTrack?.type !== 'audio') return notify('SFX can only be dropped on an audio track')
      try {
        onSfxDrop(JSON.parse(sfxPayload), trackId, pointerToTime(event))
      } catch {
        notify('Could not read SFX data')
      }
      return
    }

    const stockPayload = event.dataTransfer.getData('application/x-video-editor-stock')
    if (stockPayload) {
      if (targetTrack?.type !== 'video') return notify('Stock video can only be dropped on a video track')
      try {
        const result = JSON.parse(stockPayload)
        onStockDrop(result, trackId, pointerToTime(event))
      } catch {
        notify('Could not read stock video data')
      }
      return
    }

    const clipId = event.dataTransfer.getData('text/plain') || dragInfoRef.current?.clipId
    const clip = clips.find((item) => item.id === clipId)
    if (!clip) return

    const isCompatible = clip.type === targetTrack.type
    if (!isCompatible) return notify(`Drop ${clip.type} clips on ${clip.type} tracks`)

    const offset = dragInfoRef.current?.offsetSeconds || 0
    const nextStart = snapTime(pointerToTime(event) - offset, clip.id)
    commitClips((current) => current.map((item) => item.id === clip.id
      ? { ...item, trackId, start: Math.max(0, Math.min(TIMELINE_SECONDS - item.duration, nextStart)) }
      : item))
    setSelectedClipIds([clip.id])
    notify(`Moved to ${trackId}`)
  }

  const startTrim = (event, clip, edge) => {
    event.preventDefault()
    event.stopPropagation()
    const track = tracks.find((item) => item.id === clip.trackId)
    if (track?.locked) return notify(`${clip.trackId} is locked`)
    const before = cloneClips(clips)
    const startX = event.clientX
    const initialStart = clip.start
    const initialDuration = clip.duration
    const initialEnd = initialStart + initialDuration
    let changed = false

    const onMove = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pixelsPerSecond
      setClips((current) => current.map((item) => {
        if (item.id !== clip.id) return item
        if (edge === 'left') {
          const proposed = snapTime(initialStart + delta, clip.id)
          const nextStart = Math.max(0, Math.min(initialEnd - MIN_CLIP_DURATION, proposed))
          changed = changed || Math.abs(nextStart - initialStart) > 0.001
          return { ...item, start: nextStart, duration: initialEnd - nextStart }
        }
        const proposedEnd = snapTime(initialEnd + delta, clip.id)
        const nextEnd = Math.max(initialStart + MIN_CLIP_DURATION, Math.min(TIMELINE_SECONDS, proposedEnd))
        changed = changed || Math.abs(nextEnd - initialEnd) > 0.001
        return { ...item, duration: nextEnd - initialStart }
      }))
    }

    const onUp = () => {
      if (changed) {
        pushHistory(before)
        notify(edge === 'left' ? 'Trimmed clip start' : 'Trimmed clip end')
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const removeMarker = (marker) => {
    setMarkers((items) => items.filter((item) => item !== marker))
    notify('Marker removed')
  }

  return (
    <section className="timeline" style={{ height: `${height}%` }}>
      <div className="timeline-titlebar">
        <strong>Untitled Project</strong>
        <span className="timeline-time">{formatTime(playhead)}</span>
        <span className={`snap-indicator ${snapping ? 'on' : ''}`}>Snap {snapping ? 'On' : 'Off'}</span>
        <div className="track-size-control"><span>Track</span><button onClick={() => setTrackHeight((value) => Math.max(28, value - 4))}>−</button><button onClick={() => setTrackHeight((value) => Math.min(76, value + 4))}>+</button></div>
        <div className="timeline-zoom"><span>−</span><input type="range" min="60" max="180" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><span>+</span></div>
      </div>

      <div className="timeline-body">
        <div className="track-controls">
          <div className="ruler-spacer" />
          {tracks.map((track) => (
            <div className="track-control" style={{ height: trackHeight }} key={track.id}>
              <button className={track.locked ? 'on' : ''} onClick={() => toggleTrack(track.id, 'locked')}>🔒</button>
              <strong>{track.id}</strong>
              {track.type === 'video' ? (
                <button className={track.hidden ? 'on' : ''} onClick={() => toggleTrack(track.id, 'hidden')}>◉</button>
              ) : (
                <><button className={track.muted ? 'on' : ''} onClick={() => toggleTrack(track.id, 'muted')}>M</button><button className={track.solo ? 'on' : ''} onClick={() => toggleTrack(track.id, 'solo')}>S</button></>
              )}
            </div>
          ))}
        </div>

        <div className="timeline-scroll" ref={scrollRef}>
          <div className="time-ruler" style={{ width: laneWidth }} onPointerDown={scrubFromEvent}>
            {Array.from({ length: 13 }, (_, index) => index * 10).map((seconds) => <span key={seconds} style={{ left: seconds * pixelsPerSecond }}>{formatShortTime(seconds)}</span>)}
          </div>

          <div className="track-lanes" style={{ width: laneWidth }}>
            <div className="playhead" style={{ left: playhead * pixelsPerSecond }} onPointerDown={scrubFromEvent} />
            {markers.map((marker) => (
              <button className="timeline-marker" key={marker} style={{ left: marker * pixelsPerSecond }} onClick={() => setPlayhead(marker)} onDoubleClick={() => removeMarker(marker)} title="Click to jump. Double-click to remove.">◆</button>
            ))}

            {tracks.map((track) => (
              <div className={`track-lane ${track.locked ? 'locked' : ''}`} style={{ height: trackHeight }} key={track.id} onPointerDown={scrubFromEvent} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, track.id)}>
                {clips.filter((clip) => clip.trackId === track.id).map((clip) => (
                  <button
                    key={clip.id}
                    draggable
                    className={`timeline-clip ${clip.type} color-${clip.color} ${selectedClipIds.includes(clip.id) ? 'selected' : ''}`}
                    style={{ left: clip.start * pixelsPerSecond, width: Math.max(18, clip.duration * pixelsPerSecond), height: Math.max(24, trackHeight - 6) }}
                    onClick={(event) => onClipSelect(event, clip.id)}
                    onDragStart={(event) => onDragStart(event, clip)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (!selectedClipIds.includes(clip.id)) setSelectedClipIds([clip.id])
                      setContextMenu({ x: event.clientX, y: event.clientY, clipId: clip.id })
                    }}
                  >
                    <span className="trim-handle left" onPointerDown={(event) => startTrim(event, clip, 'left')} />
                    {clip.thumbnail && <span className="clip-thumbnail-strip" style={{ backgroundImage: `url(${clip.thumbnail})` }} aria-hidden="true" />}
                    {!!clip.effects?.length && <span className="effect-badge">fx</span>}
                    {clip.transition && <span className="transition-badge">↔</span>}
                    {clip.video?.freezeFrame && <span className="freeze-badge">❄</span>}
                    <span className="clip-name">{clip.name}</span>
                    {clip.type === 'audio' && ((clip.audio?.fadeIn || 0) > 0 || (clip.audio?.fadeOut || 0) > 0) && <span className="audio-fade-indicator" />}
                    {clip.type === 'audio' && <span className="waveform-faux" aria-hidden="true" />}
                    <span className="trim-handle right" onPointerDown={(event) => startTrim(event, clip, 'right')} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatTime(seconds) {
  const whole = Math.floor(seconds)
  const frames = Math.floor((seconds - whole) * 30)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  return `00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}

function formatShortTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default App