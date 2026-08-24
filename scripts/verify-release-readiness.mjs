import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
const envExample = read('.env.example')
const gitignore = read('.gitignore')
const finalQa = read('FINAL_QA.md')
const windowsWorkflow = read('.github/workflows/windows-installer.yml')

const checks = [
  ['Electron main entry configured', pkg.main === 'electron/main.cjs'],
  ['Windows NSIS target configured', JSON.stringify(pkg.build?.win?.target || []).includes('nsis')],
  ['Desktop shortcut enabled', pkg.build?.nsis?.createDesktopShortcut === true],
  ['Start Menu shortcut enabled', pkg.build?.nsis?.createStartMenuShortcut === true],
  ['Installation directory is user-selectable', pkg.build?.nsis?.allowToChangeInstallationDirectory === true],
  ['FFmpeg bundled as extra resource', JSON.stringify(pkg.build?.extraResources || []).includes('resources/ffmpeg')],
  ['Final regression command exists', pkg.scripts?.['verify:final'] === 'node scripts/verify-final-regression.mjs'],
  ['Windows preflight command exists', pkg.scripts?.['verify:windows:preflight'] === 'node scripts/verify-windows-preflight.cjs'],
  ['Windows acceptance command exists', pkg.scripts?.['verify:windows:acceptance'] === 'node scripts/verify-windows-acceptance.cjs'],
  ['Windows package command exists', typeof pkg.scripts?.['package:win'] === 'string' && pkg.scripts['package:win'].includes('electron-builder')],
  ['Example Pexels key is blank', /VITE_PEXELS_API_KEY=\s*$/m.test(envExample)],
  ['Example Pixabay key is blank', /VITE_PIXABAY_API_KEY=\s*$/m.test(envExample)],
  ['Local env files ignored', gitignore.includes('*.local')],
  ['Acceptance reports ignored', gitignore.includes('windows-acceptance-report.json') && gitignore.includes('windows-preflight-report.json')],
  ['Final QA includes combined acceptance command', finalQa.includes('npm run verify:windows:acceptance')],
  ['Final QA includes real microphone check', finalQa.includes('verify:microphone:windows')],
  ['Final QA includes real GPU check', finalQa.includes('verify:gpu:windows')],
  ['Windows workflow runs final regression before packaging', windowsWorkflow.indexOf('npm run verify:final') < windowsWorkflow.indexOf('npm run package:win')],
  ['Windows workflow verifies installer artifact', windowsWorkflow.includes('VideoEditor-Setup-*.exe')],
  ['Windows workflow smoke-tests installed app', windowsWorkflow.includes('Installed app stayed alive through startup smoke test')],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('PASS release-readiness contract verified. Real Windows acceptance remains a separate environment gate.')
