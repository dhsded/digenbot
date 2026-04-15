const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');

let uiWindow;
let digenView;

function createWindow() {
  uiWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'DM Gerador DIGEN',
    webPreferences: {
      preload: path.join(__dirname, 'preload_ui.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  uiWindow.loadFile(path.join(__dirname, 'index.html'));

  digenView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload_digen.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true
    }
  });

  digenView.webContents.loadURL('https://digen.ai/create');

  // Handle Tab Switching with BrowserView
  ipcMain.on('switch-tab', (event, tab) => {
    if (tab === 'digen') {
      uiWindow.setBrowserView(digenView);
      const bounds = uiWindow.getContentBounds();
      // Assume the tab bar header is 60px height
      digenView.setBounds({ x: 0, y: 60, width: bounds.width, height: bounds.height - 60 });
      // Ensure the view resizes correctly when window resizes
      digenView.setAutoResize({ width: true, height: true });
    } else {
      uiWindow.setBrowserView(null);
    }
  });

  ipcMain.on('queue-task', (event, taskData) => {
    console.log('Main: Routing task to Digen view:', taskData.prompt);
    digenView.webContents.send('execute-digen-task', taskData);
  });

  ipcMain.on('digen-status-update', (event, statusMsg) => {
    if (uiWindow) {
      uiWindow.webContents.send('ui-status-update', statusMsg);
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
