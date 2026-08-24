const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (process.platform !== 'win32') {
  console.error('FAIL Windows acceptance QA must run on Windows.')
  process.exit(1)
}

const checks = [
  ['Automated final regression', 'npm', ['run', 'verify:final']],
  ['Real microphone capture', 'npx', ['electron', 'scripts/verify-windows-microphone.cjs']],
  ['Live Pexels/Pixabay search', 'npm', ['run', 'verify:stock:live']],
  ['Real GPU hardware export', 'npm', ['run', 'verify:gpu:windows']],
]

const report = {
  startedAt: new Date().toISOString(),
  platform: process.platform,
  node: process.version,
  checks: [],
}

for (const [name, command, args] of checks) {
  console.log(`\n=== ${name} ===`)
  const result = spawnSync(command, args, {
    shell: true,
    stdio: 'inherit',
    env: process.env,
  })
  const ok = !result.error && result.status === 0
  report.checks.push({ name, ok, exitCode: result.status ?? null, error: result.error?.message || null })
  if (!ok) {
    report.completedAt = new Date().toISOString()
    report.ok = false
    fs.writeFileSync(path.resolve('windows-acceptance-report.json'), JSON.stringify(report, null, 2))
    console.error(`FAIL ${name}. Report written to windows-acceptance-report.json`)
    process.exit(result.status || 1)
  }
  console.log(`PASS ${name}`)
}

report.completedAt = new Date().toISOString()
report.ok = true
fs.writeFileSync(path.resolve('windows-acceptance-report.json'), JSON.stringify(report, null, 2))
console.log('\nPASS automated/real-service Windows acceptance checks completed.')
console.log('Report written to windows-acceptance-report.json')
console.log('One visual pass remains: verify panel resizing, keyboard shortcuts popup, native pickers, preview playback, and timeline interactions by eye.')
