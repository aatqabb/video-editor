// Manual caption/subtitle helpers: timestamp formatting, SRT/VTT export, and a
// simple heuristic segment-splitter used when captions are typed as one block
// of text instead of line-by-line.

export function formatSrtTimestamp(totalSeconds) {
  const clamped = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = Math.floor(clamped % 60)
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000)
  const pad2 = (value) => String(value).padStart(2, '0')
  const pad3 = (value) => String(value).padStart(3, '0')
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(millis)}`
}

export function formatVttTimestamp(totalSeconds) {
  return formatSrtTimestamp(totalSeconds).replace(',', '.')
}

export function parseTimestampInput(value) {
  const text = String(value || '').trim()
  if (!text) return 0
  if (/^-?\d+(\.\d+)?$/.test(text)) return Math.max(0, Number(text))
  const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/)
  if (!match) return 0
  const [, hh, mm, ss, ms] = match
  const hours = Number(hh || 0)
  const minutes = Number(mm || 0)
  const seconds = Number(ss || 0)
  const millis = Number((ms || '0').padEnd(3, '0'))
  return hours * 3600 + minutes * 60 + seconds + millis / 1000
}

export function formatClockLabel(totalSeconds) {
  const clamped = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(clamped / 60)
  const seconds = (clamped % 60).toFixed(2)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(5, '0')}`
}

export function buildSrt(segments) {
  return segments
    .map((segment, index) => (
      `${index + 1}\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\n${segment.text || ''}\n`
    ))
    .join('\n')
    .trim() + '\n'
}

export function buildVtt(segments) {
  const body = segments
    .map((segment) => (
      `${formatVttTimestamp(segment.start)} --> ${formatVttTimestamp(segment.end)}\n${segment.text || ''}\n`
    ))
    .join('\n')
    .trim()
  return `WEBVTT\n\n${body}\n`
}

export function makeSegmentId() {
  return `cap-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

// Splits a longer caption line into shorter reading chunks (used when the
// user pastes a whole sentence for one marked timestamp range) by simply
// dividing the time range proportionally across words-per-chunk groups.
export function splitSegmentIntoChunks(segment, wordsPerChunk = 8) {
  const words = String(segment.text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= wordsPerChunk) return [segment]
  const chunks = []
  for (let i = 0; i < words.length; i += wordsPerChunk) chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
  const duration = Math.max(0.01, segment.end - segment.start)
  return chunks.map((text, index) => ({
    id: makeSegmentId(),
    start: segment.start + (duration * index) / chunks.length,
    end: segment.start + (duration * (index + 1)) / chunks.length,
    text,
  }))
}

// Saves a text file to disk using the File System Access API when available
// (same technique already used by projectPersistence.js for .vedit.json
// project files), falling back to a Blob download link otherwise.
export async function saveTextFile(content, suggestedName, mimeType = 'text/plain') {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'Subtitle File', accept: { [mimeType]: [`.${suggestedName.split('.').pop()}`] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return { method: 'picker' }
    } catch (error) {
      if (error?.name === 'AbortError') return { method: 'cancelled' }
      // Fall through to the download-link approach below.
    }
  }
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = suggestedName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return { method: 'download' }
}
