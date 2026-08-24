import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/ClipControls.jsx', import.meta.url), 'utf8')

const requirements = [
  ['microphone permission request', /navigator\.mediaDevices\.getUserMedia\(\{\s*audio:\s*true\s*\}\)/],
  ['MediaRecorder capture', /new MediaRecorder\(stream\)/],
  ['recorded chunk collection', /dataavailable/],
  ['recording stop handler', /addEventListener\(['"]stop['"]/],
  ['Blob recording assembly', /new Blob\(chunksRef\.current/],
  ['voice-over timeline insertion', /kind:\s*['"]voiceover['"]/],
  ['microphone track cleanup', /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/],
  ['permission-denied feedback', /Microphone permission was not granted/],
]

let failed = false
for (const [name, pattern] of requirements) {
  const ok = pattern.test(source)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('PASS Voice-over recording implementation contract verified. Real Windows microphone permission QA remains a hands-on gate.')
