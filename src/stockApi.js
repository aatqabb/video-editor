const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'i', 'in', 'into', 'is', 'it', 'its',
  'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them', 'they', 'this',
  'to', 'was', 'we', 'were', 'with', 'you', 'your',
])

const STORAGE_KEYS = {
  pexels: 'video-editor.pexels-api-key',
  pixabay: 'video-editor.pixabay-api-key',
  unsplash: 'video-editor.unsplash-api-key',
  coverr: 'video-editor.coverr-api-key',
}

function readStoredKey(name) {
  try { return window.localStorage.getItem(STORAGE_KEYS[name]) || '' } catch { return '' }
}
function writeStoredKey(name, value) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEYS[name], value)
    else window.localStorage.removeItem(STORAGE_KEYS[name])
  } catch { /* storage can be unavailable */ }
}

function getPexelsApiKey() { return readStoredKey('pexels') || import.meta.env.VITE_PEXELS_API_KEY || '' }
function getPixabayApiKey() { return readStoredKey('pixabay') || import.meta.env.VITE_PIXABAY_API_KEY || '' }
function getUnsplashApiKey() { return readStoredKey('unsplash') || import.meta.env.VITE_UNSPLASH_API_KEY || '' }
function getCoverrApiKey() { return readStoredKey('coverr') || import.meta.env.VITE_COVERR_API_KEY || '' }

export function getStockApiKeys() {
  return { pexels: getPexelsApiKey(), pixabay: getPixabayApiKey(), unsplash: getUnsplashApiKey(), coverr: getCoverrApiKey() }
}
export function saveStockApiKeys({ pexels = '', pixabay = '', unsplash = '', coverr = '' }) {
  writeStoredKey('pexels', pexels.trim()); writeStoredKey('pixabay', pixabay.trim())
  writeStoredKey('unsplash', unsplash.trim()); writeStoredKey('coverr', coverr.trim())
  return getStockProviderStatus()
}
export function clearStockApiKeys() {
  Object.keys(STORAGE_KEYS).forEach((name) => writeStoredKey(name, ''))
  return getStockProviderStatus()
}

export function makeSearchQuery(line) {
  const words = line.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean)
  const meaningful = words.filter((word) => !SEARCH_STOP_WORDS.has(word))
  return (meaningful.length ? meaningful : words).slice(0, 8).join(' ')
}
export function splitScriptText(raw) {
  return raw.split(/\r?\n+/).flatMap((block) => block.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [block]).map((line) => line.trim()).filter(Boolean)
}

function normalizePexelsVideo(video, query) {
  const files = (video.video_files || []).filter((file) => file.file_type === 'video/mp4' && file.link).sort((a, b) => Math.abs((a.width || 0) - 1920) - Math.abs((b.width || 0) - 1920))
  const file = files[0]; if (!file) return null
  return { id: `pexels-${video.id}`, provider: 'Pexels', sourceId: String(video.id), title: query, thumbnail: video.image, fileUrl: file.link, pageUrl: video.url, duration: Number(video.duration) || 5, author: video.user?.name || 'Pexels creator', width: file.width || video.width, height: file.height || video.height, mediaType: 'video' }
}
function normalizePixabayVideo(video, query) {
  const source = video.videos?.medium || video.videos?.small || video.videos?.large || video.videos?.tiny
  if (!source?.url) return null
  return { id: `pixabay-${video.id}`, provider: 'Pixabay', sourceId: String(video.id), title: query, thumbnail: source.thumbnail || video.userImageURL || '', fileUrl: source.url, pageUrl: video.pageURL, duration: Number(video.duration) || 5, author: video.user || 'Pixabay creator', width: source.width, height: source.height, mediaType: 'video' }
}
function normalizeCoverrVideo(video, query) {
  const fileUrl = video.urls?.mp4 || video.urls?.mp4_download || video.urls?.mp4_preview
  if (!fileUrl) return null
  return { id: `coverr-${video.id}`, provider: 'Coverr', sourceId: String(video.id), title: video.title || query, thumbnail: video.thumbnail || video.poster || '', fileUrl, pageUrl: video.url || `https://coverr.co/videos/${video.id}`, duration: Number(video.duration) || 5, author: video.author?.name || video.contributor?.name || 'Coverr creator', width: video.max_width, height: video.max_height, mediaType: 'video' }
}
function normalizeUnsplashPhoto(photo, query) {
  const fileUrl = photo.urls?.regular || photo.urls?.full
  if (!fileUrl) return null
  return { id: `unsplash-${photo.id}`, provider: 'Unsplash', sourceId: String(photo.id), title: photo.alt_description || photo.description || query, thumbnail: photo.urls?.small || fileUrl, fileUrl, pageUrl: photo.links?.html, duration: 5, author: photo.user?.name || 'Unsplash photographer', width: photo.width, height: photo.height, mediaType: 'image', downloadLocation: photo.links?.download_location }
}

