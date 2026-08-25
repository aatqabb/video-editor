import fs from 'node:fs'

const plugin = fs.readFileSync(new URL('./vite-premiere-panel-resize-plugin.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PremierePanelResize.css', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

const checks = [
  ['panel resize plugin enabled', /premierePanelResizePlugin\(\)/, vite],
  ['vertical panel resize uses pointer events', /onPointerDown=\{\(event\) => startVerticalResize/, plugin],
  ['timeline resize uses pointer events', /onPointerDown=\{startTimelineResize\}/, plugin],
  ['vertical resize runs through animation frames', /requestAnimationFrame\(apply\)/, plugin],
  ['vertical panels preserve center minimum', /const minCenter =/, plugin],
  ['timeline can collapse near Premiere size', /const minTimeline =/, plugin],
  ['timeline keeps usable upper workspace', /const maxTimeline =/, plugin],
  ['drag cursor stays locked during resize', /premiere-panel-resizing-col[\s\S]*premiere-panel-resizing-row/, plugin],
  ['timeline css minimum reduced', /\.timeline\{min-height:96px\}/, css],
  ['upper workspace css minimum retained', /\.upper-workspace\{min-height:120px/, css],
  ['splitter hover feedback exists', /resize-handle\.vertical:hover/, css],
]

let failed = false
for (const [name, pattern, source] of checks) {
  const ok = pattern.test(source)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS Premiere-style panel resize contract verified.')
