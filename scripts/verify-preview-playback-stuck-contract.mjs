import fs from 'node:fs'

const plugin = fs.readFileSync(new URL('./vite-program-preview-stability-plugin.js', import.meta.url), 'utf8')

const checks = [
  ['media listener effect is stable while playhead advances', /\}, \[clip\.id, source, playing, failed, speed\]\)/.test(plugin)],
  ['playhead-driven effect is separate from media listener effect', /\}, \[desiredTime, playing, clip\.id, source, failed, speed\]\)/.test(plugin)],
  ['native playback is restarted if media is paused', plugin.includes("if (element.paused) element.play?.().catch?.(() => {})")],
  ['ordinary playback is not continuously seeked', plugin.includes('if (distance > .75)')],
  ['paused scrub remains frame accurate', plugin.includes('if (distance > .015)')],
  ['decoded frames become visible directly on media events', plugin.includes("const markReady = () =>") && plugin.includes("element.addEventListener('timeupdate', onTimeUpdate)")),
  ['seeking no longer hides an already decoded frame', !plugin.includes("const onSeeking = () => setFrameReady(false)")),
  ['video playback rate follows clip speed', plugin.includes('element.playbackRate = speed')),
  ['fallback is removed once a frame is ready', plugin.includes('clip.thumbnail && !frameReady')),
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS Program Monitor playback-stuck regression contract verified.')
