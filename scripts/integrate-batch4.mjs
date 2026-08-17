import fs from 'node:fs'

const path = process.argv[2] || 'src/App.jsx'
let code = fs.readFileSync(path, 'utf8')

if (!code.includes("from './CreativePanels'")) {
  code = code.replace(
    "import ScriptWorkspace from './ScriptWorkspace'\n",
    "import ScriptWorkspace from './ScriptWorkspace'\nimport { EffectsWorkspace, SfxWorkspace, TextWorkspace, TransitionWorkspace } from './CreativePanels'\n",
  )
}

if (!code.includes('function buildMonitorEffectStyle')) {
  const marker = 'function App() {'
  const helpers = `function buildMonitorEffectStyle(effects = []) {\n  const filters = []\n  let boxShadow = ''\n  effects.forEach(({ type, intensity = 50 }) => {\n    if (type === 'Blur') filters.push(\`blur(\${Math.max(0, intensity / 22)}px)\`)\n    if (type === 'Grayscale') filters.push(\`grayscale(\${intensity}%)\`)\n    if (type === 'Brightness') filters.push(\`brightness(\${60 + intensity * 0.8}%)\`)\n    if (type === 'Contrast') filters.push(\`contrast(\${60 + intensity * 0.9}%)\`)\n    if (type === 'Saturate') filters.push(\`saturate(\${Math.max(0, intensity * 2)}%)\`)\n    if (type === 'Sepia') filters.push(\`sepia(\${intensity}%)\`)\n    if (type === 'Hue Rotate') filters.push(\`hue-rotate(\${intensity * 3.6}deg)\`)\n    if (type === 'Vignette') boxShadow = \`inset 0 0 \${30 + intensity}px rgba(0,0,0,\${Math.min(.85, intensity / 100)})\`\n  })\n  return { filter: filters.join(' ') || undefined, boxShadow: boxShadow || undefined }\n}\n\nfunction getTextOverlayPresentation(clip, playhead) {\n  const style = clip.textStyle || {}\n  const local = Math.max(0, playhead - clip.start)\n  const remaining = Math.max(0, clip.start + clip.duration - playhead)\n  const animDuration = Math.max(.05, Number(style.animationDuration) || .45)\n  let opacity = 1\n  let dx = 0\n  let dy = 0\n  let scale = 1\n  let blur = 0\n\n  const applyAnimation = (name, progress, entering) => {\n    const p = Math.max(0, Math.min(1, progress))\n    const amount = entering ? 1 - p : p\n    if (name.includes('Fade')) opacity = Math.min(opacity, 1 - amount)\n    if (name.includes('Slide Up')) dy = 45 * amount\n    if (name.includes('Slide Down')) dy = -45 * amount\n    if (name.includes('Slide Left')) dx = 65 * amount\n    if (name.includes('Slide Right')) dx = -65 * amount\n    if (name.includes('Zoom In')) scale = .65 + .35 * p\n    if (name.includes('Zoom Out') || name.includes('Shrink')) scale = 1 - .35 * amount\n    if (name.includes('Pop')) scale = .65 + .35 * Math.min(1, p * 1.35)\n    if (name.includes('Blur')) blur = 9 * amount\n  }\n\n  if (style.animationIn && style.animationIn !== 'None' && local < animDuration) applyAnimation(style.animationIn, local / animDuration, true)\n  if (style.animationOut && style.animationOut !== 'None' && remaining < animDuration) applyAnimation(style.animationOut, 1 - remaining / animDuration, false)\n\n  let displayText = clip.text || clip.name\n  if (style.animationIn === 'Typewriter' && local < animDuration) {\n    displayText = displayText.slice(0, Math.max(1, Math.ceil(displayText.length * local / animDuration)))\n  }\n\n  return {\n    text: displayText,\n    style: {\n      left: \`\${style.x ?? 50}%\`,\n      top: \`\${style.y ?? 50}%\`,\n      fontFamily: style.fontFamily || 'Segoe UI',\n      fontSize: \`\${Math.max(8, Number(style.fontSize) || 64)}px\`,\n      color: style.color || '#fff',\n      background: style.background || 'transparent',\n      textAlign: style.align || 'center',\n      fontWeight: style.bold ? 700 : 400,\n      fontStyle: style.italic ? 'italic' : 'normal',\n      textDecoration: style.underline ? 'underline' : 'none',\n      opacity,\n      filter: blur ? \`blur(\${blur}px)\` : undefined,\n      transform: \`translate(-50%, -50%) translate(\${dx}px, \${dy}px) scale(\${scale})\`,\n    },\n  }\n}\n\n`
  if (!code.includes(marker)) throw new Error('App function marker missing')
  code = code.replace(marker, helpers + marker)
}

