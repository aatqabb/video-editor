const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron/main')
const fs = require('node:fs')
const path = require('node:path')
const { probeFfmpeg, startExport } = require('./exportEngine.cjs')

if (require('electron-squirrel-startup')) app.quit()

let mainWindow = null
let activeExport = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#0d0d0f',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (!app.isPackaged && devUrl) mainWindow.loadURL(devUrl)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('desktop:get-system-info', async () => {
  let gpuInfo = null
  try { gpuInfo = await app.getGPUInfo('basic') } catch { gpuInfo = null }

  return {
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    hardwareAcceleration: app.isHardwareAccelerationEnabled(),
    gpuFeatureStatus: app.getGPUFeatureStatus(),
    gpuInfo,
  }
})

ipcMain.handle('desktop:get-export-capabilities', async () => {
  let gpuInfo = null
  try { gpuInfo = await app.getGPUInfo('basic') } catch { gpuInfo = null }
  return {
    ffmpeg: probeFfmpeg(),
    hardwareAcceleration: app.isHardwareAccelerationEnabled(),
    gpuFeatureStatus: app.getGPUFeatureStatus(),
    gpuInfo,
  }
})

function ensureExportExtension(filePath, extension) {
  if (!filePath) return null
  const normalizedExtension = String(extension || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  if (!normalizedExtension) return filePath
  const suffix = `.${normalizedExtension}`
  return filePath.toLowerCase().endsWith(suffix) ? filePath : `${filePath}${suffix}`
}

ipcMain.handle('desktop:choose-export-path', async (_event, options = {}) => {
  const extension = options.extension || (options.format === 'mp3' ? 'mp3' : 'mp4')
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Choose Export Location',
    defaultPath: options.defaultName || `export.${extension}`,
    filters: [
      options.format === 'mp3'
        ? { name: 'MP3 Audio', extensions: ['mp3'] }
        : { name: 'MP4 Video', extensions: ['mp4'] },
    ],
  })
  return result.canceled ? null : ensureExportExtension(result.filePath, extension)
})

ipcMain.handle('desktop:start-export', async (event, payload) => {
  if (activeExport) throw new Error('An export is already running')
  const manifest = payload?.manifest
  const outputPath = payload?.outputPath
  if (!manifest || !Array.isArray(manifest.clips)) throw new Error('Invalid export manifest')
  if (!outputPath || typeof outputPath !== 'string') throw new Error('Choose an export location first')

  const job = startExport(manifest, outputPath, (progress) => {
    if (!event.sender.isDestroyed()) event.sender.send('desktop:export-progress', progress)
  })
  activeExport = job

  try {
    const result = await job.done
    if (!event.sender.isDestroyed()) event.sender.send('desktop:export-progress', { percent: 100, complete: true })
    return result
  } finally {
    activeExport = null
  }
})

ipcMain.handle('desktop:cancel-export', async () => {
  if (!activeExport?.child) return false
  activeExport.child.kill('SIGTERM')
  activeExport = null
  return true
})

ipcMain.handle('desktop:save-temp-media', async (_event, payload = {}) => {
  const bytes = payload.bytes
  if (!bytes) throw new Error('No media bytes received')
  const extension = String(payload.extension || 'webm').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'webm'
  const tempDir = path.join(app.getPath('userData'), 'temp-media')
  fs.mkdirSync(tempDir, { recursive: true })
  const filePath = path.join(tempDir, `${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extension}`)
  fs.writeFileSync(filePath, Buffer.from(bytes))
  return filePath
})

ipcMain.handle('desktop:choose-project-path', async (_event, defaultName = 'Untitled Project.vedit.json') => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save VideoEditor Project',
    defaultPath: defaultName,
    filters: [{ name: 'VideoEditor Project', extensions: ['json'] }],
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('desktop:show-open-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open VideoEditor Project',
    properties: ['openFile'],
    filters: [{ name: 'VideoEditor Project', extensions: ['json'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

app.whenReady().then(() => {
  app.setAppUserModelId('com.squirrel.VideoEditor.VideoEditor')
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
