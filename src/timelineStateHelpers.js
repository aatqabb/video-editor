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

function clipsOverlap(a, b) {
  if (!a || !b || a.trackId !== b.trackId) return false
  const aStart = Number(a.start) || 0
  const bStart = Number(b.start) || 0
  const aEnd = aStart + Math.max(0, Number(a.duration) || 0)
  const bEnd = bStart + Math.max(0, Number(b.duration) || 0)
  return aStart < bEnd - 0.0001 && aEnd > bStart + 0.0001
}

export function replaceTimelineOverlaps(clips, winnerIds) {
  const winners = new Set(winnerIds || [])
  if (!winners.size) return clips
  const winnerClips = clips.filter((clip) => winners.has(clip.id))
  if (!winnerClips.length) return clips

  return clips.filter((clip) => {
    if (winners.has(clip.id)) return true
    return !winnerClips.some((winner) => clipsOverlap(clip, winner))
  })
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

  // The moved/newer clip wins. Any older clip occupying the same track/time is removed
  // instead of continuing to play underneath it.
  return replaceTimelineOverlaps(moved, movingIds)
}
