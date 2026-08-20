export function smoothTimelineDragPlugin() {
  return {
    name: 'video-editor-smooth-timeline-drag',
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

    const pointerId = event.pointerId
    const captureTarget = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    let latestX = startX
    let latestY = startY
    let frame = 0
    let moved = false

    const idsToMove = selectedClipIds.includes(clip.id) ? [...selectedClipIds] : [clip.id]
    if (!selectedClipIds.includes(clip.id)) setSelectedClipIds([clip.id])

    const nodes = idsToMove
      .map((id) => document.querySelector(\`.timeline-clip[data-clip-id="\${CSS.escape(id)}"]\`))
      .filter(Boolean)

    const clearPreview = () => {
      nodes.forEach((node) => {
        node.style.removeProperty('transform')
        node.style.removeProperty('will-change')
        node.style.removeProperty('z-index')
      })
      document.querySelectorAll('.track-lane.timeline-drag-target').forEach((lane) => lane.classList.remove('timeline-drag-target'))
    }

    const paintPreview = () => {
      frame = 0
      const dx = latestX - startX
      const dy = latestY - startY
      nodes.forEach((node) => {
        node.style.transform = \`translate3d(\${dx}px, \${dy}px, 0)\`
        node.style.willChange = 'transform'
        node.style.zIndex = '90'
      })

      document.querySelectorAll('.track-lane.timeline-drag-target').forEach((lane) => lane.classList.remove('timeline-drag-target'))
      const lane = document.elementFromPoint(latestX, latestY)?.closest?.('.track-lane')
      if (lane) lane.classList.add('timeline-drag-target')
    }

    const schedulePreview = (moveEvent) => {
      latestX = moveEvent.clientX
      latestY = moveEvent.clientY
      if (Math.hypot(latestX - startX, latestY - startY) > 2) moved = true
      if (!frame) frame = window.requestAnimationFrame(paintPreview)
    }

    const cleanup = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      clearPreview()
      document.body.classList.remove('timeline-clip-dragging')
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
      try { captureTarget.releasePointerCapture?.(pointerId) } catch { /* pointer capture may already be released */ }
    }

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      moveEvent.preventDefault()
      schedulePreview(moveEvent)
    }

    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return
      latestX = upEvent.clientX
      latestY = upEvent.clientY
      const dx = latestX - startX
      const targetLane = document.elementFromPoint(latestX, latestY)?.closest?.('.track-lane')
      const targetTrackId = targetLane?.dataset?.trackId || clip.trackId
      cleanup()

      if (!moved) return

      const targetTrack = tracks.find((track) => track.id === targetTrackId)
      if (!targetTrack || targetTrack.locked || targetTrack.type !== clip.type) {
        notify(targetTrack?.locked ? \`\${targetTrackId} is locked\` : \`Drop \${clip.type} clips on \${clip.type} tracks\`)
        return
      }

      const requestedAnchorStart = snapTime(clip.start + dx / pixelsPerSecond, clip.id)
      commitClips((current) => moveSelectedClips({
        clips: current,
        selectedIds: idsToMove,
        anchorId: clip.id,
        targetTrackId,
        tracks,
        requestedAnchorStart,
        timelineSeconds: TIMELINE_SECONDS,
      }))
      setSelectedClipIds(idsToMove)
      notify(idsToMove.length > 1 ? \`Moved \${idsToMove.length} selected clips\` : \`Moved to \${targetTrackId}\`)
    }

    const onCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return
      cleanup()
    }

    captureTarget.setPointerCapture?.(pointerId)
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

      if (!/data-track-id=\{track\.id\}/.test(next)) {
        replaceOnce(
          'track-data-id',
          /(<div className=\{`track-lane \$\{track\.locked \? 'locked' : ''\}`\})( style=\{\{ height: trackHeight \}\})/,
          '$1 data-track-id={track.id}$2',
        )
      } else {
        applied.add('track-data-id')
      }

      const required = ['pointer-drag-handler', 'disable-native-drag', 'pointer-down-wire', 'track-data-id']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Smooth timeline drag refactor did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
