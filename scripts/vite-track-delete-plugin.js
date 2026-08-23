export function trackDeletePlugin() {
  return {
    name: 'video-editor-track-delete',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/')
      if (!normalized.endsWith('/src/App.jsx')) return null

      let next = code
      const applied = new Set()
      const replaceOnce = (name, needle, replacement) => {
        if (!next.includes(needle)) return
        next = next.replace(needle, replacement)
        applied.add(name)
      }

      replaceOnce(
        'timeline-settracks-prop',
        '        <Timeline\n          timelineSeconds={timelineSeconds}\n          height={timelineHeight}',
        '        <Timeline\n          timelineSeconds={timelineSeconds}\n          setTracks={setTracks}\n          height={timelineHeight}',
      )

      replaceOnce(
        'timeline-settracks-signature',
        'function Timeline({ timelineSeconds, height, zoom, setZoom, trackHeight, setTrackHeight, tracks, clips, setClips, commitClips, selectedClipIds, setSelectedClipIds, playhead, setPlayhead, markers, setMarkers, snapping, snapTime, toggleTrack, onAddTrack, onClipSelect, setContextMenu, notify, pushHistory, onStockDrop, onSfxDrop, onMediaDrop }) {',
        'function Timeline({ timelineSeconds, setTracks, height, zoom, setZoom, trackHeight, setTrackHeight, tracks, clips, setClips, commitClips, selectedClipIds, setSelectedClipIds, playhead, setPlayhead, markers, setMarkers, snapping, snapTime, toggleTrack, onAddTrack, onClipSelect, setContextMenu, notify, pushHistory, onStockDrop, onSfxDrop, onMediaDrop }) {',
      )

      replaceOnce(
        'delete-track-handler',
        '  const removeMarker = (marker) => {',
        `  const deleteTrack = (trackId) => {\n    const track = tracks.find((item) => item.id === trackId)\n    if (!track) return\n    const trackClips = clips.filter((clip) => clip.trackId === trackId)\n    if (trackClips.length && !window.confirm(\`Delete \${trackId} and \${trackClips.length} clip\${trackClips.length === 1 ? '' : 's'} on it?\`)) return\n    const removedIds = new Set(trackClips.map((clip) => clip.id))\n    setTracks((current) => current.filter((item) => item.id !== trackId))\n    commitClips((current) => current.filter((clip) => clip.trackId !== trackId))\n    setSelectedClipIds((ids) => ids.filter((id) => !removedIds.has(id)))\n    notify(\`\${trackId} layer deleted\`)\n  }\n\n  const removeMarker = (marker) => {`,
      )

      replaceOnce(
        'delete-track-button',
        '              <strong>{track.id}</strong>\n              {track.type === \'video\' ? (',
        '              <strong>{track.id}</strong>\n              <button className="track-delete" title={`Delete ${track.id} layer`} aria-label={`Delete ${track.id} layer`} onClick={() => deleteTrack(track.id)}>×</button>\n              {track.type === \'video\' ? (',
      )

      const required = ['timeline-settracks-prop', 'timeline-settracks-signature', 'delete-track-handler', 'delete-track-button']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Track delete patch did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
