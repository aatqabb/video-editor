export function timelineTransitionVisibilityPlugin() {
  return {
    name: 'timeline-transition-visibility',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null
      let next = code
      if (!next.includes("import './PreviewTransitionFixes.css'")) {
        next = next.replace("import './App.css'", "import './App.css'\nimport './PreviewTransitionFixes.css'")
      }

      const controlMarker = '<div className="track-control" style={{ height: trackHeight }} key={track.id}>'
      if (next.includes(controlMarker)) {
        next = next.replace(controlMarker, '<div className={`track-control ${track.hidden ? \'track-hidden\' : \'\'}`} style={{ height: trackHeight }} key={track.id}>')
      }

      const laneMarker = '<div className={`track-lane ${track.locked ? \'locked\' : \'\'}`} style={{ height: trackHeight }} key={track.id}'
      if (next.includes(laneMarker)) {
        next = next.replace(laneMarker, '<div className={`track-lane ${track.locked ? \'locked\' : \'\'} ${track.hidden ? \'track-hidden\' : \'\'}`} style={{ height: trackHeight }} key={track.id}')
      }

      const eyeMarker = '<button className={track.hidden ? \'on\' : \'\'} onClick={() => toggleTrack(track.id, \'hidden\')}>◉</button>'
      if (next.includes(eyeMarker)) {
        next = next.replace(eyeMarker, '<button className={track.hidden ? \'on\' : \'\'} title={track.hidden ? \'Show video layer\' : \'Hide video layer\'} aria-pressed={track.hidden} onClick={() => toggleTrack(track.id, \'hidden\')}>{track.hidden ? \'○\' : \'◉\'}</button>')
      }

      const marker = '{clip.transition && <span className="transition-badge">↔</span>}'
      if (next.includes(marker)) {
        const replacement = `{clip.transition && (\n                      <span\n                        className="transition-badge"\n                        title={\`Transition: \${clip.transition.type} · \${clip.transition.duration}s\`}\n                        style={{ width: Math.max(14, Math.min(Math.max(18, clip.duration * pixelsPerSecond), (Number(clip.transition.duration) || .5) * pixelsPerSecond)) }}\n                      >\n                        <span className="transition-badge-icon">↔</span>\n                      </span>\n                    )}`
        next = next.replace(marker, replacement)
      }
      return next === code ? null : { code: next, map: null }
    },
  }
}
