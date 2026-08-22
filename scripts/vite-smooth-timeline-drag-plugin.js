export function smoothTimelineDragPlugin() {
  return {
    name: 'video-editor-smooth-timeline-drag',
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

      if (!next.includes('const startClipPointerDrag = (event, clip) =>')) {
        replaceOnce(
          'pointer-drag-handler',
          /  const onDragStart = \(event, clip\) => \{/,
          `  const startClipPointerDrag = (event, clip) => {
    if (event.button !== 0 || event.target.closest('.trim-handle')) return
    const sourceTrack = tracks.find((item) => item.id === clip.trackId)
    if (sourceTrack?.locked) {
      event.preventDefault()
      notify(\`\${clip.trackId} is locked\`)
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY
    let latestX = startX
    let latestY = startY
    let moved = false
    let frame = 0

    // If the grabbed clip is already part of a multi-selection, drag that group.
    // Otherwise this is an explicit single-clip drag and stale selections are cleared.
    const idsToMove = selectedClipIds.includes(clip.id) && selectedClipIds.length > 1
      ? [...selectedClipIds]
      : [clip.id]
    if (idsToMove.length === 1) setSelectedClipIds([clip.id])

    const nodes = idsToMove
      .map((clipId) => document.querySelector(\`.timeline-clip[data-clip-id="\${CSS.escape(clipId)}"]\`))
      .filter(Boolean)

    const resolveLane = (x, y) => {
      nodes.forEach((node) => { node.style.pointerEvents = 'none' })
      const lane = document.elementFromPoint(x, y)?.closest?.('.track-lane') || null
      nodes.forEach((node) => { node.style.pointerEvents = '' })
      return lane
    }

    const clearPreview = () => {
      nodes.forEach((node) => {
        node.style.removeProperty('transform')
        node.style.removeProperty('will-change')
        node.style.removeProperty('z-index')
        node.style.removeProperty('pointer-events')
      })
      document.querySelectorAll('.track-lane.timeline-drag-target').forEach((lane) => lane.classList.remove('timeline-drag-target'))
    }

    const paint = () => {
      frame = 0
      const dx = latestX - startX
      const dy = latestY - startY
      nodes.forEach((node) => {
        node.style.transform = \`translate3d(\${dx}px, \${dy}px, 0)\`
        node.style.willChange = 'transform'
        node.style.zIndex = '95'
      })
      document.querySelectorAll('.track-lane.timeline-drag-target').forEach((lane) => lane.classList.remove('timeline-drag-target'))
      const lane = resolveLane(latestX, latestY)
      const track = tracks.find((item) => item.id === lane?.dataset?.trackId)
      if (lane && track && !track.locked && track.type === clip.type) lane.classList.add('timeline-drag-target')
    }

    const onMove = (moveEvent) => {
      latestX = moveEvent.clientX
      latestY = moveEvent.clientY
      if (Math.hypot(latestX - startX, latestY - startY) > 2) moved = true
      moveEvent.preventDefault()
      if (!frame) frame = window.requestAnimationFrame(paint)
    }

    const cleanup = () => {
      if (frame) window.cancelAnimationFrame(frame)
      clearPreview()
      document.body.classList.remove('timeline-clip-dragging')
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
    }

    const commit = () => {
      if (!moved) return
      const dx = latestX - startX
      const lane = resolveLane(latestX, latestY)
      const candidate = tracks.find((item) => item.id === lane?.dataset?.trackId)
      // Horizontal movement must still commit even when elementFromPoint misses the lane.
      // Vertical reassignment happens only for a valid unlocked same-type lane.
      const targetTrackId = candidate && !candidate.locked && candidate.type === clip.type
        ? candidate.id
        : clip.trackId
      const requestedAnchorStart = snapTime(Math.max(0, clip.start + dx / pixelsPerSecond), clip.id)
      commitClips((current) => moveSelectedClips({
        clips: current,
        selectedIds: idsToMove,
        anchorId: clip.id,
        targetTrackId,
        tracks,
        requestedAnchorStart,
      }))
      setSelectedClipIds(idsToMove)
      notify(idsToMove.length > 1 ? \`Moved \${idsToMove.length} selected clips\` : \`Moved to \${targetTrackId}\`)
    }

    const onUp = (upEvent) => {
      latestX = upEvent.clientX
      latestY = upEvent.clientY
      cleanup()
      commit()
    }

    const onCancel = () => cleanup()

    document.body.classList.add('timeline-clip-dragging')
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
  }

  const onDragStart = (event, clip) => {`,
        )
      } else {
        applied.add('pointer-drag-handler')
      }

      replaceOnce(
        'disable-native-drag',
        /\n\s+draggable\n(\s+className=\{`timeline-clip)/,
        '\n                    draggable={false}\n$1',
      )

      replaceOnce(
        'pointer-down-wire',
        /onDragStart=\{\(event\) => onDragStart\(event, clip\)\}/,
        'onPointerDown={(event) => startClipPointerDrag(event, clip)}',
      )

      if (!/data-clip-id=\{clip\.id\}/.test(next)) {
        replaceOnce(
          'clip-data-id',
          /(className=\{`timeline-clip[^\n]+\n)(\s+style=)/,
          '$1                    data-clip-id={clip.id}\n$2',
        )
      } else {
        applied.add('clip-data-id')
      }

      if (!/data-track-id=\{track\.id\}/.test(next)) {
        replaceOnce(
          'track-data-id',
          /(<div className=\{`track-lane \$\{track\.locked \? 'locked' : ''\}`\})( style=\{\{ height: trackHeight \}\})/,
          '$1 data-track-id={track.id}$2',
        )
      } else {
        applied.add('track-data-id')
      }

      const required = ['pointer-drag-handler', 'disable-native-drag', 'pointer-down-wire', 'clip-data-id', 'track-data-id']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Smooth timeline drag refactor did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
