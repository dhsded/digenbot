const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');

let uiWindow;
let digenView;
let flowView;

function createWindow() {
  uiWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'DM Gerador DIGEN',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload_ui.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  uiWindow.maximize();

  uiWindow.loadFile(path.join(__dirname, 'index.html'));

  digenView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload_digen.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      backgroundThrottling: false
    }
  });

  digenView.webContents.loadURL('https://digen.ai/create');

  digenView.webContents.setWindowOpenHandler(({ url }) => {
    digenView.webContents.loadURL(url);
    return { action: 'deny' };
  });

  flowView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload_flow.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      backgroundThrottling: false
    }
  });

  flowView.webContents.loadURL('https://labs.google/fx/pt/tools/flow');

  flowView.webContents.setWindowOpenHandler(({ url }) => {
    flowView.webContents.loadURL(url);
    return { action: 'deny' };
  });

  let footerVisible = true;

  // Handle Tab Switching with BrowserView
  ipcMain.on('switch-tab', (event, tab) => {
    const footerHeight = footerVisible ? 28 : 0;
    if (tab === 'digen') {
      uiWindow.setBrowserView(digenView);
      const bounds = uiWindow.getContentBounds();
      digenView.setBounds({ x: 0, y: 60, width: bounds.width, height: bounds.height - 60 - footerHeight });
      digenView.setAutoResize({ width: true, height: true, vertical: true });
    } else if (tab === 'flow') {
      uiWindow.setBrowserView(flowView);
      const bounds = uiWindow.getContentBounds();
      flowView.setBounds({ x: 0, y: 60, width: bounds.width, height: bounds.height - 60 - footerHeight });
      flowView.setAutoResize({ width: true, height: true, vertical: true });
    } else {
      uiWindow.setBrowserView(null);
    }
  });

  ipcMain.on('toggle-footer', (event, visible) => {
    footerVisible = visible;
    const footerHeight = visible ? 28 : 0;
    const bounds = uiWindow.getContentBounds();
    
    // Resize current active view
    const currentView = uiWindow.getBrowserView();
    if (currentView === digenView) {
      digenView.setBounds({ x: 0, y: 60, width: bounds.width, height: bounds.height - 60 - footerHeight });
    } else if (currentView === flowView) {
      flowView.setBounds({ x: 0, y: 60, width: bounds.width, height: bounds.height - 60 - footerHeight });
    }
  });

  ipcMain.on('queue-task', (event, taskData) => {
    console.log(`Main: Routing task to ${taskData.platform.toUpperCase()} view:`, taskData.prompt);
    if (taskData.platform === 'flow') {
        flowView.webContents.send('execute-flow-task', taskData);
    } else {
        digenView.webContents.send('execute-digen-task', taskData);
    }
  });

  ipcMain.on('digen-status-update', (event, statusMsg) => {
    if (uiWindow) {
      uiWindow.webContents.send('ui-status-update', statusMsg);
    }
  });

  ipcMain.on('stop-queue', () => {
    if (digenView) digenView.webContents.send('execute-stop-queue');
    if (flowView) flowView.webContents.send('execute-stop-queue');
  });

  // Spy function to dump DOM for Antigravity
  ipcMain.on('dump-dom', (event, html) => {
    try {
      require('fs').writeFileSync(path.join(__dirname, '..', 'digen_dom_spy.html'), html, 'utf-8');
      console.log("DOM extraído e salvo com sucesso!");
    } catch(e) {
      console.error("Falha ao salvar DOM", e);
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
