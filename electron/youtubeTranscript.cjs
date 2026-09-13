// Best-effort YouTube transcript fetcher.
//
// This deliberately runs in the Electron MAIN process (not the renderer):
// the official YouTube Data API does not expose caption text for videos you
// don't own, so this reads the same public timedtext caption track a
// viewer's browser would load. That endpoint (and the watch page it is
// discovered from) has no CORS headers for arbitrary origins, so a fetch()
// from the renderer would fail — the main process has no such restriction.
//
// This is unofficial and can break if YouTube changes page markup, and not
// every video has a caption track at all. Callers must treat failures as
// "no transcript available" rather than a hard error, per FootageFinder's
// UI (it falls back to search-relevance-only results in that case).

function decodeCaptionText(raw) {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchWithUserAgent(url) {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
}

async function fetchTranscript(videoId) {
  if (!videoId || typeof videoId !== 'string') throw new Error('A YouTube video id is required')

  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  const pageResponse = await fetchWithUserAgent(watchUrl)
  if (!pageResponse.ok) throw new Error(`Could not load the YouTube watch page (${pageResponse.status})`)
  const html = await pageResponse.text()

  const tracksMatch = html.match(/"captionTracks":(\[[^\]]*\])/)
  if (!tracksMatch) throw new Error('No caption tracks were found for this video')

  let tracks
  try {
    tracks = JSON.parse(tracksMatch[1].replace(/\\u0026/g, '&'))
  } catch {
    throw new Error('Could not parse this video\'s caption track list')
  }
  if (!Array.isArray(tracks) || !tracks.length) throw new Error('No caption tracks are available for this video')

  const track = tracks.find((item) => String(item.languageCode || '').toLowerCase().startsWith('en')) || tracks[0]
  if (!track?.baseUrl) throw new Error('The selected caption track has no source URL')

  const captionResponse = await fetchWithUserAgent(track.baseUrl)
  if (!captionResponse.ok) throw new Error(`Could not download captions (${captionResponse.status})`)
  const xml = await captionResponse.text()

  const segments = []
  const textPattern = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g
  let match = textPattern.exec(xml)
  while (match) {
    const start = Number(match[1]) || 0
    const dur = Number(match[2]) || 0
    const text = decodeCaptionText(match[3])
    if (text) segments.push({ start, end: start + dur, text })
    match = textPattern.exec(xml)
  }
  if (!segments.length) throw new Error('The caption track for this video was empty')

  return {
    segments,
    languageCode: track.languageCode || 'en',
    isAutomatic: /asr/i.test(track.vssId || track.kind || ''),
  }
}

module.exports = { fetchTranscript }
