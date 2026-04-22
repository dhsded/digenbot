const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require('electron');
const path = require('path');

let uiWindow;
let digenView;
let flowView;
let metaView;

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

  metaView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload_meta.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      backgroundThrottling: false
    }
  });

  metaView.webContents.loadURL('https://www.meta.ai/create?utm_source=facebook_bookmarks');

  metaView.webContents.setWindowOpenHandler(({ url }) => {
    metaView.webContents.loadURL(url);
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
    } else if (tab === 'meta') {
      uiWindow.setBrowserView(metaView);
      const bounds = uiWindow.getContentBounds();
      metaView.setBounds({ x: 0, y: 60, width: bounds.width, height: bounds.height - 60 - footerHeight });
      metaView.setAutoResize({ width: true, height: true, vertical: true });
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
    } else if (currentView === metaView) {
      metaView.setBounds({ x: 0, y: 60, width: bounds.width, height: bounds.height - 60 - footerHeight });
    }
  });

  ipcMain.on('queue-task', (event, taskData) => {
    console.log(`Main: Routing task to ${taskData.platform.toUpperCase()} view:`, taskData.prompt);
    if (taskData.platform === 'flow') {
        flowView.webContents.send('execute-flow-task', taskData);
    } else if (taskData.platform === 'meta') {
        metaView.webContents.send('execute-meta-task', taskData);
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
    if (metaView) metaView.webContents.send('execute-stop-queue');
  });

  // Spy function to dump DOM for Antigravity
  ipcMain.on('dump-dom', (event, data) => {
    try {
      let fileName = 'digen_dom_spy.html';
      let htmlData = data;
      
      if (typeof data === 'object' && data.source) {
          fileName = `${data.source}_dom_spy.html`;
          htmlData = data.html;
      }
      
      require('fs').writeFileSync(path.join(__dirname, '..', fileName), htmlData, 'utf-8');
      console.log(`DOM extraído e salvo com sucesso em ${fileName}!`);
    } catch(e) {
      console.error("Falha ao salvar DOM", e);
    }
  });

  // Silent download handler
  ipcMain.on('download-silent', (event, { base64Data, url, basePath, folderName, fileName }) => {
    try {
        const fs = require('fs');
        const https = require('https');
        const targetDir = path.join(basePath, folderName);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const filePath = path.join(targetDir, fileName);
        
        if (base64Data) {
            let base64 = base64Data;
            if (base64.includes(',')) {
                base64 = base64.split(',')[1];
            }
            fs.writeFileSync(filePath, base64, 'base64');
            console.log(`Main: Download silenciado (base64) salvo com sucesso em ${filePath}`);
        } else if (url) {
            const file = fs.createWriteStream(filePath);
            https.get(url, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`Main: Download silenciado (url) salvo com sucesso em ${filePath}`);
                });
            }).on('error', (err) => {
                fs.unlink(filePath, () => {});
                console.error("Main: Erro ao baixar url silenciosamente:", err);
            });
        }
    } catch(e) {
        console.error("Main: Erro no download silencioso", e);
    }
  });

  // Folder selector handler
  ipcMain.handle('select-folder', async () => {
      const result = await dialog.showOpenDialog(uiWindow, {
          properties: ['openDirectory']
      });
      if (result.canceled) {
          return null;
      } else {
          return result.filePaths[0];
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
