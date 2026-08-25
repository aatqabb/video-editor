import fs from 'node:fs'

const runtime = fs.readFileSync(new URL('../src/timelineLayerBalance.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/TimelineLayerSpacing.css', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

const checks = [
  ['runtime measures actual timeline body height', /timelineBody\.clientHeight/, runtime],
  ['runtime subtracts ruler height', /bodyHeight\s*-\s*rulerHeight/, runtime],
  ['runtime sums rendered track heights', /rowHeights\.reduce/, runtime],
  ['runtime computes half of remaining free space', /Math\.floor\(freeSpace\s*\/\s*2\)/, runtime],
  ['runtime updates both track columns', /controls\.style\.setProperty\('--timeline-layer-stack-offset'/, runtime],
  ['runtime updates lane column', /lanes\.style\.setProperty\('--timeline-layer-stack-offset'/, runtime],
  ['runtime marks the actual first rendered track row', /rows\[0\]\.classList\.add\('timeline-stack-first'\)/, runtime],
  ['runtime marks the actual last rendered track row', /rows\[rows\.length - 1\]\.classList\.add\('timeline-stack-last'\)/, runtime],
  ['runtime reacts to track deletion', /MutationObserver/, runtime],
  ['runtime reacts to timeline resize', /ResizeObserver/, runtime],
  ['CSS targets marked first row instead of first-of-type', /\.track-control\.timeline-stack-first,\.track-lane\.timeline-stack-first/, css],
  ['CSS targets marked last row instead of last-of-type', /\.track-control\.timeline-stack-last,\.track-lane\.timeline-stack-last/, css],
  ['broken first-of-type selector removed', !/track-control:first-of-type|track-lane:first-of-type/.test(css), css],
  ['CSS uses measured offset above first row', /margin-top:var\(--timeline-layer-stack-offset,0px\)!important/, css],
  ['CSS uses measured offset below last row', /margin-bottom:var\(--timeline-layer-stack-offset,0px\)!important/, css],
  ['old percentage min-height balancing removed', !/min-height:calc\(100%\s*-\s*38px\)/.test(css), css],
  ['old auto-margin balancing removed', !/margin-(top|bottom):auto/.test(css), css],
  ['runtime installed in application entrypoint', /installTimelineLayerBalance\(\)/, main],
]

let failed = false
for (const [name, test, source] of checks) {
  const ok = typeof test === 'boolean' ? test : test.test(source)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('PASS measured timeline layer balance contract verified.')
