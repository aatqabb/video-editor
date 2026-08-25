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

      const oldResizeBlock = `  const startVerticalResize = (side, event) => {
    event.preventDefault()
    const startX = event.clientX
    const startLeft = leftWidth
    const startRight = rightWidth

    const onMove = (moveEvent) => {
      const width = editorRef.current?.getBoundingClientRect().width || window.innerWidth
      const delta = ((moveEvent.clientX - startX) / width) * 100
      if (side === 'left') setLeftWidth(Math.min(48, Math.max(18, startLeft + delta)))
      if (side === 'right') setRightWidth(Math.min(48, Math.max(18, startRight - delta)))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startTimelineResize = (event) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = timelineHeight

    const onMove = (moveEvent) => {
      const delta = ((startY - moveEvent.clientY) / window.innerHeight) * 100
      setTimelineHeight(Math.min(70, Math.max(25, startHeight + delta)))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }`

      const newResizeBlock = `  const startVerticalResize = (side, event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
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
      if (frame) {
        window.cancelAnimationFrame(frame)
        apply()
      }
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
    event.stopPropagation()
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
      if (frame) {
        window.cancelAnimationFrame(frame)
        apply()
      }
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', cleanup, true)
      window.removeEventListener('pointercancel', cleanup, true)
      document.body.classList.remove('premiere-panel-resizing', 'premiere-panel-resizing-row')
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', cleanup, true)
    window.addEventListener('pointercancel', cleanup, true)
  }`

      if (!next.includes(oldResizeBlock)) throw new Error('Premiere panel resize could not find legacy resize handlers')
      next = next.replace(oldResizeBlock, newResizeBlock)
      next = next
        .replace("onMouseDown={(event) => startVerticalResize('left', event)}", "onPointerDown={(event) => startVerticalResize('left', event)}")
        .replace("onMouseDown={(event) => startVerticalResize('right', event)}", "onPointerDown={(event) => startVerticalResize('right', event)}")
        .replace('onMouseDown={startTimelineResize}', 'onPointerDown={startTimelineResize}')
        .replace(
          '<main className="workspace-shell">',
          '<main className="workspace-shell" style={{ gridTemplateRows: `minmax(120px, ${100 - timelineHeight}fr) 10px minmax(96px, ${timelineHeight}fr)` }}>',
        )
        .replace(
          '<section className="upper-workspace" style={{ height: `${100 - timelineHeight}%` }}>',
          '<section className="upper-workspace" style={{ gridTemplateColumns: `minmax(145px, ${leftWidth}fr) 10px minmax(220px, ${Math.max(1, 100 - leftWidth - rightWidth)}fr) 10px minmax(145px, ${rightWidth}fr)` }}>',
        )

      if (!next.includes('gridTemplateRows: `minmax(120px,')) throw new Error('Premiere panel resize could not bind timeline state to grid rows')
      if (!next.includes('gridTemplateColumns: `minmax(145px,')) throw new Error('Premiere panel resize could not bind panel state to grid columns')

      return next === code ? null : { code: next, map: null }
    },
  }
}
