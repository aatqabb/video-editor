import fs from 'node:fs'
import path from 'node:path'

const ids = ['whoosh','whoosh-fast','impact','cinematic-hit','pop','rise','glitch','bass','swipe','boom','typing','notification','click','transition','reverse','riser-short']
const dir = path.resolve('public/sfx')
let failed = false

for (const id of ids) {
  const file = path.join(dir, `${id}.wav`)
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing ${file}`)
    failed = true
    continue
  }
  const data = fs.readFileSync(file)
  const riff = data.subarray(0, 4).toString('ascii') === 'RIFF'
  const wave = data.subarray(8, 12).toString('ascii') === 'WAVE'
  const pcmPayload = data.length > 44
  const ok = riff && wave && pcmPayload
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}.wav (${data.length} bytes)`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log(`PASS ${ids.length} generated SFX WAV assets have valid RIFF/WAVE headers and audio payloads.`)
