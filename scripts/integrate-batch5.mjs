import fs from 'node:fs'

const path = process.argv[2] || 'src/App.jsx'
let code = fs.readFileSync(path, 'utf8')

if (!code.includes("from './ClipControls'")) {
  code = code.replace(
    "import { EffectsWorkspace, SfxWorkspace, TextWorkspace, TransitionWorkspace } from './CreativePanels'\n",
    "import { EffectsWorkspace, SfxWorkspace, TextWorkspace, TransitionWorkspace } from './CreativePanels'\nimport { AudioControls, VideoControls, VoiceoverWorkspace } from './ClipControls'\n",
  )
}

if (!code.includes('const selectedClip = selectedClips[0]')) {
  code = code.replace(
    "  const selectedTextClip = selectedClips.find((clip) => clip.kind === 'text') || null",
    "  const selectedTextClip = selectedClips.find((clip) => clip.kind === 'text') || null\n  const selectedClip = selectedClips[0] || null",
  )
}

if (!code.includes('const updateClipControls =')) {
  const marker = '  const firstUnlockedTrack = (type, preferredId) => tracks.find((track) => track.id === preferredId && track.type === type && !track.locked)'
  const block = `  const updateClipControls = (id, patch) => {\n    commitClips((current) => current.map((clip) => {\n      if (clip.id !== id) return clip\n      const next = { ...clip, ...patch }\n      if (patch.video) {\n        const previousSpeed = Number(clip.video?.speed) || 1\n        const nextSpeed = Math.max(.1, Number(patch.video.speed ?? previousSpeed))\n        const sourceDuration = Number(clip.sourceDuration) || clip.duration * previousSpeed\n        next.video = { ...(clip.video || {}), ...patch.video, speed: nextSpeed }\n        next.sourceDuration = sourceDuration\n        if (nextSpeed !== previousSpeed) next.duration = Math.max(MIN_CLIP_DURATION, sourceDuration / nextSpeed)\n      }\n      if (patch.audio) next.audio = { ...(clip.audio || {}), ...patch.audio }\n      return next\n    }))\n  }\n\n  const addAudioToTimeline = (audioInfo, targetTrackId = 'A1', startAt = playhead) => {\n    const track = firstUnlockedTrack('audio', targetTrackId)\n    if (!track) return notify('Unlock an audio track before adding audio')\n    const duration = Math.max(.1, Math.min(TIMELINE_SECONDS, Number(audioInfo.duration) || 3))\n    const id = audioInfo.id || \`audio-\${Date.now()}\`\n    commitClips((current) => [...current, {\n      id, trackId: track.id, name: audioInfo.name || 'Audio', type: 'audio', kind: audioInfo.kind || 'audio', start: Math.max(0, Math.min(TIMELINE_SECONDS - duration, startAt)), duration, sourceDuration: duration, color: audioInfo.kind === 'voiceover' ? 'green' : 'yellow',\n      localUrl: audioInfo.url || null, audio: { volume: 100, fadeIn: 0, fadeOut: 0 },\n    }])\n    setSelectedClipIds([id])\n  }\n\n`
  if (!code.includes(marker)) throw new Error('firstUnlockedTrack marker missing')
  code = code.replace(marker, block + marker)
}

if (!code.includes("leftTab === 'Effect Controls'")) {
  const marker = "    if (leftTab === 'Effects') {"
  const block = `    if (leftTab === 'Effect Controls' || leftTab === 'Properties') {\n      if (selectedClip?.type === 'audio') return <AudioControls clip={selectedClip} onUpdate={updateClipControls} />\n      return <VideoControls clip={selectedClip} onUpdate={updateClipControls} notify={notify} />\n    }\n\n`
  if (!code.includes(marker)) throw new Error('Effects branch marker missing')
  code = code.replace(marker, block + marker)
}

code = code.replace(
  `    return (\n      <div className="property-body">\n        <div className="section-label">{leftTab.toUpperCase()}</div>\n        {['Position X / Y', 'Scale 100%', 'Rotation 0°', 'Opacity 100%', 'Speed 1.0x'].map((item) => (\n          <button key={item} onClick={() => notify(item)}>{item}</button>\n        ))}\n      </div>\n    )`,
  `    return <VideoControls clip={selectedClip} onUpdate={updateClipControls} notify={notify} />`,
)

