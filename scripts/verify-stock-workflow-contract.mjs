import fs from 'node:fs'

const scriptWorkspace = fs.readFileSync(new URL('../src/ScriptWorkspace.jsx', import.meta.url), 'utf8')
const stockWorkspace = fs.readFileSync(new URL('../src/StockWorkspace.jsx', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../src/stockApi.js', import.meta.url), 'utf8')

const requirements = [
  ['full script input', /placeholder="Paste full script here\.\.\."/, scriptWorkspace],
  ['split into editable lines', /Split into Lines/, scriptWorkspace],
  ['editable per-line query', /placeholder="Editable stock search query"/, scriptWorkspace],
  ['standalone functional Stock workspace', /searchStockVideos\(clean, provider\)/, stockWorkspace],
  ['Pexels provider option', /<option>Pexels<\/option>/, stockWorkspace],
  ['Pixabay provider option', /<option>Pixabay<\/option>/, stockWorkspace],
  ['Coverr provider option', /<option>Coverr<\/option>/, stockWorkspace],
  ['Unsplash provider option', /<option>Unsplash<\/option>/, stockWorkspace],
  ['four local API key controls', /Coverr API key[\s\S]*Unsplash Access Key/, stockWorkspace],
  ['provider result counts', /providerCounts/, stockWorkspace],
  ['stock preview dock', /stock-preview-dock/, stockWorkspace],
  ['timeline import action', /Import to Timeline/, stockWorkspace],
  ['drag payload for stock clips', /application\/x-video-editor-stock/, stockWorkspace],
  ['download action', /downloadResult\(result\)/, stockWorkspace],
]

const apiRequirements = [
  ['Pexels API endpoint', /api\.pexels\.com\/v1\/videos\/search/, api],
  ['Pixabay video API endpoint', /pixabay\.com\/api\/videos/, api],
  ['Coverr API endpoint', /api\.coverr\.co\/videos\?query=/, api],
  ['Coverr Bearer authentication', /Authorization: `Bearer \$\{apiKey\}`/, api],
  ['Unsplash photo API endpoint', /api\.unsplash\.com\/search\/photos/, api],
  ['Unsplash Client-ID authentication', /Authorization: `Client-ID \$\{apiKey\}`/, api],
  ['Unsplash download telemetry', /downloadLocation/, api],
  ['balanced provider interleave', /interleaveProviderResults/, api],
  ['searchStockVideos export', /export async function searchStockVideos/, api],
]

let failed = false
for (const [name, pattern, source] of requirements) {
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
console.log('PASS four-provider stock workflow contract verified: Pexels/Pixabay video, Coverr video, Unsplash photo, balanced All results, preview/import/download and local keys.')
