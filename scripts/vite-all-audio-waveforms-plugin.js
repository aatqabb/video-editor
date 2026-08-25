export function allAudioWaveformsPlugin() {
  return {
    name: 'all-audio-waveforms',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.jsx') && !id.endsWith('\\src\\App.jsx')) return null
      let next = code

      const helper = `function getTimelineWaveform(clip) {\n  const targetSamples = 196\n  const source = Array.isArray(clip?.waveform) && clip.waveform.length ? clip.waveform : null\n  if (source) {\n    return Array.from({ length: targetSamples }, (_, index) => {\n      const position = (index / Math.max(1, targetSamples - 1)) * Math.max(0, source.length - 1)\n      const left = Math.floor(position)\n      const right = Math.min(source.length - 1, left + 1)\n      const mix = position - left\n      const peak = (Number(source[left]) || 0) * (1 - mix) + (Number(source[right]) || 0) * mix\n      return Math.max(.035, Math.min(1, peak))\n    })\n  }\n  const seedText = String(clip?.id || clip?.name || 'audio')\n  let seed = 2166136261\n  for (let index = 0; index < seedText.length; index += 1) { seed ^= seedText.charCodeAt(index); seed = Math.imul(seed, 16777619) }\n  let previous = .28\n  return Array.from({ length: targetSamples }, (_, index) => {\n    seed = Math.imul(seed ^ (index + 17), 2246822519)\n    const noise = ((seed >>> 0) % 1000) / 1000\n    const speech = Math.abs(Math.sin(index * .37) * Math.sin(index * .091 + .8))\n    const transient = index % 17 === 0 ? .35 : index % 29 === 0 ? .22 : 0\n    const raw = .05 + noise * .42 + speech * .48 + transient\n    const smoothed = previous * .22 + raw * .78\n    previous = smoothed\n    return Math.max(.035, Math.min(1, smoothed))\n  })\n}\n\n`

      const existingHelper = /function getTimelineWaveform\(clip\) \{[\s\S]*?\n\}\n\n(?=function formatTime\(seconds\) \{)/
      if (existingHelper.test(next)) next = next.replace(existingHelper, helper)
      else {
        const insertBefore = 'function formatTime(seconds) {'
        if (!next.includes(insertBefore)) throw new Error('All audio waveforms could not find helper insertion point')
        next = next.replace(insertBefore, helper + insertBefore)
      }

      const stereoBlock = `{clip.type === 'audio' ? (\n                      <span className="timeline-waveform-real premiere-waveform" aria-hidden="true">\n                        <span className="premiere-waveform-channel upper">\n                          {getTimelineWaveform(clip).map((peak, index) => <i key={\`u-\${index}\`} style={{ '--wave-peak': Math.max(.035, peak), '--wave-peak-lower': Math.max(.035, Math.min(1, peak * (.72 + ((index * 7) % 11) / 25))) }} />)}\n                        </span>\n                        <span className="premiere-waveform-channel lower">\n                          {getTimelineWaveform(clip).map((peak, index) => <i key={\`l-\${index}\`} style={{ '--wave-peak': Math.max(.035, peak), '--wave-peak-lower': Math.max(.035, Math.min(1, peak * (.72 + ((index * 7) % 11) / 25))) }} />)}\n                        </span>\n                      </span>\n                    ) : null}`

      const oldStereo = /\{clip\.type === 'audio' \? \(\n\s*<span className="timeline-waveform-real premiere-waveform" aria-hidden="true">[\s\S]*?<\/span>\n\s*\) : null\}/
      const legacyBlock = /\{clip\.type === 'audio' \? \(\n\s*<span className="timeline-waveform-real" aria-hidden="true">[\s\S]*?<\/span>\n\s*\) : null\}/
      if (oldStereo.test(next)) next = next.replace(oldStereo, stereoBlock)
      else if (legacyBlock.test(next)) next = next.replace(legacyBlock, stereoBlock)
      else throw new Error('All audio waveforms could not replace timeline audio waveform block')

      return { code: next, map: null }
    },
  }
}
