export function durationUiSyncPlugin() {
  return {
    name: 'video-editor-duration-ui-sync',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/')
      if (!normalized.endsWith('/src/App.jsx')) return null

      let next = code
      const applied = new Set()
      const replaceOnce = (name, needle, replacement) => {
        if (!next.includes(needle)) return
        next = next.replace(needle, replacement)
        applied.add(name)
      }

      replaceOnce(
        'content-sized-ruler',
        `  const timelineSeconds = useMemo(() => {\n    const contentEnd = clips.reduce((end, clip) => Math.max(end, (Number(clip.start) || 0) + (Number(clip.duration) || 0)), 0)\n    const required = Math.max(BASE_TIMELINE_SECONDS, contentEnd + 60, playhead + 60)\n    return Math.ceil(required / 30) * 30\n  }, [clips, playhead])`,
        `  const timelineSeconds = useMemo(() => {\n    const contentEnd = clips.reduce((end, clip) => Math.max(end, (Number(clip.start) || 0) + (Number(clip.duration) || 0)), 0)\n    const editTail = contentEnd > 0 ? Math.max(3, Math.min(10, contentEnd * .06)) : 0\n    const required = Math.max(BASE_TIMELINE_SECONDS, contentEnd + editTail, playhead + 3)\n    return Math.ceil(required / 10) * 10\n  }, [clips, playhead])`,
      )

      replaceOnce(
        'program-duration-prop',
        '<Monitor playing={playing} setPlaying={setPlaying} notify={notify} timelineClips={clips} playhead={playhead} projectSettings={projectSettings} />',
        '<Monitor playing={playing} setPlaying={setPlaying} notify={notify} timelineClips={clips} playhead={playhead} timelineDuration={timelineSeconds} projectSettings={projectSettings} />',
      )

      const monitorNeedles = [
        'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, projectSettings = { width: 1920, height: 1080 } }) {',
        'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, timelineDuration = 0, projectSettings = { width: 1920, height: 1080 } }) {',
      ]
      const monitorNeedle = monitorNeedles.find((needle) => next.includes(needle))
      if (monitorNeedle) {
        next = next.replace(
          monitorNeedle,
          'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, timelineDuration = 0, projectSettings = { width: 1920, height: 1080 } }) {',
        )
        applied.add('monitor-duration-signature')
      }

      replaceOnce(
        'live-monitor-timecode',
        '<div className="monitor-info"><span>00:00:05:11</span><button onClick={() => notify(\'Fit menu\')}>Fit ▾</button><button onClick={() => notify(\'Full resolution\')}>Full ▾</button></div>',
        '<div className="monitor-info"><span>{empty ? \'00:00:00:00\' : `${formatTime(playhead)} / ${formatTime(timelineDuration)}`}</span><button onClick={() => notify(\'Fit menu\')}>Fit ▾</button><button onClick={() => notify(\'Full resolution\')}>Full ▾</button></div>',
      )

      const required = ['content-sized-ruler', 'program-duration-prop', 'monitor-duration-signature', 'live-monitor-timecode']
      const missing = required.filter((name) => !applied.has(name))
      if (missing.length) throw new Error(`Duration UI sync patch did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
