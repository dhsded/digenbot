const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    queueTask: (data) => ipcRenderer.send('queue-task', data),
    switchTab: (tabId, width) => ipcRenderer.send('switch-tab', tabId, width),
    updateBounds: (width) => ipcRenderer.send('update-bounds', width),
    stopQueue: () => ipcRenderer.send('stop-queue'),
    toggleFooter: (visible) => ipcRenderer.send('toggle-footer', visible),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    onStatusUpdate: (callback) => ipcRenderer.on('ui-status-update', (event, data) => callback(data))
});