if (!code.includes('const selectedTextClip =')) {
  const marker = "  const getTrack = (trackId) => tracks.find((track) => track.id === trackId)"
  code = code.replace(marker, `  const selectedTextClip = selectedClips.find((clip) => clip.kind === 'text') || null\n\n${marker}`)
}

if (!code.includes('const addTextLayer =')) {
  const marker = '  const addStockToTimeline = (result, sourceLineId, targetTrackId = \'V1\', startAt = playhead) => {'
  const block = `  const firstUnlockedTrack = (type, preferredId) => tracks.find((track) => track.id === preferredId && track.type === type && !track.locked)\n    || tracks.find((track) => track.type === type && !track.locked)\n\n  const addTextLayer = (draft) => {\n    const track = firstUnlockedTrack('video', 'V3')\n    if (!track) return notify('Unlock a video track before adding text')\n    const id = \`text-\${Date.now()}\`\n    const duration = Math.max(.5, Number(draft.duration) || 5)\n    commitClips((current) => [...current, {\n      id, trackId: track.id, name: draft.text || 'Text', type: 'video', kind: 'text', start: playhead, duration, color: 'title',\n      text: draft.text || 'Text', textStyle: { ...draft },\n    }])\n    setSelectedClipIds([id])\n    notify(\`Text layer added to \${track.id}\`)\n  }\n\n  const updateTextLayer = (id, draft) => {\n    commitClips((current) => current.map((clip) => clip.id === id ? {\n      ...clip, name: draft.text || clip.name, text: draft.text || clip.text, duration: Math.max(.5, Number(draft.duration) || clip.duration), textStyle: { ...draft },\n    } : clip))\n    notify('Text layer updated')\n  }\n\n  const applyTransition = (type, duration) => {\n    const ids = new Set(selectedClips.filter((clip) => clip.type === 'video' && clip.kind !== 'text').map((clip) => clip.id))\n    if (!ids.size) return notify('Select a video clip first')\n    commitClips((current) => current.map((clip) => ids.has(clip.id) ? { ...clip, transition: { type, duration } } : clip))\n  }\n\n  const applyEffect = (type, intensity) => {\n    const ids = new Set(selectedClips.filter((clip) => clip.type === 'video' && clip.kind !== 'text').map((clip) => clip.id))\n    if (!ids.size) return notify('Select a video clip first')\n    commitClips((current) => current.map((clip) => {\n      if (!ids.has(clip.id)) return clip\n      const effects = (clip.effects || []).filter((effect) => effect.type !== type)\n      return { ...clip, effects: [...effects, { type, intensity }] }\n    }))\n  }\n\n  const resetEffects = () => {\n    const ids = new Set(selectedClips.filter((clip) => clip.type === 'video').map((clip) => clip.id))\n    if (!ids.size) return notify('Select a video clip first')\n    commitClips((current) => current.map((clip) => ids.has(clip.id) ? { ...clip, effects: [] } : clip))\n  }\n\n  const addSfxToTimeline = (sfx, targetTrackId = 'A3', startAt = playhead) => {\n    const track = firstUnlockedTrack('audio', targetTrackId)\n    if (!track) return notify('Unlock an audio track before adding SFX')\n    const duration = Math.max(.1, Math.min(TIMELINE_SECONDS, Number(sfx.duration) || 1))\n    const id = \`sfx-\${sfx.id}-\${Date.now()}\`\n    commitClips((current) => [...current, {\n      id, trackId: track.id, name: sfx.name, type: 'audio', kind: 'sfx', start: Math.max(0, Math.min(TIMELINE_SECONDS - duration, startAt)), duration, color: 'orange',\n      sfxId: sfx.id, localUrl: sfx.url || null, customSfx: Boolean(sfx.custom),\n    }])\n    setSelectedClipIds([id])\n    notify(\`\${sfx.name} added to \${track.id}\`)\n  }\n\n`
  if (!code.includes(marker)) throw new Error('Stock insertion marker missing')
  code = code.replace(marker, block + marker)
}

