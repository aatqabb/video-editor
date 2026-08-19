export function installTimelineScrubLock() {
  let blockedPointerId = null

  const onPointerDown = (event) => {
    const timeline = event.target?.closest?.('.timeline')
    if (!timeline) return

    // Dedicated playhead handles own their drag lifecycle. Never intercept their
    // pointermove events, otherwise the capture-phase scrub lock prevents the
    // React playhead drag handler from receiving movement at all.
    if (event.target?.closest?.('.ruler-playhead-head, .playhead-grab-handle')) {
      blockedPointerId = null
      return
    }

    if (event.target?.closest?.('.timeline-clip, .trim-handle, .timeline-marker')) return
    if (event.target?.closest?.('.time-ruler, .track-lane, .playhead')) {
      blockedPointerId = event.pointerId
    }
  }

  const onPointerMove = (event) => {
    if (blockedPointerId == null || event.pointerId !== blockedPointerId) return
    event.stopImmediatePropagation()
  }

  const release = (event) => {
    if (blockedPointerId == null) return
    if (event?.pointerId != null && event.pointerId !== blockedPointerId) return
    blockedPointerId = null
  }

  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointermove', onPointerMove, true)
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)

  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', release, true)
    window.removeEventListener('pointercancel', release, true)
  }
}
