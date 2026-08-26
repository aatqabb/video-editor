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
  const [failed, setFailed] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const source = clip.remoteUrl || clip.localUrl || clip.originalUrl
  const speed = Math.max(.1, Number(clip.video?.speed) || 1)
  const desiredTime = Math.max(0, Number(clip.sourceIn) || 0) + Math.max(0, playhead - (Number(clip.start) || 0)) * speed
  expectedTimeRef.current = desiredTime

  useEffect(() => {
    setFailed(false)
    setFrameReady(false)
  }, [source, clip.id])

  // Keep one stable media lifecycle per clip/source/play state. Once any decoded frame is
  // available the video remains visible while seeking; hiding it again on every seeking
  // event allowed the poster/fallback to sit over the real video and look permanently stuck.
  useEffect(() => {
    const element = mediaRef.current
    if (!element || failed || clip.kind === 'image') return
    let cancelled = false

    const markReady = () => {
      if (!cancelled && element.readyState >= 2) setFrameReady(true)
    }
    const syncInitialPosition = () => {
      if (cancelled || element.readyState < 1) return
      element.playbackRate = speed
      element.defaultPlaybackRate = speed
      const target = Math.max(0, expectedTimeRef.current)
      const distance = Math.abs((Number(element.currentTime) || 0) - target)
      if (distance > (playing ? .65 : .015)) {
        try { element.currentTime = target } catch { /* metadata can still be settling */ }
      } else {
        markReady()
      }
      if (playing) element.play?.().catch?.(() => {})
      else element.pause?.()
    }

    const onMetadata = () => syncInitialPosition()
    const onLoadedData = () => markReady()
    const onCanPlay = () => {
      markReady()
      if (playing) element.play?.().catch?.(() => {})
    }
    const onPlaying = () => markReady()
    const onTimeUpdate = () => markReady()
    const onSeeked = () => {
      markReady()
      if (playing) element.play?.().catch?.(() => {})
      else element.pause?.()
    }

    element.addEventListener('loadedmetadata', onMetadata)
    element.addEventListener('loadeddata', onLoadedData)
    element.addEventListener('canplay', onCanPlay)
    element.addEventListener('playing', onPlaying)
    element.addEventListener('timeupdate', onTimeUpdate)
    element.addEventListener('seeked', onSeeked)
    syncInitialPosition()
    return () => {
      cancelled = true
      element.removeEventListener('loadedmetadata', onMetadata)
      element.removeEventListener('loadeddata', onLoadedData)
      element.removeEventListener('canplay', onCanPlay)
      element.removeEventListener('playing', onPlaying)
      element.removeEventListener('timeupdate', onTimeUpdate)
      element.removeEventListener('seeked', onSeeked)
    }
  }, [clip.id, source, playing, failed, speed])

  // The timeline remains master clock. Paused scrubbing seeks tightly to the requested frame;
  // normal playback lets the browser decode continuously and only corrects meaningful drift.
  useEffect(() => {
    const element = mediaRef.current
    if (!element || failed || clip.kind === 'image' || element.readyState < 1) return
    element.playbackRate = speed
    const target = Math.max(0, desiredTime)
    const distance = Math.abs((Number(element.currentTime) || 0) - target)

    if (playing) {
      if (distance > .75) {
        try { element.currentTime = target } catch { /* keep current decoded frame visible */ }
      }
      if (element.paused) element.play?.().catch?.(() => {})
      if (element.readyState >= 2) setFrameReady(true)
      return
    }

    element.pause?.()
    if (distance > .015) {
      try { element.currentTime = target } catch { /* metadata may not be ready yet */ }
    } else if (element.readyState >= 2) {
      setFrameReady(true)
    }
  }, [desiredTime, playing, clip.id, source, failed, speed])

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
    {clip.thumbnail && !frameReady && <img className="program-media-fallback" src={clip.thumbnail} alt="" style={{ objectFit: style.objectFit }} />}
    <video
      key={source}
      ref={mediaRef}
      src={source}
      poster={clip.thumbnail}
      muted
      playsInline
      preload="auto"
      onLoadedData={() => setFrameReady(true)}
      onCanPlay={() => setFrameReady(true)}
      onPlaying={() => setFrameReady(true)}
      onSeeked={() => setFrameReady(true)}
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
