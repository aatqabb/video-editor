import fs from 'node:fs'

const path = process.argv[2] || 'src/App.jsx'
let code = fs.readFileSync(path, 'utf8')

if (!code.includes("import MediaLibrary from './MediaLibrary'")) {
  code = code.replace(
    "import ProjectWorkspace from './ProjectWorkspace'\n",
    "import ProjectWorkspace from './ProjectWorkspace'\nimport MediaLibrary from './MediaLibrary'\n",
  )
}

code = code.replace(/\nconst mediaItems = \[[\s\S]*?\n\]\n\nconst shortcutRows =/, '\nconst shortcutRows =')
code = code.replace("  const [selectedMedia, setSelectedMedia] = useState(4)\n", "  const [libraryItems, setLibraryItems] = useState([])\n")
code = code.replace("  const fileInputRef = useRef(null)\n", '')

if (!code.includes('const addMediaToTimeline =')) {
  const marker = "  const addSfxToTimeline = (sfx, targetTrackId = 'A3', startAt = playhead) => {"
  const block = `  const addMediaToTimeline = (media, targetTrackId = null, startAt = playhead) => {\n    const timelineType = media.type === 'audio' ? 'audio' : 'video'\n    const preferred = targetTrackId || (timelineType === 'audio' ? 'A1' : 'V1')\n    const track = firstUnlockedTrack(timelineType, preferred)\n    if (!track) return notify(\`Unlock a \${timelineType} track before adding media\`)\n\n    const duration = Math.max(.1, Math.min(TIMELINE_SECONDS, Number(media.duration) || (media.type === 'image' ? 5 : 3)))\n    const id = \`local-\${media.id}-\${Date.now()}\`\n    const start = Math.max(0, Math.min(TIMELINE_SECONDS - duration, snapTime(startAt)))\n    commitClips((current) => [...current, {\n      id,\n      trackId: track.id,\n      name: media.name,\n      type: timelineType,\n      kind: media.type === 'image' ? 'image' : 'local-media',\n      start,\n      duration,\n      sourceDuration: duration,\n      color: timelineType === 'audio' ? 'green' : media.type === 'image' ? 'purple' : 'blue',\n      localUrl: media.localUrl,\n      thumbnail: media.thumbnail || null,\n      waveform: media.waveform || [],\n      width: media.width || 0,\n      height: media.height || 0,\n      sourceFileName: media.sourceFileName || media.name,\n      mimeType: media.mimeType || '',\n      audio: timelineType === 'audio' ? { volume: 100, fadeIn: 0, fadeOut: 0 } : undefined,\n    }])\n    setSelectedClipIds([id])\n    notify(\`\${media.name} added to \${track.id}\`)\n  }\n\n`
  if (!code.includes(marker)) throw new Error('addSfx marker missing')
  code = code.replace(marker, block + marker)
}

const mediaBranch = /    if \(leftTab === 'Media'\) \{[\s\S]*?\n    \}\n\n    if \(leftTab === 'Effect Controls'/
if (!code.includes('<MediaLibrary')) {
  if (!mediaBranch.test(code)) throw new Error('Media branch not found')
  code = code.replace(mediaBranch, `    if (leftTab === 'Media') {\n      return (\n        <MediaLibrary\n          items={libraryItems}\n          setItems={setLibraryItems}\n          onAddMedia={(media) => addMediaToTimeline(media)}\n          notify={notify}\n        />\n      )\n    }\n\n    if (leftTab === 'Effect Controls'`)
}

if (!code.includes('onMediaDrop={(media, trackId, startAt)')) {
  code = code.replace(
    `          onSfxDrop={(sfx, trackId, startAt) => addSfxToTimeline(sfx, trackId, startAt)}\n        />`,
    `          onSfxDrop={(sfx, trackId, startAt) => addSfxToTimeline(sfx, trackId, startAt)}\n          onMediaDrop={(media, trackId, startAt) => addMediaToTimeline(media, trackId, startAt)}\n        />`,
  )
}

if (!/function Timeline\(\{[^}]*\bonMediaDrop\b/.test(code)) {
  code = code.replace('notify, pushHistory, onStockDrop, onSfxDrop }) {', 'notify, pushHistory, onStockDrop, onSfxDrop, onMediaDrop }) {')
}

if (!code.includes("application/x-video-editor-media")) {
  const marker = `    const sfxPayload = event.dataTransfer.getData('application/x-video-editor-sfx')\n    if (sfxPayload) {`
  const block = `    const mediaPayload = event.dataTransfer.getData('application/x-video-editor-media')\n    if (mediaPayload) {\n      try {\n        const media = JSON.parse(mediaPayload)\n        const timelineType = media.type === 'audio' ? 'audio' : 'video'\n        if (targetTrack?.type !== timelineType) return notify(\`Drop \${timelineType} media on a \${timelineType} track\`)\n        onMediaDrop(media, trackId, pointerToTime(event))\n      } catch {\n        notify('Could not read imported media data')\n      }\n      return\n    }\n\n${marker}`
  if (!code.includes(marker)) throw new Error('SFX drop marker missing')
  code = code.replace(marker, block)
}

if (!code.includes('timeline-waveform-real')) {
  const marker = `                    {clip.type === 'audio' && <span className="waveform-faux" aria-hidden="true" />}`
  const replacement = `                    {clip.type === 'audio' && clip.waveform?.length ? (\n                      <span className="timeline-waveform-real" aria-hidden="true">\n                        {clip.waveform.slice(0, 72).map((peak, index) => <i key={index} style={{ height: \`\${Math.max(8, peak * 92)}%\` }} />)}\n                      </span>\n                    ) : clip.type === 'audio' ? <span className="waveform-faux" aria-hidden="true" /> : null}`
  if (!code.includes(marker)) throw new Error('waveform render marker missing')
  code = code.replace(marker, replacement)
}

fs.writeFileSync(path, code)
console.log(`Patched ${path}`)
