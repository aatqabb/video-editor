import fs from 'node:fs'

const plugin = fs.readFileSync(new URL('./vite-program-transform-overlay-plugin.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/ProgramTransformOverlay.css', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

const checks = [
  ['program transform plugin enabled', /programTransformOverlayPlugin\(\)/, vite],
  ['program monitor receives selection state', /selectedClipIds=\{selectedClipIds\}/, plugin],
  ['program clip click selects active clip', /setSelectedClipIds\(\[activeVideo\.id\]\)/, plugin],
  ['four corner resize handles', /top-left[\s\S]*top-right[\s\S]*bottom-left[\s\S]*bottom-right/, plugin],
  ['live resize keeps layer visible', /layer\.style\.width = scale \+ '%'[\s\S]*layer\.style\.height = scale \+ '%'/, plugin],
  ['resize persists to clip controls', /updateClipControls\(activeVideo\.id, \{ video: \{ scale:/, plugin],
  ['visible transform outline', /\.program-transform-box/, css],
  ['resize handles receive pointer events', /\.program-resize-handle\{[^}]*pointer-events:auto/, css],
]

let failed = false
for (const [name, pattern, source] of checks) {
  const ok = pattern.test(source)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('PASS program monitor live resize contract verified.')
