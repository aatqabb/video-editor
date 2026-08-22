import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('electron/main.cjs')
const preload = read('electron/preload.cjs')
const media = read('src/MediaLibrary.jsx')
const pkg = JSON.parse(read('package.json'))

const checks = [
  ['Project save uses Electron native save dialog', main.includes("dialog.showSaveDialog(mainWindow") && main.includes("desktop:choose-project-path")],
  ['Project open uses Electron native open dialog', main.includes("dialog.showOpenDialog(mainWindow") && main.includes("desktop:show-open-project")],
  ['Export path uses Electron native save dialog', main.includes("desktop:choose-export-path") && main.includes('showSaveDialog')],
  ['Preload exposes project save picker', preload.includes('chooseProjectPath')],
  ['Preload exposes project open picker', preload.includes('chooseOpenProjectPath')],
  ['Preload exposes export picker', preload.includes('chooseExportPath')],
  ['Media import uses a file input that maps to the OS picker in Electron', media.includes('type="file"') && media.includes('multiple') && media.includes('video/*,audio/*,image/*')],
  ['Windows installer is NSIS x64', pkg.build?.win?.target?.some?.((target) => target.target === 'nsis' && target.arch?.includes?.('x64'))],
  ['Installer allows choosing install directory', pkg.build?.nsis?.allowToChangeInstallationDirectory === true],
  ['Installer creates Desktop shortcut', pkg.build?.nsis?.createDesktopShortcut === true],
  ['Installer creates Start Menu shortcut', pkg.build?.nsis?.createStartMenuShortcut === true],
]

let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('\nNative picker/installer contract is present. Final checkbox still requires hands-on QA on a packaged Windows .exe: import media, open/save project, choose export path, cancel each dialog, and verify Unicode/long paths.')
