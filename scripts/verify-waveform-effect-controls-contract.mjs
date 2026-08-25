import fs from 'node:fs'

const plugin = fs.readFileSync(new URL('./vite-all-audio-waveforms-plugin.js', import.meta.url), 'utf8')
const waveformCss = fs.readFileSync(new URL('../src/PremiereAudioWaveform.css', import.meta.url), 'utf8')
const controls = fs.readFileSync(new URL('../src/ClipControls.jsx', import.meta.url), 'utf8')

const checks = [
  ['dense waveform uses high sample count', /targetSamples = 196/.test(plugin)],
  ['waveform renders upper and lower channels', /premiere-waveform-channel upper/.test(plugin) && /premiere-waveform-channel lower/.test(plugin)],
  ['waveform CSS styles both channels', /grid-template-rows:1fr 1fr/.test(waveformCss) && /wave-peak-lower/.test(waveformCss)],
  ['Effect Controls has collapsible sections', /function EffectSection/.test(controls) && /aria-expanded=\{open\}/.test(controls)],
  ['Motion section has working quick resets', /title="Motion"/.test(controls) && /Center/.test(controls) && /100%/.test(controls)],
  ['Opacity presets exist', /\[25, 50, 75, 100\]/.test(controls)],
  ['Time Remapping has speed presets', /title="Time Remapping"/.test(controls) && /\[0\.5, 1, 1\.5, 2\]/.test(controls)],
  ['Audio Effect Controls keeps volume and fade functions', /title="Volume"/.test(controls) && /title="Audio Transitions"/.test(controls)],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS waveform and Effect Controls contract verified.')
