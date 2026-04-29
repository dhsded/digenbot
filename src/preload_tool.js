const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('digenAPI', {
    getVault: () => ipcRenderer.invoke('get-vault'),
    getApiKeys: () => ipcRenderer.invoke('get-api-keys')
});
