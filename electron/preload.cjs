const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('videoEditorDesktop', {
  isDesktop: true,
  getPathForFile(file) {
    try { return webUtils.getPathForFile(file) } catch { return '' }
  },
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
