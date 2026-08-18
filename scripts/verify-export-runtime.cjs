const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { probeFfmpeg, startExport } = require('../electron/exportEngine.cjs')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function run(binary, args, label) {
  const result = spawnSync(binary, args, { encoding: 'utf8', windowsHide: true, timeout: 180000 })
  if (result.status !== 0) throw new Error(`${label} failed: ${(result.stderr || result.stdout || '').slice(-2000)}`)
  return result
}

function outputExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 1024
}

function ffprobeBinary(ffmpegBinary) {
  const ext = path.extname(ffmpegBinary)
  const base = path.basename(ffmpegBinary, ext).toLowerCase()
  if (base === 'ffmpeg') return path.join(path.dirname(ffmpegBinary), `ffprobe${ext}`)
  return process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
}

function probeVideoSize(ffmpegBinary, filePath) {
  const result = run(ffprobeBinary(ffmpegBinary), [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0:s=x', filePath,
  ], 'FFprobe video dimensions')
  return String(result.stdout || '').trim()
}

async function main() {
  const capabilities = probeFfmpeg()
  assert(capabilities.available && capabilities.binary, 'FFmpeg is unavailable on this runtime')
  assert(capabilities.encoders.includes('libx264'), 'libx264 is required for CPU export smoke tests')

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-editor-export-smoke-'))
  const source = path.join(temp, 'source.mp4')
  run(capabilities.binary, [
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
    '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', source,
  ], 'Synthetic source generation')
  assert(outputExists(source), 'Synthetic source was not created')

  const resolutions = [
    ['720p', 1280, 720],
    ['1080p', 1920, 1080],
    ['2K', 2560, 1440],
    ['4K Ultra HD', 3840, 2160],
  ]

  let progressEvents = 0
  for (const [name, width, height] of resolutions) {
    const out = path.join(temp, `${name.replace(/\W+/g, '-')}.mp4`)
    const manifest = {
      settings: { width, height, fps: 30 },
      clips: [
        { id: 'v1', type: 'video', trackId: 'V1', sourcePath: source, start: 0, duration: 1.2, video: { fitMode: 'Fit', scale: 100, opacity: 100 } },
        { id: 'a1', type: 'audio', trackId: 'A1', sourcePath: source, start: 0, duration: 1.2, audio: { volume: 100 } },
      ],
      options: { format: 'mp4', resolution: name, fps: 30, quality: 'Low', renderMode: 'CPU', audioBitrate: '128k' },
    }
    const job = startExport(manifest, out, (event) => {
      if (typeof event?.percent === 'number') progressEvents += 1
    })
    const result = await job.done
    assert(result.encoder === 'libx264', `${name} did not use CPU H.264 encoder`)
    assert(outputExists(out), `${name} MP4 output was not created`)
  }

  const mp3 = path.join(temp, 'audio-only.mp3')
  const mp3Job = startExport({
    settings: { width: 1920, height: 1080, fps: 30 },
    clips: [{ id: 'a1', type: 'audio', trackId: 'A1', sourcePath: source, start: 0, duration: 1.5, audio: { volume: 100 } }],
    options: { format: 'mp3', quality: 'Low', renderMode: 'CPU', audioBitrate: '128k' },
  }, mp3, (event) => {
    if (typeof event?.percent === 'number') progressEvents += 1
  })
  await mp3Job.done
  assert(outputExists(mp3), 'MP3 audio-only output was not created')
  assert(progressEvents > 0, 'No real FFmpeg progress callbacks were observed')

  const source4k = path.join(temp, 'source-4k.mp4')
  run(capabilities.binary, [
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=3840x2160:rate=30',
    '-t', '1.2', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p',
    source4k,
  ], 'Synthetic 4K source generation')
  assert(outputExists(source4k), 'Synthetic 4K source was not created')
  assert(probeVideoSize(capabilities.binary, source4k) === '3840x2160', 'Synthetic stress source is not actually 3840x2160')

  const source4kOut = path.join(temp, '4k-source-stress.mp4')
  const source4kJob = startExport({
    settings: { width: 3840, height: 2160, fps: 30 },
    clips: [{ id: 'v4k', type: 'video', trackId: 'V1', sourcePath: source4k, start: 0, duration: 1, video: { fitMode: 'Fit', scale: 100, opacity: 100 } }],
    options: { format: 'mp4', resolution: '4K Ultra HD', fps: 30, quality: 'Low', renderMode: 'CPU', audioBitrate: '128k' },
  }, source4kOut, () => {})
  const source4kResult = await source4kJob.done
  assert(source4kResult.encoder === 'libx264', '4K source stress export did not use CPU H.264 encoder')
  assert(outputExists(source4kOut), '4K source-footage stress output was not created')
  assert(probeVideoSize(capabilities.binary, source4kOut) === '3840x2160', '4K source-footage stress output is not 3840x2160')

  const cancelOut = path.join(temp, 'cancelled.mp4')
  const cancelManifest = {
    settings: { width: 3840, height: 2160, fps: 60 },
    clips: [{ id: 'v1', type: 'video', trackId: 'V1', sourcePath: source, start: 0, duration: 3, video: { fitMode: 'Fill', scale: 100, opacity: 100 } }],
    options: { format: 'mp4', resolution: '4K Ultra HD', fps: 60, quality: 'High', renderMode: 'CPU' },
  }
  const cancelJob = startExport(cancelManifest, cancelOut, () => {})
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert(cancelJob.child, 'Cancellation test did not start an FFmpeg child process')
  cancelJob.child.kill('SIGTERM')
  let cancelled = false
  try {
    await cancelJob.done
  } catch {
    cancelled = true
  }
  assert(cancelled, 'Cancelled export unexpectedly completed successfully')

  console.log('Export runtime smoke passed: MP4 720p/1080p/2K/4K, MP3, progress callbacks, verified 3840x2160 source-footage stress, and process cancellation.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