code = code.replace(
  `    if (leftTab === 'Effects') {\n      return <OptionGrid title="VIDEO EFFECTS" options={['Blur', 'Sharpen', 'Vignette', 'Film Grain', 'Exposure', 'Contrast', 'Transform', 'Crop', 'Glow']} onClick={notify} />\n    }`,
  `    if (leftTab === 'Effects') {\n      return <EffectsWorkspace onApply={applyEffect} onReset={resetEffects} notify={notify} />\n    }`,
)

code = code.replace(
  `    if (leftTab === 'Text') {\n      return <OptionGrid title="TEXT" options={['Title', 'Subtitle', 'Caption', 'Lower Third', 'Poppins', 'Montserrat', 'Fade In', 'Zoom In', 'Typewriter']} onClick={notify} />\n    }`,
  `    if (leftTab === 'Text') {\n      return <TextWorkspace selectedTextClip={selectedTextClip} onAddText={addTextLayer} onUpdateText={updateTextLayer} notify={notify} />\n    }`,
)

code = code.replace(
  `    if (centerTab === 'SFX') return <OptionGrid title="SFX LIBRARY" options={['Whoosh', 'Impact Hit', 'Pop', 'Rise', 'Glitch', 'Bass Drop', 'Swipe', 'Boom', 'Typing']} onClick={notify} />`,
  `    if (centerTab === 'SFX') return <SfxWorkspace onAddSfx={(sfx) => addSfxToTimeline(sfx)} notify={notify} />`,
)

code = code.replace(
  `    if (centerTab === 'Transitions') return <OptionGrid title="TRANSITIONS" options={['Cross Dissolve', 'Fade', 'Slide', 'Zoom In', 'Zoom Out', 'Light Leak Warm', 'Light Leak Cool', 'Whip Pan', 'Flash']} onClick={notify} />`,
  `    if (centerTab === 'Transitions') return <TransitionWorkspace onApply={applyTransition} notify={notify} />`,
)

if (!code.includes('timelineClips={clips}')) {
  code = code.replace(
    '<div className="panel-body center-body"><Monitor playing={playing} setPlaying={setPlaying} notify={notify} /></div>',
    '<div className="panel-body center-body"><Monitor playing={playing} setPlaying={setPlaying} notify={notify} timelineClips={clips} playhead={playhead} /></div>',
  )
}

if (!code.includes('onSfxDrop={(sfx, trackId, startAt)')) {
  code = code.replace(
    `          onStockDrop={(result, trackId, startAt) => addStockToTimeline(result, result.sourceLineId, trackId, startAt)}\n        />`,
    `          onStockDrop={(result, trackId, startAt) => addStockToTimeline(result, result.sourceLineId, trackId, startAt)}\n          onSfxDrop={(sfx, trackId, startAt) => addSfxToTimeline(sfx, trackId, startAt)}\n        />`,
  )
}

