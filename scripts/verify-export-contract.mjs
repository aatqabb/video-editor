import fs from 'node:fs'

const exportWorkspace = fs.readFileSync('src/ExportWorkspace.jsx', 'utf8')
const exportEngine = fs.readFileSync('electron/exportEngine.cjs', 'utf8')
const mainProcess = fs.readFileSync('electron/main.cjs', 'utf8')
const preload = fs.readFileSync('electron/preload.cjs', 'utf8')

const checks = [
  ['renderer subscribes to export progress', exportWorkspace.includes('onExportProgress')],
  ['renderer displays numeric export percent', exportWorkspace.includes('Math.round(progress)')],
  ['renderer exposes cancel action', exportWorkspace.includes('cancelExport')],
  ['export engine emits percent from FFmpeg time', exportEngine.includes('percent: Math.max(0, Math.min(100, current / duration * 100))')],
  ['export engine contains MP3 audio-only branch', exportEngine.includes("options.format === 'mp3'") && exportEngine.includes("'-vn'")],
  ['export engine contains H.264 MP4 path', exportEngine.includes("'-c:v'") && exportEngine.includes("'-movflags', '+faststart'")],
  ['main process handles export cancellation', mainProcess.includes('cancel') && mainProcess.includes('export')],
  ['preload exposes export bridge', preload.includes('Export') || preload.includes('export')],
]

const failed = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`)
}

if (failed.length) {
  console.error(`\n${failed.length} export contract check(s) failed.`)
  process.exit(1)
}

console.log('\nExport contract wiring checks passed. Runtime Windows/export verification is still required separately.')
