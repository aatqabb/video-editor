const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function installPanelResizeRuntime() {
  let cleanupDrag = null

  const endExistingDrag = () => {
    cleanupDrag?.()
    cleanupDrag = null
  }

  const onPointerDown = (event) => {
    const handle = event.target.closest?.('.resize-handle')
    if (!handle || event.button !== 0) return

    const shell = handle.closest('.workspace-shell')
    const upper = shell?.querySelector('.upper-workspace')
    const timeline = shell?.querySelector('.timeline')
    if (!shell || !upper || !timeline) return

    event.preventDefault()
    event.stopPropagation()
    endExistingDrag()

    const shellRect = shell.getBoundingClientRect()
    const upperRect = upper.getBoundingClientRect()
    const verticalHandles = [...upper.querySelectorAll('.resize-handle.vertical')]
    const leftPanel = upper.querySelector('.left-panel')
    const rightPanel = upper.querySelector('.right-panel')
    const centerPanel = upper.querySelector('.center-panel')

    document.body.classList.add('premiere-panel-resizing')

    let latestX = event.clientX
    let latestY = event.clientY
    let raf = 0

    const apply = () => {
      raf = 0

      if (handle.classList.contains('horizontal')) {
        const minTimelinePx = 96
        const minUpperPx = 120
        const minTimelinePct = (minTimelinePx / Math.max(1, shellRect.height)) * 100
        const maxTimelinePct = 100 - (minUpperPx / Math.max(1, shellRect.height)) * 100
        const nextTimelinePct = clamp(((shellRect.bottom - latestY) / Math.max(1, shellRect.height)) * 100, minTimelinePct, maxTimelinePct)
        shell.style.setProperty('--runtime-timeline-height', `${nextTimelinePct}%`)
        shell.style.setProperty('--runtime-upper-height', `${100 - nextTimelinePct}%`)
        return
      }

      if (!leftPanel || !rightPanel || !centerPanel || verticalHandles.length < 2) return

      const minSidePx = 145
      const minCenterPx = 220
      const minSidePct = (minSidePx / Math.max(1, upperRect.width)) * 100
      const minCenterPct = (minCenterPx / Math.max(1, upperRect.width)) * 100
      const currentLeftPct = (leftPanel.getBoundingClientRect().width / Math.max(1, upperRect.width)) * 100
      const currentRightPct = (rightPanel.getBoundingClientRect().width / Math.max(1, upperRect.width)) * 100

      if (handle === verticalHandles[0]) {
        const pointerPct = ((latestX - upperRect.left) / Math.max(1, upperRect.width)) * 100
        const maxLeftPct = 100 - currentRightPct - minCenterPct
        shell.style.setProperty('--runtime-left-width', `${clamp(pointerPct, minSidePct, maxLeftPct)}%`)
      } else if (handle === verticalHandles[1]) {
        const pointerFromRightPct = ((upperRect.right - latestX) / Math.max(1, upperRect.width)) * 100
        const maxRightPct = 100 - currentLeftPct - minCenterPct
        shell.style.setProperty('--runtime-right-width', `${clamp(pointerFromRightPct, minSidePct, maxRightPct)}%`)
      }
    }

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(apply)
    }

    const onMove = (moveEvent) => {
      latestX = moveEvent.clientX
      latestY = moveEvent.clientY
      schedule()
    }

    const finish = () => {
      if (raf) {
        window.cancelAnimationFrame(raf)
        apply()
      }
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', finish, true)
      document.body.classList.remove('premiere-panel-resizing')
      cleanupDrag = null
    }

    document.body.classList.toggle('premiere-panel-resizing-row', handle.classList.contains('horizontal'))
    document.body.classList.toggle('premiere-panel-resizing-col', handle.classList.contains('vertical'))

    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', finish, true)

    cleanupDrag = () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', finish, true)
      document.body.classList.remove('premiere-panel-resizing', 'premiere-panel-resizing-row', 'premiere-panel-resizing-col')
    }
  }

  document.addEventListener('pointerdown', onPointerDown, true)

  return () => {
    endExistingDrag()
    document.removeEventListener('pointerdown', onPointerDown, true)
  }
}
