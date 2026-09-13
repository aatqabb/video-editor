// AI Footage Finder — YouTube search + transcript-based timestamp matching.
//
// Deliberately built with NO paid AI/LLM API call: "meaning → visual" is done
// with a curated keyword/concept map tuned to explainerchannel's own content
// (finance/economic history, business, football, motivational/philosophy),
// falling back to plain keyword extraction for anything not covered. This
// keeps the feature free to run — upgradeable later to a real embeddings/LLM
// call if an API key is ever added, without changing the UI contract below.

const STORAGE_KEY = 'video-editor.youtube-api-key'

function readStoredKey() {
  try { return window.localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}
function writeStoredKey(value) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch { /* storage can be unavailable */ }
}

export function getYoutubeApiKey() { return readStoredKey() || import.meta.env.VITE_YOUTUBE_API_KEY || '' }
export function saveYoutubeApiKey(value) { writeStoredKey(String(value || '').trim()); return getYoutubeProviderStatus() }
export function clearYoutubeApiKey() { writeStoredKey(''); return getYoutubeProviderStatus() }
export function getYoutubeProviderStatus() { return { youtube: Boolean(getYoutubeApiKey()) } }

// --- Free "meaning -> visual" concept expansion (no AI call) ---------------

const CONCEPT_MAP = [
  { match: /\b(bank run|withdraw(al|als)? their savings|queue(d)? outside (a |the )?banks?|waited outside banks?)\b/i, concepts: ['bank run', 'people queue outside bank', 'financial panic crowd', 'historical footage'] },
  { match: /\b(stock market (crash|collapse)|wall street crash|1929|great depression)\b/i, concepts: ['stock market crash', 'wall street trading floor', 'newspaper headlines crash', 'great depression archival footage'] },
  { match: /\b(recession|inflation|economic (crisis|downturn)|unemployment)\b/i, concepts: ['recession', 'unemployment line', 'closed factory', 'economic crisis news footage'] },
  { match: /\b(war|battlefield|soldiers?|military)\b/i, concepts: ['war footage', 'soldiers marching', 'battlefield archive'] },
  { match: /\b(protest|riot|demonstration|strike)\b/i, concepts: ['protest crowd', 'demonstration march', 'riot police'] },
  { match: /\b(poverty|homeless|slum)\b/i, concepts: ['poverty documentary', 'slum street', 'homeless footage'] },
  { match: /\b(migration|refugees?|immigrants?)\b/i, concepts: ['migration', 'refugees walking', 'border crossing footage'] },
  { match: /\b(ceo|startup|office|meeting|boardroom|entrepreneur)\b/i, concepts: ['office meeting', 'business boardroom', 'startup team working'] },
  { match: /\b(factory|manufacturing|assembly line|production line)\b/i, concepts: ['factory assembly line', 'manufacturing plant footage'] },
  { match: /\b(handshake|deal|contract|negotiation)\b/i, concepts: ['business handshake', 'contract signing'] },
  { match: /\b(stadium|crowd cheering|match|goal|championship|final)\b/i, concepts: ['football stadium crowd', 'match highlights', 'goal celebration'] },
  { match: /\b(training|practice|coach|locker room)\b/i, concepts: ['football training session', 'locker room footage'] },
  { match: /\b(sunrise|sunset|mountain|climb(ing)?|solitude|alone)\b/i, concepts: ['sunrise timelapse', 'mountain climbing', 'person alone in nature'] },
  { match: /\b(meditat(e|ion)|mindful|breathe|calm)\b/i, concepts: ['meditation footage', 'calm nature scene'] },
  { match: /\b(city|skyline|street|crowded street|urban)\b/i, concepts: ['city skyline', 'crowded street walking'] },
  { match: /\b(clock|time passing|years? later|decades?)\b/i, concepts: ['clock timelapse', 'calendar pages turning'] },
  { match: /\b(newspaper|headline|breaking news)\b/i, concepts: ['newspaper headline', 'breaking news archive'] },
]

const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'i', 'in', 'into', 'is', 'it', 'its',
  'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them', 'they', 'this',
  'to', 'was', 'we', 'were', 'with', 'you', 'your',
])

function extractKeywords(line, limit = 5) {
  const words = String(line || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean)
  const meaningful = words.filter((word) => word.length > 2 && !SEARCH_STOP_WORDS.has(word))
  return (meaningful.length ? meaningful : words).slice(0, limit)
}

export function expandVisualConcepts(line) {
  const text = String(line || '')
  const matched = CONCEPT_MAP.filter((entry) => entry.match.test(text)).flatMap((entry) => entry.concepts)
  const concepts = matched.length ? [...new Set(matched)].slice(0, 6) : extractKeywords(text, 5)
  return concepts
}

