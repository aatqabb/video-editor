import fs from 'node:fs'

const runtime = fs.readFileSync(new URL('../src/panelResizeRuntime.js', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PremierePanelResize.css', import.meta.url), 'utf8')

const checks = [
  ['runtime CSS imported directly', main.includes("import './PremierePanelResize.css'" )],
  ['runtime installer imported', main.includes('installPanelResizeRuntime')],
  ['runtime installer executed', main.includes('const removePanelResizeRuntime = installPanelResizeRuntime()')],
  ['document capture pointerdown used', runtime.includes("document.addEventListener('pointerdown', onPointerDown, true)")],
  ['horizontal splitter writes timeline height variable', runtime.includes('--runtime-timeline-height')],
  ['horizontal splitter writes upper height variable', runtime.includes('--runtime-upper-height')],
  ['left splitter writes width variable', runtime.includes('--runtime-left-width')],
  ['right splitter writes width variable', runtime.includes('--runtime-right-width')],
  ['resize updates use requestAnimationFrame', runtime.includes('requestAnimationFrame(apply)')],
  ['timeline runtime variable overrides React height', css.includes('height:var(--runtime-timeline-height,auto)!important')],
  ['upper runtime variable overrides React height', css.includes('height:var(--runtime-upper-height,auto)!important')],
  ['left runtime variable overrides React width', css.includes('width:var(--runtime-left-width,32%)!important')],
  ['right runtime variable overrides React width', css.includes('width:var(--runtime-right-width,33%)!important')],
  ['splitter hit target is widened', css.includes('.resize-handle.vertical{width:10px') && css.includes('.resize-handle.horizontal{height:11px')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS direct runtime panel resize contract verified.')
