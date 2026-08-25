import fs from 'node:fs'

const runtime = fs.readFileSync(new URL('../src/panelResizeRuntime.js', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PremierePanelResize.css', import.meta.url), 'utf8')

const checks = [
  ['runtime CSS imported directly', main.includes("import './PremierePanelResize.css'" )],
  ['runtime installer imported', main.includes('installPanelResizeRuntime')],
  ['runtime installer executed', main.includes('const removePanelResizeRuntime = installPanelResizeRuntime()')],
  ['document capture pointerdown used', runtime.includes("document.addEventListener('pointerdown', onPointerDown, true)")],
  ['horizontal splitter writes timeline height directly', runtime.includes("timeline.style.setProperty('height'")],
  ['horizontal splitter writes upper height directly', runtime.includes("upper.style.setProperty('height'")],
  ['left splitter writes width directly', runtime.includes("leftPanel.style.setProperty('width'")],
  ['right splitter writes width directly', runtime.includes("rightPanel.style.setProperty('width'")],
  ['direct dimensions use important priority', runtime.includes("'important')")],
  ['legacy runtime CSS variables removed during drag', runtime.includes("shell.style.removeProperty('--runtime-timeline-height')") && runtime.includes("shell.style.removeProperty('--runtime-left-width')")],
  ['resize updates use requestAnimationFrame', runtime.includes('requestAnimationFrame(apply)')],
  ['saved dimensions are reapplied after React mutations', runtime.includes('new MutationObserver') && runtime.includes('applySaved')],
  ['timeline retains CSS fallback override', css.includes('height:var(--runtime-timeline-height,auto)!important')],
  ['upper retains CSS fallback override', css.includes('height:var(--runtime-upper-height,auto)!important')],
  ['splitter hit target is widened', css.includes('.resize-handle.vertical{width:10px') && css.includes('.resize-handle.horizontal{height:11px')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS direct DOM panel resize contract verified.')
