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
  const [failed, setFailed] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const source = clip.remoteUrl || clip.localUrl || clip.originalUrl
  const desiredTime = Math.max(0, Number(clip.sourceIn) || 0) + Math.max(0, playhead - (Number(clip.start) || 0)) * Math.max(.1, Number(clip.video?.speed) || 1)

  useEffect(() => {
    setFailed(false)
    setFrameReady(false)
  }, [source, clip.id])

  useEffect(() => {
    const element = mediaRef.current
    if (!element || failed || clip.kind === 'image') return
    let cancelled = false

    const sync = () => {
      if (cancelled || !element) return
      const target = Math.max(0, desiredTime)
      const distance = Math.abs((Number(element.currentTime) || 0) - target)
      if (distance > (playing ? .12 : .015)) {
        setFrameReady(false)
        try { element.currentTime = target } catch { return }
      } else if (element.readyState >= 2) {
        setFrameReady(true)
      }
      if (playing) element.play?.().catch?.(() => {})
      else element.pause?.()
    }

    const onMetadata = () => sync()
    const onSeeking = () => setFrameReady(false)
    const onSeeked = () => {
      if (cancelled) return
      setFrameReady(true)
      if (playing) element.play?.().catch?.(() => {})
      else element.pause?.()
    }
    const onLoadedData = () => {
      if (Math.abs((Number(element.currentTime) || 0) - desiredTime) <= .03) setFrameReady(true)
      else sync()
    }

    element.addEventListener('loadedmetadata', onMetadata)
    element.addEventListener('loadeddata', onLoadedData)
    element.addEventListener('seeking', onSeeking)
    element.addEventListener('seeked', onSeeked)
    sync()
    return () => {
      cancelled = true
      element.removeEventListener('loadedmetadata', onMetadata)
      element.removeEventListener('loadeddata', onLoadedData)
      element.removeEventListener('seeking', onSeeking)
      element.removeEventListener('seeked', onSeeked)
    }
  }, [clip.id, source, desiredTime, playing, failed])

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
