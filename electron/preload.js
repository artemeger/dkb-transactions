const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('dkb', {
  // File operations
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  listCsvFiles: () => ipcRenderer.invoke('list-csv-files'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  
  // Dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Window management
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
});

// Also expose a simple logging utility for debugging
contextBridge.exposeInMainWorld('electronLog', {
  log: (message) => console.log('[Electron]', message),
  error: (message) => console.error('[Electron]', message),
});
