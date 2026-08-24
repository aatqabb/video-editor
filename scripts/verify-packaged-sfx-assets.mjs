import fs from 'node:fs'

const generator = fs.readFileSync(new URL('./generate-sfx-assets.mjs', import.meta.url), 'utf8')
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const requiredIds = ['whoosh', 'impact', 'cinematic-hit', 'pop', 'rise', 'glitch', 'bass', 'swipe', 'boom', 'typing', 'notification', 'click', 'transition', 'reverse', 'riser-short']
const checks = [
  ['SFX generator script exists', generator.includes("public/sfx")],
  ['Generator writes WAV files', generator.includes(".wav") && generator.includes("RIFF") && generator.includes("WAVE")],
  ['Build generates packaged SFX first', packageJson.scripts?.build?.startsWith('npm run generate:sfx')],
  ['Dedicated generate:sfx command exists', packageJson.scripts?.['generate:sfx'] === 'node scripts/generate-sfx-assets.mjs'],
  ...requiredIds.map((id) => [`Packaged preset declared: ${id}`, generator.includes(`'${id}'`)]),
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log(`PASS packaged SFX generator contract verified for ${requiredIds.length} presets.`)
