const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('espiao', {
  searchYouTube: (query, mode, filters) =>
    ipcRenderer.invoke('youtube-search', { query, mode, filters }),
});
