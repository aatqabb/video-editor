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
    if (event.target.closest('.timeline-clip') || event.target.closest('.ruler-playhead-head')) return
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

    const pointerId = event.pointerId
    let latestX = event.clientX
    let frame = 0
    let dragging = true

    document.body.classList.add('timeline-playhead-dragging')
    setPlayhead(pointerToTime({ clientX: latestX }))

    const applyPosition = () => {
      frame = 0
      if (!dragging) return
      setPlayhead(pointerToTime({ clientX: latestX }))
    }
    const schedulePosition = (clientX) => {
      latestX = clientX
      if (!frame) frame = window.requestAnimationFrame(applyPosition)
    }
    const cleanupDrag = (finalEvent, commitFinal = true) => {
      if (finalEvent.pointerId !== pointerId || !dragging) return
      dragging = false
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
    }
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId || !dragging) return
      moveEvent.preventDefault()
      moveEvent.stopPropagation()
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
        'premiere-ruler-ticks',
        /\{Array\.from\(\{ length: 13 \}, \(_, index\) => index \* 10\)\.map\(\(seconds\) => <span key=\{seconds\} style=\{\{ left: seconds \* pixelsPerSecond \}\}>\{formatShortTime\(seconds\)\}<\/span>\)\}/,
        `{Array.from({ length: timelineSeconds * 2 + 1 }, (_, index) => index / 2).map((seconds) => (
              <span
                className={\`ruler-tick \${Number.isInteger(seconds) && seconds % 10 === 0 ? 'major' : Number.isInteger(seconds) && seconds % 5 === 0 ? 'mid' : Number.isInteger(seconds) ? 'second' : 'minor'}\`}
                key={seconds}
                style={{ left: seconds * pixelsPerSecond }}
              >{Number.isInteger(seconds) && seconds % 10 === 0 ? formatShortTime(seconds) : ''}</span>
            ))}`,
      )

      replaceOnce(
        'premiere-ruler-head',
        /(<div className="time-ruler" style=\{\{ width: laneWidth \}\} onPointerDown=\{scrubFromEvent\}>)/,
        `$1
            <button
              type="button"
              className="ruler-playhead-head"
              style={{ left: playhead * pixelsPerSecond }}
              aria-label="Drag playhead"
              title="Drag playhead"
              onPointerDown={startPlayheadDrag}
            />`,
      )

      replaceOnce(
        'premiere-playhead-line',
        /<div className="playhead" style=\{\{ left: playhead \* pixelsPerSecond \}\} onPointerDown=\{scrubFromEvent\} \/>/,
        '<div className="playhead" style={{ left: playhead * pixelsPerSecond }} aria-hidden="true" />',
      )

      const required = ['premiere-scrub-handler', 'premiere-ruler-ticks', 'premiere-ruler-head', 'premiere-playhead-line']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Premiere playhead refactor did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}