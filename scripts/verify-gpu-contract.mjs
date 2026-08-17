import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('electron/main.cjs')
const preload = read('electron/preload.cjs')
const exportUi = read('src/ExportWorkspace.jsx')
const engine = read('electron/exportEngine.cjs')

const checks = [
  ['Electron GPU info query', main.includes("app.getGPUInfo('basic')")],
  ['Electron GPU feature status', main.includes('app.getGPUFeatureStatus()')],
  ['Hardware acceleration status', main.includes('app.isHardwareAccelerationEnabled()')],
  ['Export capability IPC', main.includes("desktop:get-export-capabilities")],
  ['Preload capability bridge', preload.includes('getExportCapabilities')],
  ['Export UI capability request', exportUi.includes('desktop.getExportCapabilities()')],
  ['GPU renderer guard', exportUi.includes("renderMode === 'GPU'") && exportUi.includes('hardwareEncoders')],
  ['NVENC detection', engine.includes('h264_nvenc')],
  ['Intel QSV detection', engine.includes('h264_qsv')],
  ['AMD AMF detection', engine.includes('h264_amf')],
  ['CPU H.264 fallback', engine.includes('libx264')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('\nGPU capability contract is wired. Runtime GPU support still requires verification on real Windows hardware.')
