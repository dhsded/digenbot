const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    queueTask: (taskData) => ipcRenderer.send('queue-task', taskData),
    switchTab: (tabName) => ipcRenderer.send('switch-tab', tabName),
    onStatusUpdate: (callback) => ipcRenderer.on('ui-status-update', (event, data) => callback(data))
});
