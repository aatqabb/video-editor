const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const https = require('node:https')
const { spawnSync } = require('node:child_process')

const SOURCE_URL = process.env.VIDEO_EDITOR_FFMPEG_URL || 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
const destination = path.join(__dirname, '..', 'resources', 'ffmpeg')
const ffmpegPath = path.join(destination, 'ffmpeg.exe')
const ffprobePath = path.join(destination, 'ffprobe.exe')

function download(url, target, redirects = 0) {
  if (redirects > 8) throw new Error('Too many redirects while downloading FFmpeg')
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'video-editor-build' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        download(new URL(response.headers.location, url).toString(), target, redirects + 1).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`FFmpeg download failed with HTTP ${response.statusCode}`))
        return
      }
      const stream = fs.createWriteStream(target)
      response.pipe(stream)
      stream.on('finish', () => stream.close(resolve))
      stream.on('error', reject)
    })
    request.on('error', reject)
  })
}

function findFile(root, name) {
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name.toLowerCase() === name.toLowerCase()) return full
    }
  }
  return null
}

async function main() {
  if (process.platform !== 'win32') {
    console.log('FFmpeg bundle preparation skipped: Windows package only.')
    return
  }
  if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
    console.log(`Using existing bundled FFmpeg at ${ffmpegPath}`)
    return
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-editor-ffmpeg-'))
  const archive = path.join(temp, 'ffmpeg.zip')
  const extract = path.join(temp, 'extract')
  fs.mkdirSync(extract, { recursive: true })
  fs.mkdirSync(destination, { recursive: true })

  console.log(`Downloading standalone FFmpeg from ${SOURCE_URL}`)
  await download(SOURCE_URL, archive)
  const expanded = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${extract.replaceAll("'", "''")}' -Force`,
  ], { stdio: 'inherit', windowsHide: true })
  if (expanded.status !== 0) throw new Error(`Could not extract FFmpeg archive (exit ${expanded.status})`)

  const sourceFfmpeg = findFile(extract, 'ffmpeg.exe')
  const sourceFfprobe = findFile(extract, 'ffprobe.exe')
  if (!sourceFfmpeg || !sourceFfprobe) throw new Error('Downloaded FFmpeg archive did not contain ffmpeg.exe and ffprobe.exe')
  fs.copyFileSync(sourceFfmpeg, ffmpegPath)
  fs.copyFileSync(sourceFfprobe, ffprobePath)
  fs.writeFileSync(path.join(destination, 'README.txt'), [
    'FFmpeg binaries bundled for standalone Windows media import/export.',
    `Source: ${SOURCE_URL}`,
    'Build provider: BtbN/FFmpeg-Builds.',
    'Variant: Windows x64 GPL static build (includes libx264 CPU H.264).',
    'FFmpeg licensing information: https://ffmpeg.org/legal.html',
    'Distribution of this build must comply with FFmpeg/GPL requirements.',
    '',
  ].join('\r\n'))

  const check = spawnSync(ffmpegPath, ['-hide_banner', '-version'], { encoding: 'utf8', windowsHide: true })
  if (check.status !== 0) throw new Error('Bundled ffmpeg.exe did not start')
  console.log((check.stdout || '').split(/\r?\n/)[0])
  console.log(`Bundled FFmpeg ready: ${ffmpegPath}`)
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exit(1)
})