code = code.replace(
  `    return <OptionGrid title="ESSENTIAL SOUND" options={['Dialogue', 'Music', 'SFX', 'Ambience', 'Volume', 'Fade In', 'Fade Out', 'Auto Ducking']} onClick={notify} />`,
  `    return <VoiceoverWorkspace onAddAudio={(audioInfo, trackId) => addAudioToTimeline(audioInfo, trackId)} notify={notify} />`,
)

if (!code.includes('programVideoStyle')) {
  const monitorStart = `  const activeVideo = activeClips.find((clip) => clip.type === 'video' && clip.kind !== 'text')\n  const effectStyle = buildMonitorEffectStyle(activeVideo?.effects || [])`
  const monitorEnhancement = `  const activeVideo = activeClips.find((clip) => clip.type === 'video' && clip.kind !== 'text')\n  const effectStyle = buildMonitorEffectStyle(activeVideo?.effects || [])\n  const videoControls = activeVideo?.video || {}\n  const fitMode = videoControls.fitMode || 'Fit'\n  const programVideoStyle = activeVideo ? {\n    left: \`\${videoControls.positionX ?? 50}%\`,\n    top: \`\${videoControls.positionY ?? 50}%\`,\n    width: \`\${Math.max(1, Number(videoControls.scale) || 100)}%\`,\n    height: \`\${Math.max(1, Number(videoControls.scale) || 100)}%\`,\n    opacity: Math.max(0, Math.min(1, (videoControls.opacity ?? 100) / 100)),\n    transform: \`translate(-50%, -50%) rotate(\${Number(videoControls.rotation) || 0}deg)\`,\n    clipPath: \`inset(\${videoControls.cropTop || 0}% \${videoControls.cropRight || 0}% \${videoControls.cropBottom || 0}% \${videoControls.cropLeft || 0}%)\`,\n    objectFit: fitMode === 'Fill' ? 'cover' : fitMode === 'Stretch' ? 'fill' : 'contain',\n    ...effectStyle,\n  } : undefined`
  if (!code.includes(monitorStart)) throw new Error('Monitor activeVideo marker missing')
  code = code.replace(monitorStart, monitorEnhancement)
}

if (!code.includes('program-video-layer')) {
  const marker = `        <span>{empty ? 'SOURCE MONITOR' : 'PROGRAM PREVIEW'}</span>`
  const layer = `        <span className={activeVideo ? 'program-placeholder hidden' : 'program-placeholder'}>{empty ? 'SOURCE MONITOR' : 'PROGRAM PREVIEW'}</span>\n        {!empty && activeVideo && (\n          <div className="program-video-layer" style={programVideoStyle}>\n            {activeVideo.video?.freezeFrame && activeVideo.thumbnail ? (\n              <img src={activeVideo.thumbnail} alt="" style={{ objectFit: programVideoStyle.objectFit }} />\n            ) : activeVideo.remoteUrl || activeVideo.localUrl ? (\n              <video src={activeVideo.remoteUrl || activeVideo.localUrl} poster={activeVideo.thumbnail} muted playsInline autoPlay={playing && !activeVideo.video?.freezeFrame} loop style={{ objectFit: programVideoStyle.objectFit }} />\n            ) : activeVideo.thumbnail ? (\n              <img src={activeVideo.thumbnail} alt="" style={{ objectFit: programVideoStyle.objectFit }} />\n            ) : (\n              <div className="program-video-placeholder">{activeVideo.video?.freezeFrame ? '❄ ' : ''}{activeVideo.name}</div>\n            )}\n          </div>\n        )}`
  if (!code.includes(marker)) throw new Error('Monitor placeholder marker missing')
  code = code.replace(marker, layer)
}

if (!code.includes('className="freeze-badge"')) {
  const marker = `                    {!!clip.effects?.length && <span className="effect-badge">fx</span>}\n                    {clip.transition && <span className="transition-badge">↔</span>}\n                    <span className="clip-name">{clip.name}</span>`
  const replacement = `                    {!!clip.effects?.length && <span className="effect-badge">fx</span>}\n                    {clip.transition && <span className="transition-badge">↔</span>}\n                    {clip.video?.freezeFrame && <span className="freeze-badge">❄</span>}\n                    <span className="clip-name">{clip.name}</span>\n                    {clip.type === 'audio' && ((clip.audio?.fadeIn || 0) > 0 || (clip.audio?.fadeOut || 0) > 0) && <span className="audio-fade-indicator" />}`
  if (!code.includes(marker)) throw new Error('Clip badges marker missing')
  code = code.replace(marker, replacement)
}

fs.writeFileSync(path, code)
console.log(`Patched ${path}`)
