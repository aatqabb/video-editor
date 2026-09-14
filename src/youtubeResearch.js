// YouTube Research Tool — competitor videos, view/outlier analysis, title
// patterns and simple content-gap hints, for a topic keyword or a channel.
//
// Same rule as AI Footage Finder: NO paid AI/LLM API. Everything here runs on
// the YouTube Data API v3 (the user's own free key, reused from youtubeApi.js)
// plus plain-JS statistics and keyword frequency — no external service cost.

import { getYoutubeApiKey } from './youtubeApi'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

async function youtubeGet(path, params) {
  const apiKey = getYoutubeApiKey()
  if (!apiKey) throw new Error('Add your YouTube Data API key in API Keys')
  const search = new URLSearchParams({ ...params, key: apiKey })
  const response = await fetch(`${API_BASE}/${path}?${search.toString()}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message || `YouTube API request failed (${response.status})`)
  }
  return response.json()
}

// --- Channel input parsing --------------------------------------------------

export function looksLikeChannelInput(value) {
  return /youtube\.com\/(channel\/|@|c\/|user\/)/i.test(String(value || '').trim()) || /^UC[\w-]{20,}$/.test(String(value || '').trim())
}

function parseChannelIdentifier(input) {
  const raw = String(input || '').trim()
  if (/^UC[\w-]{20,}$/.test(raw)) return { kind: 'id', value: raw }
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`)
    const path = url.pathname.replace(/\/+$/, '')
    const channelMatch = path.match(/\/channel\/(UC[\w-]{20,})/)
    if (channelMatch) return { kind: 'id', value: channelMatch[1] }
    const handleMatch = path.match(/\/@([\w.-]+)/)
    if (handleMatch) return { kind: 'handle', value: `@${handleMatch[1]}` }
    const customMatch = path.match(/\/(?:c|user)\/([\w.-]+)/)
    if (customMatch) return { kind: 'query', value: customMatch[1] }
  } catch {
    // not a URL — fall through to treating it as a raw handle/name below
  }
  return { kind: raw.startsWith('@') ? 'handle' : 'query', value: raw }
}

export async function resolveChannelId(input) {
  const parsed = parseChannelIdentifier(input)
  if (parsed.kind === 'id') return { channelId: parsed.value, channelTitle: '' }

  if (parsed.kind === 'handle') {
    const data = await youtubeGet('channels', { part: 'snippet', forHandle: parsed.value.replace(/^@/, '') })
    const item = data.items?.[0]
    if (item) return { channelId: item.id, channelTitle: item.snippet?.title || parsed.value }
  }

  const searchData = await youtubeGet('search', { part: 'snippet', type: 'channel', q: parsed.value, maxResults: '1' })
  const found = searchData.items?.[0]
  if (!found) throw new Error(`Could not find a YouTube channel for "${input}"`)
  return { channelId: found.id?.channelId, channelTitle: found.snippet?.title || parsed.value }
}

// --- Fetching videos ---------------------------------------------------------

export async function fetchChannelUploads(channelId, maxResults = 30) {
  const data = await youtubeGet('search', {
    part: 'snippet',
    channelId,
    type: 'video',
    order: 'date',
    maxResults: String(Math.min(50, maxResults)),
  })
  return (data.items || []).map((item) => ({
    videoId: item.id?.videoId,
    title: item.snippet?.title || 'Untitled video',
    channelTitle: item.snippet?.channelTitle || '',
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    publishedAt: item.snippet?.publishedAt || '',
  })).filter((item) => item.videoId)
}

export async function searchTopicVideos(query, maxResults = 25) {
  const data = await youtubeGet('search', {
    part: 'snippet',
    type: 'video',
    q: query,
    order: 'relevance',
    maxResults: String(Math.min(50, maxResults)),
  })
  return (data.items || []).map((item) => ({
    videoId: item.id?.videoId,
    title: item.snippet?.title || 'Untitled video',
    channelTitle: item.snippet?.channelTitle || '',
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    publishedAt: item.snippet?.publishedAt || '',
  })).filter((item) => item.videoId)
}

export function parseIsoDuration(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso || ''))
  if (!match) return 0
  const [, h, m, s] = match
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0)
}

