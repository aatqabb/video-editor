import { mapWithCooperativeYields, runWhenIdle } from './responsiveProcessing.js'

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'])

function extensionOf(name = '') {
  return name.toLowerCase().split('.').pop() || ''
}

export function detectMediaType(file) {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('image/')) return 'image'
  const ext = extensionOf(file.name)
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return 'unknown'
}

function once(element, eventName, errorName = 'error') {
  return new Promise((resolve, reject) => {
    const onDone = () => { cleanup(); resolve() }
    const onError = () => { cleanup(); reject(new Error(`Could not read ${eventName} metadata`)) }
    const cleanup = () => {
      element.removeEventListener(eventName, onDone)
      element.removeEventListener(errorName, onError)
    }
    element.addEventListener(eventName, onDone, { once: true })
    element.addEventListener(errorName, onError, { once: true })
  })
}

function createThumbnailSync(video, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight)
  return canvas.toDataURL('image/jpeg', 0.76)
}

function createThumbnailInWorker(video, targetWidth, targetHeight) {
  if (
    typeof Worker === 'undefined' ||
    typeof createImageBitmap === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return runWhenIdle(() => createThumbnailSync(video, targetWidth, targetHeight))
  }

  return createImageBitmap(video).then((bitmap) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./thumbnailWorker.js', import.meta.url), { type: 'module' })
    let settled = false
    const timeout = window.setTimeout(() => finish(new Error('Thumbnail worker timed out')), 30000)

    const finish = (error, thumbnail = '') => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      worker.terminate()
      if (error) reject(error)
      else resolve(thumbnail)
    }

    worker.onmessage = (event) => {
      if (event.data?.error) return finish(new Error(event.data.error))
      finish(null, typeof event.data?.thumbnail === 'string' ? event.data.thumbnail : '')
    }
    worker.onerror = () => finish(new Error('Thumbnail worker failed'))
    worker.postMessage({ bitmap, width: targetWidth, height: targetHeight }, [bitmap])
  }))
}

async function processVideo(file, url) {
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = url
  await once(video, 'loadedmetadata')

  const duration = Number.isFinite(video.duration) ? video.duration : 5
  const seekTime = duration > 0.4 ? Math.min(Math.max(0.15, duration * 0.18), Math.max(0.15, duration - 0.15)) : 0
  if (seekTime > 0) {
    video.currentTime = seekTime
    try { await once(video, 'seeked') } catch { /* keep blank thumbnail fallback */ }
  }

  let thumbnail = ''
  if (video.videoWidth && video.videoHeight) {
    const targetWidth = 320
    const targetHeight = Math.max(80, Math.round(targetWidth * video.videoHeight / video.videoWidth))
    try {
      thumbnail = await createThumbnailInWorker(video, targetWidth, targetHeight)
    } catch {
      thumbnail = await runWhenIdle(() => createThumbnailSync(video, targetWidth, targetHeight))
    }
  }

  return {
    duration,
    width: video.videoWidth || 0,
    height: video.videoHeight || 0,
    thumbnail,
  }
}

function generateWaveformSync(channel, bins = 96) {
  const block = Math.max(1, Math.floor(channel.length / bins))
  return Array.from({ length: bins }, (_, index) => {
    const start = index * block
    const end = Math.min(channel.length, start + block)
    let peak = 0
    const stride = Math.max(1, Math.floor(block / 80))
    for (let cursor = start; cursor < end; cursor += stride) {
      peak = Math.max(peak, Math.abs(channel[cursor] || 0))
    }
    return Math.max(0.04, Math.min(1, peak))
  })
}

function generateWaveformInWorker(channel, bins = 96) {
  if (typeof Worker === 'undefined') return runWhenIdle(() => generateWaveformSync(channel, bins))

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./waveformWorker.js', import.meta.url), { type: 'module' })
    const samples = channel.slice()
    let settled = false
    const timeout = window.setTimeout(() => finish(new Error('Waveform worker timed out')), 30000)

    const finish = (error, waveform) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      worker.terminate()
      if (error) reject(error)
      else resolve(waveform)
    }

    worker.onmessage = (event) => {
      if (event.data?.error) return finish(new Error(event.data.error))
      finish(null, Array.isArray(event.data?.waveform) ? event.data.waveform : [])
    }
    worker.onerror = () => finish(new Error('Waveform worker failed'))
    worker.postMessage({ samples: samples.buffer, bins }, [samples.buffer])
  })
}

async function processAudio(file) {
  const arrayBuffer = await file.arrayBuffer()
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return { duration: 5, waveform: [] }

  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0))
    const channel = buffer.getChannelData(0)
    let waveform
    try {
      waveform = await generateWaveformInWorker(channel, 96)
    } catch {
      waveform = await runWhenIdle(() => generateWaveformSync(channel, 96))
    }
    return { duration: Number.isFinite(buffer.duration) ? buffer.duration : 5, waveform }
  } finally {
    context.close().catch(() => {})
  }
}

async function processImage(url) {
  const image = new Image()
  image.src = url
  await once(image, 'load')
  return { duration: 5, width: image.naturalWidth, height: image.naturalHeight, thumbnail: url }
}

async function maybeCreateDesktopProxy(type, sourcePath, metadata, originalUrl) {
  const desktop = window.videoEditorDesktop
  const shouldProxy = type === 'video'
    && sourcePath
    && typeof desktop?.createProxy === 'function'
    && ((metadata.width || 0) > 1280 || (metadata.height || 0) > 720)
  if (!shouldProxy) return { localUrl: originalUrl, proxyUrl: '', usingProxy: false }

  try {
    const proxy = await desktop.createProxy(sourcePath)
    if (!proxy?.url) return { localUrl: originalUrl, proxyUrl: '', usingProxy: false }
    return { localUrl: proxy.url, proxyUrl: proxy.url, usingProxy: true }
  } catch (error) {
    return {
      localUrl: originalUrl,
      proxyUrl: '',
      usingProxy: false,
      proxyError: error?.message || 'Could not create low-resolution preview proxy',
    }
  }
}

export async function processMediaFile(file) {
  const type = detectMediaType(file)
  if (type === 'unknown') throw new Error(`${file.name}: unsupported media type`)

  const originalUrl = URL.createObjectURL(file)
  const sourcePath = window.videoEditorDesktop?.getPathForFile?.(file) || ''
  const base = {
    id: `media-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: file.name,
    type,
    mimeType: file.type || '',
    size: file.size,
    lastModified: file.lastModified,
    localUrl: originalUrl,
    originalUrl,
    sourcePath,
    sourceFileName: file.name,
  }

  try {
    if (type === 'video') {
      const metadata = await processVideo(file, originalUrl)
      const proxyState = await maybeCreateDesktopProxy(type, sourcePath, metadata, originalUrl)
      return { ...base, ...metadata, ...proxyState }
    }
    if (type === 'audio') return { ...base, ...(await processAudio(file)) }
    return { ...base, ...(await processImage(originalUrl)) }
  } catch (error) {
    return { ...base, duration: type === 'image' ? 5 : 3, processingError: error?.message || 'Could not analyze media' }
  }
}

export function processMediaFiles(files, onProgress) {
  return mapWithCooperativeYields(files, processMediaFile, { yieldEvery: 1, onProgress })
}

export function formatMediaDuration(seconds) {
  if (!Number.isFinite(seconds)) return '--:--'
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
