const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
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
  if (!['Fade', 'Cross Dissolve'].includes(type)) return null
  return `fade=t=in:st=0:d=${transitionDuration(clip)}:alpha=1`
}

function transitionZoomFilter(clip) {
  const type = String(clip.transition?.type || '')
  const zooms = {
    'Zoom In': [.82, 1],
    'Zoom Out': [1.18, 1],
    'Smooth Zoom In': [.72, 1],
    'Smooth Zoom Out': [1.28, 1],
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

function keyframeLerpExpression(from, to, durationSeconds, startOffsetSeconds = 0) {
  // startOffsetSeconds is 0 for filters that run inside a clip's own local
  // filter chain (t already starts at ~0 there, same as transitionZoomFilter
  // above), and the clip's global timeline start for filters that run at the
  // top-level composited stage (the overlay filter's t is global there).
  const progress = startOffsetSeconds
    ? `min(1,max(0,(t-${startOffsetSeconds})/${Math.max(.05, durationSeconds)}))`
    : `min(1,max(0,t/${Math.max(.05, durationSeconds)}))`
  return `(${from}+(${to - from})*${progress})`
}

function keyframeScaleFilter(clip) {
  const keyframe = clip.video?.keyframes?.scale
  if (!keyframe?.enabled) return null
  const from = Math.max(.01, (Number(clip.video?.scale) || 100) / 100)
  const to = Math.max(.01, (Number(keyframe.to) || 100) / 100)
  const factor = keyframeLerpExpression(from, to, seconds(clip.duration))
  return `scale=w='max(2,iw*${factor})':h='max(2,ih*${factor})':eval=frame`
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
  return keyframeLerpExpression(base, to, seconds(clip.duration), seconds(clip.start))
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

function videoClipFilter(clip, inputIndex, width, height) {
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

  const filters = [
    `crop=iw*${cropW}:ih*${cropH}:iw*${cropLeft}:ih*${cropTop}`,
    scaleFilter,
  ]
  if (rotation) filters.push(`rotate=${rotation}:ow=rotw(${rotation}):oh=roth(${rotation}):c=black@0`)
  if (speed !== 1) filters.push(`setpts=PTS/${speed}`)
  const zoomFilter = transitionZoomFilter(clip)
  if (zoomFilter) filters.push(zoomFilter)
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
    if (effect.type === 'Grayscale') filters.push('hue=s=0')
    if (effect.type === 'Brightness') filters.push(`eq=brightness=${(intensity - 50) / 100}`)
    if (effect.type === 'Contrast') filters.push(`eq=contrast=${Math.max(.1, intensity / 50)}`)
    if (effect.type === 'Saturate') filters.push(`eq=saturation=${Math.max(0, intensity / 50)}`)
    if (effect.type === 'Sepia') filters.push(`colorchannelmixer=.393:.769:.189:.349:.686:.168:.272:.534:.131`)
  }
  filters.push(`setpts=PTS-STARTPTS+${start}/TB`)
  return filters.join(',')
}

function buildVideoFilters(manifest, inputMap, duration) {
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
    lines.push(`[${inputIndex}:v]${videoClipFilter(clip, inputIndex, width, height)}[${prepared}]`)
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

function buildExportArgs(manifest, outputPath, capabilities) {
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

  const video = buildVideoFilters(manifest, inputMap, duration)
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

function startExport(manifest, outputPath, onProgress) {
  const capabilities = probeFfmpeg()
  if (!capabilities.available) throw new Error('FFmpeg is not installed or bundled yet')
  const initialArgs = buildExportArgs(manifest, outputPath, capabilities)
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
      const cpuArgs = buildExportArgs(cpuManifest, outputPath, capabilities)
      return runAttempt(cpuArgs)
    }
  })()

  return job
}

module.exports = {
  probeFfmpeg,
  startExport,
}