const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function installPanelResizeRuntime() {
  let cleanupDrag = null
  let saved = null

  const endExistingDrag = () => {
    cleanupDrag?.()
    cleanupDrag = null
  }

  const getLayout = (handle) => {
    const shell = handle?.closest('.workspace-shell')
    const upper = shell?.querySelector('.upper-workspace')
    const timeline = shell?.querySelector('.timeline')
    const leftPanel = upper?.querySelector('.left-panel')
    const centerPanel = upper?.querySelector('.center-panel')
    const rightPanel = upper?.querySelector('.right-panel')
    const verticalHandles = upper ? [...upper.querySelectorAll('.resize-handle.vertical')] : []
    const horizontalHandle = shell?.querySelector('.resize-handle.horizontal')
    return { shell, upper, timeline, leftPanel, centerPanel, rightPanel, verticalHandles, horizontalHandle }
  }

  const applySaved = () => {
    if (!saved) return
    const horizontal = document.querySelector('.workspace-shell > .resize-handle.horizontal')
    const { shell, upper, timeline, leftPanel, rightPanel } = getLayout(horizontal)
    if (!shell || !upper || !timeline || !leftPanel || !rightPanel) return
    if (saved.upperHeight != null) upper.style.setProperty('height', `${saved.upperHeight}px`, 'important')
    if (saved.timelineHeight != null) timeline.style.setProperty('height', `${saved.timelineHeight}px`, 'important')
    if (saved.leftWidth != null) leftPanel.style.setProperty('width', `${saved.leftWidth}px`, 'important')
    if (saved.rightWidth != null) rightPanel.style.setProperty('width', `${saved.rightWidth}px`, 'important')
  }

  const onPointerDown = (event) => {
    const handle = event.target.closest?.('.resize-handle')
    if (!handle || event.button !== 0) return

    const { shell, upper, timeline, leftPanel, centerPanel, rightPanel, verticalHandles } = getLayout(handle)
    if (!shell || !upper || !timeline) return

    event.preventDefault()
    event.stopPropagation()
    endExistingDrag()

    const shellRect = shell.getBoundingClientRect()
    const upperRect = upper.getBoundingClientRect()
    const handleRect = handle.getBoundingClientRect()
    const horizontal = handle.classList.contains('horizontal')
    const vertical = handle.classList.contains('vertical')
    const verticalIndex = verticalHandles.indexOf(handle)
    const minTimeline = 96
    const minUpper = 120
    const minSide = 145
    const minCenter = 220

    document.body.classList.add('premiere-panel-resizing')
    document.body.classList.toggle('premiere-panel-resizing-row', horizontal)
    document.body.classList.toggle('premiere-panel-resizing-col', vertical)

    let latestX = event.clientX
    let latestY = event.clientY
    let raf = 0

    const apply = () => {
      raf = 0

      if (horizontal) {
        const availableHeight = Math.max(1, shellRect.height - handleRect.height)
        const nextTimeline = clamp(shellRect.bottom - latestY - handleRect.height / 2, minTimeline, Math.max(minTimeline, availableHeight - minUpper))
        const nextUpper = Math.max(minUpper, availableHeight - nextTimeline)

        upper.style.setProperty('height', `${nextUpper}px`, 'important')
        timeline.style.setProperty('height', `${nextTimeline}px`, 'important')
        shell.style.removeProperty('--runtime-upper-height')
        shell.style.removeProperty('--runtime-timeline-height')
        saved = { ...(saved || {}), upperHeight: nextUpper, timelineHeight: nextTimeline }
        return
      }

      if (!vertical || !leftPanel || !centerPanel || !rightPanel || verticalHandles.length < 2) return

      const firstHandleWidth = verticalHandles[0]?.getBoundingClientRect().width || 0
      const secondHandleWidth = verticalHandles[1]?.getBoundingClientRect().width || 0
      const availableWidth = Math.max(1, upperRect.width - firstHandleWidth - secondHandleWidth)
      const currentLeft = leftPanel.getBoundingClientRect().width
      const currentRight = rightPanel.getBoundingClientRect().width

      if (verticalIndex === 0) {
        const desiredLeft = latestX - upperRect.left - firstHandleWidth / 2
        const maxLeft = Math.max(minSide, availableWidth - currentRight - minCenter)
        const nextLeft = clamp(desiredLeft, minSide, maxLeft)
        leftPanel.style.setProperty('width', `${nextLeft}px`, 'important')
        shell.style.removeProperty('--runtime-left-width')
        saved = { ...(saved || {}), leftWidth: nextLeft }
      } else if (verticalIndex === 1) {
        const desiredRight = upperRect.right - latestX - secondHandleWidth / 2
        const maxRight = Math.max(minSide, availableWidth - currentLeft - minCenter)
        const nextRight = clamp(desiredRight, minSide, maxRight)
        rightPanel.style.setProperty('width', `${nextRight}px`, 'important')
        shell.style.removeProperty('--runtime-right-width')
        saved = { ...(saved || {}), rightWidth: nextRight }
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
      document.body.classList.remove('premiere-panel-resizing', 'premiere-panel-resizing-row', 'premiere-panel-resizing-col')
      cleanupDrag = null
    }

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

  const observer = new MutationObserver(() => {
    if (!saved) return
    window.requestAnimationFrame(applySaved)
  })
  observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })

  return () => {
    endExistingDrag()
    observer.disconnect()
    document.removeEventListener('pointerdown', onPointerDown, true)
  }
}
