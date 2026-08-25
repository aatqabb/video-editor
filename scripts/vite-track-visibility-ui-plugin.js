export function trackVisibilityUiPlugin() {
  return {
    name: 'video-editor-track-visibility-ui',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/')
      if (!normalized.endsWith('/src/App.jsx')) return null

      let next = code
      let buttonApplied = false
      let controlApplied = false
      let laneApplied = false

      const oldButton = `<button className={track.hidden ? 'on' : ''} onClick={() => toggleTrack(track.id, 'hidden')}>◉</button>`
      const newButton = `<button
                  className={\`track-visibility-toggle \${track.hidden ? 'is-hidden' : 'is-visible'}\`}
                  title={track.hidden ? \`Show \${track.id} layer\` : \`Hide \${track.id} layer\`}
                  aria-label={track.hidden ? \`Show \${track.id} layer\` : \`Hide \${track.id} layer\`}
                  aria-pressed={track.hidden}
                  onClick={() => toggleTrack(track.id, 'hidden')}
                ><span className="track-eye" aria-hidden="true">{track.hidden ? '◌' : '◉'}</span><span className="track-visibility-state">{track.hidden ? 'OFF' : 'ON'}</span></button>`
      if (next.includes(oldButton)) {
        next = next.replace(oldButton, newButton)
        buttonApplied = true
      } else if (next.includes('track-visibility-toggle')) {
        buttonApplied = true
      }

      const controlPattern = /<div className="track-control" style=\{\{ height: trackHeight \}\} key=\{track\.id\}>/
      if (controlPattern.test(next)) {
        next = next.replace(controlPattern, '<div className={`track-control ${track.hidden ? \'track-hidden\' : \'\'}`} style={{ height: trackHeight }} key={track.id}>')
        controlApplied = true
      } else if (next.includes("track-control ${track.hidden ? 'track-hidden'")) {
        controlApplied = true
      }

      const lanePatterns = [
        /className=\{`track-lane \$\{track\.locked \? 'locked' : ''\}`\}/,
        /className=\{`track-lane \$\{track\.locked \? 'locked' : ''\} \$\{track\.hidden \? 'track-hidden' : ''\}`\}/,
      ]
      if (lanePatterns[1].test(next)) {
        laneApplied = true
      } else if (lanePatterns[0].test(next)) {
        next = next.replace(lanePatterns[0], "className={`track-lane ${track.locked ? 'locked' : ''} ${track.hidden ? 'track-hidden' : ''}`}")
        laneApplied = true
      }

      const missing = []
      if (!buttonApplied) missing.push('visibility-button')
      if (!controlApplied) missing.push('hidden-control-state')
      if (!laneApplied) missing.push('hidden-lane-state')
      if (missing.length) throw new Error(`Track visibility UI patch did not apply: ${missing.join(', ')}`)

      return { code: next, map: null }
    },
  }
}
