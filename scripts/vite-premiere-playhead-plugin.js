export function premierePlayheadPlugin() {
  return {
    name: 'video-editor-premiere-playhead',
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

      replaceOnce(
        'premiere-scrub-handler',
        /  const scrubFromEvent = \(event\) => \{[\s\S]*?\n  \}\n\n  const onDragStart =/,
        `  const scrubFromEvent = (event) => {
    if (event.target.closest('.timeline-clip') || event.target.closest('.playhead-grab-handle')) return
    if (event.button !== 0) return

    const startX = event.clientX
    const startY = event.clientY
    const pointerId = event.pointerId
    const clickTime = pointerToTime(event)

    const cleanupClick = () => {
      window.removeEventListener('pointerup', onClickUp, true)
      window.removeEventListener('pointercancel', onClickCancel, true)
    }
    const onClickUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return
      cleanupClick()
      const moved = Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY)
      if (moved < 5) setPlayhead(clickTime)
    }
    const onClickCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return
      cleanupClick()
    }

    window.addEventListener('pointerup', onClickUp, true)
    window.addEventListener('pointercancel', onClickCancel, true)
  }

  const startPlayheadDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const captureTarget = event.currentTarget
    const pointerId = event.pointerId
    let latestX = event.clientX
    let frame = 0

    captureTarget.setPointerCapture?.(pointerId)
    document.body.classList.add('timeline-playhead-dragging')

    const applyPosition = () => {
      frame = 0
      setPlayhead(pointerToTime({ clientX: latestX }))
    }
    const schedulePosition = (clientX) => {
      latestX = clientX
      if (!frame) frame = window.requestAnimationFrame(applyPosition)
    }
    const cleanupDrag = (finalEvent, commitFinal = true) => {
      if (finalEvent.pointerId !== pointerId) return
      if (frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
      if (commitFinal) {
        latestX = finalEvent.clientX
        setPlayhead(pointerToTime({ clientX: latestX }))
      }
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
      document.body.classList.remove('timeline-playhead-dragging')
      try { captureTarget.releasePointerCapture?.(pointerId) } catch { /* capture may already be released */ }
    }
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      moveEvent.preventDefault()
      schedulePosition(moveEvent.clientX)
    }
    const onUp = (upEvent) => cleanupDrag(upEvent, true)
    const onCancel = (cancelEvent) => cleanupDrag(cancelEvent, false)

    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
  }

  const onDragStart =`,
      )

      replaceOnce(
        'premiere-playhead-handle',
        /<div className="playhead" style=\{\{ left: playhead \* pixelsPerSecond \}\} onPointerDown=\{scrubFromEvent\} \/>/,
        '<div className="playhead" style={{ left: playhead * pixelsPerSecond }} onPointerDown={startPlayheadDrag}><button type="button" className="playhead-grab-handle" aria-label="Drag playhead" title="Drag playhead" /></div>',
      )

      const required = ['premiere-scrub-handler', 'premiere-playhead-handle']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Premiere playhead refactor did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
