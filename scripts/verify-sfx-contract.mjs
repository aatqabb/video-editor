import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/CreativePanels.jsx', import.meta.url), 'utf8')

const requirements = [
  ['dedicated SFX library', /SFX LIBRARY/],
  ['SFX search', /placeholder="Search SFX"/],
  ['SFX preview control', /className="sfx-play"/],
  ['SFX drag payload', /application\/x-video-editor-sfx/],
  ['custom SFX import', /accept="audio\/\*"/],
  ['timeline insertion callback', /onAddSfx\(/],
]

let failed = false
for (const [name, pattern] of requirements) {
  const ok = pattern.test(source)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('PASS SFX workflow contract verified. Packaged final SFX audio assets remain a separate content gate.')
