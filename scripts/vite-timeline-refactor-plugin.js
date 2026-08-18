export function timelineRefactorPlugin() {
  return {
    name: 'video-editor-timeline-refactor',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null

      let next = code

      const importNeedle = "import { buildProjectDocument, clearAutosave, getRecentProjects, readAutosave, readProjectFile, rememberProject, saveProjectFile, writeAutosave } from './projectPersistence'"
      if (next.includes(importNeedle) && !next.includes("from './timelineStateHelpers'")) {
        next = next.replace(importNeedle, `${importNeedle}\nimport { addTimelineTrack, moveSelectedClips } from './timelineStateHelpers'`)
      }

      next = next.replace("const [markers, setMarkers] = useState([15.5])", "const [markers, setMarkers] = useState([])")

      const toggleTrackNeedle = `  const toggleTrack = (trackId, key) => {\n    setTracks((current) => current.map((track) => track.id === trackId ? { ...track, [key]: !track[key] } : track))\n    notify(\`${'${trackId}'} ${'${key}'} toggled\`)\n  }`
      if (next.includes(toggleTrackNeedle) && !next.includes('const addTrack = (type) =>')) {
        next = next.replace(toggleTrackNeedle, `${toggleTrackNeedle}\n\n  const addTrack = (type) => {\n    setTracks((current) => {\n      const result = addTimelineTrack(current, type)\n      notify(\`Added ${'${result.track.id}'}\`)\n      return result.tracks\n    })\n  }`)
      }

      next = next.replace(
        "          toggleTrack={toggleTrack}\n          onClipSelect={onClipSelect}",
        "          toggleTrack={toggleTrack}\n          onAddTrack={addTrack}\n          onClipSelect={onClipSelect}",
      )

      next = next.replace(
        "function Timeline({ height, zoom, setZoom, trackHeight, setTrackHeight, tracks, clips, setClips, commitClips, selectedClipIds, setSelectedClipIds, playhead, setPlayhead, markers, setMarkers, snapping, snapTime, toggleTrack, onClipSelect, setContextMenu, notify, pushHistory, onStockDrop, onSfxDrop, onMediaDrop })",
        "function Timeline({ height, zoom, setZoom, trackHeight, setTrackHeight, tracks, clips, setClips, commitClips, selectedClipIds, setSelectedClipIds, playhead, setPlayhead, markers, setMarkers, snapping, snapTime, toggleTrack, onAddTrack, onClipSelect, setContextMenu, notify, pushHistory, onStockDrop, onSfxDrop, onMediaDrop })",
      )

      const scrubOld = `  const scrubFromEvent = (event) => {\n    if (event.target.closest('.timeline-clip')) return\n    event.preventDefault()\n    setPlayhead(pointerToTime(event))\n    const onMove = (moveEvent) => setPlayhead(pointerToTime(moveEvent))\n    const onUp = () => {\n      window.removeEventListener('pointermove', onMove)\n      window.removeEventListener('pointerup', onUp)\n    }\n    window.addEventListener('pointermove', onMove)\n    window.addEventListener('pointerup', onUp)\n  }`
      const scrubNew = `  const scrubFromEvent = (event) => {\n    if (event.target.closest('.timeline-clip')) return\n    event.preventDefault()\n    setPlayhead(pointerToTime(event))\n  }`
      next = next.replace(scrubOld, scrubNew)

      const dragSelectionNeedle = `    const rect = event.currentTarget.getBoundingClientRect()\n    dragInfoRef.current = { clipId: clip.id, offsetSeconds: (event.clientX - rect.left) / pixelsPerSecond }`
      if (next.includes(dragSelectionNeedle)) {
        next = next.replace(dragSelectionNeedle, `    const dragSelection = selectedClipIds.includes(clip.id) ? [...selectedClipIds] : [clip.id]\n    if (!selectedClipIds.includes(clip.id)) setSelectedClipIds(dragSelection)\n    const rect = event.currentTarget.getBoundingClientRect()\n    dragInfoRef.current = { clipId: clip.id, offsetSeconds: (event.clientX - rect.left) / pixelsPerSecond, selectedIds: dragSelection }`)
      }

      const singleMoveOld = `    const offset = dragInfoRef.current?.offsetSeconds || 0\n    const nextStart = snapTime(pointerToTime(event) - offset, clip.id)\n    commitClips((current) => current.map((item) => item.id === clip.id\n      ? { ...item, trackId, start: Math.max(0, Math.min(TIMELINE_SECONDS - item.duration, nextStart)) }\n      : item))\n    setSelectedClipIds([clip.id])\n    notify(\`Moved to ${'${trackId}'}\`)`
      const groupMoveNew = `    const offset = dragInfoRef.current?.offsetSeconds || 0\n    const nextStart = snapTime(pointerToTime(event) - offset, clip.id)\n    const idsToMove = dragInfoRef.current?.selectedIds?.length ? dragInfoRef.current.selectedIds : (selectedClipIds.includes(clip.id) ? selectedClipIds : [clip.id])\n    commitClips((current) => moveSelectedClips({\n      clips: current,\n      selectedIds: idsToMove,\n      anchorId: clip.id,\n      targetTrackId: trackId,\n      tracks,\n      requestedAnchorStart: nextStart,\n      timelineSeconds: TIMELINE_SECONDS,\n    }))\n    setSelectedClipIds(idsToMove)\n    notify(idsToMove.length > 1 ? \`Moved ${'${idsToMove.length}'} selected clips\` : \`Moved to ${'${trackId}'}\`)`
      next = next.replace(singleMoveOld, groupMoveNew)

      next = next.replace(
        "          <div className=\"ruler-spacer\" />",
        "          <div className=\"ruler-spacer timeline-track-add\"><button type=\"button\" title=\"Add video track\" onClick={() => onAddTrack?.('video')}>+V</button><button type=\"button\" title=\"Add audio track\" onClick={() => onAddTrack?.('audio')}>+A</button></div>",
      )

      return next === code ? null : { code: next, map: null }
    },
  }
}
