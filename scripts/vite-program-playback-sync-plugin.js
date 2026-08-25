export function programPlaybackSyncPlugin() {
  return {
    name: 'video-editor-program-playback-sync',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null

      let next = code
      const helperMarker = 'function ProgramVideoMedia({ clip, playing, playhead, style }) {'
      if (!next.includes(helperMarker)) {
        const monitorMarkers = [
          'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, timelineDuration = 0, projectSettings = { width: 1920, height: 1080 } }) {',
          'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, projectSettings = { width: 1920, height: 1080 } }) {',
        ]
        const monitorMarker = monitorMarkers.find((marker) => next.includes(marker))
        if (!monitorMarker) throw new Error('Program playback sync could not find Monitor component')
        const helpers = `function syncMediaElement(element, clip, playing, playhead) {\n  if (!element || !clip) return\n  const speed = Math.max(.1, Number(clip.video?.speed) || 1)\n  const sourceIn = Math.max(0, Number(clip.sourceIn) || 0)\n  const desired = sourceIn + Math.max(0, playhead - (Number(clip.start) || 0)) * speed\n  const apply = () => {\n    if (Number.isFinite(desired) && Math.abs((Number(element.currentTime) || 0) - desired) > (playing ? .35 : .04)) {\n      try { element.currentTime = desired } catch { /* metadata may not be ready yet */ }\n    }\n    if (playing) {\n      const promise = element.play?.()\n      promise?.catch?.(() => {})\n    } else {\n      element.pause?.()\n    }\n  }\n  if (element.readyState >= 1) apply()\n  else element.addEventListener('loadedmetadata', apply, { once: true })\n}\n\nfunction ProgramVideoMedia({ clip, playing, playhead, style }) {\n  const mediaRef = useRef(null)\n  const [failed, setFailed] = useState(false)\n  const source = clip.remoteUrl || clip.localUrl || clip.originalUrl\n  useEffect(() => {\n    setFailed(false)\n  }, [source, clip.id])\n  useEffect(() => {\n    if (!failed) syncMediaElement(mediaRef.current, clip, playing, playhead)\n  }, [clip, playing, playhead, failed])\n  if ((!source || failed) && clip.thumbnail) return <img src={clip.thumbnail} alt="" style={{ objectFit: style.objectFit }} />\n  if (!source) return <div className="program-video-placeholder">{clip.name}</div>\n  return <video ref={mediaRef} src={source} poster={clip.thumbnail} muted playsInline preload="auto" onError={() => setFailed(true)} style={{ objectFit: style.objectFit }} />\n}\n\nfunction ProgramAudioMedia({ clip, playing, playhead }) {\n  const mediaRef = useRef(null)\n  useEffect(() => {\n    const element = mediaRef.current\n    if (!element) return\n    element.volume = Math.max(0, Math.min(1, (Number(clip.audio?.volume) || 100) / 100))\n    syncMediaElement(element, clip, playing, playhead)\n  }, [clip, playing, playhead])\n  const source = clip.remoteUrl || clip.localUrl || clip.originalUrl\n  if (!source) return null\n  return <audio ref={mediaRef} src={source} preload="auto" aria-hidden="true" style={{ display: 'none' }} />\n}\n\n`
        next = next.replace(monitorMarker, `${helpers}${monitorMarker}`)
      }

      const monitorSignaturePatterns = [
        'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, timelineDuration = 0, projectSettings = { width: 1920, height: 1080 } }) {',
        'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, projectSettings = { width: 1920, height: 1080 } }) {',
      ]
      const currentSignature = monitorSignaturePatterns.find((marker) => next.includes(marker))
      if (currentSignature) {
        next = next.replace(currentSignature, currentSignature.replace('timelineClips = [],', 'timelineClips = [], tracks = [],'))
      }
      if (!next.includes('timelineClips = [], tracks = []')) throw new Error('Program playback sync could not add track state to Monitor')

      if (!next.includes('timelineClips={clips} tracks={tracks}')) {
        const programMonitorCallPattern = /timelineClips=\{clips\}(?=[\s\S]{0,180}?playhead=\{playhead\}[\s\S]{0,180}?projectSettings=\{projectSettings\})/
        if (programMonitorCallPattern.test(next)) {
          next = next.replace(programMonitorCallPattern, 'timelineClips={clips} tracks={tracks}')
        }
      }
      if (!next.includes('timelineClips={clips} tracks={tracks}')) throw new Error('Program playback sync could not pass tracks to Program Monitor')

      const oldActiveClips = 'const activeClips = empty ? [] : timelineClips.filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration)'
      const newActiveClips = "const visibleTrackIds = new Set(tracks.filter((track) => !track.hidden).map((track) => track.id))\n  const activeClips = empty ? [] : timelineClips.filter((clip) => visibleTrackIds.has(clip.trackId) && playhead >= clip.start && playhead < clip.start + clip.duration)"
      if (next.includes(oldActiveClips)) next = next.replace(oldActiveClips, newActiveClips)
      else if (!next.includes('const visibleTrackIds = new Set(')) throw new Error('Program playback sync could not make hidden tracks affect preview')

      const oldActiveVideo = "const activeVideo = activeClips.find((clip) => clip.type === 'video' && clip.kind !== 'text')"
      const newActiveVideo = "const videoTrackOrder = new Map(tracks.filter((track) => track.type === 'video').map((track, index) => [track.id, index]))\n  const activeVideos = activeClips.filter((clip) => clip.type === 'video' && clip.kind !== 'text').sort((a, b) => (videoTrackOrder.get(a.trackId) ?? 9999) - (videoTrackOrder.get(b.trackId) ?? 9999))\n  const activeVideo = activeVideos.find((clip) => clip.remoteUrl || clip.localUrl || clip.originalUrl || clip.thumbnail) || activeVideos[0]"
      if (next.includes(oldActiveVideo)) next = next.replace(oldActiveVideo, newActiveVideo)
      else if (!next.includes('const videoTrackOrder = new Map(')) throw new Error('Program playback sync could not prioritize the top visible video layer')

      const oldVideoBranch = 'activeVideo.remoteUrl || activeVideo.localUrl ? ('
      const newVideoBranch = 'activeVideo.remoteUrl || activeVideo.localUrl || activeVideo.originalUrl ? ('
      if (next.includes(oldVideoBranch)) next = next.replace(oldVideoBranch, newVideoBranch)

      const oldVideo = '<video src={activeVideo.remoteUrl || activeVideo.localUrl} poster={activeVideo.thumbnail} muted playsInline autoPlay={playing && !activeVideo.video?.freezeFrame} loop style={{ objectFit: programVideoStyle.objectFit }} />'
      const newVideo = '<ProgramVideoMedia clip={activeVideo} playing={playing && !activeVideo.video?.freezeFrame} playhead={playhead} style={programVideoStyle} />'
      if (next.includes(oldVideo)) next = next.replace(oldVideo, newVideo)
      else if (!next.includes(newVideo)) throw new Error('Program playback sync could not replace Program Monitor video element')

      const audioMarker = "        {!empty && textClips.map((clip) => {"
      const audioBlock = "        {!empty && activeClips.filter((clip) => clip.type === 'audio').map((clip) => (\n          <ProgramAudioMedia key={clip.id} clip={clip} playing={playing} playhead={playhead} />\n        ))}\n"
      if (!next.includes('<ProgramAudioMedia key={clip.id}')) {
        if (!next.includes(audioMarker)) throw new Error('Program playback sync could not find text overlay marker')
        next = next.replace(audioMarker, `${audioBlock}${audioMarker}`)
      }

      return { code: next, map: null }
    },
  }
}
