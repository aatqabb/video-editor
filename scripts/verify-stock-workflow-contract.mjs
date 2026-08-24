import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/ScriptWorkspace.jsx', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../src/stockApi.js', import.meta.url), 'utf8')

const requirements = [
  ['full script input', /placeholder="Paste full script here\.\.\."/],
  ['split into editable lines', /Split into Lines/],
  ['editable per-line query', /placeholder="Editable stock search query"/],
  ['Pexels provider option', /<option>Pexels<\/option>/],
  ['Pixabay provider option', /<option>Pixabay<\/option>/],
  ['local API key storage UI', /Keys are stored only on this PC\/browser/],
  ['per-line stock search', /searchLine\(line\)/],
  ['stock preview dock', /stock-preview-dock/],
  ['timeline import action', /Import to Timeline/],
  ['drag payload for stock clips', /application\/x-video-editor-stock/],
  ['download action', /downloadResult\(result\)/],
]

const apiRequirements = [
  ['Pexels API endpoint', /pexels/i],
  ['Pixabay API endpoint', /pixabay/i],
  ['searchStockVideos export', /searchStockVideos/],
]

let failed = false
for (const [name, pattern] of requirements) {
  const ok = pattern.test(source)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
for (const [name, pattern] of apiRequirements) {
  const ok = pattern.test(api)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('PASS Script → Pexels/Pixabay workflow contract verified. Real API-key searches remain a hands-on live-service gate.')
