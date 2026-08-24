import { spawnSync } from 'node:child_process'

const checks = [
  ['Lint', 'npm', ['run', 'lint']],
  ['Production build', 'npm', ['run', 'build']],
  ['Generated SFX assets', 'node', ['scripts/verify-generated-sfx-assets.mjs']],
  ['Timeline state', 'node', ['scripts/verify-timeline-state.mjs']],
  ['Vite transform order', 'node', ['scripts/verify-vite-transform-order.mjs']],
  ['GPU contract', 'node', ['scripts/verify-gpu-contract.mjs']],
  ['Responsiveness contract', 'node', ['scripts/verify-responsiveness-contract.mjs']],
  ['Export contract', 'node', ['scripts/verify-export-contract.mjs']],
  ['Voice-over recording contract', 'node', ['scripts/verify-voiceover-contract.mjs']],
  ['SFX workflow contract', 'node', ['scripts/verify-sfx-contract.mjs']],
  ['Stock workflow contract', 'node', ['scripts/verify-stock-workflow-contract.mjs']],
  ['Windows native picker contract', 'node', ['scripts/verify-windows-native-picker.mjs']],
  ['Hands-on QA tooling contract', 'node', ['scripts/verify-hands-on-qa-contract.mjs']],
]

let failed = false

for (const [name, command, args] of checks) {
  console.log(`\n=== ${name} ===`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })

  if (result.error || result.status !== 0) {
    failed = true
    console.error(`FAIL: ${name}${result.error ? ` — ${result.error.message}` : ` (exit ${result.status})`}`)
    break
  }

  console.log(`PASS: ${name}`)
}

if (failed) process.exit(1)

console.log('\nPASS: automated final regression gate completed.')
console.log('Hands-on checks remain separate: real Windows GPU encode/decode/export, microphone permission/recording, live Pexels/Pixabay API keys, and visual/native-picker QA.')
