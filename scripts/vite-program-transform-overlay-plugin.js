export function programTransformOverlayPlugin() {
  return {
    name: 'program-transform-overlay',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('src/App.jsx')) return null
      let next = code
      next = next.replace("import './App.css'", "import './App.css'\nimport './ProgramTransformOverlay.css'")

      const monitorCallPattern = /<Monitor\s+playing=\{playing\}\s+setPlaying=\{setPlaying\}\s+notify=\{notify\}\s+timelineClips=\{clips\}([^>]*)\/>/
      const monitorMatch = next.match(monitorCallPattern)
      if (!monitorMatch) throw new Error('Program transform overlay could not find Program Monitor call')
      if (!monitorMatch[0].includes('selectedClipIds={selectedClipIds}')) {
        const selectedMonitorCall = monitorMatch[0].replace(
          ' />',
          ' selectedClipIds={selectedClipIds} setSelectedClipIds={setSelectedClipIds} updateClipControls={updateClipControls} />',
        )
        next = next.replace(monitorMatch[0], selectedMonitorCall)
      }

      const monitorSignaturePattern = /function Monitor\(\{\s*playing,\s*setPlaying,\s*notify,\s*empty = false,\s*timelineClips = \[\],([\s\S]*?)projectSettings = \{ width: 1920, height: 1080 \}\s*\}\) \{/
      const signatureMatch = next.match(monitorSignaturePattern)
      if (!signatureMatch) throw new Error('Program transform overlay could not find Monitor signature')
      if (!signatureMatch[0].includes('selectedClipIds = []')) {
        const selectionSignature = signatureMatch[0].replace(
          ' }) {',
          ', selectedClipIds = [], setSelectedClipIds = () => {}, updateClipControls = () => {} }) {',
        )
        next = next.replace(signatureMatch[0], selectionSignature)
      }

      if (!next.includes('const activeVideoSelected = Boolean(')) {
        const activeVideoPattern = /(  const activeVideo = [^\n]+\n)/
        const activeVideoMatch = next.match(activeVideoPattern)
        if (!activeVideoMatch) throw new Error('Program transform overlay could not find active Program video')
        next = next.replace(
          activeVideoMatch[0],
          `${activeVideoMatch[0]}  const activeVideoSelected = Boolean(activeVideo && selectedClipIds.includes(activeVideo.id))\n`,
        )
      }

      next = next.replace(
        '  } : undefined\n\n  return (',
        `  } : undefined\n\n  const selectActiveVideo = (event) => {\n    event.stopPropagation()\n    if (activeVideo) setSelectedClipIds([activeVideo.id])\n  }\n\n  const startProgramResize = (event, corner) => {\n    event.preventDefault()\n    event.stopPropagation()\n    if (!activeVideo) return\n    if (!activeVideoSelected) setSelectedClipIds([activeVideo.id])\n    const layer = event.currentTarget.closest('.program-video-layer')\n    const screen = event.currentTarget.closest('.monitor-screen')\n    if (!layer || !screen) return\n    const startScale = Math.max(1, Number(videoControls.scale) || 100)\n    const startX = event.clientX\n    const startY = event.clientY\n    const rect = screen.getBoundingClientRect()\n    const dirX = corner.includes('right') ? 1 : -1\n    const dirY = corner.includes('bottom') ? 1 : -1\n    const onMove = (moveEvent) => {\n      const dx = (moveEvent.clientX - startX) * dirX\n      const dy = (moveEvent.clientY - startY) * dirY\n      const delta = ((dx / Math.max(1, rect.width)) + (dy / Math.max(1, rect.height))) * 50\n      const scale = Math.max(5, Math.min(400, startScale + delta))\n      layer.style.width = scale + '%'\n      layer.style.height = scale + '%'\n      layer.dataset.liveScale = String(scale)\n      const label = layer.querySelector('.program-transform-size')\n      if (label) label.textContent = Math.round(scale) + '%'\n    }\n    const onUp = () => {\n      window.removeEventListener('pointermove', onMove)\n      window.removeEventListener('pointerup', onUp)\n      const scale = Number(layer.dataset.liveScale) || startScale\n      delete layer.dataset.liveScale\n      updateClipControls(activeVideo.id, { video: { scale: Math.round(scale * 10) / 10 } })\n    }\n    window.addEventListener('pointermove', onMove)\n    window.addEventListener('pointerup', onUp)\n  }\n\n  return (`,
      )
      next = next.replace(
        '<div className="program-video-layer" style={programVideoStyle}>',
        `<div className={'program-video-layer ' + (activeVideoSelected ? 'program-video-selected' : '')} style={programVideoStyle} onPointerDown={selectActiveVideo}>\n            {activeVideoSelected && <div className="program-transform-box" onPointerDown={(event) => event.stopPropagation()}>\n              <span className="program-transform-size">{Math.round(Number(videoControls.scale) || 100)}%</span>\n              <button className="program-resize-handle top-left" onPointerDown={(event) => startProgramResize(event, 'top-left')} />\n              <button className="program-resize-handle top-right" onPointerDown={(event) => startProgramResize(event, 'top-right')} />\n              <button className="program-resize-handle bottom-left" onPointerDown={(event) => startProgramResize(event, 'bottom-left')} />\n              <button className="program-resize-handle bottom-right" onPointerDown={(event) => startProgramResize(event, 'bottom-right')} />\n            </div>}`,
      )
      return next === code ? null : { code: next, map: null }
    },
  }
}
