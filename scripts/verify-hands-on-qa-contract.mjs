import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
const gpu = read('scripts/verify-windows-gpu-export.cjs')
const stock = read('scripts/verify-live-stock.mjs')

const checks = [
  ['Windows GPU QA command wired', pkg.scripts?.['verify:gpu:windows'] === 'node scripts/verify-windows-gpu-export.cjs'],
  ['Live stock QA command wired', pkg.scripts?.['verify:stock:live'] === 'node scripts/verify-live-stock.mjs'],
  ['GPU QA tests NVENC', gpu.includes('h264_nvenc')],
  ['GPU QA tests Intel QSV', gpu.includes('h264_qsv')],
  ['GPU QA tests AMD AMF', gpu.includes('h264_amf')],
  ['GPU QA generates real MP4 output', gpu.includes("'-f', 'lavfi'") && gpu.includes('.mp4')],
  ['Pexels live key supported', stock.includes('PEXELS_API_KEY') && stock.includes('api.pexels.com/videos/search')],
  ['Pixabay live key supported', stock.includes('PIXABAY_API_KEY') && stock.includes('pixabay.com/api/videos')],
  ['Live stock test validates video data', stock.includes('video_files') && stock.includes('hit.videos')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS hands-on Windows QA tooling contract verified.')
