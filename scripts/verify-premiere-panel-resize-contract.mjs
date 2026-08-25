import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replace(/\r\n?/g, '\n')
const css = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

const checks = [
  ['panel resize transform disabled', !vite.includes('premierePanelResizePlugin')],
  ['override resize CSS not imported', !main.includes("PremierePanelResize.css")],
  ['legacy document runtime removed', !main.includes('installPanelResizeRuntime')],
  ['vertical resize lives in App source', /const startVerticalResize = \(side, event\) =>/.test(source)],
  ['timeline resize lives in App source', /const startTimelineResize = \(event\) =>/.test(source)],
  ['left panel width is state-driven', /left-panel" style=\{\{ width: `\$\{leftWidth\}%` \}\}/.test(source)],
  ['right panel width is state-driven', /right-panel" style=\{\{ width: `\$\{rightWidth\}%` \}\}/.test(source)],
  ['upper workspace height is state-driven', /upper-workspace" style=\{\{ height: `\$\{100 - timelineHeight\}%` \}\}/.test(source)],
  ['timeline receives independent height state', /<Timeline[\s\S]*height=\{timelineHeight\}/.test(source)],
  ['vertical splitters are present in source', (source.match(/resize-handle vertical/g) || []).length === 2],
  ['horizontal splitter is present in source', source.includes('resize-handle horizontal')],
  ['workspace uses direct flex reflow', /\.workspace-shell\{[^}]*display:flex[^}]*flex-direction:column/.test(css)],
  ['upper workspace uses direct horizontal flex', /\.upper-workspace\{[^}]*display:flex/.test(css)],
  ['center panel absorbs remaining width', /\.center-panel\{[^}]*flex:1/.test(css)],
  ['timeline does not flex-shrink', /\.timeline\{[^}]*flex-shrink:0/.test(css)],
  ['vertical resize cursor exists', /\.resize-handle\.vertical\{[^}]*cursor:col-resize/.test(css)],
  ['horizontal resize cursor exists', /\.resize-handle\.horizontal\{[^}]*cursor:row-resize/.test(css)],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS direct-source Premiere panel resize contract verified.')
