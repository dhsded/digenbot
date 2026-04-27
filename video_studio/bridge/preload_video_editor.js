const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoAPI', {
    // Comunica-se com o Main Process para acessar a extensão C++
    testEngine: () => ipcRenderer.invoke('video:testEngine'),
    
    // Funções futuras do editor
    processVideo: (config) => ipcRenderer.invoke('video:process', config),
});
