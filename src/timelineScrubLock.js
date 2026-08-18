export function installTimelineScrubLock() {
  let blockDragScrub = false

  const onPointerDown = (event) => {
    const timeline = event.target?.closest?.('.timeline')
    if (!timeline) return
    if (event.target?.closest?.('.timeline-clip, .trim-handle, .timeline-marker')) return
    if (event.target?.closest?.('.time-ruler, .track-lane, .playhead')) {
      blockDragScrub = true
    }
  }

  const onPointerMove = (event) => {
    if (!blockDragScrub) return
    event.stopImmediatePropagation()
  }

  const release = () => { blockDragScrub = false }

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
