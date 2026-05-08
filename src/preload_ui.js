const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    queueTask: (data) => ipcRenderer.send('queue-task', data),
    switchTab: (tabId, width) => ipcRenderer.send('switch-tab', tabId, width),
    updateBounds: (width) => ipcRenderer.send('update-bounds', width),
    stopQueue: () => ipcRenderer.send('stop-queue'),
    toggleFooter: (visible) => ipcRenderer.send('toggle-footer', visible),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getTools: () => ipcRenderer.invoke('get-tools'),
    startTool: (toolId) => ipcRenderer.invoke('start-tool', toolId),
    openToolView: (url, width) => ipcRenderer.send('open-tool-view', url, width),
    browserCommand: (cmd) => ipcRenderer.send('browser-command', cmd),
    onStatusUpdate: (callback) => ipcRenderer.on('ui-status-update', (event, data) => callback(data)),
    broadcastTheme: (theme) => ipcRenderer.send('set-theme', theme),
    onOpenImageViewer: (callback) => ipcRenderer.on('open-image-viewer', (event, src) => callback(src)),
    closeImageViewer: () => ipcRenderer.send('close-image-viewer'),
    onToolQueueTask: (callback) => ipcRenderer.on('tool-queue-task', (event, data) => callback(data)),
    showEngineTab: (engine) => ipcRenderer.send('show-engine-tab', engine),
    onEngineActive: (callback) => ipcRenderer.on('engine-active', (event, data) => callback(data)),
    // Storyboard Storage
    getStoryboardPath: () => ipcRenderer.invoke('get-storyboard-path'),
    openStoryboardFolder: () => ipcRenderer.send('open-storyboard-folder'),
    cleanupStoryboard: (days) => ipcRenderer.invoke('cleanup-storyboard', days),
    saveAppSettings: (s) => ipcRenderer.invoke('save-app-settings', s),
    loadAppSettings: () => ipcRenderer.invoke('load-app-settings'),
});
