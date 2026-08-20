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

      replaceOnce('base-duration', 'const TIMELINE_SECONDS = 120', 'const BASE_TIMELINE_SECONDS = 120')

      replaceOnce(
        'dynamic-duration',
        "  const [contextMenu, setContextMenu] = useState(null)\n\n  const editorRef = useRef(null)",
        `  const [contextMenu, setContextMenu] = useState(null)\n\n  const timelineSeconds = useMemo(() => {\n    const contentEnd = clips.reduce((end, clip) => Math.max(end, (Number(clip.start) || 0) + (Number(clip.duration) || 0)), 0)\n    const required = Math.max(BASE_TIMELINE_SECONDS, contentEnd + 30, playhead + 30)\n    return Math.ceil(required / 30) * 30\n  }, [clips, playhead])\n\n  const editorRef = useRef(null)`,
      )

      // All runtime timeline bounds now use the dynamic duration. The top-level base constant
      // was renamed above, so remaining occurrences are safe to redirect.
      next = next.replaceAll('TIMELINE_SECONDS', 'timelineSeconds')

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

      // Every imported media item gets its own fresh layer and is aligned to the current
      // playhead. Video always receives a linked audio layer using the same source URL;
      // silent videos simply produce a silent linked audio clip.
      replaceOnce(
        'media-import-handler',
        /  const addMediaToTimeline = \(media, targetTrackId = null, startAt = playhead\) => \{[\s\S]*?\n  \}\n\n  const addSfxToTimeline/,
        `  const addMediaToTimeline = (media, targetTrackId = null, startAt = playhead) => {\n    setPlaying(false)\n    const timelineType = media.type === 'audio' ? 'audio' : 'video'\n    const prefix = timelineType === 'audio' ? 'A' : 'V'\n    const nextNumber = Math.max(0, ...tracks\n      .filter((track) => track.type === timelineType)\n      .map((track) => Number.parseInt(String(track.id).replace(/\\D/g, ''), 10))\n      .filter(Number.isFinite)) + 1\n    const trackId = \`\${prefix}\${nextNumber}\`\n    const newTrack = { id: trackId, type: timelineType, locked: false, hidden: false, muted: false, solo: false }\n\n    let audioTrack = null\n    if (timelineType === 'video') {\n      const audioNumber = Math.max(0, ...tracks\n        .filter((track) => track.type === 'audio')\n        .map((track) => Number.parseInt(String(track.id).replace(/\\D/g, ''), 10))\n        .filter(Number.isFinite)) + 1\n      audioTrack = { id: \`A\${audioNumber}\`, type: 'audio', locked: false, hidden: false, muted: false, solo: false }\n    }\n\n    setTracks((current) => {\n      if (timelineType === 'video') {\n        const firstAudio = current.findIndex((track) => track.type === 'audio')\n        const withVideo = firstAudio === -1\n          ? [...current, newTrack]\n          : [...current.slice(0, firstAudio), newTrack, ...current.slice(firstAudio)]\n        return audioTrack ? [...withVideo, audioTrack] : withVideo\n      }\n      return [...current, newTrack]\n    })\n\n    const duration = Math.max(.1, Number(media.duration) || (media.type === 'image' ? 5 : 3))\n    const id = \`local-\${media.id}-\${Date.now()}\`\n    const start = Math.max(0, snapTime(playhead))\n    const videoClip = {\n      id,\n      trackId,\n      name: media.name,\n      type: timelineType,\n      kind: media.type === 'image' ? 'image' : 'local-media',\n      start,\n      duration,\n      sourceDuration: duration,\n      color: timelineType === 'audio' ? 'green' : media.type === 'image' ? 'purple' : 'blue',\n      localUrl: media.localUrl,\n      originalUrl: media.originalUrl || media.localUrl,\n      sourcePath: media.sourcePath || '',\n      sourceIn: 0,\n      thumbnail: media.thumbnail || null,\n      waveform: media.waveform || [],\n      width: media.width || 0,\n      height: media.height || 0,\n      sourceFileName: media.sourceFileName || media.name,\n      mimeType: media.mimeType || '',\n      audio: timelineType === 'audio' ? { volume: 100, fadeIn: 0, fadeOut: 0 } : undefined,\n    }\n\n    if (timelineType === 'video' && audioTrack) {\n      const audioId = \`\${id}-audio\`\n      const linkedVideo = { ...videoClip, linkedAudioId: audioId }\n      const linkedAudio = {\n        id: audioId,\n        trackId: audioTrack.id,\n        name: \`\${media.name} · Audio\`,\n        type: 'audio',\n        kind: 'linked-video-audio',\n        linkedClipId: id,\n        start,\n        duration,\n        sourceDuration: duration,\n        sourceIn: 0,\n        color: 'green',\n        localUrl: media.originalUrl || media.localUrl,\n        sourcePath: media.sourcePath || '',\n        sourceFileName: media.sourceFileName || media.name,\n        mimeType: media.mimeType || '',\n        waveform: media.audioWaveform || [],\n        audio: { volume: 100, fadeIn: 0, fadeOut: 0 },\n      }\n      commitClips((current) => [...current, linkedVideo, linkedAudio])\n      setSelectedClipIds([id, audioId])\n      notify(\`\${media.name} added on new video/audio layers at playhead\`)\n      return\n    }\n\n    commitClips((current) => [...current, videoClip])\n    setSelectedClipIds([id])\n    notify(\`\${media.name} added on new \${timelineType} layer at playhead\`)\n  }\n\n  const addSfxToTimeline`,
      )

      // Allow trimming to extend the timeline; the dynamic duration grows with content.
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
