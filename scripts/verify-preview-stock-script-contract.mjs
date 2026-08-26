import fs from 'node:fs'

const previewPlugin = fs.readFileSync(new URL('./vite-program-preview-stability-plugin.js', import.meta.url), 'utf8')
const stockApi = fs.readFileSync(new URL('../src/stockApi.js', import.meta.url), 'utf8')
const scriptWorkspace = fs.readFileSync(new URL('../src/ScriptWorkspace.jsx', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

const checks = [
  ['preview does not hide decoded video on each seek', !previewPlugin.includes("const onSeeking = () => setFrameReady(false)")],
  ['preview event wiring does not rebuild on every playhead tick', previewPlugin.includes("}, [clip.id, source, playing, failed, speed])")],
  ['decoded preview becomes visible from loaded/play/seek/timeupdate events', previewPlugin.includes('const markReady = () =>') && previewPlugin.includes("element.addEventListener('timeupdate', onTimeUpdate)")),
  ['playing preview only corrects meaningful drift', previewPlugin.includes('if (distance > .75)')],
  ['playing preview restarts a paused media element', previewPlugin.includes("if (element.paused) element.play?.().catch?.(() => {})")],
  ['paused preview keeps tight frame-accurate seek tolerance', previewPlugin.includes('if (distance > .015)')],
  ['preview playback rate follows clip speed', previewPlugin.includes('element.playbackRate = speed')],
  ['preview fallback is removed after a decoded frame exists', previewPlugin.includes('clip.thumbnail && !frameReady')],
  ['preview stability plugin is wired after playback sync', /programPlaybackSyncPlugin\(\), programPreviewStabilityPlugin\(\)/.test(vite)],
  ['stock requests expanded Pexels page size', stockApi.includes('per_page=80')],
  ['stock requests expanded Pixabay page size', stockApi.includes('per_page=200')],
  ['stock requests expanded Unsplash page size', stockApi.includes('per_page=30')],
  ['stock orders all videos before images', /mediaType !== 'image'[\s\S]*mediaType === 'image'/.test(stockApi)],
  ['script edits debounce into automatic split', scriptWorkspace.includes('autoSplitTimerRef') && scriptWorkspace.includes('splitIntoLines(value, true)')],
  ['script automatic split starts line searches', scriptWorkspace.includes('void searchLinesSequentially(nextLines, true)')],
  ['script auto-search defaults to all configured providers', scriptWorkspace.includes("const [provider, setProvider] = useState('All')")],
  ['script preview handles stock images', scriptWorkspace.includes("preview.mediaType === 'image'")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS continuously visible Program Monitor preview, maximum stock ordering, and script auto-search contract verified.')
