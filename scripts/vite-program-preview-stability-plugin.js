export function programPreviewStabilityPlugin() {
  return {
    name: 'video-editor-program-preview-stability',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/')
      if (!normalized.endsWith('/src/App.jsx')) return null
      if (!code.includes('function ProgramVideoMedia({ clip, playing, playhead, style }) {')) {
        throw new Error('Program preview stability could not find ProgramVideoMedia')
      }

      const replacement = `function ProgramVideoMedia({ clip, playing, playhead, style }) {
  const mediaRef = useRef(null)
  const expectedTimeRef = useRef(0)
  const frameRequestRef = useRef(0)
  const [failed, setFailed] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const source = clip.remoteUrl || clip.localUrl || clip.originalUrl
  const desiredTime = Math.max(0, Number(clip.sourceIn) || 0) + Math.max(0, playhead - (Number(clip.start) || 0)) * Math.max(.1, Number(clip.video?.speed) || 1)
  expectedTimeRef.current = desiredTime

  useEffect(() => {
    setFailed(false)
    setFrameReady(false)
    frameRequestRef.current += 1
  }, [source, clip.id])

  // Media event wiring is intentionally NOT recreated for every playhead tick. During
  // playback the <video> element owns continuous frame progression; the timeline clock is
  // only used to correct meaningful drift. Rebuilding this effect on every playhead update
  // used to cancel requestVideoFrameCallback before it could reveal the next decoded frame,
  // leaving Program Monitor visually stuck on the poster/last frame.
  useEffect(() => {
    const element = mediaRef.current
    if (!element || failed || clip.kind === 'image') return
    let cancelled = false

    const revealDecodedFrame = () => {
      const requestId = frameRequestRef.current + 1
      frameRequestRef.current = requestId
      const reveal = () => {
        if (cancelled || frameRequestRef.current !== requestId) return
        if (element.readyState < 2) return
        if (playing) {
          setFrameReady(true)
          return
        }
        const distance = Math.abs((Number(element.currentTime) || 0) - expectedTimeRef.current)
        if (distance <= .06) setFrameReady(true)
      }
      if (typeof element.requestVideoFrameCallback === 'function') element.requestVideoFrameCallback(() => reveal())
      else window.setTimeout(reveal, 0)
    }

    const syncInitialPosition = () => {
      if (cancelled || element.readyState < 1) return
      const target = Math.max(0, expectedTimeRef.current)
      const distance = Math.abs((Number(element.currentTime) || 0) - target)
      const tolerance = playing ? .65 : .015
      if (distance > tolerance) {
        setFrameReady(false)
        try { element.currentTime = target } catch { /* metadata may still be settling */ }
      } else if (element.readyState >= 2) {
        revealDecodedFrame()
      }
      if (playing) element.play?.().catch?.(() => {})
      else element.pause?.()
    }

    const onMetadata = () => syncInitialPosition()
    const onLoadedData = () => revealDecodedFrame()
    const onCanPlay = () => {
      revealDecodedFrame()
      if (playing) element.play?.().catch?.(() => {})
    }
    const onPlaying = () => revealDecodedFrame()
    const onSeeking = () => setFrameReady(false)
    const onSeeked = () => {
      if (cancelled) return
      revealDecodedFrame()
      if (playing) element.play?.().catch?.(() => {})
      else element.pause?.()
    }

    element.addEventListener('loadedmetadata', onMetadata)
    element.addEventListener('loadeddata', onLoadedData)
    element.addEventListener('canplay', onCanPlay)
    element.addEventListener('playing', onPlaying)
    element.addEventListener('seeking', onSeeking)
    element.addEventListener('seeked', onSeeked)
    syncInitialPosition()
    return () => {
      cancelled = true
      frameRequestRef.current += 1
      element.removeEventListener('loadedmetadata', onMetadata)
      element.removeEventListener('loadeddata', onLoadedData)
      element.removeEventListener('canplay', onCanPlay)
      element.removeEventListener('playing', onPlaying)
      element.removeEventListener('seeking', onSeeking)
      element.removeEventListener('seeked', onSeeked)
    }
  }, [clip.id, source, playing, failed])

  // Follow explicit playhead moves without continuously seeking during ordinary playback.
  // Paused scrubbing stays frame-accurate; while playing we only correct large drift or
  // restart a paused/stalled media element, allowing native video decoding to stay smooth.
  useEffect(() => {
    const element = mediaRef.current
    if (!element || failed || clip.kind === 'image' || element.readyState < 1) return
    const target = Math.max(0, desiredTime)
    const distance = Math.abs((Number(element.currentTime) || 0) - target)

    if (playing) {
      if (distance > .75) {
        setFrameReady(false)
        try { element.currentTime = target } catch { /* keep current decoded frame */ }
      }
      if (element.paused) element.play?.().catch?.(() => {})
      return
    }

    element.pause?.()
    if (distance > .015) {
      setFrameReady(false)
      try { element.currentTime = target } catch { /* metadata may not be ready yet */ }
    } else if (element.readyState >= 2) {
      setFrameReady(true)
    }
  }, [desiredTime, playing, clip.id, source, failed])

  if (!source) {
    if (clip.thumbnail) return <img src={clip.thumbnail} alt="" style={{ objectFit: style.objectFit }} />
    return <div className="program-video-placeholder">{clip.name}</div>
  }
  if (clip.kind === 'image') return <img src={source} alt="" style={{ objectFit: style.objectFit }} />
  if (failed) {
    if (clip.thumbnail) return <img src={clip.thumbnail} alt="" style={{ objectFit: style.objectFit }} />
    return <div className="program-video-placeholder">{clip.name}</div>
  }

  return <div className="program-media-stack">
    {clip.thumbnail && <img className="program-media-fallback" src={clip.thumbnail} alt="" style={{ objectFit: style.objectFit, opacity: frameReady ? 0 : 1 }} />}
    <video
      key={source}
      ref={mediaRef}
      src={source}
      poster={clip.thumbnail}
      muted
      playsInline
      preload="auto"
      onError={() => setFailed(true)}
      style={{ objectFit: style.objectFit, opacity: frameReady ? 1 : 0 }}
    />
  </div>
}`

      const pattern = /function ProgramVideoMedia\(\{ clip, playing, playhead, style \}\) \{[\s\S]*?\n\}\n\nfunction ProgramAudioMedia/
      if (!pattern.test(code)) throw new Error('Program preview stability could not replace ProgramVideoMedia block')
      return { code: code.replace(pattern, `${replacement}\n\nfunction ProgramAudioMedia`), map: null }
    },
  }
}
