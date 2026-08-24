const query = process.env.STOCK_TEST_QUERY || 'nature landscape'
const pexelsKey = process.env.PEXELS_API_KEY || ''
const pixabayKey = process.env.PIXABAY_API_KEY || ''

async function verifyPexels() {
  if (!pexelsKey) return { skipped: true, message: 'PEXELS_API_KEY not set' }
  const url = new URL('https://api.pexels.com/videos/search')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '1')
  const response = await fetch(url, { headers: { Authorization: pexelsKey } })
  if (!response.ok) throw new Error(`Pexels HTTP ${response.status}: ${await response.text()}`)
  const data = await response.json()
  const video = data?.videos?.[0]
  if (!video?.id || !Array.isArray(video.video_files) || !video.video_files.length) throw new Error('Pexels returned no usable video result')
  return { skipped: false, id: video.id, files: video.video_files.length }
}

async function verifyPixabay() {
  if (!pixabayKey) return { skipped: true, message: 'PIXABAY_API_KEY not set' }
  const url = new URL('https://pixabay.com/api/videos/')
  url.searchParams.set('key', pixabayKey)
  url.searchParams.set('q', query)
  url.searchParams.set('per_page', '3')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Pixabay HTTP ${response.status}: ${await response.text()}`)
  const data = await response.json()
  const hit = data?.hits?.[0]
  if (!hit?.id || !hit.videos || !Object.keys(hit.videos).length) throw new Error('Pixabay returned no usable video result')
  return { skipped: false, id: hit.id, variants: Object.keys(hit.videos).length }
}

let failed = false
for (const [name, run] of [['Pexels', verifyPexels], ['Pixabay', verifyPixabay]]) {
  try {
    const result = await run()
    if (result.skipped) console.log(`SKIP ${name}: ${result.message}`)
    else console.log(`PASS ${name}: live search returned usable video data`, result)
  } catch (error) {
    failed = true
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

if (!pexelsKey && !pixabayKey) {
  console.log('\nSet PEXELS_API_KEY and/or PIXABAY_API_KEY to run live service verification on the target Windows PC.')
  process.exit(2)
}
if (failed) process.exit(1)
console.log('\nPASS live stock service verification completed for all supplied keys.')
