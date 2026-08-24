import { spawnSync } from 'node:child_process'

const run = (command, args = []) => {
  try {
    const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 15000 })
    return { ok: result.status === 0, text: `${result.stdout || ''}\n${result.stderr || ''}`.trim() }
  } catch (error) {
    return { ok: false, text: error?.message || String(error) }
  }
}

const isWindows = process.platform === 'win32'
console.log(`Platform: ${process.platform} ${process.arch}`)

let adapters = []
if (isWindows) {
  const ps = run('powershell.exe', [
    '-NoProfile',
    '-Command',
    "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,DriverVersion,VideoProcessor | ConvertTo-Json -Compress",
  ])
  if (ps.ok && ps.text) {
    try {
      const parsed = JSON.parse(ps.text)
      adapters = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      console.log(`GPU query output could not be parsed: ${ps.text}`)
    }
  } else {
    console.log(`GPU query unavailable: ${ps.text}`)
  }
} else {
  console.log('Windows GPU runtime query skipped on non-Windows host.')
}

for (const adapter of adapters) {
  console.log(`GPU: ${adapter.Name || 'Unknown'} | ${adapter.AdapterCompatibility || 'Unknown vendor'} | driver ${adapter.DriverVersion || 'unknown'}`)
}

const ffmpegBinary = process.env.VIDEO_EDITOR_FFMPEG || (isWindows ? 'ffmpeg.exe' : 'ffmpeg')
console.log(`FFmpeg binary: ${ffmpegBinary}`)
const ffmpeg = run(ffmpegBinary, ['-hide_banner', '-encoders'])
const encoderText = ffmpeg.text.toLowerCase()
const encoders = {
  nvidia: encoderText.includes('h264_nvenc'),
  intel: encoderText.includes('h264_qsv'),
  amd: encoderText.includes('h264_amf'),
  cpu: encoderText.includes('libx264'),
}

const decodersRun = run(ffmpegBinary, ['-hide_banner', '-hwaccels'])
const decoderText = decodersRun.text.toLowerCase()
const hwaccels = ['cuda', 'qsv', 'd3d11va', 'dxva2', 'vulkan'].filter((name) => decoderText.includes(name))

console.log(`FFmpeg: ${ffmpeg.ok ? 'available' : 'not available'}`)
console.log(`NVENC encoder compiled in: ${encoders.nvidia ? 'YES' : 'NO'}`)
console.log(`Intel QSV encoder compiled in: ${encoders.intel ? 'YES' : 'NO'}`)
console.log(`AMD AMF encoder compiled in: ${encoders.amd ? 'YES' : 'NO'}`)
console.log(`CPU libx264 fallback: ${encoders.cpu ? 'YES' : 'NO'}`)
console.log(`Hardware decode APIs compiled in: ${hwaccels.length ? hwaccels.join(', ') : 'none detected'}`)

const vendorText = adapters.map((adapter) => `${adapter.Name || ''} ${adapter.AdapterCompatibility || ''}`.toLowerCase()).join(' ')
const expectations = []
if (vendorText.includes('nvidia')) expectations.push(['NVIDIA hardware export encoder', encoders.nvidia])
if (vendorText.includes('intel')) expectations.push(['Intel hardware export encoder', encoders.intel])
if (vendorText.includes('amd') || vendorText.includes('advanced micro devices')) expectations.push(['AMD hardware export encoder', encoders.amd])
if (adapters.length && !vendorText.includes('hyper-v')) expectations.push(['Hardware decoding API', hwaccels.length > 0])

let failed = false
for (const [name, ok] of expectations) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (!isWindows) {
  console.log('Runtime vendor checks require a Windows machine; contract verification can still run in CI.')
  process.exit(0)
}

if (!adapters.length) {
  console.error('FAIL No Windows GPU adapters were returned by Win32_VideoController.')
  process.exit(1)
}
if (!ffmpeg.ok || !encoders.cpu) {
  console.error('FAIL Bundled/system FFmpeg runtime or CPU encoder is unavailable.')
  process.exit(1)
}
if (failed) process.exit(1)
console.log('PASS Windows GPU runtime verification completed for available hardware.')
