// Shared multi-keyframe data model + interpolation, used by the Effect
// Controls "stopwatch" UI (ClipControls.jsx, and later the Text panel) and by
// the preview resolvers in App.jsx. A property's keyframe track looks like:
//
//   { enabled: true, points: [{ time, value, easing }, ...] }
//
// `time` is in seconds relative to the CLIP'S OWN start (0 = clip start),
// matching how the rest of the app already treats a clip's local time.
// `points` is kept sorted by time. `easing` on a point describes how the
// value eases INTO that point from the previous one (Adobe's own convention
// keys the interpolation type to the incoming keyframe).
//
// Backward compatibility: the app previously shipped a simpler "static value
// -> single end value across the whole clip" model, stored as
// { enabled, to, easing } with no `points` array (see the six VIDEO_PRESETS
// in ClipControls.jsx, and any project saved before this feature). Rather
// than migrating every saved project file, resolveKeyframeValue understands
// BOTH shapes directly, so old projects keep animating exactly as before and
// only get "upgraded" to the points-array shape the moment a person actually
// interacts with the new stopwatch UI on that property.

export function easeProgress(progress, easing) {
  const p = Math.max(0, Math.min(1, progress))
  if (easing === 'easeIn') return p * p
  if (easing === 'easeOut') return 1 - (1 - p) * (1 - p)
  if (easing === 'easeInOut') return p * p * (3 - 2 * p)
  return p
}

// True if `track` uses the new multi-keyframe shape.
export function isMultiKeyframeTrack(track) {
  return Boolean(track && Array.isArray(track.points))
}

// Resolve a property's value at `localTime` (seconds from clip start).
// `baseValue` is the plain static value shown in the panel when no
// keyframing is enabled at all. `duration` is the clip's total duration in
// seconds, only used for the legacy two-point shape.
export function resolveKeyframeValue(track, baseValue, localTime, duration) {
  if (!track?.enabled) return baseValue

  if (isMultiKeyframeTrack(track)) {
    const points = track.points
    if (!points.length) return baseValue
    if (points.length === 1) return points[0].value
    if (localTime <= points[0].time) return points[0].value
    const last = points[points.length - 1]
    if (localTime >= last.time) return last.value
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      if (localTime >= a.time && localTime <= b.time) {
        const span = Math.max(0.0001, b.time - a.time)
        const p = easeProgress((localTime - a.time) / span, b.easing)
        return a.value + (b.value - a.value) * p
      }
    }
    return last.value
  }

  // Legacy shape: a single transition from `baseValue` to `track.to` spread
  // across the clip's whole duration.
  if (track.to !== undefined) {
    const span = Math.max(0.05, Number(duration) || 0.05)
    const p = easeProgress(localTime / span, track.easing)
    return baseValue + (Number(track.to) - baseValue) * p
  }

  return baseValue
}

// Does a keyframe already sit at (approximately) this exact time?
export function keyframeAt(track, time, epsilon = 0.001) {
  if (!isMultiKeyframeTrack(track)) return null
  return track.points.find((pt) => Math.abs(pt.time - time) <= epsilon) || null
}

// Insert or replace the keyframe at `time` with `value`, keeping the array
// sorted. Returns a NEW points array (does not mutate).
export function upsertKeyframe(points, time, value, easing = 'linear') {
  const epsilon = 0.001
  const next = (points || []).filter((pt) => Math.abs(pt.time - time) > epsilon)
  next.push({ time, value, easing })
  next.sort((a, b) => a.time - b.time)
  return next
}

// Remove whichever keyframe sits at `time`. Returns a NEW points array.
export function removeKeyframeAt(points, time, epsilon = 0.001) {
  return (points || []).filter((pt) => Math.abs(pt.time - time) > epsilon)
}

// Turn a legacy { enabled, to, easing } track into the new points-array
// shape, anchored so it animates identically to how it already displayed
// (base value at time 0, `to` at `duration`). No-op if already migrated.
export function migrateLegacyTrack(track, baseValue, duration) {
  if (!track) return { enabled: false, points: [] }
  if (isMultiKeyframeTrack(track)) return track
  if (!track.enabled || track.to === undefined) return { enabled: Boolean(track.enabled), points: [] }
  return {
    enabled: true,
    points: [
      { time: 0, value: baseValue, easing: 'linear' },
      { time: Math.max(0.05, Number(duration) || 0.05), value: Number(track.to), easing: track.easing || 'linear' },
    ],
  }
}
