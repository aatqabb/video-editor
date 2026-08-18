const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { probeFfmpeg } = require('./exportEngine.cjs')

function proxyKey(sourcePath) {
  let stamp = ''
  try {
    const stat = fs.statSync(sourcePath)
    stamp = `${stat.size}:${stat.mtimeMs}`
  } catch {
    stamp = String(Date.now())
  }
  return crypto.createHash('sha1').update(`${sourcePath}:${stamp}`).digest('hex').slice(0, 20)
}

function makeProxy(sourcePath, outputDir) {
  if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('Source video is unavailable for proxy generation')
  const capabilities = probeFfmpeg()
  if (!capabilities.available || !capabilities.binary) throw new Error('FFmpeg is required for proxy preview')

  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `${proxyKey(sourcePath)}-preview.mp4`)
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024) {
    return { outputPath, url: pathToFileURL(outputPath).href, cached: true }
  }

  const args = [
    '-hide_banner', '-y', '-i', sourcePath,
    '-vf', "scale=w='min(960,iw)':h=-2",
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    outputPath,
  ]

  const child = spawn(capabilities.binary, args, { windowsHide: true })
  let stderr = ''
  const done = new Promise((resolve, reject) => {
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) resolve({ outputPath, url: pathToFileURL(outputPath).href, cached: false })
      else reject(new Error(`Proxy generation failed (${code}). ${stderr.slice(-1200)}`))
    })
  })

  return { child, done }
}

module.exports = { makeProxy }
