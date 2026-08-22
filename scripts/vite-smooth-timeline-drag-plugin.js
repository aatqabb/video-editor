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

    const groupModifier = event.ctrlKey || event.metaKey || event.shiftKey
    const idsToMove = groupModifier && selectedClipIds.includes(clip.id) && selectedClipIds.length > 1
      ? [...selectedClipIds]
      : [clip.id]
    if (!groupModifier) setSelectedClipIds([clip.id])
    else if (!selectedClipIds.includes(clip.id)) setSelectedClipIds([clip.id])

    const nodes = idsToMove
      .map((id) => document.querySelector(\`.timeline-clip[data-clip-id="\${CSS.escape(id)}"]\`))
      .filter(Boolean)

    const clearPreview = () => {
      nodes.forEach((node) => {
        node.style.removeProperty('transform')
        node.style.removeProperty('will-change')
        node.style.removeProperty('z-index')
        node.style.removeProperty('pointer-events')
      })
      document.querySelectorAll('.track-lane.timeline-drag-target').forEach((lane) => lane.classList.remove('timeline-drag-target'))
    }

    const resolveTargetTrack = (x, y) => {
      nodes.forEach((node) => { node.style.pointerEvents = 'none' })
      const lane = document.elementFromPoint(x, y)?.closest?.('.track-lane')
      nodes.forEach((node) => { node.style.pointerEvents = '' })
      const trackId = lane?.dataset?.trackId || clip.trackId
      const track = tracks.find((item) => item.id === trackId)
      const valid = Boolean(track && !track.locked && track.type === clip.type)
      return { lane, track, trackId: valid ? trackId : clip.trackId, valid }
    }

    const paintPreview = () => {
      frame = 0
      const dx = latestX - startX
      const dy = latestY - startY
      nodes.forEach((node) => {
        node.style.transform = \`translate3d(\${dx}px, \${dy}px, 0)\`
        node.style.willChange = 'transform'
        node.style.zIndex = '95'
      })

      document.querySelectorAll('.track-lane.timeline-drag-target').forEach((lane) => lane.classList.remove('timeline-drag-target'))
      const target = resolveTargetTrack(latestX, latestY)
      if (target.valid && target.lane) target.lane.classList.add('timeline-drag-target')
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
      document.removeEventListener('pointermove', onMove, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('pointercancel', onCancel, true)
      captureTarget.removeEventListener('pointermove', onMove, true)
      captureTarget.removeEventListener('lostpointercapture', onLostCapture, true)
      try { captureTarget.releasePointerCapture?.(pointerId) } catch { /* capture may already be gone */ }
    }

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      moveEvent.preventDefault()
      moveEvent.stopPropagation()
      schedulePreview(moveEvent)
    }

    const commitAt = (clientX, clientY) => {
      const dx = clientX - startX
      const target = resolveTargetTrack(clientX, clientY)
      if (!target.valid) {
        const targetTrackId = target.lane?.dataset?.trackId
        const targetTrack = tracks.find((track) => track.id === targetTrackId)
        notify(targetTrack?.locked ? \`\${targetTrackId} is locked\` : \`Drop \${clip.type} clips on \${clip.type} tracks\`)
        return
      }

      const requestedAnchorStart = snapTime(Math.max(0, clip.start + dx / pixelsPerSecond), clip.id)
      commitClips((current) => moveSelectedClips({
        clips: current,
        selectedIds: idsToMove,
        anchorId: clip.id,
        targetTrackId: target.track.id,
        tracks,
        requestedAnchorStart,
      }))
      setSelectedClipIds(idsToMove)
      notify(idsToMove.length > 1 ? \`Moved \${idsToMove.length} selected clips\` : \`Moved to \${target.track.id}\`)
    }

    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return
      latestX = upEvent.clientX
      latestY = upEvent.clientY
      const shouldCommit = moved
      cleanup()
      if (shouldCommit) commitAt(latestX, latestY)
    }

    const onCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return
      cleanup()
    }

    const onLostCapture = (lostEvent) => {
      if (lostEvent.pointerId !== pointerId) return
      const shouldCommit = moved
      cleanup()
      if (shouldCommit) commitAt(latestX, latestY)
    }

    try { captureTarget.setPointerCapture?.(pointerId) } catch { /* document listeners are the fallback */ }
    document.body.classList.add('timeline-clip-dragging')
    captureTarget.addEventListener('pointermove', onMove, true)
    captureTarget.addEventListener('lostpointercapture', onLostCapture, true)
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('pointercancel', onCancel, true)
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
