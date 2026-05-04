const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('digenAPI', {
    getVault: () => ipcRenderer.invoke('get-vault'),
    getApiKeys: () => ipcRenderer.invoke('get-api-keys'),
    getNextApiKey: () => ipcRenderer.invoke('get-next-api-key'),
    getTheme: () => ipcRenderer.invoke('get-theme'),
    onThemeChange: (callback) => ipcRenderer.on('theme-changed', (event, theme) => callback(theme)),
    openImageViewer: (src) => ipcRenderer.send('open-image-viewer', src),
    injectTask: (platform, prompt, imageUrl) => ipcRenderer.send('tool-inject-task', { platform, prompt, imageUrl })
});

