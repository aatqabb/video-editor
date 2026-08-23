export function programPlaybackSyncPlugin() {
  return {
    name: 'video-editor-program-playback-sync',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null

      let next = code
      const helperMarker = 'function ProgramVideoMedia({ clip, playing, playhead, style }) {'
      if (!next.includes(helperMarker)) {
        const monitorMarker = 'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, projectSettings = { width: 1920, height: 1080 } }) {'
        if (!next.includes(monitorMarker)) throw new Error('Program playback sync could not find Monitor component')
        const helpers = `function syncMediaElement(element, clip, playing, playhead) {\n  if (!element || !clip) return\n  const speed = Math.max(.1, Number(clip.video?.speed) || 1)\n  const sourceIn = Math.max(0, Number(clip.sourceIn) || 0)\n  const desired = sourceIn + Math.max(0, playhead - (Number(clip.start) || 0)) * speed\n  const apply = () => {\n    if (Number.isFinite(desired) && Math.abs((Number(element.currentTime) || 0) - desired) > (playing ? .35 : .04)) {\n      try { element.currentTime = desired } catch { /* metadata may not be ready yet */ }\n    }\n    if (playing) {\n      const promise = element.play?.()\n      promise?.catch?.(() => {})\n    } else {\n      element.pause?.()\n    }\n  }\n  if (element.readyState >= 1) apply()\n  else element.addEventListener('loadedmetadata', apply, { once: true })\n}\n\nfunction ProgramVideoMedia({ clip, playing, playhead, style }) {\n  const mediaRef = useRef(null)\n  useEffect(() => {\n    syncMediaElement(mediaRef.current, clip, playing, playhead)\n  }, [clip, playing, playhead])\n  return <video ref={mediaRef} src={clip.remoteUrl || clip.localUrl || clip.originalUrl} poster={clip.thumbnail} muted playsInline preload=\"auto\" style={{ objectFit: style.objectFit }} />\n}\n\nfunction ProgramAudioMedia({ clip, playing, playhead }) {\n  const mediaRef = useRef(null)\n  useEffect(() => {\n    const element = mediaRef.current\n    if (!element) return\n    element.volume = Math.max(0, Math.min(1, (Number(clip.audio?.volume) || 100) / 100))\n    syncMediaElement(element, clip, playing, playhead)\n  }, [clip, playing, playhead])\n  const source = clip.remoteUrl || clip.localUrl || clip.originalUrl\n  if (!source) return null\n  return <audio ref={mediaRef} src={source} preload=\"auto\" aria-hidden=\"true\" style={{ display: 'none' }} />\n}\n\n`
        next = next.replace(monitorMarker, `${helpers}${monitorMarker}`)
      }

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
