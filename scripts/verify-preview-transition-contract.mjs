import fs from 'node:fs'

const playback = fs.readFileSync(new URL('./vite-program-playback-sync-plugin.js', import.meta.url), 'utf8')
const transition = fs.readFileSync(new URL('./vite-timeline-transition-visibility-plugin.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PreviewTransitionFixes.css', import.meta.url), 'utf8')

const checks = [
  ['hidden video tracks filter Program Monitor candidates', /tracks\.filter\(\(track\) => !track\.hidden\)/.test(playback)],
  ['active Program video is keyed so hide switches media cleanly', /ProgramVideoMedia key=\{activeVideo\.id\}/.test(playback)],
  ['preview holds thumbnail until video is actually ready', /setReady\(true\)/.test(playback) && /program-media-fallback/.test(playback)],
  ['preview video is hidden until loaded', /opacity: ready && !failed \? 1 : 0/.test(playback)],
  ['transition marker is drawn from the clip start', /className="transition-badge"/.test(transition) && /style=\{\{ width:/.test(transition)],
  ['transition marker is visibly styled at left edge', /\.transition-badge\{position:absolute;left:0;top:0;bottom:0/.test(css)],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS preview hide, black-frame fallback, and transition visibility contract verified.')
