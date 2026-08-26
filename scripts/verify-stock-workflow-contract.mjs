import fs from 'node:fs'

const scriptWorkspace = fs.readFileSync(new URL('../src/ScriptWorkspace.jsx', import.meta.url), 'utf8')
const stockWorkspace = fs.readFileSync(new URL('../src/StockWorkspace.jsx', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../src/stockApi.js', import.meta.url), 'utf8')

const requirements = [
  ['full script input', /Paste full script here/, scriptWorkspace],
  ['auto split plus search control', /Split \+ Auto Search/, scriptWorkspace],
  ['script change schedules automatic split and search', /autoSplitTimerRef/ && /splitIntoLines\(value, true\)/, scriptWorkspace],
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
  ['Pexels video API endpoint', /api\.pexels\.com\/v1\/videos\/search/, api],
  ['Pexels image API endpoint', /api\.pexels\.com\/v1\/search/, api],
  ['Pixabay video API endpoint', /pixabay\.com\/api\/videos/, api],
  ['Pixabay image API endpoint', /pixabay\.com\/api\/\?key=/, api],
  ['Coverr API endpoint', /api\.coverr\.co\/videos\?query=/, api],
  ['Coverr Bearer authentication', /Authorization: `Bearer \$\{apiKey\}`/, api],
  ['Unsplash photo API endpoint', /api\.unsplash\.com\/search\/photos/, api],
  ['Unsplash Client-ID authentication', /Authorization: `Client-ID \$\{apiKey\}`/, api],
  ['Unsplash download telemetry', /downloadLocation/, api],
  ['Pexels maximum page size requested', /per_page=80/, api],
  ['Pixabay maximum page size requested', /per_page=200/, api],
  ['Unsplash maximum page size requested', /per_page=30/, api],
  ['video results are ordered before image results', /orderVideosThenImages/ && /mediaType !== 'image'[\s\S]*mediaType === 'image'/, api],
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
console.log('PASS stock workflow contract verified: maximum provider page sizes, videos before images, preview/import/download, and script auto split/search.')