const monitorPattern = /function Monitor\(\{ playing, setPlaying, notify, empty = false \}\) \{[\s\S]*?\n\}\n\nfunction OptionGrid/
if (!code.includes('timelineClips = []')) {
  if (!monitorPattern.test(code)) throw new Error('Monitor function block missing')
  const monitor = `function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0 }) {\n  const activeClips = empty ? [] : timelineClips.filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration)\n  const textClips = activeClips.filter((clip) => clip.kind === 'text')\n  const activeVideo = activeClips.find((clip) => clip.type === 'video' && clip.kind !== 'text')\n  const effectStyle = buildMonitorEffectStyle(activeVideo?.effects || [])\n\n  return (\n    <div className="monitor">\n      <div className={\`monitor-screen \${empty ? 'empty' : 'program'}\`} style={empty ? undefined : effectStyle}>\n        <span>{empty ? 'SOURCE MONITOR' : 'PROGRAM PREVIEW'}</span>\n        {!empty && textClips.map((clip) => {\n          const presentation = getTextOverlayPresentation(clip, playhead)\n          return <div className="program-text-overlay" key={clip.id} style={presentation.style}>{presentation.text}</div>\n        })}\n        {!empty && activeVideo?.transition && <span className="monitor-transition-label">{activeVideo.transition.type} · {activeVideo.transition.duration}s</span>}\n      </div>\n      <div className="monitor-info"><span>00:00:05:11</span><button onClick={() => notify('Fit menu')}>Fit ▾</button><button onClick={() => notify('Full resolution')}>Full ▾</button></div>\n      <div className="monitor-controls">\n        {['|◀', '◀', playing ? '❚❚' : '▶', '▶', '▶|', '▣'].map((label, index) => (\n          <button key={\`\${label}-\${index}\`} onClick={() => index === 2 ? setPlaying((value) => !value) : notify(\`Monitor control \${label}\`)}>{label}</button>\n        ))}\n      </div>\n    </div>\n  )\n}\n\nfunction OptionGrid`
  code = code.replace(monitorPattern, monitor)
}

if (!/function Timeline\(\{[^}]*\bonSfxDrop\b/.test(code)) {
  code = code.replace('notify, pushHistory, onStockDrop }) {', 'notify, pushHistory, onStockDrop, onSfxDrop }) {')
}

if (!code.includes("application/x-video-editor-sfx")) {
  const needle = `    const stockPayload = event.dataTransfer.getData('application/x-video-editor-stock')\n    if (stockPayload) {`
  const insert = `    const sfxPayload = event.dataTransfer.getData('application/x-video-editor-sfx')\n    if (sfxPayload) {\n      if (targetTrack?.type !== 'audio') return notify('SFX can only be dropped on an audio track')\n      try {\n        onSfxDrop(JSON.parse(sfxPayload), trackId, pointerToTime(event))\n      } catch {\n        notify('Could not read SFX data')\n      }\n      return\n    }\n\n${needle}`
  if (!code.includes(needle)) throw new Error('Stock drop marker missing')
  code = code.replace(needle, insert)
}

if (!code.includes('className="transition-badge"')) {
  const needle = `                    {clip.thumbnail && <span className="clip-thumbnail-strip" style={{ backgroundImage: \`url(\${clip.thumbnail})\` }} aria-hidden="true" />}\n                    <span className="clip-name">{clip.name}</span>`
  const replacement = `                    {clip.thumbnail && <span className="clip-thumbnail-strip" style={{ backgroundImage: \`url(\${clip.thumbnail})\` }} aria-hidden="true" />}\n                    {!!clip.effects?.length && <span className="effect-badge">fx</span>}\n                    {clip.transition && <span className="transition-badge">↔</span>}\n                    <span className="clip-name">{clip.name}</span>`
  if (!code.includes(needle)) throw new Error('Clip render marker missing')
  code = code.replace(needle, replacement)
}

fs.writeFileSync(path, code)
console.log(`Patched ${path}`)
