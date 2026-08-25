import fs from 'node:fs'
import { premierePanelResizePlugin } from './vite-premiere-panel-resize-plugin.js'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replace(/\r\n?/g, '\n')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PremierePanelResize.css', import.meta.url), 'utf8')
const transformed = premierePanelResizePlugin().transform(source, '/repo/src/App.jsx')?.code || source

const checks = [
  ['resize CSS imported directly', main.includes("import './PremierePanelResize.css'")],
  ['legacy document runtime removed', !main.includes('installPanelResizeRuntime')],
  ['workspace shell is real grid splitter', css.includes('display:grid!important') && css.includes('grid-template-rows:')],
  ['upper workspace is nested grid splitter', css.includes('grid-template-columns:')],
  ['timeline state drives grid rows', transformed.includes('gridTemplateRows: `minmax(120px, ${100 - timelineHeight}fr) 10px minmax(96px, ${timelineHeight}fr)`')],
  ['panel state drives grid columns', transformed.includes('gridTemplateColumns: `minmax(145px, ${leftWidth}fr) 10px minmax(220px, ${Math.max(1, 100 - leftWidth - rightWidth)}fr) 10px minmax(145px, ${rightWidth}fr)`')],
  ['vertical pointer drag is wired', transformed.includes("onPointerDown={(event) => startVerticalResize('left', event)}") && transformed.includes("onPointerDown={(event) => startVerticalResize('right', event)}")],
  ['horizontal pointer drag is wired', transformed.includes('onPointerDown={startTimelineResize}')],
  ['pointer moves update through animation frames', transformed.includes('window.requestAnimationFrame(apply)')],
  ['minimum timeline size preserved', transformed.includes('(96 / Math.max(1, rect.height))') && css.includes('96px')],
  ['minimum center size preserved', transformed.includes('(220 / Math.max(1, rect.width))') && css.includes('220px')],
  ['splitter hit targets are ten pixels', css.includes('width:10px!important') && css.includes('height:10px!important')],
  ['panel contents remain constrained', css.includes('.panel-body,.center-body,.monitor,.monitor-screen{min-width:0;min-height:0}')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS React-driven nested grid split pane contract verified.')
