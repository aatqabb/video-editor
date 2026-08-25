import fs from 'node:fs'
import { normalizeLineEndingsPlugin } from './normalize-line-endings-plugin.js'
import { stockWorkspacePlugin } from './vite-stock-workspace-plugin.js'
import { timelineRefactorPlugin } from './vite-timeline-refactor-plugin.js'
import { playbackMediaPlugin } from './vite-playback-media-plugin.js'
import { unlimitedTimelineImportPlugin } from './vite-unlimited-timeline-import-plugin.js'
import { durationUiSyncPlugin } from './vite-duration-ui-sync-plugin.js'
import { programPlaybackSyncPlugin } from './vite-program-playback-sync-plugin.js'
import { premierePlayheadPlugin } from './vite-premiere-playhead-plugin.js'
import { smoothTimelineDragPlugin } from './vite-smooth-timeline-drag-plugin.js'
import { trackDeletePlugin } from './vite-track-delete-plugin.js'
import { programTransformOverlayPlugin } from './vite-program-transform-overlay-plugin.js'

let code = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const id = '/repo/src/App.jsx'
for (const plugin of [
  normalizeLineEndingsPlugin(),
  stockWorkspacePlugin(),
  timelineRefactorPlugin(),
  playbackMediaPlugin(),
  unlimitedTimelineImportPlugin(),
  durationUiSyncPlugin(),
  programPlaybackSyncPlugin(),
  premierePlayheadPlugin(),
  smoothTimelineDragPlugin(),
  trackDeletePlugin(),
  programTransformOverlayPlugin(),
]) {
  const result = plugin.transform?.(code, id)
  if (result?.code) code = result.code
}

const checks = [
  ['smooth clip pointer handler survives playhead transform', code.includes('const startClipPointerDrag = (event, clip) =>')],
  ['timeline clips use pointer drag wiring', code.includes('onPointerDown={(event) => startClipPointerDrag(event, clip)}')],
  ['native clip drag is disabled', code.includes('draggable={false}')],
  ['playhead uses window-level pointer drag loop', code.includes("window.addEventListener('pointermove', onMove, true)") && code.includes("window.addEventListener('pointerup', onUp, true)")],
  ['playhead drag does not depend on pointer capture', !code.includes('setPointerCapture?.(pointerId)') && !code.includes("addEventListener('lostpointercapture'" )],
  ['playhead release commits final pointer position', code.includes('setPlayhead(pointerToTime({ clientX: latestX }))')],
  ['dynamic timeline prop is wired', code.includes('timelineSeconds={timelineSeconds}')],
  ['timeline width uses dynamic duration', code.includes('const laneWidth = timelineSeconds * pixelsPerSecond')],
  ['media import creates fresh layer at playhead', code.includes('added on a new ${timelineType} layer at playhead')],
  ['video import creates linked audio layer', code.includes("kind: 'linked-video-audio'")],
  ['right trim has no fixed timeline cap', !code.includes('Math.min(timelineSeconds, proposedEnd)')],
  ['ruler follows real content end without 60-second tail', code.includes('const required = Math.max(10, contentEnd + 1, playhead + 1)') && !code.includes('contentEnd + 60')],
  ['program monitor receives live timeline duration', code.includes('timelineDuration={timelineSeconds}')],
  ['program monitor receives clip selection state', code.includes('selectedClipIds={selectedClipIds}') && code.includes('setSelectedClipIds={setSelectedClipIds}')],
  ['program monitor signature owns clip selection state', code.includes('selectedClipIds = []') && code.includes('setSelectedClipIds = () => {}')],
  ['program monitor keeps imported or stock video media live', code.includes('clip.remoteUrl || clip.localUrl || clip.originalUrl')],
  ['program monitor resize persists scale', code.includes('updateClipControls(activeVideo.id, { video: { scale:')],
  ['program monitor renders current / total duration', code.includes('${formatTime(playhead)} / ${formatTime(timelineDuration)}')],
  ['hard-coded monitor timecode is removed', !code.includes('<span>00:00:05:11</span>')],
  ['timeline receives setTracks for layer deletion', code.includes('setTracks={setTracks}')],
  ['track delete handler removes track clips and selection', code.includes('const deleteTrack = (trackId) =>') && code.includes("clip.trackId !== trackId") && code.includes('removedIds.has(id)')],
  ['each track exposes a delete layer control', code.includes('className="track-delete"') && code.includes('deleteTrack(track.id)')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('\nVite transform order preserves timeline drag, robust window-level playhead dragging, imports, duration UI, removable layers, and Program Monitor live resize together.')
