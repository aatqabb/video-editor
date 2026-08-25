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

  return clips.map((clip) => {
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
}