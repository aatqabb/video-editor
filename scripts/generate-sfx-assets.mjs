import fs from 'node:fs'
import path from 'node:path'

const sampleRate = 44100
const outDir = path.resolve('public/sfx')
fs.mkdirSync(outDir, { recursive: true })

const presets = [
  ['whoosh', .7, 220, 70, 'sine'],
  ['whoosh-fast', .4, 360, 90, 'triangle'],
  ['impact', .5, 120, 45, 'sine'],
  ['cinematic-hit', .8, 95, 35, 'sine'],
  ['pop', .25, 820, 430, 'triangle'],
  ['rise', 1.2, 90, 900, 'sine'],
  ['glitch', .55, 620, 140, 'square'],
  ['bass', .9, 80, 32, 'sine'],
  ['swipe', .45, 280, 110, 'triangle'],
  ['boom', 1, 75, 28, 'sine'],
  ['typing', .8, 760, 520, 'square'],
  ['notification', .35, 660, 920, 'sine'],
  ['click', .2, 980, 540, 'triangle'],
  ['transition', .65, 180, 520, 'triangle'],
  ['reverse', .8, 70, 300, 'sine'],
  ['riser-short', .7, 110, 700, 'sine'],
]

function wavHeader(dataBytes) {
  const buffer = Buffer.alloc(44)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  return buffer
}

function osc(type, phase) {
  const p = phase % (Math.PI * 2)
  if (type === 'square') return p < Math.PI ? 1 : -1
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(p))
  return Math.sin(p)
}

for (const [id, duration, startHz, endHz, type] of presets) {
  const frames = Math.max(1, Math.round(duration * sampleRate))
  const pcm = Buffer.alloc(frames * 2)
  let phase = 0
  for (let i = 0; i < frames; i += 1) {
    const t = i / Math.max(1, frames - 1)
    const hz = startHz + (endHz - startHz) * t
    phase += (Math.PI * 2 * hz) / sampleRate
    const attack = Math.min(1, t / .03)
    const release = Math.min(1, (1 - t) / .12)
    const envelope = Math.max(0, Math.min(attack, release))
    const transient = Math.exp(-t * 18) * (id.includes('impact') || id === 'boom' ? .35 : .08)
    const value = Math.max(-1, Math.min(1, osc(type, phase) * envelope * .42 + transient))
    pcm.writeInt16LE(Math.round(value * 32767), i * 2)
  }
  fs.writeFileSync(path.join(outDir, `${id}.wav`), Buffer.concat([wavHeader(pcm.length), pcm]))
}

console.log(`Generated ${presets.length} packaged SFX assets in ${outDir}`)
