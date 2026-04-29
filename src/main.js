const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let uiWindow;
let digenView;
let flowView;
let metaView;
let editorView;
let toolView;
let espiaoView;
let scraperView;
let currentSidebarWidth = 250;
let loadedUrls = { digen: false, flow: false, meta: false, video_editor: false, espiao: false };
const runningTools = {};

// ─── Dev Server Manager ───────────────────────────────────────────────────────
// Keeps track of all spawned child processes so we can kill them on exit.
const devServers = [];

/**
 * Polls a TCP port until it starts accepting connections.
 * @param {number} port
 * @param {number} [timeout=60000] - Max wait time in ms
 * @returns {Promise<void>}
 */
function waitForPort(port, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const client = net.createConnection({ port, host: '127.0.0.1' });
      client.once('connect', () => {
        client.destroy();
        resolve();
      });
      client.once('error', () => {
        client.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Port ${port} did not open within ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

/**
 * Starts `npm run dev` inside `dir` and waits until `port` is reachable.
 * Cross-platform: uses npm.cmd on Windows, npm elsewhere.
 * @param {string} dir  - Absolute path to the project directory
 * @param {number} port - The port the dev server will listen on
 * @param {string} label - Human-readable name for logs
 * @returns {Promise<void>}
 */
function startDevServer(dir, port, label) {
  return new Promise((resolve, reject) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    console.log(`[DevServer] Starting "${label}" on port ${port} from ${dir}`);

    const child = spawn(npmCmd, ['run', 'dev'], {
      cwd: dir,
      // Detach so the child doesn't inherit our stdin/stdout in production
      stdio: ['ignore', 'pipe', 'pipe'],
      // Give the child its own process group so we can kill it cleanly
      detached: false,
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    devServers.push(child);

    child.stdout.on('data', (d) => console.log(`[DevServer:${label}]`, d.toString().trim()));
    child.stderr.on('data', (d) => console.error(`[DevServer:${label}:err]`, d.toString().trim()));
    child.on('error', (err) => console.error(`[DevServer:${label}] spawn error:`, err));
    child.on('exit', (code) => console.log(`[DevServer:${label}] exited with code ${code}`));

    waitForPort(port)
      .then(() => {
        console.log(`[DevServer] "${label}" ready on port ${port}`);
        resolve();
      })
      .catch(reject);
  });
}

/** Kill all spawned dev servers on app exit. */
function killAllDevServers() {
  for (const child of devServers) {
    try {
      if (!child.killed) child.kill();
    } catch (e) {
      // ignore
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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

  metaView.webContents.setWindowOpenHandler(({ url }) => {
    metaView.webContents.loadURL(url);
    return { action: 'deny' };
  });

  editorView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'video_studio', 'bridge', 'preload_video_editor.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      backgroundThrottling: false
    }
  });

  toolView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload_tool.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true
    }
  });

  espiaoView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload_espiao.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      backgroundThrottling: false
    }
  });

  // Hidden view used exclusively for scraping YouTube — never added to the window
  scraperView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      // Use a real Chrome UA so YouTube renders full content
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });

  digenView.setBackgroundColor('#ffffff');
  flowView.setBackgroundColor('#ffffff');
  metaView.setBackgroundColor('#ffffff');
  editorView.setBackgroundColor('#0a0a0a');
  toolView.setBackgroundColor('#ffffff');
  espiaoView.setBackgroundColor('#0f0f1a');

  // ── Auto-start local dev servers ──────────────────────────────────────────
  const videoEditorDir = path.join(__dirname, '..', 'video_studio', 'ui');
  const espiaoDir = path.join(__dirname, '..', 'Ferramentas', 'espiao');

  // Start both servers in parallel; load their BrowserViews when ready.
  startDevServer(videoEditorDir, 5173, 'Editor de Vídeo').then(() => {
    // Pre-load the editor so it's instant when the user clicks the tab
    if (!loadedUrls.video_editor) {
      editorView.webContents.loadURL('http://localhost:5173');
      loadedUrls.video_editor = true;
    } else {
      // Server came up after tab was already clicked (blank screen case)
      editorView.webContents.reload();
    }
  }).catch((err) => console.error('[DevServer] Editor de Vídeo failed to start:', err));

  startDevServer(espiaoDir, 5174, 'Espião').then(() => {
    if (!loadedUrls.espiao) {
      espiaoView.webContents.loadURL('http://localhost:5174');
      loadedUrls.espiao = true;
    } else {
      // Server came up after the tab was already clicked — reload to fix blank
      espiaoView.webContents.reload();
    }
  }).catch((err) => console.error('[DevServer] Espião failed to start:', err));
  // ─────────────────────────────────────────────────────────────────────────

  let footerVisible = true;

  // Handle Tab Switching with BrowserView
  ipcMain.on('switch-tab', (event, tab, sidebarWidth = 250) => {
    currentSidebarWidth = sidebarWidth;
    const footerHeight = footerVisible ? 28 : 0;
    const navHeight = 40; // Height of the browser controls bar
    const bounds = uiWindow.getContentBounds();
    console.log(`[DEBUG] switch-tab: ${tab}, sidebarWidth: ${sidebarWidth}, bounds:`, bounds);
    
    if (tab === 'digen') {
      if (!loadedUrls.digen) {
        digenView.webContents.loadURL('https://digen.ai/create');
        loadedUrls.digen = true;
      }
      uiWindow.setBrowserView(digenView);
      const newBounds = { x: sidebarWidth, y: navHeight, width: bounds.width - sidebarWidth, height: bounds.height - footerHeight - navHeight };
      digenView.setBounds(newBounds);
      digenView.setAutoResize({ width: true, height: true, vertical: true });
    } else if (tab === 'flow') {
      if (!loadedUrls.flow) {
        flowView.webContents.loadURL('https://labs.google/fx/pt/tools/flow');
        loadedUrls.flow = true;
      }
      uiWindow.setBrowserView(flowView);
      flowView.setBounds({ x: sidebarWidth, y: navHeight, width: bounds.width - sidebarWidth, height: bounds.height - footerHeight - navHeight });
      flowView.setAutoResize({ width: true, height: true, vertical: true });
    } else if (tab === 'meta') {
      if (!loadedUrls.meta) {
        metaView.webContents.loadURL('https://www.meta.ai/create?utm_source=facebook_bookmarks');
        loadedUrls.meta = true;
      }
      uiWindow.setBrowserView(metaView);
      metaView.setBounds({ x: sidebarWidth, y: navHeight, width: bounds.width - sidebarWidth, height: bounds.height - footerHeight - navHeight });
      metaView.setAutoResize({ width: true, height: true, vertical: true });
    } else if (tab === 'video_editor') {
      if (!loadedUrls.video_editor) {
        editorView.webContents.loadURL('http://localhost:5173');
        loadedUrls.video_editor = true;
      }
      uiWindow.setBrowserView(editorView);
      editorView.setBounds({ x: sidebarWidth, y: 0, width: bounds.width - sidebarWidth, height: bounds.height - footerHeight });
      editorView.setAutoResize({ width: true, height: true, vertical: true });
    } else if (tab === 'espiao') {
      if (!loadedUrls.espiao) {
        espiaoView.webContents.loadURL('http://localhost:5174');
        loadedUrls.espiao = true;
      }
      uiWindow.setBrowserView(espiaoView);
      espiaoView.setBounds({ x: sidebarWidth, y: 0, width: bounds.width - sidebarWidth, height: bounds.height - footerHeight });
      espiaoView.setAutoResize({ width: true, height: true, vertical: true });
    } else {
      uiWindow.setBrowserView(null);
    }
  });

  ipcMain.on('open-tool-view', (event, url, sidebarWidth) => {
    const bounds = uiWindow.getContentBounds();
    const footerHeight = footerVisible ? 28 : 0;
    const navHeight = 0; // No browser controls for Studio Tools
    
    if (toolView.webContents.getURL() !== url) {
        toolView.webContents.loadURL(url);
    }
    uiWindow.setBrowserView(toolView);
    toolView.setBounds({ x: sidebarWidth, y: navHeight, width: bounds.width - sidebarWidth, height: bounds.height - footerHeight - navHeight });
    toolView.setAutoResize({ width: true, height: true, vertical: true });
  });

  ipcMain.on('update-bounds', (event, sidebarWidth) => {
    currentSidebarWidth = sidebarWidth;
    const footerHeight = footerVisible ? 28 : 0;
    const bounds = uiWindow.getContentBounds();
    const currentView = uiWindow.getBrowserView();
    const navHeight = [digenView, flowView, metaView].includes(currentView) ? 40 : 0;
    if (currentView) {
      currentView.setBounds({ x: sidebarWidth, y: navHeight, width: bounds.width - sidebarWidth, height: bounds.height - footerHeight - navHeight });
    }
  });

  ipcMain.on('toggle-footer', (event, visible) => {
    footerVisible = visible;
    const footerHeight = visible ? 28 : 0;
    const bounds = uiWindow.getContentBounds();
    const currentView = uiWindow.getBrowserView();
    const navHeight = [digenView, flowView, metaView].includes(currentView) ? 40 : 0;
    if (currentView) {
      currentView.setBounds({ x: currentSidebarWidth, y: navHeight, width: bounds.width - currentSidebarWidth, height: bounds.height - footerHeight - navHeight });
    }
  });

  ipcMain.on('browser-command', (event, command) => {
    const view = uiWindow.getBrowserView();
    if (!view) return;
    
    switch (command) {
        case 'back':
            if (view.webContents.canGoBack()) view.webContents.goBack();
            break;
        case 'forward':
            if (view.webContents.canGoForward()) view.webContents.goForward();
            break;
        case 'reload':
            view.webContents.reload();
            break;
        case 'home':
            if (view === digenView) view.webContents.loadURL('https://digen.ai/create');
            else if (view === flowView) view.webContents.loadURL('https://labs.google/fx/pt/tools/flow');
            else if (view === metaView) view.webContents.loadURL('https://www.meta.ai/create?utm_source=facebook_bookmarks');
            break;
    }
  });

  ipcMain.on('queue-task', (event, taskData) => {
    console.log(`Main: Routing task to ${taskData.platform.toUpperCase()} view:`, taskData.prompt);
    const routeTask = () => {
      if (taskData.platform === 'flow') {
          flowView.webContents.send('execute-flow-task', taskData);
      } else if (taskData.platform === 'meta') {
          metaView.webContents.send('execute-meta-task', taskData);
      } else {
          digenView.webContents.send('execute-digen-task', taskData);
      }
    };

    let targetView;
    let urlToLoad = '';
    let platformKey = taskData.platform;
    
    if (platformKey === 'flow') { targetView = flowView; urlToLoad = 'https://labs.google/fx/pt/tools/flow'; }
    else if (platformKey === 'meta') { targetView = metaView; urlToLoad = 'https://www.meta.ai/create?utm_source=facebook_bookmarks'; }
    else { targetView = digenView; urlToLoad = 'https://digen.ai/create'; platformKey = 'digen'; }

    if (!loadedUrls[platformKey]) {
      loadedUrls[platformKey] = true;
      targetView.webContents.once('did-finish-load', () => {
        routeTask();
      });
      targetView.webContents.loadURL(urlToLoad);
    } else {
      routeTask();
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

  // Tools scanner handler
  ipcMain.handle('get-tools', async () => {
      const fs = require('fs');
      const ferramentasDir = path.join(__dirname, '..', 'Ferramentas');
      const tools = [];
      if (fs.existsSync(ferramentasDir)) {
          const dirs = fs.readdirSync(ferramentasDir, { withFileTypes: true })
                         .filter(dirent => dirent.isDirectory())
                         .map(dirent => dirent.name);
          for (const dir of dirs) {
              const metadataPath = path.join(ferramentasDir, dir, 'metadata.json');
              if (fs.existsSync(metadataPath)) {
                  try {
                      const data = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                      tools.push({ id: dir, ...data });
                  } catch(e) {}
              }
          }
      }
      return tools;
  });

  // Start tool dev server handler
  ipcMain.handle('start-tool', async (event, toolId) => {
      const fs = require('fs');
      const { spawn } = require('child_process');
      const toolDir = path.join(__dirname, '..', 'Ferramentas', toolId);
      const pkgPath = path.join(toolDir, 'package.json');
      
      if (!fs.existsSync(pkgPath)) {
          // If no package.json, maybe it's just static HTML? Try to open index.html
          const indexPath = path.join(toolDir, 'index.html');
          if (fs.existsSync(indexPath)) {
              return { url: 'file://' + indexPath };
          }
          return { error: 'No package.json or index.html found' };
      }
      
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const devScript = pkg.scripts && pkg.scripts.dev ? pkg.scripts.dev : '';
      let port = 5173; // Default Vite port
      const portMatch = devScript.match(/--port[= ](\d+)/);
      if (portMatch) port = parseInt(portMatch[1]);
      
      const url = `http://localhost:${port}`;
      
      if (runningTools[toolId]) {
          return { url }; // Already running
      }
      
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd: toolDir });
      runningTools[toolId] = { process: child, url };
      
      child.on('exit', () => {
          console.log(`[DEBUG] Tool ${toolId} exited`);
          delete runningTools[toolId];
      });
      
      // Wait a bit for the server to start
      await new Promise(r => setTimeout(r, 2000));
      return { url };
  });

  // Tools data IPC handlers
  ipcMain.handle('get-vault', async () => {
      try {
          const result = await uiWindow.webContents.executeJavaScript('localStorage.getItem("digenCharacters")');
          return result ? JSON.parse(result) : [];
      } catch (e) {
          return [];
      }
  });

  ipcMain.handle('get-api-keys', async () => {
      try {
          const result = await uiWindow.webContents.executeJavaScript('localStorage.getItem("digenApiKeys")');
          return result ? JSON.parse(result) : [];
      } catch (e) {
          return [];
      }
  });

  // ── YouTube Scraper ────────────────────────────────────────────────────────
  ipcMain.handle('youtube-search', async (_event, { query, mode, filters = {} }) => {
    const encoded = encodeURIComponent(query);
    const hl = filters.language === 'en' ? 'en' : filters.language === 'es' ? 'es' : 'pt-BR';

    // sp=EgIQAg%3D%3D → filter for Channels only
    const url = mode === 'canais'
      ? `https://www.youtube.com/results?search_query=${encoded}&sp=EgIQAg%3D%3D&hl=${hl}`
      : `https://www.youtube.com/results?search_query=${encoded}&hl=${hl}`;

    const selector = mode === 'canais' ? 'ytd-channel-renderer' : 'ytd-video-renderer';

    try {
      // Load the search page
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Page load timeout')), 30000);
        scraperView.webContents.once('did-finish-load', () => { clearTimeout(timeout); resolve(); });
        scraperView.webContents.loadURL(url);
      });

      // Dismiss cookie consent if present (EU)
      try {
        await scraperView.webContents.executeJavaScript(`
          (function(){
            const btn = document.querySelector('button[aria-label*="ccept"], button[aria-label*="ceitar"], form[action*="consent"] button[value="1"]');
            if(btn) btn.click();
          })()
        `);
        await new Promise(r => setTimeout(r, 800));
      } catch(_) {}

      // Poll until result elements appear (YouTube is a SPA)
      const maxWait = 15000;
      const pollStart = Date.now();
      let found = false;
      while (Date.now() - pollStart < maxWait) {
        const count = await scraperView.webContents.executeJavaScript(
          `document.querySelectorAll('${selector}').length`
        );
        if (count > 0) { found = true; break; }
        await new Promise(r => setTimeout(r, 600));
      }

      if (!found) return { success: false, error: 'Sem resultados ou página não carregou.', data: [] };

      // ── Extract channel data ────────────────────────────────────────────
      if (mode === 'canais') {
        const data = await scraperView.webContents.executeJavaScript(`
          (function(){
            return Array.from(document.querySelectorAll('ytd-channel-renderer')).slice(0,25).map(el => {
              const name =
                el.querySelector('#channel-title .yt-formatted-string')?.textContent?.trim() ||
                el.querySelector('#channel-title yt-formatted-string')?.textContent?.trim() ||
                el.querySelector('#text.ytd-channel-name')?.textContent?.trim() || '';
              const handle =
                el.querySelector('[id*="handle"]')?.textContent?.trim() ||
                el.querySelector('.ytd-channel-renderer #channel-handle')?.textContent?.trim() || '';
              const subs =
                el.querySelector('#subscribers')?.textContent?.trim() || '0';
              const videoCount =
                el.querySelector('#video-count')?.textContent?.trim() || '0';
              const description =
                el.querySelector('yt-attributed-string.ytd-channel-renderer')?.textContent?.trim() ||
                el.querySelector('#description-text')?.textContent?.trim() || '';
              const link = el.querySelector('a#main-link, a.channel-link, a[href*="/@"]');
              const url = link?.href || '';
              const avatarUrl =
                el.querySelector('yt-img-shadow img')?.src ||
                el.querySelector('#avatar img')?.src || '';
              return { name, handle, subs, videoCount, description, url, avatarUrl };
            }).filter(c => c.name);
          })()
        `);
        return { success: true, data };
      }

      // ── Extract video data ──────────────────────────────────────────────
      const data = await scraperView.webContents.executeJavaScript(`
        (function(){
          return Array.from(document.querySelectorAll('ytd-video-renderer')).slice(0,25).map(el => {
            const titleEl = el.querySelector('a#video-title, #video-title');
            const title = titleEl?.textContent?.trim() || '';
            const href = titleEl?.getAttribute('href') || '';
            const url = href.startsWith('http') ? href : ('https://www.youtube.com' + href);
            const channelEl = el.querySelector('#channel-name a');
            const channelName = channelEl?.textContent?.trim() || '';
            const channelUrl = channelEl?.href || '';
            const metas = el.querySelectorAll('#metadata-line span.inline-metadata-item');
            const viewCount = metas[0]?.textContent?.trim() || '0';
            const publishedAt = metas[1]?.textContent?.trim() || '';
            const durationEl =
              el.querySelector('ytd-thumbnail-overlay-time-status-renderer span#text') ||
              el.querySelector('.ytd-thumbnail-overlay-time-status-renderer span');
            const duration = durationEl?.textContent?.trim() || '';
            const imgEl = el.querySelector('#thumbnail img, yt-image img');
            const thumbnailUrl = imgEl?.src || imgEl?.getAttribute('data-src') || '';
            return { title, url, channelName, channelUrl, viewCount, publishedAt, duration, thumbnailUrl };
          }).filter(v => v.title);
        })()
      `);
      return { success: true, data };

    } catch (err) {
      console.error('[Scraper] Error:', err);
      return { success: false, error: err.message, data: [] };
    }
  });
  // ─────────────────────────────────────────────────────────────────────────
}

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killAllDevServers();
  if (process.platform !== 'darwin') app.quit();
});

// Also clean up if the process is killed directly
process.on('exit', killAllDevServers);
process.on('SIGINT', () => { killAllDevServers(); process.exit(0); });
process.on('SIGTERM', () => { killAllDevServers(); process.exit(0); });
