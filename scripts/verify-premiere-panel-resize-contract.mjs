import fs from 'node:fs'
import { premierePanelResizePlugin } from './vite-premiere-panel-resize-plugin.js'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replace(/\r\n?/g, '\n')
const css = fs.readFileSync(new URL('../src/PremierePanelResize.css', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
const transformed = premierePanelResizePlugin().transform(source, '/repo/src/App.jsx')?.code || source

const checks = [
  ['panel resize plugin enabled', /premierePanelResizePlugin\(\)/, vite],
  ['vertical panel resize uses pointer events', /onPointerDown=\{\(event\) => startVerticalResize/, transformed],
  ['timeline resize uses pointer events', /onPointerDown=\{startTimelineResize\}/, transformed],
  ['vertical resize runs through animation frames', /requestAnimationFrame\(apply\)/, transformed],
  ['vertical panels preserve center minimum', /const minCenter =/, transformed],
  ['timeline can collapse near Premiere size', /const minTimeline =/, transformed],
  ['timeline keeps usable upper workspace', /const maxTimeline =/, transformed],
  ['drag cursor stays locked during resize', /premiere-panel-resizing-col[\s\S]*premiere-panel-resizing-row/, transformed],
  ['panel resize css is imported', /PremierePanelResize\.css/, transformed],
  ['timeline css minimum reduced', /\.workspace-shell>\.timeline\{[^}]*min-height:96px/, css],
  ['upper workspace css minimum retained', /\.workspace-shell>\.upper-workspace\{[^}]*min-height:120px/, css],
  ['splitter hover feedback exists', /resize-handle\.vertical:hover::after/, css],
]

let failed = false
for (const [name, pattern, sourceText] of checks) {
  const ok = pattern.test(sourceText)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS Premiere-style panel resize contract verified.')