export function formatDurationLabel(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function fetchVideoStats(videoIds) {
  const ids = videoIds.filter(Boolean)
  if (!ids.length) return {}
  const chunks = []
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))

  const statsById = {}
  for (const chunk of chunks) {
    // eslint-disable-next-line no-await-in-loop
    const data = await youtubeGet('videos', { part: 'statistics,contentDetails', id: chunk.join(',') })
    for (const item of data.items || []) {
      statsById[item.id] = {
        viewCount: Number(item.statistics?.viewCount || 0),
        likeCount: Number(item.statistics?.likeCount || 0),
        commentCount: Number(item.statistics?.commentCount || 0),
        durationSeconds: parseIsoDuration(item.contentDetails?.duration),
      }
    }
  }
  return statsById
}

// --- Analysis: outliers, title patterns, keyword frequency ------------------

function median(numbers) {
  if (!numbers.length) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'how', 'i', 'in', 'into', 'is', 'it',
  'its', 'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them', 'they',
  'this', 'to', 'was', 'we', 'were', 'what', 'when', 'why', 'will', 'with', 'you', 'your',
])

const POWER_WORDS = ['secret', 'truth', 'never', 'nobody', 'mistake', 'why', 'how', 'shocking', 'real reason', 'exposed', 'warning', 'stop', 'before', 'worst', 'best', 'biggest', 'insane', 'nobody tells you']

function tokenizeTitle(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !TITLE_STOP_WORDS.has(word))
}

export function analyzeVideos(videos) {
  const withViews = videos.filter((video) => Number.isFinite(video.viewCount))
  const viewCounts = withViews.map((video) => video.viewCount)
  const med = median(viewCounts)
  const average = viewCounts.length ? Math.round(viewCounts.reduce((sum, value) => sum + value, 0) / viewCounts.length) : 0
  const outlierThreshold = med * 2.5

  const ranked = [...videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).map((video) => ({
    ...video,
    isOutlier: med > 0 && (video.viewCount || 0) >= outlierThreshold,
    outlierMultiple: med > 0 ? Math.round(((video.viewCount || 0) / med) * 10) / 10 : 0,
  }))

  const withNumbers = videos.filter((video) => /\d/.test(video.title)).length
  const withQuestion = videos.filter((video) => /\?/.test(video.title)).length
  const powerWordHits = POWER_WORDS.filter((word) => videos.some((video) => video.title.toLowerCase().includes(word)))

  const wordCounts = new Map()
  videos.forEach((video) => {
    const seen = new Set(tokenizeTitle(video.title))
    seen.forEach((word) => wordCounts.set(word, (wordCounts.get(word) || 0) + 1))
  })
  const topKeywords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }))

  return {
    count: videos.length,
    medianViews: Math.round(med),
    averageViews: average,
    outliers: ranked.filter((video) => video.isOutlier),
    ranked,
    titlePatterns: {
      withNumbersPct: videos.length ? Math.round((withNumbers / videos.length) * 100) : 0,
      withQuestionPct: videos.length ? Math.round((withQuestion / videos.length) * 100) : 0,
      commonPowerWords: powerWordHits,
    },
    topKeywords,
  }
}

// --- Orchestration -----------------------------------------------------------

export async function researchByTopic(query, maxResults = 25) {
  const videos = await searchTopicVideos(query, maxResults)
  const stats = await fetchVideoStats(videos.map((video) => video.videoId))
  const merged = videos.map((video) => ({ ...video, ...(stats[video.videoId] || { viewCount: 0, durationSeconds: 0 }) }))
  return { mode: 'topic', label: query, ...analyzeVideos(merged) }
}

export async function researchByChannel(channelInput, maxResults = 30) {
  const { channelId, channelTitle } = await resolveChannelId(channelInput)
  const uploads = await fetchChannelUploads(channelId, maxResults)
  const stats = await fetchVideoStats(uploads.map((video) => video.videoId))
  const merged = uploads.map((video) => ({ ...video, ...(stats[video.videoId] || { viewCount: 0, durationSeconds: 0 }) }))
  return { mode: 'channel', label: channelTitle || channelInput, channelId, ...analyzeVideos(merged) }
}
