export function addTimelineTrack(tracks, type) {
  const prefix = type === 'audio' ? 'A' : 'V'
  const numbers = tracks
    .filter((track) => track.type === type)
    .map((track) => Number.parseInt(String(track.id).replace(/\D/g, ''), 10))
    .filter(Number.isFinite)
  const id = `${prefix}${Math.max(0, ...numbers) + 1}`
  const track = { id, type, locked: false, hidden: false, muted: false, solo: false }
  if (type === 'video') {
    return { tracks: [track, ...tracks], track }
  }
  return { tracks: [...tracks, track], track }
}

function clipBounds(clip) {
  const start = Number(clip?.start) || 0
  const duration = Math.max(0, Number(clip?.duration) || 0)
  return { start, end: start + duration }
}

function clipsOverlap(a, b) {
  if (!a || !b || a.trackId !== b.trackId) return false
  const aBounds = clipBounds(a)
  const bBounds = clipBounds(b)
  return aBounds.start < bBounds.end - 0.0001 && aBounds.end > bBounds.start + 0.0001
}

function shiftedSourceIn(clip, removedFromStart) {
  const speed = Math.max(0.1, Number(clip?.video?.speed) || 1)
  return (Number(clip?.sourceIn) || 0) + Math.max(0, removedFromStart) * speed
}

function subtractWinnerFromClip(clip, winner) {
  if (!clipsOverlap(clip, winner)) return [clip]

  const loser = clipBounds(clip)
  const win = clipBounds(winner)
  const overlapStart = Math.max(loser.start, win.start)
  const overlapEnd = Math.min(loser.end, win.end)

  // Winner covers the whole older clip.
  if (overlapStart <= loser.start + 0.0001 && overlapEnd >= loser.end - 0.0001) return []

  // Only the tail of the older clip is covered: keep its untouched left portion.
  if (overlapStart > loser.start + 0.0001 && overlapEnd >= loser.end - 0.0001) {
    return [{ ...clip, duration: Math.max(0, overlapStart - loser.start) }]
  }

  // Only the head of the older clip is covered: keep its untouched right portion and
  // advance sourceIn so playback resumes from the correct source frame/sample.
  if (overlapStart <= loser.start + 0.0001 && overlapEnd < loser.end - 0.0001) {
    const removedFromStart = overlapEnd - loser.start
    return [{
      ...clip,
      start: overlapEnd,
      duration: Math.max(0, loser.end - overlapEnd),
      sourceIn: shiftedSourceIn(clip, removedFromStart),
    }]
  }

  // Winner sits inside the older clip: remove only the occupied middle and split the
  // remaining left/right portions into two clips.
  const leftDuration = Math.max(0, overlapStart - loser.start)
  const rightDuration = Math.max(0, loser.end - overlapEnd)
  const right = {
    ...clip,
    id: `${clip.id}-after-${winner.id}`,
    start: overlapEnd,
    duration: rightDuration,
    sourceIn: shiftedSourceIn(clip, overlapEnd - loser.start),
  }
  return [
    { ...clip, duration: leftDuration },
    right,
  ].filter((part) => part.duration > 0.0001)
}

export function replaceTimelineOverlaps(clips, winnerIds) {
  const winners = new Set(winnerIds || [])
  if (!winners.size) return clips
  const winnerClips = clips.filter((clip) => winners.has(clip.id))
  if (!winnerClips.length) return clips

  const untouchedWinners = clips.filter((clip) => winners.has(clip.id))
  const olderClips = clips.filter((clip) => !winners.has(clip.id))
  const resolvedOlder = olderClips.flatMap((clip) => {
    let parts = [clip]
    winnerClips.forEach((winner) => {
      parts = parts.flatMap((part) => subtractWinnerFromClip(part, winner))
    })
    return parts
  })

  return [...resolvedOlder, ...untouchedWinners]
}

export function insertClipReplacingOverlaps(clips, clip) {
  return replaceTimelineOverlaps([...clips, clip], [clip.id])
}

export function moveSelectedClips({ clips, selectedIds, anchorId, targetTrackId, tracks, requestedAnchorStart }) {
  const selected = new Set(selectedIds)
  const anchor = clips.find((clip) => clip.id === anchorId)
  const targetTrack = tracks.find((track) => track.id === targetTrackId)
  if (!anchor || !targetTrack || anchor.type !== targetTrack.type) return clips

  const selectedUnlocked = clips.filter((clip) => selected.has(clip.id) && !tracks.find((track) => track.id === clip.trackId)?.locked)
  const moving = selectedUnlocked.length ? selectedUnlocked : [anchor]
  const movingIds = new Set(moving.map((clip) => clip.id))
  const minStart = Math.min(...moving.map((clip) => clip.start))
  let delta = requestedAnchorStart - anchor.start
  // Timeline grows with content, so moving right has no artificial boundary.
  // Only keep clips from crossing before time zero.
  delta = Math.max(-minStart, delta)

  const anchorTypeTracks = tracks.filter((track) => track.type === anchor.type)
  const anchorTrackIndex = anchorTypeTracks.findIndex((track) => track.id === anchor.trackId)
  const targetTrackIndex = anchorTypeTracks.findIndex((track) => track.id === targetTrackId)
  const trackShift = targetTrackIndex - anchorTrackIndex

  const moved = clips.map((clip) => {
    if (!movingIds.has(clip.id)) return clip

    let nextTrackId = clip.trackId
    if (clip.type === anchor.type && trackShift !== 0) {
      const sameTypeTracks = tracks.filter((track) => track.type === clip.type)
      const sourceIndex = sameTypeTracks.findIndex((track) => track.id === clip.trackId)
      const shiftedTrack = sameTypeTracks[sourceIndex + trackShift]
      if (shiftedTrack && !shiftedTrack.locked) nextTrackId = shiftedTrack.id
    }

    return { ...clip, start: clip.start + delta, trackId: nextTrackId }
  })

  // The moved/newer clip wins only the time range it actually occupies. Older clips on
  // the same layer are trimmed or split so their non-overlapping portions remain.
  return replaceTimelineOverlaps(moved, movingIds)
}
