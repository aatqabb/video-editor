const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function ffmpegCandidates() {
  const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const candidates = [
    process.env.VIDEO_EDITOR_FFMPEG,
    process.resourcesPath && path.join(process.resourcesPath, executable),
    process.resourcesPath && path.join(process.resourcesPath, 'ffmpeg', executable),
    path.join(__dirname, '..', 'resources', 'ffmpeg', executable),
    'ffmpeg',
  ]
  return [...new Set(candidates.filter(Boolean))]
}

function canRun(binary) {
  try {
    const result = spawnSync(binary, ['-hide_banner', '-version'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
    return result.status === 0
  } catch {
    return false
  }
}

function resolveFfmpeg() {
  return ffmpegCandidates().find(canRun) || null
}

function probeList(binary, args, candidates) {
  if (!binary) return []
  try {
    const result = spawnSync(binary, args, { encoding: 'utf8', windowsHide: true, timeout: 10000 })
    const text = `${result.stdout || ''}\n${result.stderr || ''}`.toLowerCase()
    return candidates.filter((candidate) => text.includes(candidate.toLowerCase()))
  } catch {
    return []
  }
}

function probeEncoders(binary) {
  return probeList(binary, ['-hide_banner', '-encoders'], ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264', 'libmp3lame', 'aac'])
}

function probeHardwareAccelerators(binary) {
  return probeList(binary, ['-hide_banner', '-hwaccels'], ['cuda', 'qsv', 'd3d11va', 'dxva2'])
}

function probeFfmpeg() {
  const binary = resolveFfmpeg()
  const encoders = probeEncoders(binary)
  const hardwareAccelerators = probeHardwareAccelerators(binary)
  return {
    available: Boolean(binary),
    binary,
    encoders,
    hardwareEncoders: encoders.filter((encoder) => ['h264_nvenc', 'h264_qsv', 'h264_amf'].includes(encoder)),
    hardwareAccelerators,
  }
}

function escapeFilterPath(value) {
  return String(value).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function clipInput(clip) {
  if (clip.sourcePath && fs.existsSync(clip.sourcePath)) return clip.sourcePath
  if (clip.remoteUrl && /^https?:\/\//i.test(clip.remoteUrl)) return clip.remoteUrl
  return null
}

function chooseVideoEncoder(capabilities, renderMode = 'Auto') {
  if (renderMode === 'CPU') return capabilities.encoders.includes('libx264') ? 'libx264' : null
  const preferred = ['h264_nvenc', 'h264_qsv', 'h264_amf']
  const hardware = preferred.find((encoder) => capabilities.encoders.includes(encoder))
  if (renderMode === 'GPU') return hardware
  return hardware || (capabilities.encoders.includes('libx264') ? 'libx264' : null)
}

function seconds(value) {
  return Math.max(0, Number(value) || 0)
}

function timelineDuration(manifest) {
  const ends = (manifest.clips || []).map((clip) => seconds(clip.start) + seconds(clip.duration))
  return Math.max(1, ...ends)
}

function addMediaInputs(args, clips) {
  const inputMap = new Map()
  for (const clip of clips) {
    const source = clipInput(clip)
    if (!source) continue
    const key = `${clip.id}:${source}`
    const inputIndex = inputMap.size
    if (clip.kind === 'image') {
      args.push('-loop', '1', '-t', String(seconds(clip.duration)), '-i', source)
    } else {
      const sourceIn = seconds(clip.sourceIn)
      if (sourceIn) args.push('-ss', String(sourceIn))
      args.push('-t', String(Math.max(.05, seconds(clip.duration) * Math.max(.1, Number(clip.video?.speed) || 1))), '-i', source)
    }
    inputMap.set(key, inputIndex)
  }
  return inputMap
}

function transitionDuration(clip) {
  const requested = Math.max(.05, Number(clip.transition?.duration) || .45)
  return Math.min(requested, Math.max(.05, seconds(clip.duration) / 2))
}

function transitionFadeFilter(clip) {
  const type = String(clip.transition?.type || '')
  const duration = transitionDuration(clip)
  // Fade/Cross Dissolve/Dip to Black all fade the clip's ALPHA to 0 over the
  // black base canvas (buildVideoFilters starts every export from a
  // `color=c=black` layer) — that's a true "dip to black" already, so Dip to
  // Black is just an alias for the existing behavior.
  if (type === 'Fade' || type === 'Cross Dissolve' || type === 'Dip to Black') return `fade=t=in:st=0:d=${duration}:alpha=1`
  // Dip to White / Flash need the fade to blend an actual WHITE color into the
  // clip's own pixels, not fade transparency — verified via `-h filter=fade`
  // and a real pixel-sampled render that `alpha=1` ignores `color` entirely
  // (it fades transparency over the black base instead), while the default,
  // non-alpha mode correctly blends `color=white` into the source pixels and
  // fades back to the original picture by the end of the duration.
  if (type === 'Dip to White') return `fade=t=in:st=0:d=${duration}:color=white`
  if (type === 'Flash') return `fade=t=in:st=0:d=${Math.max(.05, duration * .4)}:color=white`
  return null
}

function transitionZoomFilter(clip) {
  const type = String(clip.transition?.type || '')
  const zooms = {
    'Zoom In': [.82, 1],
    'Zoom Out': [1.18, 1],
    'Smooth Zoom In': [.72, 1],
    'Smooth Zoom Out': [1.28, 1],
    // "+ Distort" has no real lens-distortion filter behind it here (documented
    // simplification — same honesty policy as the other approximations in this
    // file) so it reuses the plain zoom range rather than silently doing nothing.
    'Zoom In + Distort': [.8, 1],
    'Zoom Out + Distort': [1.2, 1],
    'Zoom In Rotate': [.82, 1],
    'Zoom Out Rotate': [1.18, 1],
    'Rotate + Zoom': [.85, 1],
    'Camera Push In': [.94, 1],
    'Camera Pull Out': [1.06, 1],
    'Spin Zoom': [.7, 1],
  }
  const range = zooms[type]
  if (!range) return null

  const duration = transitionDuration(clip)
  const progress = `min(1,max(0,t/${duration}))`
  const eased = type.startsWith('Smooth') ? `(${progress}*${progress}*(3-2*${progress}))` : progress
  const [from, to] = range
  const factor = `(${from}+(${to - from})*${eased})`
  return `scale=w='max(2,iw*${factor})':h='max(2,ih*${factor})':eval=frame`
}

// Rotate component for the zoom+rotate transition family. Degrees settle to 0
// by the end of the transition. `rotate`'s `angle` accepts a per-frame t
// expression (verified this session via a real render comparing rotation
// position at t=0 vs mid-transition on a marker test image); ow/oh are left
// at their default (= input size) rather than rotw()/roth() so the frame's
// pixel dimensions stay constant across the animation — verified via a
// combined pan+rotate render producing a stable, unchanged output size.
function transitionRotateFilter(clip) {
  const type = String(clip.transition?.type || '')
  const startDegrees = {
    'Zoom In Rotate': -12,
    'Zoom Out Rotate': 12,
    'Rotate + Zoom': 18,
    'Spin Zoom': 360,
  }[type]
  if (startDegrees === undefined) return null

  const duration = transitionDuration(clip)
  const progress = `min(1,max(0,t/${duration}))`
  const startRadians = (startDegrees * Math.PI / 180).toFixed(6)
  return `rotate=angle='${startRadians}*(1-${progress})':c=black@0`
}

// Camera pan/tilt/shake family: scale the frame up (PAN_HEADROOM) then crop
// back down to the original size with an animated x/y offset, so the pan
// stays within real picture content instead of exposing empty edges. crop's
// x/y accept per-frame t expressions (verified this session via a real
// render comparing crop-window position at two different times), and this
// exact scale-up + animated-crop chain was verified together with the rotate
// filter above to keep output dimensions stable frame to frame.
const PAN_HEADROOM = 1.16

function transitionPanFilter(clip) {
  const type = String(clip.transition?.type || '')
  const panTypes = ['Camera Pan Left', 'Camera Pan Right', 'Camera Tilt Up', 'Camera Tilt Down', 'Camera Shake', 'Handheld Camera', 'Whip Pan Left', 'Whip Pan Right']
  if (!panTypes.includes(type)) return null

  const duration = transitionDuration(clip)
  const progress = `min(1,max(0,t/${duration}))`
  const maxOffsetX = `(iw-iw/${PAN_HEADROOM})`
  const maxOffsetY = `(ih-ih/${PAN_HEADROOM})`
  let x = `${maxOffsetX}/2`
  let y = `${maxOffsetY}/2`

  if (type === 'Camera Pan Left') x = `${maxOffsetX}*(1-${progress})`
  if (type === 'Camera Pan Right') x = `${maxOffsetX}*${progress}`
  if (type === 'Camera Tilt Up') y = `${maxOffsetY}*${progress}`
  if (type === 'Camera Tilt Down') y = `${maxOffsetY}*(1-${progress})`
  // Shake/Handheld: crop is clamped to valid bounds by FFmpeg itself, so a
  // sine wiggle around the center offset is safe without extra clamping.
  if (type === 'Camera Shake') {
    x = `${maxOffsetX}/2+(${maxOffsetX}/2)*sin(t*22)`
    y = `${maxOffsetY}/2+(${maxOffsetY}/2)*sin(t*17+1)`
  }
  if (type === 'Handheld Camera') {
    x = `${maxOffsetX}/2+(${maxOffsetX}/2.6)*sin(t*3.1)`
    y = `${maxOffsetY}/2+(${maxOffsetY}/2.6)*sin(t*2.3+1)`
  }
  if (type === 'Whip Pan Left') x = `${maxOffsetX}*(1-${progress})`
  if (type === 'Whip Pan Right') x = `${maxOffsetX}*${progress}`

  return `scale=w='trunc(iw*${PAN_HEADROOM}/2)*2':h='trunc(ih*${PAN_HEADROOM}/2)*2',crop=w='iw/${PAN_HEADROOM}':h='ih/${PAN_HEADROOM}':x='${x}':y='${y}'`
}

// Blur Transition / Whip Pan accent blur. gblur's `sigma` cannot be driven by
// a per-frame t expression — confirmed via a direct FFmpeg error
// ("Unable to parse option value ... Invalid argument") when this was tried —
// so this is a static blur held for the transition window via `enable`
// (an honest simplification, not a smooth ramp) rather than a broken feature.
function transitionBlurPulseFilter(clip) {
  const type = String(clip.transition?.type || '')
  if (!['Blur Transition', 'Whip Pan Left', 'Whip Pan Right'].includes(type)) return null
  const isWhipPan = type !== 'Blur Transition'
  const duration = isWhipPan ? Math.min(transitionDuration(clip), .25) : transitionDuration(clip)
  const sigma = isWhipPan ? 9 : 14
  return `gblur=sigma=${sigma}:enable='lt(t,${duration})'`
}

function transitionLightLeakFilters(clip) {
  const type = String(clip.transition?.type || '')
  if (!['Light Leak Warm', 'Light Leak Cool', 'Light Leak Film'].includes(type)) return []

  const duration = transitionDuration(clip)
  const progress = `min(1,max(0,t/${duration}))`
  const glow = `(1-${progress})`
  const tint = type === 'Light Leak Cool'
    ? { r: -.08, g: .04, b: .2 }
    : type === 'Light Leak Film'
      ? { r: .12, g: .03, b: .06 }
      : { r: .18, g: .06, b: -.12 }

  return [
    `eq=brightness='0.3*${glow}':saturation='1+0.5*${glow}':eval=frame`,
    `colorbalance=rs=${tint.r}:gs=${tint.g}:bs=${tint.b}:enable='lt(t,${duration})'`,
  ]
}

// --- Effect Controls keyframes (animate a property from its static value to
// an end value across the whole clip) — free, plain FFmpeg expressions, same
// eval=frame technique already used above for transition zoom/light-leak. ---

// Same easing curve names offered in the Effect Controls keyframe UI
// (Linear/Ease In/Ease Out/Ease In-Out) — reuses the exact smoothstep-family
// math already trusted elsewhere in this file (transitionZoomFilter's
// "Smooth" easing below uses the same p*p*(3-2p) curve).
function easedProgressExpression(progressExpression, easing) {
  const p = progressExpression
  if (easing === 'easeIn') return `(${p}*${p})`
  if (easing === 'easeOut') return `(1-(1-${p})*(1-${p}))`
  if (easing === 'easeInOut') return `(${p}*${p}*(3-2*${p}))`
  return p
}

function keyframeLerpExpression(from, to, durationSeconds, startOffsetSeconds = 0, easing = 'linear') {
  // startOffsetSeconds is 0 for filters that run inside a clip's own local
  // filter chain (t already starts at ~0 there, same as transitionZoomFilter
  // above), and the clip's global timeline start for filters that run at the
  // top-level composited stage (the overlay filter's t is global there).
  const progress = startOffsetSeconds
    ? `min(1,max(0,(t-${startOffsetSeconds})/${Math.max(.05, durationSeconds)}))`
    : `min(1,max(0,t/${Math.max(.05, durationSeconds)}))`
  const eased = easedProgressExpression(progress, easing)
  return `(${from}+(${to - from})*${eased})`
}

function keyframeScaleFilter(clip) {
  const keyframe = clip.video?.keyframes?.scale
  if (!keyframe?.enabled) return null
  const from = Math.max(.01, (Number(clip.video?.scale) || 100) / 100)
  const to = Math.max(.01, (Number(keyframe.to) || 100) / 100)
  const factor = keyframeLerpExpression(from, to, seconds(clip.duration), 0, keyframe.easing)
  return `scale=w='max(2,iw*${factor})':h='max(2,ih*${factor})':eval=frame`
}

// Rotation keyframe — same `rotate` filter already proven to accept a
// per-frame t expression (verified this session for the transition-rotate
// family above); ow/oh stay at their default (input size) rather than
// rotw()/roth() for the same reason as transitionRotateFilter — animated
// canvas dimensions are the risky part, not the angle itself.
function keyframeRotationFilter(clip) {
  const keyframe = clip.video?.keyframes?.rotation
  if (!keyframe?.enabled) return null
  const fromDegrees = Number(clip.video?.rotation) || 0
  const toDegrees = Number(keyframe.to) || 0
  const degreesExpr = keyframeLerpExpression(fromDegrees, toDegrees, seconds(clip.duration), 0, keyframe.easing)
  return `rotate=angle='(${degreesExpr})*PI/180':c=black@0`
}

// colorchannelmixer's "aa" option is a plain <double> (verified against
// `ffmpeg -h filter=colorchannelmixer` — no `eval` option, no av_expr support,
// unlike scale's w/h), so it cannot be driven by a per-frame t-expression the
// way scale/position can. The one case FFmpeg animates natively and reliably
// is a full 0<->1 alpha sweep, via the `fade` filter (already used elsewhere
// in this file for transition fades) — which covers the built-in Fade
// In/Fade Out presets. An arbitrary partial range (e.g. 60%->30%) has no
// verified-safe native export filter, so it stays preview-only and the
// export keeps the clip's static starting opacity for that case.
function keyframeOpacityFadeFilter(clip) {
  const keyframe = clip.video?.keyframes?.opacity
  if (!keyframe?.enabled) return null
  const base = Math.max(0, Math.min(1, (Number(clip.video?.opacity ?? 100)) / 100))
  const to = Math.max(0, Math.min(1, Number(keyframe.to ?? 100) / 100))
  const duration = Math.max(.05, seconds(clip.duration))
  if (base <= .01 && to >= .99) return `fade=t=in:st=0:d=${duration}:alpha=1`
  if (base >= .99 && to <= .01) return `fade=t=out:st=0:d=${duration}:alpha=1`
  return null
}

function keyframePositionFraction(clip, axisKey) {
  // Runs at the top-level overlay stage (see buildVideoFilters below), where
  // t is the GLOBAL composited timeline time — same domain transitionOverlayPosition
  // already uses for slide transitions — so the clip's start must be subtracted.
  const video = clip.video || {}
  const base = Math.max(0, Math.min(1, (Number(video[axisKey] ?? 50)) / 100))
  const keyframe = video.keyframes?.[axisKey]
  if (!keyframe?.enabled) return String(base)
  const to = Math.max(0, Math.min(1, Number(keyframe.to ?? 50) / 100))
  return keyframeLerpExpression(base, to, seconds(clip.duration), seconds(clip.start), keyframe.easing)
}

function transitionOverlayPosition(clip, axis, baseExpression) {
  const type = String(clip.transition?.type || '')
  const start = seconds(clip.start)
  const duration = transitionDuration(clip)
  const progress = `min(1,max(0,(t-${start})/${duration}))`

  if (axis === 'x') {
    if (type === 'Slide Left' || type === 'Push') return `${baseExpression}+W*(1-${progress})`
    if (type === 'Slide Right') return `${baseExpression}-W*(1-${progress})`
  }
  if (axis === 'y') {
    if (type === 'Slide Up') return `${baseExpression}+H*(1-${progress})`
    if (type === 'Slide Down') return `${baseExpression}-H*(1-${progress})`
  }
  return baseExpression
}

// Color Correction (Effect Controls "Color" section) — Temperature/Tint/
// Vibrance. `colortemperature` and `vibrance` are both real, direct FFmpeg
// filters (verified via real renders: 3000K rendered visibly orange, 10000K
// visibly blue; a muted tan color (176,138,120) became vivid orange
// (255,139,79) under vibrance). Tint specifically does NOT use
// `colorbalance`'s rm/gm/bm midtone options — a real render proved those
// leave neutral gray completely unchanged (exact 128,128,128 and 64,64,64
// gray pixels stayed bit-identical), which is wrong for a general tint
// control since real footage is full of near-neutral tones. A
// `colorchannelmixer` channel-gain scale was verified instead to correctly
// shift even pure gray toward magenta/green.
function colorGradeFilters(clip) {
  const video = clip.video || {}
  const temperature = Math.max(-100, Math.min(100, Number(video.temperature) || 0))
  const tint = Math.max(-100, Math.min(100, Number(video.tint) || 0))
  const vibrance = Math.max(-100, Math.min(100, Number(video.vibrance) || 0))
  const filters = []
  if (temperature) {
    // Positive slider = warmer (Lightroom/Premiere convention) -> lower Kelvin.
    const kelvin = Math.round(6500 - (temperature / 100) * 3500)
    filters.push(`colortemperature=temperature=${kelvin}`)
  }
  if (tint) {
    const t = (tint / 100) * .3
    filters.push(`colorchannelmixer=rr=${(1 + t).toFixed(3)}:gg=${(1 - t).toFixed(3)}:bb=${(1 + t).toFixed(3)}`)
  }
  if (vibrance) filters.push(`vibrance=intensity=${((vibrance / 100) * 1.5).toFixed(3)}`)
  return filters
}

function videoClipFilter(clip, inputIndex, width, height, fps) {
  const video = clip.video || {}
  const cropTop = Math.max(0, Math.min(49, Number(video.cropTop) || 0)) / 100
  const cropRight = Math.max(0, Math.min(49, Number(video.cropRight) || 0)) / 100
  const cropBottom = Math.max(0, Math.min(49, Number(video.cropBottom) || 0)) / 100
  const cropLeft = Math.max(0, Math.min(49, Number(video.cropLeft) || 0)) / 100
  const cropW = Math.max(.02, 1 - cropLeft - cropRight)
  const cropH = Math.max(.02, 1 - cropTop - cropBottom)
  const scalePercent = Math.max(.01, (Number(video.scale) || 100) / 100)
  const targetW = Math.max(2, Math.round(width * scalePercent))
  const targetH = Math.max(2, Math.round(height * scalePercent))
  const fit = video.fitMode || 'Fit'
  const scaleFilter = fit === 'Stretch'
    ? `scale=${targetW}:${targetH}`
    : fit === 'Fill'
      ? `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}`
      : `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black@0`
  const opacityFadeFilter = keyframeOpacityFadeFilter(clip)
  const staticOpacity = opacityFadeFilter ? 1 : Math.max(0, Math.min(1, (Number(video.opacity ?? 100)) / 100))
  const start = seconds(clip.start)
  const speed = Math.max(.1, Number(video.speed) || 1)
  const rotation = (Number(video.rotation) || 0) * Math.PI / 180
  const freezeFrame = Boolean(video.freezeFrame)

  const filters = []
  if (freezeFrame) {
    // Time Remapping's "Freeze Frame" — the live preview swaps in a single
    // static thumbnail for the clip's whole duration, so export holds the
    // first decoded frame the same way: select isolates frame 0, loop
    // repeats it indefinitely, setpts regenerates real per-frame timestamps.
    // Nothing downstream needs to cap the loop — the export's own top-level
    // `-t` duration is what stops it (verified this session: a 0.2s source
    // correctly produced a valid held frame as late as t=2.5s).
    filters.push(`select='eq(n\\,0)'`, `loop=loop=-1:size=1:start=0`, `setpts=N/${fps}/TB`)
  }
  filters.push(`crop=iw*${cropW}:ih*${cropH}:iw*${cropLeft}:ih*${cropTop}`, scaleFilter)
  const rotationKeyframeFilter = keyframeRotationFilter(clip)
  if (rotationKeyframeFilter) filters.push(rotationKeyframeFilter)
  else if (rotation) filters.push(`rotate=${rotation}:ow=rotw(${rotation}):oh=roth(${rotation}):c=black@0`)
  if (!freezeFrame && speed !== 1) filters.push(`setpts=PTS/${speed}`)
  filters.push(...colorGradeFilters(clip))
  const zoomFilter = transitionZoomFilter(clip)
  if (zoomFilter) filters.push(zoomFilter)
  const rotateFilter = transitionRotateFilter(clip)
  if (rotateFilter) filters.push(rotateFilter)
  const panFilter = transitionPanFilter(clip)
  if (panFilter) filters.push(panFilter)
  const blurPulseFilter = transitionBlurPulseFilter(clip)
  if (blurPulseFilter) filters.push(blurPulseFilter)
  const keyframeZoomFilter = keyframeScaleFilter(clip)
  if (keyframeZoomFilter) filters.push(keyframeZoomFilter)
  filters.push(...transitionLightLeakFilters(clip))
  filters.push(`format=rgba,colorchannelmixer=aa=${staticOpacity}`)
  if (opacityFadeFilter) filters.push(opacityFadeFilter)
  const transitionFilter = transitionFadeFilter(clip)
  if (transitionFilter) filters.push(transitionFilter)

  for (const effect of clip.effects || []) {
    const intensity = Math.max(0, Math.min(100, Number(effect.intensity) || 0))
    if (effect.type === 'Blur') filters.push(`gblur=sigma=${Math.max(.1, intensity / 16)}`)
    if (effect.type === 'Sharpen') filters.push(`unsharp=5:5:${(intensity / 100 * 3).toFixed(2)}:5:5:0.0`)
    // vignette's `angle` narrows the visible "lens cone" — a full PI/2 shows
    // no vignette at all, so intensity maps down from there towards a tight,
    // strongly-vignetted PI/7 (verified via a real render: corner pixel went
    // fully black while the center stayed at the source's full brightness).
    if (effect.type === 'Vignette') filters.push(`vignette=angle=${(Math.PI / 2 - (intensity / 100) * (Math.PI / 2 - Math.PI / 7)).toFixed(4)}`)
    if (effect.type === 'Grayscale') filters.push('hue=s=0')
    if (effect.type === 'Brightness') filters.push(`eq=brightness=${(intensity - 50) / 100}`)
    if (effect.type === 'Contrast') filters.push(`eq=contrast=${Math.max(.1, intensity / 50)}`)
    if (effect.type === 'Saturate') filters.push(`eq=saturation=${Math.max(0, intensity / 50)}`)
    if (effect.type === 'Sepia') filters.push(`colorchannelmixer=.393:.769:.189:.349:.686:.168:.272:.534:.131`)
    // hue's `h` is in degrees, same mapping the live preview's CSS
    // hue-rotate(deg) filter already uses for this effect (see App.jsx).
    if (effect.type === 'Hue Rotate') filters.push(`hue=h=${(intensity * 3.6).toFixed(1)}`)
    // Verified via a real render (noise=alls=20:allf=t) that this produces
    // visible per-pixel grain; allf=t makes it flicker frame to frame like
    // real film grain instead of a single static noise pattern.
    if (effect.type === 'Film Grain') filters.push(`noise=alls=${Math.max(1, Math.round(intensity * .4))}:allf=t`)
  }
  filters.push(`setpts=PTS-STARTPTS+${start}/TB`)
  return filters.join(',')
}

// --- Text / caption burn-in (drawtext) --------------------------------------
//
// Text and caption clips previously never reached the exported file at all —
// they were preview-only (filtered out below by kind !== 'text'). This burns
// them into the real output with FFmpeg's drawtext filter, matching the
// preview as closely as drawtext allows:
//  - position: the (x%,y%) point is always the CENTER of the text box, same
//    as the preview's `translate(-50%,-50%)` — computed here via drawtext's
//    own text_w/text_h expression variables rather than assumed.
//  - color/background/alignment: direct drawtext equivalents (fontcolor,
//    box/boxcolor, text_align).
//  - font: Windows ships Segoe UI/Arial/etc. as real files in C:\Windows\Fonts
//    — this app is Windows-only (see package.json build.win), so those exact
//    paths are used for fontfile=, verified against `ffmpeg -h filter=drawtext`
//    for the option's existence/shape, not guessed. A font loaded from disk in
//    the Text panel (real file path, not just a browser FontFace) is used
//    directly; anything else (PC-picked fonts, unknown families) falls back
//    to Arial rather than silently failing the whole export.
//  - fade in/out: only the "Fade" animation family is reproduced (via the
//    `alpha` expression drawtext documents as time-capable) — slide/zoom/pop
//    animations stay preview-only, same honesty policy as the opacity
//    keyframe limitation above.
//  - fontSize/x/y are authored against the app's default 1920px-wide canvas
//    (the live preview has no fixed pixel reference at all — it's a fluid,
//    window-size-relative box — so 1920 is the least-arbitrary anchor,
//    matching this app's own default project width) and scaled by
//    exportWidth/1920 for other resolutions.
//  - "paragraph" wrap mode inserts manual \n breaks (drawtext does not
//    auto-wrap text) using an approximate average-character-width estimate,
//    since no real font metrics are available at manifest-build time; this
//    is a documented approximation, not a guess about FFmpeg's own behavior.

const WINDOWS_FONTS_DIR = 'C:\\Windows\\Fonts'
const WINDOWS_FONT_FILES = {
  'segoe ui': { regular: 'segoeui.ttf', bold: 'segoeuib.ttf' },
  'arial': { regular: 'arial.ttf', bold: 'arialbd.ttf' },
  'calibri': { regular: 'calibri.ttf', bold: 'calibrib.ttf' },
  'cambria': { regular: 'cambria.ttc', bold: 'cambriab.ttf' },
  'georgia': { regular: 'georgia.ttf', bold: 'georgiab.ttf' },
  'verdana': { regular: 'verdana.ttf', bold: 'verdanab.ttf' },
  'trebuchet ms': { regular: 'trebuc.ttf', bold: 'trebucbd.ttf' },
  'times new roman': { regular: 'times.ttf', bold: 'timesbd.ttf' },
  'courier new': { regular: 'cour.ttf', bold: 'courbd.ttf' },
  'impact': { regular: 'impact.ttf', bold: 'impact.ttf' },
}

function resolveFontFile(style) {
  if (style.fontFilePath && fs.existsSync(style.fontFilePath)) return style.fontFilePath
  const key = String(style.fontFamily || '').trim().toLowerCase()
  const entry = WINDOWS_FONT_FILES[key] || WINDOWS_FONT_FILES.arial
  return path.join(WINDOWS_FONTS_DIR, style.bold ? entry.bold : entry.regular)
}

// Rough average-character-width heuristic (no real font metrics available
// here) used only to decide where to insert manual line breaks for
// "paragraph" wrap mode — drawtext itself never auto-wraps.
function wrapCaptionText(text, fontSizePx, boxWidthPx) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return ''
  const avgCharWidth = Math.max(4, fontSizePx * 0.56)
  const maxChars = Math.max(4, Math.floor(boxWidthPx / avgCharWidth))
  const lines = []
  let current = ''
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  })
  if (current) lines.push(current)
  return lines.join('\n')
}

// Number of discrete steps used to approximate a per-character typewriter
// reveal, or the cap on steps for a per-word reveal (capped separately from
// the character version since a long caption could otherwise have dozens of
// words, each needing its own chained drawtext call). drawtext's text
// content itself can't be driven by a per-frame expression (only
// fontsize/x/y/alpha/etc can — verified via `-h filter=drawtext`'s option
// flags), so a true smooth per-character or per-word reveal isn't possible;
// this stacks that many drawtext calls, each showing one more chunk of the
// text and gated to its own slice of the animation window via `enable`,
// which is an honest stepped approximation rather than a broken feature.
const TYPEWRITER_STEPS = 10
const WORD_REVEAL_MAX_STEPS = 14

function prepareTextAssets(manifest, cleanupTargets) {
  const textClips = (manifest.clips || []).filter((clip) => clip.type === 'video' && clip.kind === 'text' && String(clip.text || '').trim())
  const fileByClipId = new Map()
  const typewriterStepsByClipId = new Map()
  if (!textClips.length) return { fileByClipId, typewriterStepsByClipId }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-editor-captions-'))
  cleanupTargets.push(tempDir)

  textClips.forEach((clip) => {
    const style = clip.textStyle || {}
    const wrap = style.wrap !== false
    const fontSizePx = Math.max(4, Math.round((Number(style.fontSize) || 64)))
    const content = wrap ? wrapCaptionText(clip.text, fontSizePx, 1920 * 0.86) : String(clip.text || '').replace(/\r?\n/g, ' ')
    const filePath = path.join(tempDir, `${clip.id}.txt`)
    fs.writeFileSync(filePath, content, 'utf8')
    fileByClipId.set(clip.id, filePath)

    const animIn = String(style.animationIn || '')
    if (animIn === 'Typewriter' && content.length > 1) {
      const stepPaths = []
      for (let step = 1; step <= TYPEWRITER_STEPS; step += 1) {
        const cutoff = Math.max(1, Math.round((content.length * step) / TYPEWRITER_STEPS))
        const stepPath = path.join(tempDir, `${clip.id}-tw${step}.txt`)
        fs.writeFileSync(stepPath, content.slice(0, cutoff), 'utf8')
        stepPaths.push(stepPath)
      }
      typewriterStepsByClipId.set(clip.id, stepPaths)
    } else if (animIn === 'Word Reveal') {
      const words = content.split(/\s+/).filter(Boolean)
      if (words.length > 1) {
        const stepCount = Math.min(words.length, WORD_REVEAL_MAX_STEPS)
        const stepPaths = []
        for (let step = 1; step <= stepCount; step += 1) {
          const wordCount = Math.max(1, Math.round((words.length * step) / stepCount))
          const stepPath = path.join(tempDir, `${clip.id}-wd${step}.txt`)
          fs.writeFileSync(stepPath, words.slice(0, wordCount).join(' '), 'utf8')
          stepPaths.push(stepPath)
        }
        typewriterStepsByClipId.set(clip.id, stepPaths)
      }
    }
  })

  return { fileByClipId, typewriterStepsByClipId }
}

// --- Text animation math ----------------------------------------------------
// Mirrors App.jsx's getTextOverlayPresentation (the live preview's animation
// math) as closely as drawtext allows, so export matches what was actually
// previewed instead of reinventing the motion. Previously only the "Fade"
// half of animationIn/animationOut ever reached the exported file — every
// Slide/Zoom/Pop/Shrink/Typewriter animation was preview-only. drawtext's x,
// y, fontsize and alpha are all confirmed per-frame-expression-capable
// (`-h filter=drawtext` marks each with the timeline "T" flag, and a real
// render confirmed fontsize itself can be time-animated — text measured
// ~15px tall early vs ~81px tall late for the same fontsize expression).

function textAnimationWindows(clip, style) {
  const start = seconds(clip.start)
  const duration = Math.max(.05, seconds(clip.duration))
  const end = start + duration
  const animDuration = Math.max(.05, Number(style.animationDuration) || .45)
  return {
    start,
    end,
    animDuration,
    // 0 at clip start -> 1 once the "in" animation has finished playing.
    inProgress: `min(1,max(0,(t-${start})/${animDuration}))`,
    // 0 until the "out" animation window begins -> 1 at clip end.
    outProgress: `min(1,max(0,(t-${end - animDuration})/${animDuration}))`,
  }
}

// Fade AND the blur-family animations (no real per-text blur exists without
// rendering text to its own layer — out of scope here, documented
// simplification) both use a plain alpha fade as the closest honest visual
// substitute for "appearing softly".
function textFadeAlphaExpression(clip, style) {
  const animIn = String(style.animationIn || '')
  const animOut = String(style.animationOut || '')
  const { start, end, animDuration } = textAnimationWindows(clip, style)
  const parts = []
  if (animIn.includes('Fade') || animIn.includes('Blur')) parts.push(`min(1,max(0,(t-${start})/${animDuration}))`)
  if (animOut.includes('Fade') || animOut.includes('Blur')) parts.push(`min(1,max(0,(${end}-t)/${animDuration}))`)
  if (!parts.length) return '1'
  return parts.length === 1 ? parts[0] : `min(${parts.join(',')})`
}

// Slide In/Out: an additive pixel offset on x or y that decays to 0 as the
// clip settles (entering) or grows from 0 as it leaves (exiting) — same
// direction/sign convention and magic numbers (45/65) as the live preview,
// scaled by the same width/1920 reference used for fontSize elsewhere in
// this file.
function textSlideOffsetExpression(clip, style, axis, scale) {
  const animIn = String(style.animationIn || '')
  const animOut = String(style.animationOut || '')
  const { inProgress, outProgress } = textAnimationWindows(clip, style)
  const entering = `(1-${inProgress})`
  const exiting = outProgress
  const px = (axis === 'x' ? 65 : 45) * scale
  const positiveName = axis === 'x' ? 'Slide Left' : 'Slide Up'
  const negativeName = axis === 'x' ? 'Slide Right' : 'Slide Down'
  const terms = []
  if (animIn.includes(positiveName)) terms.push(`${px}*${entering}`)
  if (animIn.includes(negativeName)) terms.push(`-${px}*${entering}`)
  if (animOut.includes(positiveName)) terms.push(`${px}*${exiting}`)
  if (animOut.includes(negativeName)) terms.push(`-${px}*${exiting}`)
  return terms.length ? terms.join('+') : null
}

// Bounce is a real spring-overshoot curve — distinct from Pop, which just
// eases up to full size with no overshoot — matching bounceInScale/
// bounceOutScale in App.jsx's preview exactly (av_expr's `if(cond,a,b)` and
// `lt(a,b)` are both standard eval.c operators, same family as the
// `between(...)` already used elsewhere in this file).
function bounceInExpression(p) {
  return `(if(lt(${p},.7),.5+.65*(${p}/.7),1.15-.15*((${p}-.7)/.3)))`
}
function bounceOutExpression(q) {
  return `(if(lt(${q},.3),1+.15*(${q}/.3),1.15*(1-(${q}-.3)/.7)))`
}

// Zoom In/Pop/Bounce grow the text up to (or past, for Bounce) full size;
// Zoom Out/Bounce Out shrink it back down — all expressed as a multiplier on
// the base fontSize, same curve constants as the live preview. "Shrink" is
// no longer offered in the UI but old projects that still reference it keep
// working via the same Zoom Out curve, rather than silently doing nothing.
function textScaleFactorExpression(clip, style) {
  const animIn = String(style.animationIn || '')
  const animOut = String(style.animationOut || '')
  const { inProgress, outProgress } = textAnimationWindows(clip, style)
  const factors = []
  if (animIn === 'Bounce') factors.push(bounceInExpression(inProgress))
  else if (animIn.includes('Zoom In')) factors.push(`(.65+.35*${inProgress})`)
  else if (animIn.includes('Pop')) factors.push(`(.65+.35*min(1,${inProgress}*1.35))`)
  if (animOut === 'Bounce Out') factors.push(bounceOutExpression(outProgress))
  else if (animOut.includes('Zoom Out') || animOut.includes('Shrink')) factors.push(`(1-.35*${outProgress})`)
  if (!factors.length) return null
  return factors.length === 1 ? factors[0] : `(${factors.join('*')})`
}

function textOverlayFilter(clip, { width, textFilePath, enableWindow }) {
  const style = clip.textStyle || {}
  const scale = width / 1920
  const baseFontSizePx = Math.max(4, Math.round((Number(style.fontSize) || 64) * scale))
  const align = { left: 'L', right: 'R' }[style.align] || 'C'
  const color = /^#[0-9a-f]{6}$/i.test(style.color || '') ? style.color : '#ffffff'
  const start = seconds(clip.start)
  const end = start + seconds(clip.duration)

  // Commas inside a single-quoted option value are safe here (same pattern
  // already verified working for alpha='min(1,max(0,...))' elsewhere in this
  // file) — no backslash-escaping needed, unlike the freeze-frame select
  // filter's eq(n\,0), which needed it for a different reason.
  const scaleFactor = textScaleFactorExpression(clip, style)
  const fontsizeExpr = scaleFactor ? `max(4,round(${baseFontSizePx}*${scaleFactor}))` : String(baseFontSizePx)
  const dx = textSlideOffsetExpression(clip, style, 'x', scale)
  const dy = textSlideOffsetExpression(clip, style, 'y', scale)
  const baseX = `(w*${(Math.max(0, Math.min(100, Number(style.x ?? 50))) / 100)})-text_w/2`
  const baseY = `(h*${(Math.max(0, Math.min(100, Number(style.y ?? 50))) / 100)})-text_h/2`

  const parts = [
    `fontfile='${escapeFilterPath(resolveFontFile(style))}'`,
    `textfile='${escapeFilterPath(textFilePath)}'`,
    `fontsize='${fontsizeExpr}'`,
    `fontcolor=${color}`,
    `text_align=${align}`,
    `line_spacing=${Math.round(baseFontSizePx * 0.12)}`,
    `x='${dx ? `${baseX}+(${dx})` : baseX}'`,
    `y='${dy ? `${baseY}+(${dy})` : baseY}'`,
    `alpha='${textFadeAlphaExpression(clip, style)}'`,
    `enable='between(t,${enableWindow ? enableWindow[0] : start},${enableWindow ? enableWindow[1] : end})'`,
  ]

  const bg = String(style.background || '')
  const bgMatch = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(bg)
  const bgAlpha = bgMatch?.[2] ? parseInt(bgMatch[2], 16) / 255 : bgMatch ? 1 : 0
  if (bgMatch && bgAlpha > 0.01) {
    parts.push('box=1', `boxcolor=#${bgMatch[1]}@${bgAlpha.toFixed(3)}`, `boxborderw=${Math.max(1, Math.round(baseFontSizePx * 0.18))}`)
  }

  return `drawtext=${parts.join(':')}`
}

function buildTextOverlays(manifest, base, width, textAssets) {
  const lines = []
  const { fileByClipId, typewriterStepsByClipId } = textAssets
  const textClips = (manifest.clips || [])
    .filter((clip) => clip.type === 'video' && clip.kind === 'text' && fileByClipId.has(clip.id))
    .sort((a, b) => {
      const an = Number(String(a.trackId || '').replace(/\D/g, '')) || 1
      const bn = Number(String(b.trackId || '').replace(/\D/g, '')) || 1
      return an - bn || a.start - b.start
    })

  let current = base
  let counter = 0
  const push = (clip, textFilePath, enableWindow) => {
    const filter = textOverlayFilter(clip, { width, textFilePath, enableWindow })
    const next = `text${counter}`
    counter += 1
    lines.push(`[${current}]${filter}[${next}]`)
    current = next
  }

  textClips.forEach((clip) => {
    const steps = typewriterStepsByClipId.get(clip.id)
    if (steps?.length) {
      const start = seconds(clip.start)
      const end = start + seconds(clip.duration)
      const animDuration = Math.max(.05, Number(clip.textStyle?.animationDuration) || .45)
      const stepDuration = animDuration / steps.length
      steps.forEach((stepPath, index) => {
        const windowStart = start + index * stepDuration
        const windowEnd = index === steps.length - 1 ? end : start + (index + 1) * stepDuration
        push(clip, stepPath, [windowStart, windowEnd])
      })
    } else {
      push(clip, fileByClipId.get(clip.id), null)
    }
  })

  return { lines, outputLabel: current }
}

function buildVideoFilters(manifest, inputMap, duration, textAssets) {
  const width = Math.max(64, Math.round(manifest.settings?.width || 1920))
  const height = Math.max(64, Math.round(manifest.settings?.height || 1080))
  const fps = Math.max(1, Math.round(manifest.options?.fps || manifest.settings?.fps || 30))
  const lines = [`color=c=black:s=${width}x${height}:r=${fps}:d=${duration}[base0]`]

  const videoClips = (manifest.clips || [])
    .filter((clip) => clip.type === 'video' && clip.kind !== 'text' && clipInput(clip))
    .sort((a, b) => {
      const an = Number(String(a.trackId || '').replace(/\D/g, '')) || 1
      const bn = Number(String(b.trackId || '').replace(/\D/g, '')) || 1
      return an - bn || a.start - b.start
    })

  let base = 'base0'
  videoClips.forEach((clip, index) => {
    const source = clipInput(clip)
    const inputIndex = inputMap.get(`${clip.id}:${source}`)
    const prepared = `vprep${index}`
    lines.push(`[${inputIndex}:v]${videoClipFilter(clip, inputIndex, width, height, fps)}[${prepared}]`)
    const nextBase = `base${index + 1}`
    const baseX = `(W-w)*${keyframePositionFraction(clip, 'positionX')}`
    const baseY = `(H-h)*${keyframePositionFraction(clip, 'positionY')}`
    const x = transitionOverlayPosition(clip, 'x', baseX)
    const y = transitionOverlayPosition(clip, 'y', baseY)
    const start = seconds(clip.start)
    const end = start + seconds(clip.duration)
    lines.push(`[${base}][${prepared}]overlay=x='${x}':y='${y}':enable='between(t,${start},${end})':eof_action=pass[${nextBase}]`)
    base = nextBase
  })

  if (textAssets?.fileByClipId?.size) {
    const textOverlays = buildTextOverlays(manifest, base, width, textAssets)
    lines.push(...textOverlays.lines)
    base = textOverlays.outputLabel
  }

  return { lines, outputLabel: base, width, height, fps }
}

function buildAudioFilters(manifest, inputMap) {
  const audioClips = (manifest.clips || []).filter((clip) => clip.type === 'audio' && clipInput(clip))
  if (!audioClips.length) return { lines: [], outputLabel: null }
  const lines = []
  const outputs = []

  audioClips.forEach((clip, index) => {
    const source = clipInput(clip)
    const inputIndex = inputMap.get(`${clip.id}:${source}`)
    const duration = Math.max(.05, seconds(clip.duration))
    const volume = Math.max(0, (Number(clip.audio?.volume ?? 100)) / 100)
    const fadeIn = Math.min(duration, Math.max(0, Number(clip.audio?.fadeIn) || 0))
    const fadeOut = Math.min(duration, Math.max(0, Number(clip.audio?.fadeOut) || 0))
    const delay = Math.max(0, Math.round(seconds(clip.start) * 1000))
    const parts = [`atrim=duration=${duration}`, 'asetpts=PTS-STARTPTS', `volume=${volume}`]
    if (fadeIn) parts.push(`afade=t=in:st=0:d=${fadeIn}`)
    if (fadeOut) parts.push(`afade=t=out:st=${Math.max(0, duration - fadeOut)}:d=${fadeOut}`)
    parts.push(`adelay=${delay}|${delay}`)
    const label = `aprep${index}`
    lines.push(`[${inputIndex}:a]${parts.join(',')}[${label}]`)
    outputs.push(`[${label}]`)
  })

  if (outputs.length === 1) return { lines, outputLabel: outputs[0].slice(1, -1) }
  lines.push(`${outputs.join('')}amix=inputs=${outputs.length}:duration=longest:dropout_transition=0[aout]`)
  return { lines, outputLabel: 'aout' }
}

function buildExportArgs(manifest, outputPath, capabilities, cleanupTargets = []) {
  const options = manifest.options || {}
  const duration = timelineDuration(manifest)
  const args = ['-y', '-hide_banner', '-loglevel', 'info']
  const clipsWithSources = (manifest.clips || []).filter((clip) => clipInput(clip))
  const inputMap = addMediaInputs(args, clipsWithSources)

  if (options.format === 'mp3') {
    const audio = buildAudioFilters(manifest, inputMap)
    if (!audio.outputLabel) throw new Error('No exportable audio clips have a real file path or remote source')
    args.push('-filter_complex', audio.lines.join(';'), '-map', `[${audio.outputLabel}]`, '-t', String(duration), '-vn')
    args.push('-c:a', capabilities.encoders.includes('libmp3lame') ? 'libmp3lame' : 'mp3', '-b:a', options.audioBitrate || '192k', outputPath)
    return args
  }

  const textAssets = prepareTextAssets(manifest, cleanupTargets)
  const video = buildVideoFilters(manifest, inputMap, duration, textAssets)
  const audio = buildAudioFilters(manifest, inputMap)
  const filters = [...video.lines, ...audio.lines]
  args.push('-filter_complex', filters.join(';'), '-map', `[${video.outputLabel}]`)
  if (audio.outputLabel) args.push('-map', `[${audio.outputLabel}]`)
  const encoder = chooseVideoEncoder(capabilities, options.renderMode || 'Auto')
  if (!encoder) throw new Error(options.renderMode === 'GPU' ? 'No supported GPU H.264 encoder found in FFmpeg' : 'No H.264 encoder found in FFmpeg')
  args.push('-c:v', encoder)
  if (encoder === 'libx264') args.push('-preset', options.quality === 'High' ? 'slow' : options.quality === 'Low' ? 'veryfast' : 'medium', '-crf', options.quality === 'High' ? '18' : options.quality === 'Low' ? '28' : '22')
  else args.push('-b:v', options.quality === 'High' ? '20M' : options.quality === 'Low' ? '5M' : '10M')
  if (audio.outputLabel) args.push('-c:a', 'aac', '-b:a', options.audioBitrate || '192k')
  args.push('-r', String(video.fps), '-t', String(duration), '-movflags', '+faststart', '-pix_fmt', 'yuv420p', outputPath)
  return args
}

function parseFfmpegTime(line) {
  const match = line.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

function selectedVideoEncoder(args) {
  const index = args.indexOf('-c:v')
  return index >= 0 ? args[index + 1] : null
}

function cleanupTempDirs(cleanupTargets) {
  cleanupTargets.forEach((dir) => {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* best-effort cleanup only */ }
  })
}

function startExport(manifest, outputPath, onProgress) {
  const capabilities = probeFfmpeg()
  if (!capabilities.available) throw new Error('FFmpeg is not installed or bundled yet')
  const cleanupTargets = []
  const initialArgs = buildExportArgs(manifest, outputPath, capabilities, cleanupTargets)
  const duration = timelineDuration(manifest)
  const job = { child: null, done: null, args: initialArgs, capabilities }

  const runAttempt = (args) => new Promise((resolve, reject) => {
    const child = spawn(capabilities.binary, args, { windowsHide: true })
    job.child = child
    job.args = args
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr = `${stderr}${text}`.slice(-12000)
      const current = parseFfmpegTime(text)
      if (current != null) onProgress?.({ current, duration, percent: Math.max(0, Math.min(100, current / duration * 100)) })
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ outputPath, encoder: selectedVideoEncoder(args) || 'audio' })
      else reject(new Error(`FFmpeg export failed (${code}). ${stderr.slice(-1800)}`))
    })
  })

  job.done = (async () => {
    try {
      return await runAttempt(initialArgs)
    } catch (error) {
      const initialEncoder = selectedVideoEncoder(initialArgs)
      const isHardwareAttempt = ['h264_nvenc', 'h264_qsv', 'h264_amf'].includes(initialEncoder)
      const autoMode = (manifest.options?.renderMode || 'Auto') === 'Auto'
      const cpuAvailable = capabilities.encoders.includes('libx264')
      if (!isHardwareAttempt || !autoMode || !cpuAvailable) throw error

      onProgress?.({ current: 0, duration, percent: 0, fallback: 'CPU', message: 'GPU export failed; retrying with CPU' })
      const cpuManifest = {
        ...manifest,
        options: { ...(manifest.options || {}), renderMode: 'CPU' },
      }
      const cpuArgs = buildExportArgs(cpuManifest, outputPath, capabilities, cleanupTargets)
      return runAttempt(cpuArgs)
    } finally {
      cleanupTempDirs(cleanupTargets)
    }
  })()

  return job
}

module.exports = {
  probeFfmpeg,
  startExport,
}