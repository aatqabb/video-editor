export function playbackMediaPlugin() {
  return {
    name: 'video-editor-playback-media-behavior',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/')

      if (normalized.endsWith('/src/MediaLibrary.jsx')) {
        return {
          code: code
            .replace(/<video key=\{preview\.localUrl\} src=\{preview\.localUrl\} controls autoPlay \/>/g, '<video key={preview.localUrl} src={preview.localUrl} controls preload="metadata" />')
            .replace(/<audio key=\{preview\.localUrl\} src=\{preview\.localUrl\} controls autoPlay \/>/g, '<audio key={preview.localUrl} src={preview.localUrl} controls preload="metadata" />'),
          map: null,
        }
      }

      if (normalized.endsWith('/src/mediaProcessing.js')) {
        const needle = `      const metadata = await processVideo(file, originalUrl)\n      const proxyState = await maybeCreateDesktopProxy(type, sourcePath, metadata, originalUrl)\n      return { ...base, ...metadata, ...proxyState }`
        if (!code.includes(needle)) return null
        const replacement = `      const metadata = await processVideo(file, originalUrl)\n      let embeddedAudio = { hasAudio: false, audioWaveform: [] }\n      try {\n        const audioMetadata = await processAudio(file)\n        embeddedAudio = {\n          hasAudio: Boolean(audioMetadata?.duration > 0),\n          audioWaveform: Array.isArray(audioMetadata?.waveform) ? audioMetadata.waveform : [],\n        }\n      } catch {\n        // Some browser/codec combinations cannot decode an embedded stream through AudioContext.\n        // Keep importing the video normally; the linked-audio flag simply stays off.\n      }\n      const proxyState = await maybeCreateDesktopProxy(type, sourcePath, metadata, originalUrl)\n      return { ...base, ...metadata, ...embeddedAudio, ...proxyState }`
        return { code: code.replace(needle, replacement), map: null }
      }

      if (!normalized.endsWith('/src/App.jsx')) return null

      let next = code
      const applied = new Set()
      const replaceOnce = (name, needle, replacement) => {
        if (!next.includes(needle)) return
        next = next.replace(needle, replacement)
        applied.add(name)
      }

      replaceOnce(
        'playback-clock',
        `  useEffect(() => {\n    const timer = window.setTimeout(() => {\n      const project = buildProjectDocument({ name: projectName, settings: projectSettings, clips, tracks, markers, playhead })`,
        `  useEffect(() => {\n    if (!playing) return undefined\n    let frame = 0\n    let previous = performance.now()\n    const tick = (now) => {\n      const elapsed = Math.min(.1, Math.max(0, (now - previous) / 1000))\n      previous = now\n      setPlayhead((current) => {\n        const nextTime = Math.min(TIMELINE_SECONDS, current + elapsed)\n        if (nextTime >= TIMELINE_SECONDS) setPlaying(false)\n        return nextTime\n      })\n      frame = window.requestAnimationFrame(tick)\n    }\n    frame = window.requestAnimationFrame(tick)\n    return () => window.cancelAnimationFrame(frame)\n  }, [playing])\n\n  useEffect(() => {\n    const timer = window.setTimeout(() => {\n      const project = buildProjectDocument({ name: projectName, settings: projectSettings, clips, tracks, markers, playhead })`,
      )

      for (const handler of ['addAudioToTimeline', 'addTextLayer', 'addMediaToTimeline', 'addSfxToTimeline', 'addStockToTimeline']) {
        const marker = `  const ${handler} = (`
        const index = next.indexOf(marker)
        if (index === -1) continue
        const bodyStart = next.indexOf('=> {', index)
        if (bodyStart === -1) continue
        const insertAt = bodyStart + 4
        if (next.slice(insertAt, insertAt + 40).includes('setPlaying(false)')) continue
        next = `${next.slice(0, insertAt)}\n    setPlaying(false)${next.slice(insertAt)}`
        applied.add(`pause-${handler}`)
      }

      replaceOnce(
        'linked-video-audio',
        `    setSelectedClipIds([id])\n    notify(\`\${media.name} added to \${track.id}\`)\n  }\n\n  const addSfxToTimeline`,
        `    if (timelineType === 'video' && media.hasAudio) {\n      const audioTrack = firstUnlockedTrack('audio', 'A1')\n      if (audioTrack) {\n        const audioId = \`\${id}-audio\`\n        commitClips((current) => [...current, {\n          id: audioId,\n          trackId: audioTrack.id,\n          name: \`\${media.name} · Audio\`,\n          type: 'audio',\n          kind: 'linked-video-audio',\n          linkedClipId: id,\n          start,\n          duration,\n          sourceDuration: duration,\n          sourceIn: 0,\n          color: 'green',\n          localUrl: media.originalUrl || media.localUrl,\n          sourcePath: media.sourcePath || '',\n          sourceFileName: media.sourceFileName || media.name,\n          mimeType: media.mimeType || '',\n          waveform: media.audioWaveform || [],\n          audio: { volume: 100, fadeIn: 0, fadeOut: 0 },\n        }])\n        setSelectedClipIds([id, audioId])\n        notify(\`\${media.name} added with linked audio\`)\n        return\n      }\n    }\n    setSelectedClipIds([id])\n    notify(\`\${media.name} added to \${track.id}\`)\n  }\n\n  const addSfxToTimeline`,
      )

      const required = ['playback-clock', 'pause-addMediaToTimeline', 'pause-addAudioToTimeline', 'pause-addSfxToTimeline', 'pause-addStockToTimeline', 'linked-video-audio']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Playback/media behavior patch did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
