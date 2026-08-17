const { app, BrowserWindow, dialog, ipcMain } = require('electron/main')
const path = require('node:path')

let mainWindow = null

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
    require('electron').shell.openExternal(url)
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
  return result.canceled ? null : result.filePath
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
  app.setAppUserModelId('com.videoeditor.app')
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
