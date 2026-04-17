const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    queueTask: (data) => ipcRenderer.send('queue-task', data),
    switchTab: (tabId) => ipcRenderer.send('switch-tab', tabId),
    stopQueue: () => ipcRenderer.send('stop-queue'),
    toggleFooter: (visible) => ipcRenderer.send('toggle-footer', visible),
    onStatusUpdate: (callback) => ipcRenderer.on('ui-status-update', (event, data) => callback(data))
});
