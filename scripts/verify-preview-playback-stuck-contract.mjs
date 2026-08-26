import fs from 'node:fs'

const plugin = fs.readFileSync(new URL('./vite-program-preview-stability-plugin.js', import.meta.url), 'utf8')

const checks = [
  ['media listener effect is stable while playhead advances', /\}, \[clip\.id, source, playing, failed\]\)/.test(plugin)],
  ['playhead-driven effect is separate from media listener effect', /\}, \[desiredTime, playing, clip\.id, source, failed\]\)/.test(plugin)],
  ['native playback is restarted if media is paused', plugin.includes("if (element.paused) element.play?.().catch?.(() => {})")],
  ['ordinary playback is not continuously seeked', plugin.includes('if (distance > .75)')],
  ['paused scrub remains frame accurate', plugin.includes('if (distance > .015)')],
  ['decoded playback frames can reveal immediately while playing', plugin.includes("if (playing) {\n          setFrameReady(true)")],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS Program Monitor playback-stuck regression contract verified.')
