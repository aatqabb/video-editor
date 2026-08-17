const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'i', 'in', 'into', 'is', 'it', 'its',
  'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them', 'they', 'this',
  'to', 'was', 'we', 'were', 'with', 'you', 'your',
])

export function makeSearchQuery(line) {
  const words = line
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const meaningful = words.filter((word) => !SEARCH_STOP_WORDS.has(word))
  return (meaningful.length ? meaningful : words).slice(0, 8).join(' ')
}

export function splitScriptText(raw) {
  return raw
    .split(/\r?\n+/)
    .flatMap((block) => block.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [block])
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizePexelsVideo(video, query) {
  const files = (video.video_files || [])
    .filter((file) => file.file_type === 'video/mp4' && file.link)
    .sort((a, b) => Math.abs((a.width || 0) - 1920) - Math.abs((b.width || 0) - 1920))

  const file = files[0]
  if (!file) return null

  return {
    id: `pexels-${video.id}`,
    provider: 'Pexels',
    sourceId: String(video.id),
    title: query,
    thumbnail: video.image,
    fileUrl: file.link,
    pageUrl: video.url,
    duration: Number(video.duration) || 5,
    author: video.user?.name || 'Pexels creator',
    width: file.width || video.width,
    height: file.height || video.height,
  }
}

function normalizePixabayVideo(video, query) {
  const source = video.videos?.medium || video.videos?.small || video.videos?.large || video.videos?.tiny
  if (!source?.url) return null

  return {
    id: `pixabay-${video.id}`,
    provider: 'Pixabay',
    sourceId: String(video.id),
    title: query,
    thumbnail: source.thumbnail || video.userImageURL || '',
    fileUrl: source.url,
    pageUrl: video.pageURL,
    duration: Number(video.duration) || 5,
    author: video.user || 'Pixabay creator',
    width: source.width,
    height: source.height,
  }
}

export function getStockProviderStatus() {
  return {
    pexels: Boolean(import.meta.env.VITE_PEXELS_API_KEY),
    pixabay: Boolean(import.meta.env.VITE_PIXABAY_API_KEY),
  }
}

export async function fetchPexelsVideos(query) {
  const apiKey = import.meta.env.VITE_PEXELS_API_KEY
  if (!apiKey) throw new Error('Pexels API key is not configured')

  const response = await fetch(
    `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&per_page=8`,
    { headers: { Authorization: apiKey } },
  )

  if (!response.ok) throw new Error(`Pexels search failed (${response.status})`)
  const data = await response.json()
  return (data.videos || []).map((video) => normalizePexelsVideo(video, query)).filter(Boolean)
}

export async function fetchPixabayVideos(query) {
  const apiKey = import.meta.env.VITE_PIXABAY_API_KEY
  if (!apiKey) throw new Error('Pixabay API key is not configured')

  const response = await fetch(
    `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&per_page=8&safesearch=true`,
  )

  if (!response.ok) throw new Error(`Pixabay search failed (${response.status})`)
  const data = await response.json()
  return (data.hits || []).map((video) => normalizePixabayVideo(video, query)).filter(Boolean)
}

export async function searchStockVideos(query, provider = 'Both') {
  const tasks = []
  if (provider !== 'Pixabay' && import.meta.env.VITE_PEXELS_API_KEY) tasks.push(fetchPexelsVideos(query))
  if (provider !== 'Pexels' && import.meta.env.VITE_PIXABAY_API_KEY) tasks.push(fetchPixabayVideos(query))

  if (!tasks.length) {
    throw new Error(
      provider === 'Pexels'
        ? 'Add VITE_PEXELS_API_KEY to .env.local'
        : provider === 'Pixabay'
          ? 'Add VITE_PIXABAY_API_KEY to .env.local'
          : 'Add a Pexels or Pixabay API key to .env.local',
    )
  }

  const settled = await Promise.allSettled(tasks)
  const items = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  if (items.length) return items.slice(0, 12)

  const firstError = settled.find((result) => result.status === 'rejected')
  throw firstError?.reason || new Error('No stock videos found')
}
