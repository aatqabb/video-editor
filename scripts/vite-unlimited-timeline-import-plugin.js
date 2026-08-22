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

      // Any audio imported through the generic audio path gets its own fresh audio layer
      // and is inserted exactly where the playhead currently is.
      replaceOnce(
        'audio-import-handler',
        /  const addAudioToTimeline = \(audioInfo, targetTrackId = 'A1', startAt = playhead\) => \{[\s\S]*?\n  \}\n\n  const firstUnlockedTrack/,
        `  const addAudioToTimeline = (audioInfo, targetTrackId = 'A1', startAt = playhead) => {\n    setPlaying(false)\n    const numbers = tracks\n      .filter((track) => track.type === 'audio')\n      .map((track) => Number.parseInt(String(track.id).replace(/\\D/g, ''), 10))\n      .filter(Number.isFinite)\n    const track = { id: \`A\${Math.max(0, ...numbers) + 1}\`, type: 'audio', locked: false, hidden: false, muted: false, solo: false }\n    setTracks((current) => {\n      const firstAudio = current.findIndex((item) => item.type === 'audio')\n      const split = firstAudio === -1 ? current.length : firstAudio\n      return [...current.slice(0, split), track, ...current.slice(split)]\n    })\n    const duration = Math.max(.1, Number(audioInfo.duration) || 3)\n    const id = audioInfo.id || \`audio-\${Date.now()}\`\n    const start = Math.max(0, Number(playhead) || 0)\n    commitClips((current) => [...current, {\n      id, trackId: track.id, name: audioInfo.name || 'Audio', type: 'audio', kind: audioInfo.kind || 'audio', start, duration, sourceDuration: duration, color: audioInfo.kind === 'voiceover' ? 'green' : 'yellow',\n      localUrl: audioInfo.url || audioInfo.localUrl || null, originalUrl: audioInfo.originalUrl || audioInfo.url || audioInfo.localUrl || null, audio: { volume: 100, fadeIn: 0, fadeOut: 0 },\n    }])\n    setSelectedClipIds([id])\n    notify(\`\${audioInfo.name || 'Audio'} added on new audio layer at playhead\`)\n  }\n\n  const firstUnlockedTrack`,
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

      // Every imported media item gets a new layer. Video receives a linked audio
      // layer using the original source URL, and both clips begin at the playhead.
      replaceOnce(
        'media-import-handler',
        /  const addMediaToTimeline = \(media, targetTrackId = null, startAt = playhead\) => \{[\s\S]*?\n  \}\n\n  const addSfxToTimeline/,
        `  const addMediaToTimeline = (media, targetTrackId = null, startAt = playhead) => {\n    setPlaying(false)\n    const timelineType = media.type === 'audio' ? 'audio' : 'video'\n    const nextId = (type) => {\n      const prefix = type === 'audio' ? 'A' : 'V'\n      const numbers = tracks\n        .filter((track) => track.type === type)\n        .map((track) => Number.parseInt(String(track.id).replace(/\\D/g, ''), 10))\n        .filter(Number.isFinite)\n      return \`\${prefix}\${Math.max(0, ...numbers) + 1}\`\n    }\n\n    const trackId = nextId(timelineType)\n    const newTrack = { id: trackId, type: timelineType, locked: false, hidden: false, muted: false, solo: false }\n    const audioTrack = timelineType === 'video'\n      ? { id: nextId('audio'), type: 'audio', locked: false, hidden: false, muted: false, solo: false }\n      : null\n\n    setTracks((current) => {\n      const firstAudio = current.findIndex((track) => track.type === 'audio')\n      const split = firstAudio === -1 ? current.length : firstAudio\n      if (timelineType === 'video') {\n        return audioTrack\n          ? [...current.slice(0, split), newTrack, audioTrack, ...current.slice(split)]\n          : [...current.slice(0, split), newTrack, ...current.slice(split)]\n      }\n      return [...current.slice(0, split), newTrack, ...current.slice(split)]\n    })\n\n    const duration = Math.max(.1, Number(media.duration) || (media.type === 'image' ? 5 : 3))\n    const id = \`local-\${media.id}-\${Date.now()}\`\n    const start = Math.max(0, Number(playhead) || 0)\n    const sourceUrl = media.originalUrl || media.localUrl\n    const primaryClip = {\n      id,\n      trackId,\n      name: media.name,\n      type: timelineType,\n      kind: media.type === 'image' ? 'image' : 'local-media',\n      start,\n      duration,\n      sourceDuration: duration,\n      color: timelineType === 'audio' ? 'green' : media.type === 'image' ? 'purple' : 'blue',\n      localUrl: media.localUrl,\n      originalUrl: sourceUrl,\n      sourcePath: media.sourcePath || '',\n      sourceIn: 0,\n      thumbnail: media.thumbnail || null,\n      waveform: media.waveform || [],\n      width: media.width || 0,\n      height: media.height || 0,\n      sourceFileName: media.sourceFileName || media.name,\n      mimeType: media.mimeType || '',\n      audio: timelineType === 'audio' ? { volume: 100, fadeIn: 0, fadeOut: 0 } : undefined,\n    }\n\n    if (timelineType === 'video' && audioTrack) {\n      const audioId = \`\${id}-audio\`\n      const videoClip = { ...primaryClip, linkedAudioId: audioId }\n      const linkedAudio = {\n        id: audioId,\n        trackId: audioTrack.id,\n        name: \`\${media.name} · Audio\`,\n        type: 'audio',\n        kind: 'linked-video-audio',\n        linkedClipId: id,\n        start,\n        duration,\n        sourceDuration: duration,\n        sourceIn: 0,\n        color: 'green',\n        localUrl: sourceUrl,\n        originalUrl: sourceUrl,\n        sourcePath: media.sourcePath || '',\n        sourceFileName: media.sourceFileName || media.name,\n        mimeType: media.mimeType || '',\n        waveform: media.audioWaveform || media.waveform || [],\n        audio: { volume: 100, fadeIn: 0, fadeOut: 0 },\n      }\n      commitClips((current) => [...current, videoClip, linkedAudio])\n      // Select only the clip the user imported; linked audio stays available but does not
      // accidentally turn every normal drag into a group drag.\n      setSelectedClipIds([id])\n      notify(\`\${media.name} added on new video + audio layers at playhead\`)\n      return\n    }\n\n    commitClips((current) => [...current, primaryClip])\n    setSelectedClipIds([id])\n    notify(\`\${media.name} added on a new \${timelineType} layer at playhead\`)\n  }\n\n  const addSfxToTimeline`,
      )

      replaceOnce(
        'stock-start',
        'const start = Math.max(0, Math.min(timelineSeconds - duration, snapTime(startAt)))',
        'const start = Math.max(0, snapTime(startAt))',
      )

      replaceOnce(
        'trim-no-right-limit',
        'const nextEnd = Math.max(initialStart + MIN_CLIP_DURATION, Math.min(timelineSeconds, proposedEnd))',
        'const nextEnd = Math.max(initialStart + MIN_CLIP_DURATION, proposedEnd)',
      )

      const required = ['base-duration', 'dynamic-duration', 'timeline-prop', 'timeline-signature', 'audio-import-handler', 'media-import-handler']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Unlimited timeline/import patch did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
