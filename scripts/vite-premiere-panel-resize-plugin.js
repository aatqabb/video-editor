export function premierePanelResizePlugin() {
  return {
    name: 'video-editor-premiere-panel-resize',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null
      let next = code
      if (!next.includes("import './PremierePanelResize.css'")) {
        next = next.replace("import './App.css'", "import './App.css'\nimport './PremierePanelResize.css'")
      }

      next = next.replace(
        /  const startVerticalResize = \(side, event\) => \{[\s\S]*?\n  \}\n\n  const startTimelineResize = \(event\) => \{[\s\S]*?\n  \}/,
        `  const startVerticalResize = (side, event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const workspace = event.currentTarget.closest('.upper-workspace')
    if (!workspace) return
    const rect = workspace.getBoundingClientRect()
    const startX = event.clientX
    const startLeft = leftWidth
    const startRight = rightWidth
    const minSide = Math.max(12, (145 / Math.max(1, rect.width)) * 100)
    const minCenter = Math.max(18, (220 / Math.max(1, rect.width)) * 100)
    let latestX = startX
    let frame = 0

    document.body.classList.add('premiere-panel-resizing', 'premiere-panel-resizing-col')
    const apply = () => {
      frame = 0
      const delta = ((latestX - startX) / Math.max(1, rect.width)) * 100
      if (side === 'left') {
        const maxLeft = Math.max(minSide, 100 - startRight - minCenter)
        setLeftWidth(Math.min(maxLeft, Math.max(minSide, startLeft + delta)))
      } else {
        const maxRight = Math.max(minSide, 100 - startLeft - minCenter)
        setRightWidth(Math.min(maxRight, Math.max(minSide, startRight - delta)))
      }
    }
    const onMove = (moveEvent) => {
      latestX = moveEvent.clientX
      if (!frame) frame = window.requestAnimationFrame(apply)
    }
    const cleanup = () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', cleanup, true)
      window.removeEventListener('pointercancel', cleanup, true)
      document.body.classList.remove('premiere-panel-resizing', 'premiere-panel-resizing-col')
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', cleanup, true)
    window.addEventListener('pointercancel', cleanup, true)
  }

  const startTimelineResize = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const shell = event.currentTarget.closest('.workspace-shell')
    if (!shell) return
    const rect = shell.getBoundingClientRect()
    const minTimeline = Math.max(11, (96 / Math.max(1, rect.height)) * 100)
    const maxTimeline = Math.min(82, 100 - (120 / Math.max(1, rect.height)) * 100)
    let latestY = event.clientY
    let frame = 0

    document.body.classList.add('premiere-panel-resizing', 'premiere-panel-resizing-row')
    const apply = () => {
      frame = 0
      const nextHeight = ((rect.bottom - latestY) / Math.max(1, rect.height)) * 100
      setTimelineHeight(Math.min(maxTimeline, Math.max(minTimeline, nextHeight)))
    }
    const onMove = (moveEvent) => {
      latestY = moveEvent.clientY
      if (!frame) frame = window.requestAnimationFrame(apply)
    }
    const cleanup = () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', cleanup, true)
      window.removeEventListener('pointercancel', cleanup, true)
      document.body.classList.remove('premiere-panel-resizing', 'premiere-panel-resizing-row')
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', cleanup, true)
    window.addEventListener('pointercancel', cleanup, true)
  }`,
      )

      next = next
        .replace("onMouseDown={(event) => startVerticalResize('left', event)}", "onPointerDown={(event) => startVerticalResize('left', event)}")
        .replace("onMouseDown={(event) => startVerticalResize('right', event)}", "onPointerDown={(event) => startVerticalResize('right', event)}")
        .replace('onMouseDown={startTimelineResize}', 'onPointerDown={startTimelineResize}')

      return next === code ? null : { code: next, map: null }
    },
  }
}