export function buildYoutubeQuery(line, extraTerms = 'documentary footage') {
  const concepts = expandVisualConcepts(line)
  const query = concepts.slice(0, 4).join(' ')
  return extraTerms ? `${query} ${extraTerms}`.trim() : query
}

// --- YouTube Data API v3 search (renderer fetch — Google APIs allow CORS) --

export async function searchYoutubeVideos(query, { maxResults = 6 } = {}) {
  const apiKey = getYoutubeApiKey()
  if (!apiKey) throw new Error('Add your YouTube Data API key in API Keys')
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(maxResults),
    q: query,
    key: apiKey,
    videoCaption: 'closedCaption',
    safeSearch: 'moderate',
  })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message || `YouTube search failed (${response.status})`)
  }
  const data = await response.json()
  return (data.items || []).map((item) => ({
    videoId: item.id?.videoId,
    title: item.snippet?.title || 'Untitled video',
    channelTitle: item.snippet?.channelTitle || 'Unknown channel',
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    publishedAt: item.snippet?.publishedAt || '',
  })).filter((item) => item.videoId)
}

// --- Transcript fetch (Electron main process only — real YouTube CORS) ----

export async function fetchTranscript(videoId) {
  const desktop = window.videoEditorDesktop
  if (!desktop?.fetchYoutubeTranscript) throw new Error('Transcript fetch needs the Windows desktop app (not available in browser preview)')
  return desktop.fetchYoutubeTranscript(videoId)
}

// --- Free relevance scoring: word overlap between a transcript window and the line/concepts ---

function tokenize(text) {
  return new Set(String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2))
}

function overlapScore(windowTokens, targetTokens) {
  if (!targetTokens.size) return 0
  let hits = 0
  targetTokens.forEach((word) => { if (windowTokens.has(word)) hits += 1 })
  return hits / targetTokens.size
}

export function buildTimestampWindows(segments, windowSeconds = 28) {
  if (!segments?.length) return []
  const windows = []
  let cursor = 0
  while (cursor < segments.length) {
    const windowStart = segments[cursor].start
    let end = windowStart
    let text = ''
    let index = cursor
    while (index < segments.length && segments[index].start < windowStart + windowSeconds) {
      end = segments[index].end
      text += ` ${segments[index].text}`
      index += 1
    }
    windows.push({ start: windowStart, end, text: text.trim() })
    cursor = index > cursor ? index : cursor + 1
  }
  return windows
}

export function formatTimestamp(seconds) {
  const whole = Math.max(0, Math.round(Number(seconds) || 0))
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function buildYoutubeTimestampUrl(videoId, seconds) {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.max(0, Math.round(Number(seconds) || 0))}s`
}

// --- Orchestration: one script line -> ranked footage suggestions ----------

export async function findFootageForLine(lineText, { maxVideos = 4, maxResults = 3 } = {}) {
  const concepts = expandVisualConcepts(lineText)
  const query = buildYoutubeQuery(lineText)
  const videos = await searchYoutubeVideos(query, { maxResults: 6 })
  if (!videos.length) return { concepts, query, results: [] }

  const targetTokens = new Set([...tokenize(lineText), ...concepts.flatMap((concept) => [...tokenize(concept)])])
  const candidates = []

  for (const video of videos.slice(0, maxVideos)) {
    try {
      const transcript = await fetchTranscript(video.videoId)
      const windows = buildTimestampWindows(transcript.segments, 28)
      let best = null
      windows.forEach((windowItem) => {
        const score = overlapScore(tokenize(windowItem.text), targetTokens)
        if (!best || score > best.score) best = { ...windowItem, score }
      })
      if (best && best.score > 0) {
        candidates.push({
          ...video,
          hasTranscript: true,
          start: best.start,
          end: best.end,
          matchScore: Math.min(99, Math.max(30, Math.round(best.score * 100))),
          pageUrl: buildYoutubeTimestampUrl(video.videoId, best.start),
          timestampLabel: `${formatTimestamp(best.start)} → ${formatTimestamp(best.end)}`,
        })
      } else {
        candidates.push({
          ...video, hasTranscript: true, start: 0, end: 0, matchScore: 25,
          pageUrl: buildYoutubeTimestampUrl(video.videoId, 0), timestampLabel: 'No strong transcript match found',
        })
      }
    } catch {
      candidates.push({
        ...video, hasTranscript: false, start: 0, end: 0, matchScore: 20,
        pageUrl: buildYoutubeTimestampUrl(video.videoId, 0), timestampLabel: 'Transcript unavailable — full video only',
      })
    }
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore)
  return { concepts, query, results: candidates.slice(0, maxResults) }
}
