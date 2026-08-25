import fs from 'node:fs'

const playback = fs.readFileSync(new URL('./vite-program-playback-sync-plugin.js', import.meta.url), 'utf8')
const transition = fs.readFileSync(new URL('./vite-timeline-transition-visibility-plugin.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PreviewTransitionFixes.css', import.meta.url), 'utf8')

const checks = [
  ['hidden video tracks filter Program Monitor candidates', /tracks\.filter\(\(track\) => !track\.hidden\)/.test(playback)],
  ['active Program video is keyed so hide switches media cleanly', /ProgramVideoMedia key=\{activeVideo\.id\}/.test(playback)],
  ['preview holds thumbnail until video is actually ready', /setReady\(true\)/.test(playback) && /program-media-fallback/.test(playback)],
  ['preview video stays hidden until media frame is ready', /opacity: ready \? 1 : 0/.test(playback)],
  ['paused seeking restores fallback until seek completes', /onSeeking=/.test(playback) && /onSeeked=/.test(playback)],
  ['image clips render as images rather than broken video elements', /clip\.kind === 'image'/.test(playback) && /return <img src=\{source\}/.test(playback)],
  ['failed media without thumbnail uses placeholder instead of black stack', /if \(failed\)/.test(playback) && /program-video-placeholder/.test(playback)],
  ['hide control has explicit pressed state and hidden track styling', /aria-pressed=\{track\.hidden\}/.test(transition) && /track-hidden/.test(css)],
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
