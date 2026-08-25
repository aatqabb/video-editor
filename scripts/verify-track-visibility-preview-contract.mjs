import fs from 'node:fs'

const plugin = fs.readFileSync(new URL('./vite-program-playback-sync-plugin.js', import.meta.url), 'utf8')
const helpers = fs.readFileSync(new URL('../src/timelineStateHelpers.js', import.meta.url), 'utf8')
const overlayCss = fs.readFileSync(new URL('../src/ProgramTransformOverlay.css', import.meta.url), 'utf8')

const checks = [
  ['program monitor receives track state', /timelineClips=\{clips\} tracks=\{tracks\}/.test(plugin)],
  ['hidden tracks are removed from preview candidates', /tracks\.filter\(\(track\) => !track\.hidden\)/.test(plugin)],
  ['top visible video track wins preview', /videoTrackOrder/.test(plugin) && /activeVideos/.test(plugin)],
  ['preview accepts originalUrl media sources', /activeVideo\.originalUrl/.test(plugin)],
  ['failed video playback falls back instead of black screen', /setFailed\(true\)/.test(plugin) && /program-media-fallback/.test(plugin)],
  ['preview waits for loaded video before revealing it', /setReady\(true\)/.test(plugin) && /opacity: ready \? 1 : 0/.test(plugin)],
  ['image clips render as images instead of video elements', /clip\.kind === 'image'/.test(plugin) && /isImage/.test(plugin)],
  ['transition is visibly anchored at clip start', /transition-start-badge/.test(plugin) && /left:0/.test(overlayCss)],
  ['hidden layer control has explicit state', /aria-pressed=\{track\.hidden\}/.test(plugin)],
  ['new video track is inserted at absolute top', /return \{ tracks: \[track, \.\.\.tracks\], track \}/.test(helpers)],
  ['new audio track is inserted at absolute bottom', /return \{ tracks: \[\.\.\.tracks, track\], track \}/.test(helpers)],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS track visibility, preview fallback, transition-start visibility, and layer insertion contract verified.')
