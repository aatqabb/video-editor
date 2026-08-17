const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('videoEditorDesktop', {
  isDesktop: true,
  getPathForFile(file) {
    try { return webUtils.getPathForFile(file) } catch { return '' }
  },
  getSystemInfo: () => ipcRenderer.invoke('desktop:get-system-info'),
  chooseExportPath: (options) => ipcRenderer.invoke('desktop:choose-export-path', options),
  chooseProjectPath: (defaultName) => ipcRenderer.invoke('desktop:choose-project-path', defaultName),
  chooseOpenProjectPath: () => ipcRenderer.invoke('desktop:show-open-project'),
})
