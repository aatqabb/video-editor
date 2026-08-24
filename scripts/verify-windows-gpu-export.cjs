const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function candidates() {
  return [
    process.env.VIDEO_EDITOR_FFMPEG,
    path.join(process.cwd(), 'release', 'win-unpacked', 'resources', 'ffmpeg', 'ffmpeg.exe'),
    path.join(process.cwd(), 'resources', 'ffmpeg', 'ffmpeg.exe'),
    'ffmpeg.exe',
    'ffmpeg',
  ].filter(Boolean)
}

function canRun(binary) {
  try {
    const result = spawnSync(binary, ['-hide_banner', '-version'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
    return result.status === 0
  } catch { return false }
}

const ffmpeg = candidates().find(canRun)
if (!ffmpeg) {
  console.error('FAIL no runnable FFmpeg found. Run npm run package:win first or set VIDEO_EDITOR_FFMPEG.')
  process.exit(1)
}

const enc = spawnSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8', windowsHide: true, timeout: 10000 })
const encText = `${enc.stdout || ''}\n${enc.stderr || ''}`
const hardware = ['h264_nvenc', 'h264_qsv', 'h264_amf'].filter((name) => encText.includes(name))
if (!hardware.length) {
  console.error('FAIL bundled FFmpeg exposes no supported hardware H.264 encoder (NVENC/QSV/AMF).')
  process.exit(1)
}

const outDir = path.join(process.cwd(), 'release', 'gpu-qa')
fs.mkdirSync(outDir, { recursive: true })
let passed = false

for (const encoder of hardware) {
  const output = path.join(outDir, `${encoder}.mp4`)
  try { fs.rmSync(output, { force: true }) } catch {}
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '3', '-c:v', encoder, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', output,
  ]
  const result = spawnSync(ffmpeg, args, { encoding: 'utf8', windowsHide: true, timeout: 60000 })
  if (result.status !== 0) {
    console.log(`SKIP ${encoder}: runtime encode failed on this machine`)
    const detail = `${result.stderr || result.stdout || ''}`.trim().slice(-1000)
    if (detail) console.log(detail)
    continue
  }
  const size = fs.existsSync(output) ? fs.statSync(output).size : 0
  if (size < 10000) {
    console.log(`SKIP ${encoder}: output file was unexpectedly small (${size} bytes)`)
    continue
  }
  console.log(`PASS ${encoder}: real hardware export produced ${output} (${size} bytes)`)
  passed = true
}

if (!passed) {
  console.error('FAIL none of the detected GPU encoders completed a real export on this Windows machine.')
  process.exit(1)
}
console.log('PASS real Windows GPU export verification completed.')
