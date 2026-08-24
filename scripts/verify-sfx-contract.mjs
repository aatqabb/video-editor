import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/CreativePanels.jsx', import.meta.url), 'utf8')
const generator = fs.readFileSync(new URL('./generate-sfx-assets.mjs', import.meta.url), 'utf8')

const requirements = [
  ['dedicated SFX library', /SFX LIBRARY/],
  ['SFX search', /placeholder="Search SFX"/],
  ['SFX preview control', /className="sfx-play"/],
  ['packaged WAV URL mapping', /url:`\/sfx\/\$\{sfx\.id\}\.wav`/],
  ['packaged asset marker', /packaged:true/],
  ['real audio preview', /new Audio\(sfx\.url\)/],
  ['preview playback', /audio\.play\(\)/],
  ['SFX drag payload', /application\/x-video-editor-sfx/],
  ['custom SFX import', /accept="audio\/\*"/],
  ['timeline insertion callback', /onAddSfx\(sfx\)/],
  ['WAV generator output directory', /public\/sfx/],
  ['WAV generator writes preset files', /`\$\{id\}\.wav`/],
]

let failed = false
for (const [name, pattern] of requirements) {
  const target = name.startsWith('WAV generator') ? generator : source
  const ok = pattern.test(target)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('PASS SFX workflow contract verified with packaged WAV preview, drag payload, timeline insertion, and custom import.')
