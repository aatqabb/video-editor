function intersects(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
}

function makeSelectionBox() {
  const box = document.createElement('div')
  box.className = 'timeline-selection-marquee'
  box.setAttribute('aria-hidden', 'true')
  document.body.appendChild(box)
  return box
}

export function installTimelineSelectionEnhancer() {
  let drag = null

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    const lanes = event.target.closest('.track-lanes')
    if (!lanes) return
    if (event.target.closest('.timeline-clip, .playhead, .timeline-marker, button, input')) return

    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      active: false,
      box: null,
    }
  }

  const onPointerMove = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    drag.currentX = event.clientX
    drag.currentY = event.clientY

    const moved = Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY)
    if (!drag.active && moved < 5) return
    if (!drag.active) {
      drag.active = true
      drag.box = makeSelectionBox()
      document.body.classList.add('timeline-marquee-active')
    }

    const left = Math.min(drag.startX, drag.currentX)
    const top = Math.min(drag.startY, drag.currentY)
    const width = Math.abs(drag.currentX - drag.startX)
    const height = Math.abs(drag.currentY - drag.startY)
    Object.assign(drag.box.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })
  }

  const finish = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const current = drag
    drag = null

    if (current.active) {
      const selectionRect = {
        left: Math.min(current.startX, current.currentX),
        right: Math.max(current.startX, current.currentX),
        top: Math.min(current.startY, current.currentY),
        bottom: Math.max(current.startY, current.currentY),
      }
      const clips = [...document.querySelectorAll('.timeline-clip')]
        .filter((clip) => intersects(selectionRect, clip.getBoundingClientRect()))

      if (clips.length) {
        clips[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        clips.slice(1).forEach((clip) => clip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })))
      }
    }

    current.box?.remove()
    document.body.classList.remove('timeline-marquee-active')
  }

  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointermove', onPointerMove, true)
  window.addEventListener('pointerup', finish, true)
  window.addEventListener('pointercancel', finish, true)

  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', finish, true)
    window.removeEventListener('pointercancel', finish, true)
    document.querySelector('.timeline-selection-marquee')?.remove()
    document.body.classList.remove('timeline-marquee-active')
  }
}
