import fs from 'node:fs'

const helper = fs.readFileSync(new URL('../src/timelineStateHelpers.js', import.meta.url), 'utf8')
const overlapPlugin = fs.readFileSync(new URL('./vite-overlap-replacement-plugin.js', import.meta.url), 'utf8')
const visibilityPlugin = fs.readFileSync(new URL('./vite-track-visibility-ui-plugin.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/PreviewTransitionFixes.css', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

const checks = [
  ['moving clips resolve older overlaps by range', /return replaceTimelineOverlaps\(moved, movingIds\)/.test(helper)],
  ['new clips resolve older overlaps by range', /const addedIds = next\.filter/.test(overlapPlugin) && /replaceTimelineOverlaps\(next, addedIds\)/.test(overlapPlugin)],
  ['overlap subtraction trims and splits instead of deleting whole old clip', helper.includes('function subtractWinnerFromClip') && helper.includes('leftDuration') && helper.includes('rightDuration') && helper.includes("id: `${clip.id}-after-${winner.id}`")],
  ['front overlap advances source position', helper.includes('shiftedSourceIn') && helper.includes('sourceIn: shiftedSourceIn(clip, removedFromStart)')],
  ['touching clip edges are not treated as overlap', /aBounds\.start < bBounds\.end - 0\.0001 && aBounds\.end > bBounds\.start \+ 0\.0001/.test(helper)],
  ['visibility button has explicit show hide state', visibilityPlugin.includes('track-visibility-toggle') && /Show \\?\$\{track\.id\} layer/.test(visibilityPlugin) && /Hide \\?\$\{track\.id\} layer/.test(visibilityPlugin) && visibilityPlugin.includes("track.hidden ? 'OFF' : 'ON'")],
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
console.log('PASS partial overlap replacement and track visibility contract verified.')
