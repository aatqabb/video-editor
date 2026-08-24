const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (process.platform !== 'win32') {
  console.error('FAIL Windows acceptance QA must run on Windows.')
  process.exit(1)
}

const checks = [
  ['Windows preflight', 'npm', ['run', 'verify:windows:preflight']],
  ['Automated final regression', 'npm', ['run', 'verify:final']],
  ['Real microphone capture', 'npm', ['run', 'verify:microphone:windows']],
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
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

report.completedAt = new Date().toISOString()
report.ok = report.checks.every((check) => check.ok)
report.failedChecks = report.checks.filter((check) => !check.ok).map((check) => check.name)
fs.writeFileSync(path.resolve('windows-acceptance-report.json'), JSON.stringify(report, null, 2))

console.log('\nWindows acceptance report written to windows-acceptance-report.json')
if (!report.ok) {
  console.error(`FAIL acceptance checks: ${report.failedChecks.join(', ')}`)
  console.error('All checks were attempted so the report shows every blocker in one run.')
  process.exit(1)
}

console.log('PASS automated/real-service Windows acceptance checks completed.')
console.log('One visual pass remains: verify panel resizing, keyboard shortcuts popup, native pickers, preview playback, and timeline interactions by eye.')
