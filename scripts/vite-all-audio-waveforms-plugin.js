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
        const helper = `function getTimelineWaveform(clip) {\n  const targetSamples = 144\n  const source = Array.isArray(clip?.waveform) && clip.waveform.length ? clip.waveform : null\n  if (source) {\n    return Array.from({ length: targetSamples }, (_, index) => {\n      const sourceIndex = Math.min(source.length - 1, Math.floor((index / targetSamples) * source.length))\n      return Math.max(.03, Math.min(1, Number(source[sourceIndex]) || 0))\n    })\n  }\n  const seedText = String(clip?.id || clip?.name || 'audio')\n  let seed = 2166136261\n  for (let index = 0; index < seedText.length; index += 1) {\n    seed ^= seedText.charCodeAt(index)\n    seed = Math.imul(seed, 16777619)\n  }\n  let previous = .35\n  return Array.from({ length: targetSamples }, (_, index) => {\n    seed = Math.imul(seed ^ (index + 1), 2246822519)\n    const noise = ((seed >>> 0) % 1000) / 1000\n    const pulse = .12 + .88 * Math.abs(Math.sin((index + 3) * .41) * Math.cos((index + 7) * .17))\n    const raw = .08 + noise * .56 + pulse * .36\n    const smoothed = previous * .34 + raw * .66\n    previous = smoothed\n    return Math.max(.04, Math.min(1, smoothed))\n  })\n}\n\n`
        next = next.replace(insertBefore, helper + insertBefore)
      } else {
        const existingHelper = /function getTimelineWaveform\(clip\) \{[\s\S]*?\n\}\n\n(?=function formatTime\(seconds\) \{)/
        if (existingHelper.test(next)) {
          const helper = `function getTimelineWaveform(clip) {\n  const targetSamples = 144\n  const source = Array.isArray(clip?.waveform) && clip.waveform.length ? clip.waveform : null\n  if (source) {\n    return Array.from({ length: targetSamples }, (_, index) => {\n      const sourceIndex = Math.min(source.length - 1, Math.floor((index / targetSamples) * source.length))\n      return Math.max(.03, Math.min(1, Number(source[sourceIndex]) || 0))\n    })\n  }\n  const seedText = String(clip?.id || clip?.name || 'audio')\n  let seed = 2166136261\n  for (let index = 0; index < seedText.length; index += 1) {\n    seed ^= seedText.charCodeAt(index)\n    seed = Math.imul(seed, 16777619)\n  }\n  let previous = .35\n  return Array.from({ length: targetSamples }, (_, index) => {\n    seed = Math.imul(seed ^ (index + 1), 2246822519)\n    const noise = ((seed >>> 0) % 1000) / 1000\n    const pulse = .12 + .88 * Math.abs(Math.sin((index + 3) * .41) * Math.cos((index + 7) * .17))\n    const raw = .08 + noise * .56 + pulse * .36\n    const smoothed = previous * .34 + raw * .66\n    previous = smoothed\n    return Math.max(.04, Math.min(1, smoothed))\n  })\n}\n\n`
          next = next.replace(existingHelper, helper)
        }
      }

      const oldBlock = `{clip.type === 'audio' && clip.waveform?.length ? (\n                      <span className="timeline-waveform-real" aria-hidden="true">\n                        {clip.waveform.slice(0, 72).map((peak, index) => <i key={index} style={{ height: \`${'${Math.max(8, peak * 92)}'}%\` }} />)}\n                      </span>\n                    ) : clip.type === 'audio' ? <span className="waveform-faux" aria-hidden="true" /> : null}`
      const currentBlock = `{clip.type === 'audio' ? (\n                      <span className="timeline-waveform-real" aria-hidden="true">\n                        {getTimelineWaveform(clip).map((peak, index) => <i key={index} style={{ height: \`${'${Math.max(8, peak * 92)}'}%\` }} />)}\n                      </span>\n                    ) : null}`
      const newBlock = `{clip.type === 'audio' ? (\n                      <span className="timeline-waveform-real premiere-waveform" aria-hidden="true">\n                        {getTimelineWaveform(clip).map((peak, index) => <i key={index} style={{ '--wave-peak': Math.max(.04, peak) }} />)}\n                      </span>\n                    ) : null}`
      if (next.includes(oldBlock)) next = next.replace(oldBlock, newBlock)
      else if (next.includes(currentBlock)) next = next.replace(currentBlock, newBlock)
      else if (!next.includes('className="timeline-waveform-real premiere-waveform"')) throw new Error('All audio waveforms could not replace timeline audio waveform block')

      return { code: next, map: null }
    },
  }
}
