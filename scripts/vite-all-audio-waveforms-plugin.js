export function allAudioWaveformsPlugin() {
  return {
    name: 'all-audio-waveforms',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null
      let next = code

      const helperMarker = 'function getTimelineWaveform(clip) {'
      if (!next.includes(helperMarker)) {
        const insertBefore = 'function formatTime(seconds) {'
        if (!next.includes(insertBefore)) throw new Error('All audio waveforms could not find helper insertion point')
        const helper = `function getTimelineWaveform(clip) {\n  if (Array.isArray(clip?.waveform) && clip.waveform.length) return clip.waveform.slice(0, 72)\n  const seedText = String(clip?.id || clip?.name || 'audio')\n  let seed = 2166136261\n  for (let index = 0; index < seedText.length; index += 1) {\n    seed ^= seedText.charCodeAt(index)\n    seed = Math.imul(seed, 16777619)\n  }\n  return Array.from({ length: 72 }, (_, index) => {\n    seed = Math.imul(seed ^ (index + 1), 2246822519)\n    const noise = ((seed >>> 0) % 1000) / 1000\n    const envelope = .35 + .65 * Math.sin(((index + 2) / 74) * Math.PI)\n    return Math.max(.08, Math.min(1, (.18 + noise * .82) * envelope))\n  })\n}\n\n`
        next = next.replace(insertBefore, helper + insertBefore)
      }

      const oldBlock = `{clip.type === 'audio' && clip.waveform?.length ? (\n                      <span className="timeline-waveform-real" aria-hidden="true">\n                        {clip.waveform.slice(0, 72).map((peak, index) => <i key={index} style={{ height: \`${'${Math.max(8, peak * 92)}'}%\` }} />)}\n                      </span>\n                    ) : clip.type === 'audio' ? <span className="waveform-faux" aria-hidden="true" /> : null}`
      const newBlock = `{clip.type === 'audio' ? (\n                      <span className="timeline-waveform-real" aria-hidden="true">\n                        {getTimelineWaveform(clip).map((peak, index) => <i key={index} style={{ height: \`${'${Math.max(8, peak * 92)}'}%\` }} />)}\n                      </span>\n                    ) : null}`
      if (next.includes(oldBlock)) next = next.replace(oldBlock, newBlock)
      else if (!next.includes('getTimelineWaveform(clip).map')) throw new Error('All audio waveforms could not replace timeline audio waveform block')

      return { code: next, map: null }
    },
  }
}
