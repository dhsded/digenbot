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
  startSubnicheScan: (query, filters) =>
    ipcRenderer.send('start-subniche-scan', { query, filters }),
  stopTrendScan: () => 
    ipcRenderer.send('stop-trend-scan'),
  onTrendKeywordFound: (callback) => {
    ipcRenderer.on('trend-keyword-found', (_event, keywords) => callback(keywords));
  },
  onTrendKeywordMetric: (callback) => {
    ipcRenderer.on('trend-keyword-metric', (_event, data) => callback(data));
  },
  onTrendStatus: (callback) => {
    ipcRenderer.on('trend-status', (_event, status) => callback(status));
  },
  offTrendEvents: () => {
    ipcRenderer.removeAllListeners('trend-keyword-found');
    ipcRenderer.removeAllListeners('trend-keyword-metric');
    ipcRenderer.removeAllListeners('trend-status');
  }
});
