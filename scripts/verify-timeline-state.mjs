import assert from 'node:assert/strict'
import { addTimelineTrack, insertClipReplacingOverlaps, moveSelectedClips } from '../src/timelineStateHelpers.js'

const tracks = [
  { id: 'V2', type: 'video', locked: false },
  { id: 'V1', type: 'video', locked: false },
  { id: 'A1', type: 'audio', locked: false },
]
const addedVideo = addTimelineTrack(tracks, 'video')
assert.equal(addedVideo.track.id, 'V3')
assert.deepEqual(addedVideo.tracks.map((track) => track.id), ['V3', 'V2', 'V1', 'A1'])
const addedAudio = addTimelineTrack(addedVideo.tracks, 'audio')
assert.equal(addedAudio.track.id, 'A2')
assert.deepEqual(addedAudio.tracks.map((track) => track.id), ['V3', 'V2', 'V1', 'A1', 'A2'])

const clips = [
  { id: 'a', type: 'video', trackId: 'V2', start: 2, duration: 3 },
  { id: 'b', type: 'video', trackId: 'V1', start: 5, duration: 2 },
  { id: 'c', type: 'audio', trackId: 'A1', start: 1, duration: 4 },
]
const moved = moveSelectedClips({
  clips,
  selectedIds: ['a', 'b'],
  anchorId: 'a',
  targetTrackId: 'V1',
  tracks,
  requestedAnchorStart: 12,
  timelineSeconds: 120,
})
assert.equal(moved.find((clip) => clip.id === 'a').start, 12)
assert.equal(moved.find((clip) => clip.id === 'b').start, 15)
assert.equal(moved.find((clip) => clip.id === 'a').trackId, 'V1')
assert.equal(moved.find((clip) => clip.id === 'b').trackId, 'V1')
assert.equal(moved.find((clip) => clip.id === 'c').start, 1)

const mixedMoved = moveSelectedClips({
  clips,
  selectedIds: ['a', 'c'],
  anchorId: 'a',
  targetTrackId: 'V1',
  tracks,
  requestedAnchorStart: 20,
  timelineSeconds: 120,
})
assert.equal(mixedMoved.find((clip) => clip.id === 'a').start, 20)
assert.equal(mixedMoved.find((clip) => clip.id === 'c').start, 19)
assert.equal(mixedMoved.find((clip) => clip.id === 'c').trackId, 'A1')

const collisionClips = [
  { id: 'old', type: 'video', trackId: 'V1', start: 10, duration: 5, sourceIn: 0, video: { speed: 1 } },
  { id: 'winner', type: 'video', trackId: 'V2', start: 2, duration: 4 },
  { id: 'safe', type: 'video', trackId: 'V1', start: 20, duration: 3 },
]
const collisionMoved = moveSelectedClips({
  clips: collisionClips,
  selectedIds: ['winner'],
  anchorId: 'winner',
  targetTrackId: 'V1',
  tracks,
  requestedAnchorStart: 12,
})
const trimmedOld = collisionMoved.find((clip) => clip.id === 'old')
assert.equal(trimmedOld.start, 10, 'older clip start should remain when only its tail overlaps')
assert.equal(trimmedOld.duration, 2, 'only the 12-15 overlapping tail should be removed')
assert.equal(collisionMoved.some((clip) => clip.id === 'winner'), true, 'moved clip should win the occupied overlap range')
assert.equal(collisionMoved.some((clip) => clip.id === 'safe'), true, 'non-overlapping clips must remain')

const inserted = insertClipReplacingOverlaps(collisionClips, {
  id: 'new', type: 'video', trackId: 'V1', start: 11, duration: 2,
})
const splitLeft = inserted.find((clip) => clip.id === 'old')
const splitRight = inserted.find((clip) => clip.id === 'old-after-new')
assert.equal(splitLeft.start, 10)
assert.equal(splitLeft.duration, 1, 'left non-overlapping portion should remain')
assert.equal(splitRight.start, 13)
assert.equal(splitRight.duration, 2, 'right non-overlapping portion should remain')
assert.equal(splitRight.sourceIn, 3, 'right split should resume at the correct source position')
assert.equal(inserted.some((clip) => clip.id === 'new'), true)
assert.equal(inserted.some((clip) => clip.id === 'safe'), true)

const frontTrim = insertClipReplacingOverlaps([
  { id: 'old-front', type: 'video', trackId: 'V1', start: 10, duration: 5, sourceIn: 4, video: { speed: 2 } },
], { id: 'front-winner', type: 'video', trackId: 'V1', start: 8, duration: 4 })
const frontRemainder = frontTrim.find((clip) => clip.id === 'old-front')
assert.equal(frontRemainder.start, 12)
assert.equal(frontRemainder.duration, 3)
assert.equal(frontRemainder.sourceIn, 8, 'front trim should advance sourceIn by removed duration times playback speed')

const fullyCovered = insertClipReplacingOverlaps([
  { id: 'covered', type: 'video', trackId: 'V1', start: 10, duration: 2 },
], { id: 'cover', type: 'video', trackId: 'V1', start: 9, duration: 4 })
assert.equal(fullyCovered.some((clip) => clip.id === 'covered'), false, 'fully covered old clip should be removed')

const edgeTouch = insertClipReplacingOverlaps([
  { id: 'touch', type: 'video', trackId: 'V1', start: 10, duration: 2 },
], { id: 'touch-winner', type: 'video', trackId: 'V1', start: 12, duration: 2 })
assert.equal(edgeTouch.some((clip) => clip.id === 'touch'), true, 'touching edges are not overlap')

console.log('timeline state helpers verified')
