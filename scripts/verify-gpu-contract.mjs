import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { summarizeGpuCapabilities } = require('../electron/gpuCapabilities.cjs')

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('electron/main.cjs')
const preload = read('electron/preload.cjs')
const exportUi = read('src/ExportWorkspace.jsx')
const engine = read('electron/exportEngine.cjs')

const syntheticGpuInfo = {
  gpuDevice: [
    { active: true, vendorString: 'NVIDIA Corporation', deviceString: 'GeForce RTX Test', vendorId: 0x10de },
    { active: false, vendorString: 'Intel', deviceString: 'Intel UHD Test', vendorId: 0x8086 },
    { active: false, vendorString: 'Advanced Micro Devices, Inc.', deviceString: 'Radeon Test', vendorId: 0x1002 },
  ],
}
const syntheticFfmpeg = {
  hardwareEncoders: ['h264_nvenc', 'h264_qsv', 'h264_amf'],
  hardwareAccelerators: ['cuda', 'qsv', 'd3d11va', 'dxva2'],
}
const summary = summarizeGpuCapabilities(syntheticGpuInfo, syntheticFfmpeg)
const unknownSummary = summarizeGpuCapabilities({ gpuDevice: [{ active: true, vendorString: 'Microsoft', deviceString: 'Basic Render Driver' }] }, syntheticFfmpeg)

const checks = [
  ['Electron GPU info query', main.includes("app.getGPUInfo('basic')")],
  ['Electron GPU feature status', main.includes('app.getGPUFeatureStatus()')],
  ['Hardware acceleration status', main.includes('app.isHardwareAccelerationEnabled()')],
  ['Export capability IPC', main.includes('desktop:get-export-capabilities')],
  ['Normalized GPU summary IPC', main.includes('summarizeGpuCapabilities') && main.includes('gpuCapabilities')],
  ['Preload capability bridge', preload.includes('getExportCapabilities')],
  ['Export UI capability request', exportUi.includes('desktop.getExportCapabilities()')],
  ['GPU renderer guard uses matched hardware encoders', exportUi.includes("renderMode === 'GPU'") && exportUi.includes('availableHardwareEncoders')],
  ['NVENC detection', engine.includes('h264_nvenc')],
  ['Intel QSV detection', engine.includes('h264_qsv')],
  ['AMD AMF detection', engine.includes('h264_amf')],
  ['CPU H.264 fallback', engine.includes('libx264')],
  ['FFmpeg hwaccel command is probed', engine.includes("['-hide_banner', '-hwaccels']")],
  ['CUDA decode backend is probed', engine.includes("'cuda'")],
  ['QSV decode backend is probed', engine.includes("'qsv'")],
  ['D3D11VA decode backend is probed', engine.includes("'d3d11va'")],
  ['DXVA2 decode backend is probed', engine.includes("'dxva2'")],
  ['FFmpeg capability result exposes hardware accelerators', engine.includes('hardwareAccelerators')],
  ['Synthetic NVIDIA adapter maps to NVENC', summary.adapters[0]?.vendor === 'nvidia' && summary.adapters[0]?.encoder === 'h264_nvenc' && summary.adapters[0]?.encoderAvailable],
  ['Synthetic Intel adapter maps to QSV', summary.adapters[1]?.vendor === 'intel' && summary.adapters[1]?.encoder === 'h264_qsv' && summary.adapters[1]?.encoderAvailable],
  ['Synthetic AMD adapter maps to AMF', summary.adapters[2]?.vendor === 'amd' && summary.adapters[2]?.encoder === 'h264_amf' && summary.adapters[2]?.encoderAvailable],
  ['NVIDIA decode candidates include CUDA/D3D11VA', summary.adapters[0]?.decodeBackendCandidates.includes('cuda') && summary.adapters[0]?.decodeBackendCandidates.includes('d3d11va')],
  ['Intel decode candidates include QSV/D3D11VA', summary.adapters[1]?.decodeBackendCandidates.includes('qsv') && summary.adapters[1]?.decodeBackendCandidates.includes('d3d11va')],
  ['AMD decode candidates include D3D11VA', summary.adapters[2]?.decodeBackendCandidates.includes('d3d11va')],
  ['Hardware decode availability summarized', summary.hasHardwareDecoder && summary.availableHardwareDecoders.includes('d3d11va')],
  ['Active adapter preserved', summary.activeAdapter?.device === 'GeForce RTX Test'],
  ['Unknown adapter does not claim hardware encode/decode', !unknownSummary.hasHardwareEncoder && !unknownSummary.hasHardwareDecoder && unknownSummary.adapters[0]?.vendor === 'unknown'],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('\nGPU capability contract verifies FFmpeg hwaccel probing plus deterministic vendor encode/decode mappings. Real NVIDIA/Intel/AMD runtime support still requires verification on Windows hardware.')
