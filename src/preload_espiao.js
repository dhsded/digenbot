const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('espiao', {
  searchYouTube: (query, mode, filters) =>
    ipcRenderer.invoke('youtube-search', { query, mode, filters }),
  saveReport: (csvContent, defaultName) =>
    ipcRenderer.invoke('espiao-save-report', { csvContent, defaultName }),
  getKeywords: (query) =>
    ipcRenderer.invoke('espiao-get-keywords', query),
  startTrendScan: (filters) => 
    ipcRenderer.send('start-trend-scan', filters),
  stopTrendScan: () => 
    ipcRenderer.send('stop-trend-scan'),
  onTrendChunk: (callback) => {
    ipcRenderer.on('trend-chunk', (_event, items) => callback(items));
  },
  offTrendChunk: () => {
    ipcRenderer.removeAllListeners('trend-chunk');
  }
});
