export function unlimitedTimelineImportPlugin() {
  return {
    name: 'video-editor-unlimited-timeline-imports',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/')
      if (!normalized.endsWith('/src/App.jsx')) return null

      let next = code
      const applied = new Set()
      const replaceOnce = (name, pattern, replacement) => {
        const updated = next.replace(pattern, replacement)
        if (updated !== next) {
          next = updated
          applied.add(name)
        }
      }

      replaceOnce('base-duration', 'const TIMELINE_SECONDS = 120', 'const BASE_TIMELINE_SECONDS = 30')

      replaceOnce(
        'dynamic-duration',
        "  const [contextMenu, setContextMenu] = useState(null)\n\n  const editorRef = useRef(null)",
        `  const [contextMenu, setContextMenu] = useState(null)\n\n  const timelineSeconds = useMemo(() => {\n    const contentEnd = clips.reduce((end, clip) => Math.max(end, (Number(clip.start) || 0) + (Number(clip.duration) || 0)), 0)\n    const required = Math.max(BASE_TIMELINE_SECONDS, contentEnd + 60, playhead + 60)\n    return Math.ceil(required / 30) * 30\n  }, [clips, playhead])\n\n  const editorRef = useRef(null)`,
      )

      // Redirect only the original standalone constant name. Do not rewrite the
      // BASE_TIMELINE_SECONDS identifier itself.
      next = next.replace(/\bTIMELINE_SECONDS\b/g, 'timelineSeconds')

      replaceOnce(
        'timeline-prop',
        '        <Timeline\n          height={timelineHeight}',
        '        <Timeline\n          timelineSeconds={timelineSeconds}\n          height={timelineHeight}',
      )

      replaceOnce(
        'timeline-signature',
        'function Timeline({ height, zoom, setZoom, trackHeight, setTrackHeight, tracks, clips, setClips, commitClips, selectedClipIds, setSelectedClipIds, playhead, setPlayhead, markers, setMarkers, snapping, snapTime, toggleTrack, onAddTrack, onClipSelect, setContextMenu, notify, pushHistory, onStockDrop, onSfxDrop, onMediaDrop }) {',
        'function Timeline({ timelineSeconds, height, zoom, setZoom, trackHeight, setTrackHeight, tracks, clips, setClips, commitClips, selectedClipIds, setSelectedClipIds, playhead, setPlayhead, markers, setMarkers, snapping, snapTime, toggleTrack, onAddTrack, onClipSelect, setContextMenu, notify, pushHistory, onStockDrop, onSfxDrop, onMediaDrop }) {',
      )

      replaceOnce(
        'audio-duration',
        /const duration = Math\.max\(\.1, Math\.min\(timelineSeconds, Number\(audioInfo\.duration\) \|\| 3\)\)/,
        'const duration = Math.max(.1, Number(audioInfo.duration) || 3)',
      )
      replaceOnce(
        'audio-start',
        'start: Math.max(0, Math.min(timelineSeconds - duration, startAt)),',
        'start: Math.max(0, startAt),',
      )
      replaceOnce(
        'sfx-duration',
        /const duration = Math\.max\(\.1, Math\.min\(timelineSeconds, Number\(sfx\.duration\) \|\| 1\)\)/,
        'const duration = Math.max(.1, Number(sfx.duration) || 1)',
      )
      replaceOnce(
        'sfx-start',
        "id, trackId: track.id, name: sfx.name, type: 'audio', kind: 'sfx', start: Math.max(0, Math.min(timelineSeconds - duration, startAt)), duration, color: 'orange',",
        "id, trackId: track.id, name: sfx.name, type: 'audio', kind: 'sfx', start: Math.max(0, startAt), duration, color: 'orange',",
      )

      // Every imported media item gets a brand-new layer. Video imports also get
      // a brand-new linked audio layer placed immediately next to the video/audio
      // boundary so the pair is visible together. Placement is exactly at the
      // current playhead, not at track zero and not at the drag origin.
      replaceOnce(
        'media-import-handler',
        /  const addMediaToTimeline = \(media, targetTrackId = null, startAt = playhead\) => \{[\s\S]*?\n  \}\n\n  const addSfxToTimeline/,
        `  const addMediaToTimeline = (media, targetTrackId = null, startAt = playhead) => {\n    setPlaying(false)\n    const timelineType = media.type === 'audio' ? 'audio' : 'video'\n    const nextId = (type) => {\n      const prefix = type === 'audio' ? 'A' : 'V'\n      const nextNumber = Math.max(0, ...tracks\n        .filter((track) => track.type === type)\n        .map((track) => Number.parseInt(String(track.id).replace(/\\D/g, ''), 10))\n        .filter(Number.isFinite)) + 1\n      return \`\${prefix}\${nextNumber}\`\n    }\n\n    const trackId = nextId(timelineType)\n    const newTrack = { id: trackId, type: timelineType, locked: false, hidden: false, muted: false, solo: false }\n    const audioTrack = timelineType === 'video'\n      ? { id: nextId('audio'), type: 'audio', locked: false, hidden: false, muted: false, solo: false }\n      : null\n\n    setTracks((current) => {\n      const firstAudio = current.findIndex((track) => track.type === 'audio')\n      if (timelineType === 'video') {\n        const split = firstAudio === -1 ? current.length : firstAudio\n        const videos = [...current.slice(0, split), newTrack]\n        const audios = current.slice(split)\n        return audioTrack ? [...videos, audioTrack, ...audios] : [...videos, ...audios]\n      }\n\n      // Audio-only imports get a fresh top audio layer rather than reusing A1/A2/etc.\n      const split = firstAudio === -1 ? current.length : firstAudio\n      return [...current.slice(0, split), newTrack, ...current.slice(split)]\n    })\n\n    const duration = Math.max(.1, Number(media.duration) || (media.type === 'image' ? 5 : 3))\n    const id = \`local-\${media.id}-\${Date.now()}\`\n    const start = Math.max(0, Number(playhead) || 0)\n    const sourceUrl = media.originalUrl || media.localUrl\n    const videoClip = {\n      id,\n      trackId,\n      name: media.name,\n      type: timelineType,\n      kind: media.type === 'image' ? 'image' : 'local-media',\n      start,\n      duration,\n      sourceDuration: duration,\n      color: timelineType === 'audio' ? 'green' : media.type === 'image' ? 'purple' : 'blue',\n      localUrl: media.localUrl,\n      originalUrl: sourceUrl,\n      sourcePath: media.sourcePath || '',\n      sourceIn: 0,\n      thumbnail: media.thumbnail || null,\n      waveform: media.waveform || [],\n      width: media.width || 0,\n      height: media.height || 0,\n      sourceFileName: media.sourceFileName || media.name,\n      mimeType: media.mimeType || '',\n      audio: timelineType === 'audio' ? { volume: 100, fadeIn: 0, fadeOut: 0 } : undefined,\n    }\n\n    if (timelineType === 'video' && audioTrack) {\n      const audioId = \`\${id}-audio\`\n      const linkedVideo = { ...videoClip, linkedAudioId: audioId }\n      const linkedAudio = {\n        id: audioId,\n        trackId: audioTrack.id,\n        name: \`\${media.name} · Audio\`,\n        type: 'audio',\n        kind: 'linked-video-audio',\n        linkedClipId: id,\n        start,\n        duration,\n        sourceDuration: duration,\n        sourceIn: 0,\n        color: 'green',\n        localUrl: sourceUrl,\n        originalUrl: sourceUrl,\n        sourcePath: media.sourcePath || '',\n        sourceFileName: media.sourceFileName || media.name,\n        mimeType: media.mimeType || '',\n        waveform: media.audioWaveform || media.waveform || [],\n        audio: { volume: 100, fadeIn: 0, fadeOut: 0 },\n      }\n      commitClips((current) => [...current, linkedVideo, linkedAudio])\n      setSelectedClipIds([id, audioId])\n      notify(\`\${media.name} added on new video + audio layers at playhead\`)\n      return\n    }\n\n    commitClips((current) => [...current, videoClip])\n    setSelectedClipIds([id])\n    notify(\`\${media.name} added on a new \${timelineType} layer at playhead\`)\n  }\n\n  const addSfxToTimeline`,
      )

      // Allow trimming to extend forever to the right; timeline width grows from content.
      replaceOnce(
        'trim-no-right-limit',
        'const nextEnd = Math.max(initialStart + MIN_CLIP_DURATION, Math.min(timelineSeconds, proposedEnd))',
        'const nextEnd = Math.max(initialStart + MIN_CLIP_DURATION, proposedEnd)',
      )

      const required = ['base-duration', 'dynamic-duration', 'timeline-prop', 'timeline-signature', 'media-import-handler']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Unlimited timeline/import patch did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
