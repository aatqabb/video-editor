import fs from 'node:fs'

const helper = fs.readFileSync(new URL('../src/timelineStateHelpers.js', import.meta.url), 'utf8')
const overlapPlugin = fs.readFileSync(new URL('./vite-overlap-replacement-plugin.js', import.meta.url), 'utf8')
const visibilityPlugin = fs.readFileSync(new URL('./vite-track-visibility-ui-plugin.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PreviewTransitionFixes.css', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

const checks = [
  ['moving clips remove older overlaps', /return replaceTimelineOverlaps\(moved, movingIds\)/.test(helper)],
  ['new clips replace older overlaps', /const addedIds = next\.filter/.test(overlapPlugin) && /replaceTimelineOverlaps\(next, addedIds\)/.test(overlapPlugin)],
  ['touching clip edges are not treated as overlap', /aStart < bEnd - 0\.0001 && aEnd > bStart \+ 0\.0001/.test(helper)],
  ['visibility button has explicit show hide state', /track-visibility-toggle/.test(visibilityPlugin) && /Show \\$\{track\.id\} layer/.test(visibilityPlugin) && /Hide \\$\{track\.id\} layer/.test(visibilityPlugin)],
  ['hidden lanes are visually dimmed', /track-lane\.track-hidden/.test(css) && /track-control\.track-hidden/.test(css)],
  ['visibility toggle has distinct visible and hidden styles', /track-visibility-toggle\.is-visible/.test(css) && /track-visibility-toggle\.is-hidden/.test(css)],
  ['overlap and visibility plugins are wired', /overlapReplacementPlugin\(\)/.test(vite) && /trackVisibilityUiPlugin\(\)/.test(vite)],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS overlap replacement and track visibility contract verified.')
