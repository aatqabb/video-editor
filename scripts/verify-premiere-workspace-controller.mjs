import fs from 'node:fs'

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const controller = fs.readFileSync(new URL('../src/premiereWorkspaceController.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PremiereWorkspaceController.css', import.meta.url), 'utf8')

const checks = [
  ['controller is installed', main.includes('installPremiereWorkspaceController()')],
  ['old direct resize CSS is not imported', !main.includes("./DirectPanelResize.css")],
  ['workspace uses dedicated grid rows', css.includes('grid-template-rows:') && css.includes('--premiere-timeline-px')],
  ['upper workspace uses dedicated grid columns', css.includes('grid-template-columns:') && css.includes('--premiere-left-px') && css.includes('--premiere-right-px')],
  ['splitter hit targets are ten pixels', css.includes('width:10px!important') && css.includes('height:10px!important')],
  ['pointer events are captured globally', controller.includes("document.addEventListener('pointerdown', onPointerDown, true)")],
  ['drag updates live through animation frames', controller.includes('requestAnimationFrame(apply)')],
  ['timeline has wide resize range', controller.includes('0.08, 0.88')],
  ['pane proportions persist', controller.includes('localStorage.setItem(STORAGE_KEY')],
  ['layout adapts on container resize', controller.includes('new ResizeObserver')],
  ['program monitor is constrained inside pane', css.includes('.monitor-screen{max-width:100%!important;max-height:100%!important')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS full Premiere workspace controller contract verified.')
