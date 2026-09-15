const { contextBridge, ipcRenderer, webUtils } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

contextBridge.exposeInMainWorld('videoEditorDesktop', {
  isDesktop: true,
  getPathForFile(file) {
    try { return webUtils.getPathForFile(file) } catch { return '' }
  },
  // Resolves a relative app asset URL (e.g. the built-in SFX library's
  // "./sfx/whoosh.wav", served relative to dist/index.html — see vite
  // config's base:'./' and main.cjs's loadFile(dist/index.html)) to the real
  // file it's packaged at, so export can use it via a real sourcePath
  // instead of only the browser-playable relative URL. Existence-checked
  // rather than assumed, and returns '' (safe, honest fallback) in dev mode
  // where there is no built dist/ folder yet.
  resolveAppAsset(relativeUrl) {
    try {
      const clean = String(relativeUrl || '').replace(/^\.?\/+/, '')
      const candidate = path.join(__dirname, '..', 'dist', clean)
      return fs.existsSync(candidate) ? candidate : ''
    } catch { return '' }
  },
  // Writes browser-only media (no real file on disk — e.g. a MediaRecorder
  // voice-over) to a real temp file, so it also has a sourcePath export can
  // use. The main-process handler already existed (desktop:save-temp-media)
  // but was never exposed to the renderer until this fix.
  saveTempMedia: (bytes, extension) => ipcRenderer.invoke('desktop:save-temp-media', { bytes, extension }),
  getSystemInfo: () => ipcRenderer.invoke('desktop:get-system-info'),
  getExportCapabilities: () => ipcRenderer.invoke('desktop:get-export-capabilities'),
  createProxy: (sourcePath) => ipcRenderer.invoke('desktop:create-proxy', sourcePath),
  chooseExportPath: (options) => ipcRenderer.invoke('desktop:choose-export-path', options),
  startExport: (payload) => ipcRenderer.invoke('desktop:start-export', payload),
  cancelExport: () => ipcRenderer.invoke('desktop:cancel-export'),
  onExportProgress(callback) {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('desktop:export-progress', listener)
    return () => ipcRenderer.removeListener('desktop:export-progress', listener)
  },
  chooseProjectPath: (defaultName) => ipcRenderer.invoke('desktop:choose-project-path', defaultName),
  chooseOpenProjectPath: () => ipcRenderer.invoke('desktop:show-open-project'),
  fetchYoutubeTranscript: (videoId) => ipcRenderer.invoke('desktop:fetch-youtube-transcript', videoId),
})