export function getStockProviderStatus() {
  return { pexels: Boolean(getPexelsApiKey()), pixabay: Boolean(getPixabayApiKey()), unsplash: Boolean(getUnsplashApiKey()), coverr: Boolean(getCoverrApiKey()) }
}

export async function fetchPexelsVideos(query) {
  const apiKey = getPexelsApiKey(); if (!apiKey) throw new Error('Pexels API key is not configured')
  const response = await fetch(`https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&per_page=8`, { headers: { Authorization: apiKey } })
  if (!response.ok) throw new Error(`Pexels search failed (${response.status})`)
  const data = await response.json(); return (data.videos || []).map((video) => normalizePexelsVideo(video, query)).filter(Boolean)
}
export async function fetchPixabayVideos(query) {
  const apiKey = getPixabayApiKey(); if (!apiKey) throw new Error('Pixabay API key is not configured')
  const response = await fetch(`https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&per_page=8&safesearch=true`)
  if (!response.ok) throw new Error(`Pixabay search failed (${response.status})`)
  const data = await response.json(); return (data.hits || []).map((video) => normalizePixabayVideo(video, query)).filter(Boolean)
}
export async function fetchCoverrVideos(query) {
  const apiKey = getCoverrApiKey(); if (!apiKey) throw new Error('Coverr API key is not configured')
  const response = await fetch(`https://api.coverr.co/videos?query=${encodeURIComponent(query)}&page_size=8&urls=true`, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!response.ok) throw new Error(`Coverr search failed (${response.status})`)
  const data = await response.json(); return (data.hits || []).map((video) => normalizeCoverrVideo(video, query)).filter(Boolean)
}
export async function fetchUnsplashPhotos(query) {
  const apiKey = getUnsplashApiKey(); if (!apiKey) throw new Error('Unsplash access key is not configured')
  const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=8&content_filter=high`, { headers: { Authorization: `Client-ID ${apiKey}`, 'Accept-Version': 'v1' } })
  if (!response.ok) throw new Error(`Unsplash search failed (${response.status})`)
  const data = await response.json(); return (data.results || []).map((photo) => normalizeUnsplashPhoto(photo, query)).filter(Boolean)
}

export async function searchStockVideos(query, provider = 'All') {
  const tasks = []
  const add = (name, hasKey, fn) => { if ((provider === 'All' || provider === 'Both' || provider === name) && hasKey) tasks.push(fn(query)) }
  add('Pexels', getPexelsApiKey(), fetchPexelsVideos)
  add('Pixabay', getPixabayApiKey(), fetchPixabayVideos)
  add('Coverr', getCoverrApiKey(), fetchCoverrVideos)
  add('Unsplash', getUnsplashApiKey(), fetchUnsplashPhotos)
  if (!tasks.length) throw new Error(`Add your ${provider === 'All' || provider === 'Both' ? 'stock provider' : provider} API key in API Keys`)
  const settled = await Promise.allSettled(tasks)
  const items = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  if (items.length) return items.slice(0, 16)
  const firstError = settled.find((result) => result.status === 'rejected')
  throw firstError?.reason || new Error('No stock media found')
}
