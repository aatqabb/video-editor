export function timelineRefactorPlugin() {
  return {
    name: 'video-editor-timeline-refactor',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null

      let next = code
      const applied = new Set()

      const replaceOnce = (name, pattern, replacement) => {
        const updated = next.replace(pattern, replacement)
        if (updated !== next) {
          next = updated
          applied.add(name)
        }
      }

      if (!next.includes("from './timelineStateHelpers'")) {
        replaceOnce(
          'helpers-import',
          /(import\s+\{[^}]*buildProjectDocument[^}]*\}\s+from\s+['"]\.\/projectPersistence['"])/,
          "$1\nimport { addTimelineTrack, moveSelectedClips } from './timelineStateHelpers'",
        )
      } else {
        applied.add('helpers-import')
      }

      replaceOnce(
        'empty-default-markers',
        /const \[markers,\s*setMarkers\]\s*=\s*useState\(\[[^\]]*\]\)/,
        'const [markers, setMarkers] = useState([])',
      )

      if (!next.includes('const addTrack = (type) =>')) {
        replaceOnce(
          'add-track-handler',
          /(const toggleTrack = \(trackId, key\) => \{[\s\S]*?\n  \})/,
          `$1

  const addTrack = (type) => {
    setTracks((current) => {
      const result = addTimelineTrack(current, type)
      notify(\`Added \${result.track.id}\`)
      return result.tracks
    })
  }`,
        )
      } else {
        applied.add('add-track-handler')
      }

      if (!/onAddTrack=\{addTrack\}/.test(next)) {
        replaceOnce(
          'timeline-prop',
          /(\s+toggleTrack=\{toggleTrack\}\s*\n)(\s+onClipSelect=\{onClipSelect\})/,
          '$1          onAddTrack={addTrack}\n$2',
        )
      } else {
        applied.add('timeline-prop')
      }

      if (!/function Timeline\(\{[^}]*onAddTrack/.test(next)) {
        replaceOnce(
          'timeline-signature',
          /function Timeline\(\{([^}]*)toggleTrack,\s*onClipSelect,/,
          'function Timeline({$1toggleTrack, onAddTrack, onClipSelect,',
        )
      } else {
        applied.add('timeline-signature')
      }

      replaceOnce(
        'scrub-click-only',
        /  const scrubFromEvent = \(event\) => \{[\s\S]*?\n  \}\n\n  const onDragStart =/,
        `  const scrubFromEvent = (event) => {
    if (event.target.closest('.timeline-clip')) return
    if (event.button !== 0) return
    const startX = event.clientX
    const startY = event.clientY
    const pointerId = event.pointerId
    const clickTime = pointerToTime(event)

    const cleanup = () => {
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
    }
    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return
      cleanup()
      const moved = Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY)
      if (moved < 5) setPlayhead(clickTime)
    }
    const onCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return
      cleanup()
    }

    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
  }

  const onDragStart =`,
      )

      replaceOnce(
        'drag-snapshot',
        /  const onDragStart = \(event, clip\) => \{[\s\S]*?\n  \}\n\n  const onDrop =/,
        `  const onDragStart = (event, clip) => {
    const track = tracks.find((item) => item.id === clip.trackId)
    if (track?.locked) {
      event.preventDefault()
      notify(\`\${clip.trackId} is locked\`)
      return
    }

    const domSelectedIds = [...document.querySelectorAll('.timeline-clip.selected')]
      .map((node) => node.dataset.clipId)
      .filter(Boolean)
    const dragSelection = domSelectedIds.includes(clip.id) && domSelectedIds.length > 1
      ? domSelectedIds
      : (selectedClipIds.includes(clip.id) ? [...selectedClipIds] : [clip.id])

    const rect = event.currentTarget.getBoundingClientRect()
    dragInfoRef.current = {
      clipId: clip.id,
      offsetSeconds: (event.clientX - rect.left) / pixelsPerSecond,
      selectedIds: dragSelection,
    }
    if (!selectedClipIds.includes(clip.id) || selectedClipIds.length !== dragSelection.length) {
      setSelectedClipIds(dragSelection)
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', clip.id)
  }

  const onDrop =`,
      )

      replaceOnce(
        'group-drop',
        /    const offset = dragInfoRef\.current\?\.offsetSeconds \|\| 0\n    const nextStart = snapTime\(pointerToTime\(event\) - offset, clip\.id\)\n    commitClips\(\(current\) => current\.map\(\(item\) => item\.id === clip\.id[\s\S]*?    notify\(`Moved to \$\{trackId\}`\)/,
        `    const offset = dragInfoRef.current?.offsetSeconds || 0
    const nextStart = snapTime(pointerToTime(event) - offset, clip.id)
    const idsToMove = dragInfoRef.current?.selectedIds?.length
      ? [...dragInfoRef.current.selectedIds]
      : (selectedClipIds.includes(clip.id) ? [...selectedClipIds] : [clip.id])

    commitClips((current) => moveSelectedClips({
      clips: current,
      selectedIds: idsToMove,
      anchorId: clip.id,
      targetTrackId: trackId,
      tracks,
      requestedAnchorStart: nextStart,
      timelineSeconds: TIMELINE_SECONDS,
    }))
    dragInfoRef.current = null
    setSelectedClipIds(idsToMove)
    notify(idsToMove.length > 1 ? \`Moved \${idsToMove.length} selected clips\` : \`Moved to \${trackId}\`)`,
      )

      if (!/data-clip-id=\{clip\.id\}/.test(next)) {
        replaceOnce(
          'clip-data-id',
          /(\s+key=\{clip\.id\}\s*\n)(\s+draggable)/,
          '$1                    data-clip-id={clip.id}\n$2',
        )
      } else {
        applied.add('clip-data-id')
      }

      if (!/timeline-track-add/.test(next)) {
        replaceOnce(
          'track-add-ui',
          /<div className="ruler-spacer"\s*\/>/,
          '<div className="ruler-spacer timeline-track-add"><button type="button" title="Add video track" onClick={() => onAddTrack?.(\'video\')}>+V</button><button type="button" title="Add audio track" onClick={() => onAddTrack?.(\'audio\')}>+A</button></div>',
        )
      } else {
        applied.add('track-add-ui')
      }

      const required = [
        'helpers-import',
        'add-track-handler',
        'timeline-prop',
        'timeline-signature',
        'scrub-click-only',
        'drag-snapshot',
        'group-drop',
        'clip-data-id',
        'track-add-ui',
      ]
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) {
        throw new Error(`Timeline refactor did not apply: ${missing.join(', ')}`)
      }

      return { code: next, map: null }
    },
  }
}
