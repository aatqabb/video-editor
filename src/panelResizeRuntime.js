const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function installPanelResizeRuntime() {
  let cleanupDrag = null

  const getLayout = (handle = null) => {
    const shell = handle?.closest?.('.workspace-shell') || document.querySelector('.workspace-shell')
    const upper = shell?.querySelector('.upper-workspace')
    const verticalHandles = upper ? [...upper.querySelectorAll('.resize-handle.vertical')] : []
    const horizontalHandle = shell?.querySelector('.resize-handle.horizontal')
    return { shell, upper, verticalHandles, horizontalHandle }
  }

  const endExistingDrag = () => {
    cleanupDrag?.()
    cleanupDrag = null
  }

  const onPointerDown = (event) => {
    const handle = event.target.closest?.('.resize-handle')
    if (!handle || event.button !== 0) return

    const { shell, upper, verticalHandles, horizontalHandle } = getLayout(handle)
    if (!shell || !upper || !horizontalHandle || verticalHandles.length < 2) return

    const isHorizontal = handle === horizontalHandle
    const verticalIndex = verticalHandles.indexOf(handle)
    if (!isHorizontal && verticalIndex < 0) return

    event.preventDefault()
    event.stopPropagation()
    endExistingDrag()

    document.body.classList.add('premiere-panel-resizing')
    document.body.classList.toggle('premiere-panel-resizing-row', isHorizontal)
    document.body.classList.toggle('premiere-panel-resizing-col', !isHorizontal)

    const shellRect = shell.getBoundingClientRect()
    const upperRect = upper.getBoundingClientRect()
    const rowHandle = horizontalHandle.getBoundingClientRect().height || 10
    const leftHandle = verticalHandles[0].getBoundingClientRect().width || 10
    const rightHandle = verticalHandles[1].getBoundingClientRect().width || 10
    const leftPanel = upper.querySelector('.left-panel')
    const rightPanel = upper.querySelector('.right-panel')
    const startLeft = leftPanel?.getBoundingClientRect().width || upperRect.width * .32
    const startRight = rightPanel?.getBoundingClientRect().width || upperRect.width * .33

    let latestX = event.clientX
    let latestY = event.clientY
    let frame = 0

    const apply = () => {
      frame = 0
      if (isHorizontal) {
        const maxUpper = Math.max(120, shellRect.height - rowHandle - 96)
        const nextUpper = clamp(latestY - shellRect.top - rowHandle / 2, 120, maxUpper)
        shell.style.gridTemplateRows = `${nextUpper}px ${rowHandle}px minmax(96px,1fr)`
        return
      }

      const usable = Math.max(1, upperRect.width - leftHandle - rightHandle)
      if (verticalIndex === 0) {
        const nextLeft = clamp(latestX - upperRect.left - leftHandle / 2, 145, Math.max(145, usable - startRight - 220))
        upper.style.gridTemplateColumns = `${nextLeft}px ${leftHandle}px minmax(220px,1fr) ${rightHandle}px ${startRight}px`
      } else {
        const nextRight = clamp(upperRect.right - latestX - rightHandle / 2, 145, Math.max(145, usable - startLeft - 220))
        upper.style.gridTemplateColumns = `${startLeft}px ${leftHandle}px minmax(220px,1fr) ${rightHandle}px ${nextRight}px`
      }
    }

    const onMove = (moveEvent) => {
      latestX = moveEvent.clientX
      latestY = moveEvent.clientY
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    const finish = () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
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
    cleanupDrag = finish
  }

  document.addEventListener('pointerdown', onPointerDown, true)

  return () => {
    endExistingDrag()
    document.removeEventListener('pointerdown', onPointerDown, true)
  }
}
