const { contextBridge, ipcRenderer } = require('electron');

// Listener global para extração de DOM do Espião
ipcRenderer.on('extract-dom', () => {
    try {
        console.log("Extraindo DOM do Gemini...");
        const html = document.documentElement.outerHTML;
        ipcRenderer.send('dump-dom', { source: 'gemini', html: html });
        alert('DOM do Gemini extraído com sucesso! Verifique a pasta raiz do projeto.');
    } catch(e) {
        console.error("Erro ao extrair DOM:", e);
        alert('Falha ao extrair DOM. Veja o console.');
    }
});

// A API completa de orquestração do Gemini será implementada aqui 
// após analisarmos a estrutura do DOM extraído.
contextBridge.exposeInMainWorld('geminiSpy', {
    ping: () => 'pong'
});
