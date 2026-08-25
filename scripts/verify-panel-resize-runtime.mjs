import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replace(/\r\n?/g, '\n')
const css = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

const checks = [
  ['no resize override CSS imported', !main.includes("PremierePanelResize.css")],
  ['no document resize runtime installed', !main.includes('installPanelResizeRuntime')],
  ['no Vite resize transform enabled', !vite.includes('premierePanelResizePlugin')],
  ['left/right widths update React state', source.includes('setLeftWidth(') && source.includes('setRightWidth(')],
  ['timeline height updates React state', source.includes('setTimelineHeight(')],
  ['vertical mousemove is live during drag', source.includes("window.addEventListener('mousemove', onMove)")],
  ['horizontal mousemove is live during drag', source.includes("window.addEventListener('mousemove', onMove)")],
  ['upper workspace height follows timeline state', source.includes('style={{ height: `${100 - timelineHeight}%` }}')],
  ['left panel width follows state', source.includes('style={{ width: `${leftWidth}%` }}')],
  ['right panel width follows state', source.includes('style={{ width: `${rightWidth}%` }}')],
  ['timeline height is passed independently', source.includes('height={timelineHeight}')],
  ['workspace shell allows flex reflow', css.includes('.workspace-shell{flex:1;min-height:0;display:flex;flex-direction:column}')],
  ['upper workspace is horizontal flex', css.includes('.upper-workspace{display:flex;min-height:170px}')],
  ['center panel fills remaining width', css.includes('.center-panel{flex:1;min-width:240px}')],
  ['timeline is independently sized', css.includes('.timeline{flex-shrink:0')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS direct-source live panel resize runtime contract verified.')
