import fs from 'node:fs'
import { premierePanelResizePlugin } from './vite-premiere-panel-resize-plugin.js'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replace(/\r\n?/g, '\n')
const css = fs.readFileSync(new URL('../src/PremierePanelResize.css', import.meta.url), 'utf8')
const runtime = fs.readFileSync(new URL('../src/panelResizeRuntime.js', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
const transformed = premierePanelResizePlugin().transform(source, '/repo/src/App.jsx')?.code || source

const checks = [
  ['panel resize plugin enabled', /premierePanelResizePlugin\(\)/, vite],
  ['vertical panel resize uses pointer events', /onPointerDown=\{\(event\) => startVerticalResize/, transformed],
  ['timeline resize uses pointer events', /onPointerDown=\{startTimelineResize\}/, transformed],
  ['resize updates run through animation frames', /requestAnimationFrame\(apply\)/, runtime],
  ['outer workspace is a grid split pane', /\.workspace-shell\{[^}]*display:grid[^}]*grid-template-rows:/, css],
  ['upper workspace is a nested grid split pane', /\.workspace-shell>\.upper-workspace\{[^}]*display:grid[^}]*grid-template-columns:/, css],
  ['timeline minimum remains usable', /minmax\(96px/, css],
  ['upper workspace minimum remains usable', /minmax\(120px/, css],
  ['side panels preserve minimum width', /minmax\(145px/, css],
  ['center panel preserves minimum width', /minmax\(220px/, css],
  ['horizontal drag writes grid rows directly', /gridTemplateRows/, runtime],
  ['vertical drag writes grid columns directly', /gridTemplateColumns/, runtime],
  ['drag cursor stays locked during resize', /premiere-panel-resizing-col[\s\S]*premiere-panel-resizing-row/, runtime],
  ['splitter hover feedback exists', /\.resize-handle:hover::after\{background:#2f8cff\}/, css],
  ['panel content remains constrained to panes', /\.panel-body,\.center-body,\.monitor,\.monitor-screen\{min-width:0;min-height:0\}/, css],
  ['panel body scroll stays inside pane', /\.panel-body\{overflow:auto\}/, css],
]

let failed = false
for (const [name, pattern, sourceText] of checks) {
  const ok = pattern.test(sourceText)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS Premiere-style nested split-pane contract verified.')
