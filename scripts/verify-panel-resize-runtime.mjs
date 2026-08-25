import fs from 'node:fs'

const runtime = fs.readFileSync(new URL('../src/panelResizeRuntime.js', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PremierePanelResize.css', import.meta.url), 'utf8')

const checks = [
  ['runtime CSS imported directly', main.includes("import './PremierePanelResize.css'" )],
  ['runtime installer imported', main.includes('installPanelResizeRuntime')],
  ['runtime installer executed', main.includes('const removePanelResizeRuntime = installPanelResizeRuntime()')],
  ['document capture pointerdown used', runtime.includes("document.addEventListener('pointerdown', onPointerDown, true)")],
  ['workspace shell is real grid splitter', css.includes('display:grid!important') && css.includes('grid-template-rows:')],
  ['upper workspace is nested grid splitter', css.includes('grid-template-columns:')],
  ['React inline panel widths neutralized', css.includes('width:auto!important')],
  ['React inline heights neutralized', css.includes('height:auto!important')],
  ['horizontal drag writes grid rows', runtime.includes('shell.style.gridTemplateRows')],
  ['vertical drag writes grid columns', runtime.includes('upper.style.gridTemplateColumns')],
  ['minimum timeline size preserved', runtime.includes('96') && css.includes('96px')],
  ['minimum center size preserved', runtime.includes('220') && css.includes('220px')],
  ['resize updates use requestAnimationFrame', runtime.includes('requestAnimationFrame(apply)')],
  ['splitter hit targets are ten pixels', css.includes('width:10px!important') && css.includes('height:10px!important')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS nested grid split pane contract verified.')
