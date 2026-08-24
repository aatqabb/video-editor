const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

function commandWorks(command, args = []) {
  try {
    const result = spawnSync(command, args, { windowsHide: true, encoding: 'utf8', shell: true, timeout: 10000 })
    return { ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}`.trim() }
  } catch (error) {
    return { ok: false, output: error.message }
  }
}

const repoRoot = path.resolve(__dirname, '..')
const bundledFfmpeg = path.join(repoRoot, 'resources', 'ffmpeg', 'ffmpeg.exe')
const packagedFfmpeg = path.join(repoRoot, 'release', 'win-unpacked', 'resources', 'ffmpeg', 'ffmpeg.exe')
const ffmpegPath = [process.env.VIDEO_EDITOR_FFMPEG, packagedFfmpeg, bundledFfmpeg].find((candidate) => candidate && fs.existsSync(candidate))
const nodeCheck = commandWorks('node', ['--version'])
const npmCheck = commandWorks('npm', ['--version'])
const ffmpegCheck = ffmpegPath ? commandWorks(`"${ffmpegPath}"`, ['-hide_banner', '-version']) : { ok: false, output: 'No bundled/prepared FFmpeg found yet' }

const checks = [
  { name: 'Windows platform', ok: process.platform === 'win32', detail: process.platform },
  { name: 'Node available', ok: nodeCheck.ok, detail: nodeCheck.output.split(/\r?\n/)[0] || 'unknown' },
  { name: 'npm available', ok: npmCheck.ok, detail: npmCheck.output.split(/\r?\n/)[0] || 'unknown' },
  { name: 'FFmpeg prepared/bundled', ok: ffmpegCheck.ok, detail: ffmpegPath || ffmpegCheck.output },
  { name: 'Pexels API key present', ok: Boolean(process.env.PEXELS_API_KEY), detail: process.env.PEXELS_API_KEY ? 'present' : 'set PEXELS_API_KEY before live stock QA' },
  { name: 'Pixabay API key present', ok: Boolean(process.env.PIXABAY_API_KEY), detail: process.env.PIXABAY_API_KEY ? 'present' : 'set PIXABAY_API_KEY before live stock QA' },
]

const report = {
  generatedAt: new Date().toISOString(),
  platform: process.platform,
  checks,
  blocking: checks.filter((check) => ['Windows platform', 'Node available', 'npm available'].includes(check.name) && !check.ok).map((check) => check.name),
  preparationNeeded: checks.filter((check) => !check.ok).map((check) => check.name),
}

for (const check of checks) console.log(`${check.ok ? 'PASS' : 'NEEDS SETUP'} ${check.name}: ${check.detail}`)
fs.writeFileSync(path.join(repoRoot, 'windows-preflight-report.json'), JSON.stringify(report, null, 2))
console.log('\nPreflight report written to windows-preflight-report.json')

if (report.blocking.length) {
  console.error(`FAIL blocking prerequisites: ${report.blocking.join(', ')}`)
  process.exit(1)
}
console.log('PASS core Windows acceptance prerequisites are available. Items marked NEEDS SETUP can be prepared before the full acceptance run.')
