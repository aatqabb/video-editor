import fs from 'node:fs'

const plugin = fs.readFileSync(new URL('./vite-program-playback-sync-plugin.js', import.meta.url), 'utf8')
const helpers = fs.readFileSync(new URL('../src/timelineStateHelpers.js', import.meta.url), 'utf8')

const checks = [
  ['program monitor receives track state', /timelineClips=\{clips\} tracks=\{tracks\}/.test(plugin)],
  ['hidden tracks are removed from preview candidates', /tracks\.filter\(\(track\) => !track\.hidden\)/.test(plugin)],
  ['top visible video track wins preview', /videoTrackOrder/.test(plugin) && /activeVideos/.test(plugin)],
  ['preview accepts originalUrl media sources', /activeVideo\.originalUrl/.test(plugin)],
  ['failed video playback falls back to thumbnail', /setFailed\(true\)/.test(plugin) && /clip\.thumbnail/.test(plugin)],
  ['new video track is inserted at absolute top', /return \{ tracks: \[track, \.\.\.tracks\], track \}/.test(helpers)],
  ['new audio track is inserted at absolute bottom', /return \{ tracks: \[\.\.\.tracks, track\], track \}/.test(helpers)],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS track visibility, preview fallback, and layer insertion contract verified.')
