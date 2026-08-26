import fs from 'node:fs'

const previewPlugin = fs.readFileSync(new URL('./vite-program-preview-stability-plugin.js', import.meta.url), 'utf8')
const stockApi = fs.readFileSync(new URL('../src/stockApi.js', import.meta.url), 'utf8')
const scriptWorkspace = fs.readFileSync(new URL('../src/ScriptWorkspace.jsx', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

const checks = [
  ['preview hides stale video while seeking', previewPlugin.includes("const onSeeking = () => setFrameReady(false)")],
  ['preview seek completion rechecks expected playhead frame', previewPlugin.includes('expectedTimeRef.current') && previewPlugin.includes("distance > (playing ? .4 : .04)")),
  ['preview waits for decoded video frame before reveal', previewPlugin.includes('requestVideoFrameCallback') && previewPlugin.includes('revealDecodedFrame')],
  ['paused preview uses tight playhead sync while playback avoids seek thrash', previewPlugin.includes('playing ? .4 : .015')],
  ['preview cancels stale frame reveal callbacks', previewPlugin.includes('frameRequestRef.current += 1')],
  ['preview stability plugin is wired after playback sync', /programPlaybackSyncPlugin\(\), programPreviewStabilityPlugin\(\)/.test(vite)],
  ['stock requests expanded Pexels page size', stockApi.includes('per_page=80')],
  ['stock requests expanded Pixabay page size', stockApi.includes('per_page=200')],
  ['stock requests expanded Unsplash page size', stockApi.includes('per_page=30')],
  ['stock orders all videos before images', /mediaType !== 'image'[\s\S]*mediaType === 'image'/.test(stockApi)],
  ['script edits debounce into automatic split', scriptWorkspace.includes('autoSplitTimerRef') && scriptWorkspace.includes('splitIntoLines(value, true)')],
  ['script automatic split starts line searches', scriptWorkspace.includes('void searchLinesSequentially(nextLines, true)')],
  ['script auto-search defaults to all configured providers', scriptWorkspace.includes("const [provider, setProvider] = useState('All')")),
  ['script preview handles stock images', scriptWorkspace.includes("preview.mediaType === 'image'")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS decoded-frame preview sync, maximum stock ordering, and script auto-search contract verified.')
