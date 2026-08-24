import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
const gpu = read('scripts/verify-windows-gpu-export.cjs')
const stock = read('scripts/verify-live-stock.mjs')
const mic = read('scripts/verify-windows-microphone.cjs')
const preflight = read('scripts/verify-windows-preflight.cjs')
const acceptance = read('scripts/verify-windows-acceptance.cjs')

const checks = [
  ['Windows GPU QA command wired', pkg.scripts?.['verify:gpu:windows'] === 'node scripts/verify-windows-gpu-export.cjs'],
  ['Windows microphone QA command wired', pkg.scripts?.['verify:microphone:windows'] === 'npx electron scripts/verify-windows-microphone.cjs'],
  ['Live stock QA command wired', pkg.scripts?.['verify:stock:live'] === 'node scripts/verify-live-stock.mjs'],
  ['Windows preflight command wired', pkg.scripts?.['verify:windows:preflight'] === 'node scripts/verify-windows-preflight.cjs'],
  ['Windows acceptance command wired', pkg.scripts?.['verify:windows:acceptance'] === 'node scripts/verify-windows-acceptance.cjs'],
  ['GPU QA tests NVENC', gpu.includes('h264_nvenc')],
  ['GPU QA tests Intel QSV', gpu.includes('h264_qsv')],
  ['GPU QA tests AMD AMF', gpu.includes('h264_amf')],
  ['GPU QA generates real MP4 output', gpu.includes("'-f', 'lavfi'") && gpu.includes('.mp4')],
  ['Pexels live key supported', stock.includes('PEXELS_API_KEY') && stock.includes('api.pexels.com/videos/search')],
  ['Pixabay live key supported', stock.includes('PIXABAY_API_KEY') && stock.includes('pixabay.com/api/videos')],
  ['Live stock test validates video data', stock.includes('video_files') && stock.includes('hit.videos')],
  ['Microphone QA uses getUserMedia', mic.includes('getUserMedia({ audio: true })')],
  ['Microphone QA records real bytes', mic.includes('MediaRecorder') && mic.includes('blob.size > 0')],
  ['Preflight checks API-key readiness', preflight.includes('PEXELS_API_KEY') && preflight.includes('PIXABAY_API_KEY')],
  ['Preflight checks prepared FFmpeg', preflight.includes('resources') && preflight.includes('ffmpeg.exe')],
  ['Preflight writes diagnostic report', preflight.includes('windows-preflight-report.json')],
  ['Acceptance runner includes preflight', acceptance.includes("'verify:windows:preflight'" )],
  ['Acceptance runner includes final regression', acceptance.includes("'verify:final'")],
  ['Acceptance runner includes microphone', acceptance.includes("'verify:microphone:windows'" )],
  ['Acceptance runner includes live stock', acceptance.includes("'verify:stock:live'" )],
  ['Acceptance runner includes GPU export', acceptance.includes("'verify:gpu:windows'" )],
  ['Acceptance runner writes report', acceptance.includes('windows-acceptance-report.json')],
  ['Acceptance runner attempts all checks', acceptance.includes('report.checks.every') && !acceptance.includes('process.exit(result.status || 1)')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS hands-on Windows QA tooling contract verified, including preflight diagnostics, microphone capture, live stock, GPU export, and comprehensive acceptance reporting.')
