import fs from 'node:fs'

const path = process.argv[2] || 'src/App.jsx'
let code = fs.readFileSync(path, 'utf8')

if (!code.includes("import ScriptWorkspace from './ScriptWorkspace'")) {
  code = code.replace("import './App.css'\n", "import './App.css'\nimport ScriptWorkspace from './ScriptWorkspace'\n")
}

if (!code.includes('const addStockToTimeline =')) {
  const marker = "  const startVerticalResize = (side, event) => {"
  const block = `  const addStockToTimeline = (result, sourceLineId, targetTrackId = 'V1', startAt = playhead) => {\n    const preferredTrack = tracks.find((track) => track.id === targetTrackId && track.type === 'video' && !track.locked)\n      || tracks.find((track) => track.type === 'video' && !track.locked)\n\n    if (!preferredTrack) return notify('Unlock a video track before importing stock footage')\n\n    const id = \`stock-\${result.provider.toLowerCase()}-\${result.sourceId}-\${Date.now()}\`\n    const duration = Math.max(2, Math.min(10, Number(result.duration) || 5))\n    const start = Math.max(0, Math.min(TIMELINE_SECONDS - duration, snapTime(startAt)))\n\n    commitClips((current) => [\n      ...current,\n      {\n        id,\n        trackId: preferredTrack.id,\n        name: \`\${result.provider}: \${result.title}\`,\n        type: 'video',\n        start,\n        duration,\n        color: result.provider === 'Pexels' ? 'cyan' : 'purple',\n        thumbnail: result.thumbnail,\n        remoteUrl: result.fileUrl,\n        pageUrl: result.pageUrl,\n        provider: result.provider,\n        stockId: result.sourceId,\n        sourceLineId,\n      },\n    ])\n    setSelectedClipIds([id])\n    notify(\`\${result.provider} video added to \${preferredTrack.id}\`)\n  }\n\n`
  if (!code.includes(marker)) throw new Error('Could not find startVerticalResize insertion point')
  code = code.replace(marker, block + marker)
}

const scriptBranch = /    if \(centerTab === 'Script'\) \{[\s\S]*?\n    \}\n    if \(centerTab === 'Stock'\)/
if (!code.includes('<ScriptWorkspace')) {
  if (!scriptBranch.test(code)) throw new Error('Could not find Script branch')
  code = code.replace(scriptBranch, `    if (centerTab === 'Script') {\n      return (\n        <ScriptWorkspace\n          notify={notify}\n          onImportStock={(result, lineId) => addStockToTimeline(result, lineId)}\n        />\n      )\n    }\n    if (centerTab === 'Stock')`)
}

if (!code.includes('onStockDrop={(result, trackId, startAt)')) {
  const timelineProps = '          pushHistory={pushHistory}\n        />'
  if (!code.includes(timelineProps)) throw new Error('Could not find Timeline props insertion point')
  code = code.replace(timelineProps, `          pushHistory={pushHistory}\n          onStockDrop={(result, trackId, startAt) => addStockToTimeline(result, result.sourceLineId, trackId, startAt)}\n        />`)
}

if (!/function Timeline\(\{[^}]*\bonStockDrop\b/.test(code)) {
  const compactSignature = 'notify, pushHistory }) {'
  if (!code.includes(compactSignature)) throw new Error('Could not find Timeline signature insertion point')
  code = code.replace(compactSignature, 'notify, pushHistory, onStockDrop }) {')
}

if (!code.includes("application/x-video-editor-stock")) {
  const dropBlock = /  const onDrop = \(event, trackId\) => \{[\s\S]*?\n  \}\n\n  const startTrim =/
  if (!dropBlock.test(code)) throw new Error('Could not find onDrop block')
  const replacement = `  const onDrop = (event, trackId) => {\n    event.preventDefault()\n    const targetTrack = tracks.find((track) => track.id === trackId)\n    if (targetTrack?.locked) return notify(\`\${trackId} is locked\`)\n\n    const stockPayload = event.dataTransfer.getData('application/x-video-editor-stock')\n    if (stockPayload) {\n      if (targetTrack?.type !== 'video') return notify('Stock video can only be dropped on a video track')\n      try {\n        const result = JSON.parse(stockPayload)\n        onStockDrop(result, trackId, pointerToTime(event))\n      } catch {\n        notify('Could not read stock video data')\n      }\n      return\n    }\n\n    const clipId = event.dataTransfer.getData('text/plain') || dragInfoRef.current?.clipId\n    const clip = clips.find((item) => item.id === clipId)\n    if (!clip) return\n\n    const isCompatible = clip.type === targetTrack.type\n    if (!isCompatible) return notify(\`Drop \${clip.type} clips on \${clip.type} tracks\`)\n\n    const offset = dragInfoRef.current?.offsetSeconds || 0\n    const nextStart = snapTime(pointerToTime(event) - offset, clip.id)\n    commitClips((current) => current.map((item) => item.id === clip.id\n      ? { ...item, trackId, start: Math.max(0, Math.min(TIMELINE_SECONDS - item.duration, nextStart)) }\n      : item))\n    setSelectedClipIds([clip.id])\n    notify(\`Moved to \${trackId}\`)\n  }\n\n  const startTrim =`
  code = code.replace(dropBlock, replacement)
}

if (!code.includes('className="clip-thumbnail-strip"')) {
  const clipName = '                    <span className="clip-name">{clip.name}</span>'
  if (!code.includes(clipName)) throw new Error('Could not find clip name render point')
  code = code.replace(clipName, `                    {clip.thumbnail && <span className="clip-thumbnail-strip" style={{ backgroundImage: \`url(\${clip.thumbnail})\` }} aria-hidden="true" />}\n                    <span className="clip-name">{clip.name}</span>`)
}

fs.writeFileSync(path, code)
console.log(`Patched ${path}`)
