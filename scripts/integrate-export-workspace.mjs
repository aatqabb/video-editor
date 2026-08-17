import fs from 'node:fs'

const path = process.argv[2] || 'src/App.jsx'
let code = fs.readFileSync(path, 'utf8')

if (!code.includes("import ExportWorkspace from './ExportWorkspace'")) {
  code = code.replace(
    "import MediaLibrary from './MediaLibrary'\n",
    "import MediaLibrary from './MediaLibrary'\nimport ExportWorkspace from './ExportWorkspace'\n",
  )
}

code = code.replace(
  "const centerTabs = ['Source', 'Script', 'Stock', 'SFX', 'Transitions', 'Essential Sound']",
  "const centerTabs = ['Source', 'Script', 'Stock', 'SFX', 'Transitions', 'Essential Sound', 'Export']",
)

if (!code.includes("if (centerTab === 'Export')")) {
  const marker = "    if (centerTab === 'Source') return <Monitor"
  const block = `    if (centerTab === 'Export') {\n      return <ExportWorkspace projectName={projectName} projectSettings={projectSettings} clips={clips} tracks={tracks} notify={notify} />\n    }\n`
  if (!code.includes(marker)) throw new Error('Source center branch marker missing')
  code = code.replace(marker, block + marker)
}

const navOld = `{['Import', 'Edit', 'Export'].map((item) => (\n            <button key={item} className={item === 'Edit' ? 'active' : ''} onClick={() => notify(\`${'${item}'} workspace\`)}>{item}</button>\n          ))}`
const navNew = `{['Import', 'Edit', 'Export'].map((item) => (\n            <button\n              key={item}\n              className={item === 'Edit' ? 'active' : ''}\n              onClick={() => {\n                if (item === 'Import') setLeftTab('Media')\n                else if (item === 'Export') setCenterTab('Export')\n                else notify('Edit workspace')\n              }}\n            >{item}</button>\n          ))}`
if (code.includes(navOld)) code = code.replace(navOld, navNew)

if (!code.includes('sourcePath: media.sourcePath')) {
  code = code.replace(
    `      localUrl: media.localUrl,\n      thumbnail: media.thumbnail || null,`,
    `      localUrl: media.localUrl,\n      sourcePath: media.sourcePath || '',\n      sourceIn: 0,\n      thumbnail: media.thumbnail || null,`,
  )
}

if (!code.includes('sourceIn: 0,\n        thumbnail: result.thumbnail')) {
  code = code.replace(
    `        thumbnail: result.thumbnail,\n        remoteUrl: result.fileUrl,`,
    `        sourceIn: 0,\n        thumbnail: result.thumbnail,\n        remoteUrl: result.fileUrl,`,
  )
}

// Preserve source offsets when splitting.
if (!code.includes('sourceIn: (Number(clip.sourceIn) || 0) + leftDuration')) {
  code = code.replace(
    `{ ...clip, id: rightId, name: \`${'${clip.name}'} (2)\`, start: playhead, duration: rightDuration },`,
    `{ ...clip, id: rightId, name: \`${'${clip.name}'} (2)\`, start: playhead, duration: rightDuration, sourceIn: (Number(clip.sourceIn) || 0) + leftDuration * Math.max(.1, Number(clip.video?.speed) || 1) },`,
  )
}

// Preserve source offsets when backward/ripple trimming.
if (!code.includes('sourceIn: (Number(clip.sourceIn) || 0) + deltaSource')) {
  const old = `      if (direction === 'backward') {\n        return { ...clip, start: playhead, duration: Math.max(MIN_CLIP_DURATION, end - playhead) }\n      }`
  const replacement = `      if (direction === 'backward') {\n        const deltaSource = (playhead - clip.start) * Math.max(.1, Number(clip.video?.speed) || 1)\n        return { ...clip, start: playhead, duration: Math.max(MIN_CLIP_DURATION, end - playhead), sourceIn: (Number(clip.sourceIn) || 0) + deltaSource }\n      }`
  if (code.includes(old)) code = code.replace(old, replacement)
}

// Preserve source offsets when dragging the left trim handle.
if (!code.includes('sourceIn: (Number(item.sourceIn) || 0) + sourceDelta')) {
  const old = `          return { ...item, start: nextStart, duration: initialEnd - nextStart }`
  const replacement = `          const sourceDelta = (nextStart - initialStart) * Math.max(.1, Number(item.video?.speed) || 1)\n          return { ...item, start: nextStart, duration: initialEnd - nextStart, sourceIn: (Number(clip.sourceIn) || 0) + sourceDelta }`
  if (code.includes(old)) code = code.replace(old, replacement)
}

fs.writeFileSync(path, code)
console.log(`Patched ${path}`)
