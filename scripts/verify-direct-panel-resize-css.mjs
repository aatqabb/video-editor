import fs from 'node:fs'
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/DirectPanelResize.css', import.meta.url), 'utf8')
const checks = [
  ['direct resize CSS is loaded after App import', /import App from '.\/App\.jsx'\nimport '.\/DirectPanelResize\.css'/.test(main)],
  ['workspace remains flex based', /\.workspace-shell\{[\s\S]*display:flex!important/.test(css)],
  ['upper workspace remains horizontal flex', /\.workspace-shell>\.upper-workspace\{[\s\S]*display:flex!important/.test(css)],
  ['timeline can shrink to useful minimum', /min-height:96px/.test(css)],
  ['upper workspace keeps useful minimum', /min-height:120px/.test(css)],
  ['vertical hit target widened', /width:10px!important/.test(css)],
  ['horizontal hit target widened', /height:10px!important/.test(css)],
  ['program monitor is constrained to pane', /\.monitor-screen\{[\s\S]*max-width:100%/.test(css)],
]
let failed = false
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed = true }
if (failed) process.exit(1)
console.log('PASS direct panel resize CSS verified.')
