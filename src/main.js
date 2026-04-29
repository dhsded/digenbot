const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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
      fetch(`http://localhost:${port}`)
        .then(() => resolve())
        .catch(() => {
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
      backgroundThrottling: false,
      webSecurity: false  // Allow cross-origin images (YouTube CDN)
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
  // Date filter sp params for video search (protobuf-encoded YouTube filters)
  const VIDEO_DATE_SP = {
    'any':   '',
    'hour':  'EgIIAQ%3D%3D',
    'today': 'EgIIAg%3D%3D',
    'week':  'EgIIAw%3D%3D',
    'month': 'EgIIBA%3D%3D',
    'year':  'EgIIBQ%3D%3D',
  };

  ipcMain.handle('youtube-search', async (_event, { query, mode, filters = {} }) => {
    const encoded = encodeURIComponent(query);
    const hl = filters.hl || 'pt-BR';
    const gl = filters.gl || '';
    const maxResults = Math.min(filters.maxResults || 30, 200);

    // Build the sp (search params) filter
    let sp;
    if (mode === 'canais') {
      sp = 'EgIQAg%3D%3D'; // Channel type filter
    } else {
      sp = VIDEO_DATE_SP[filters.dateRange] || '';
    }

    const spParam = sp ? `&sp=${sp}` : '';
    const glParam = gl ? `&gl=${gl}` : '';
    const url = `https://www.youtube.com/results?search_query=${encoded}${spParam}&hl=${hl}${glParam}`;

    console.log(`[Scraper] Searching: ${url} (mode=${mode}, max=${maxResults})`);

    try {
      // Clear cookies to prevent YouTube from forcing the local IP's language/region
      await scraperView.webContents.session.clearStorageData({ storages: ['cookies'] });

      // Load the search page with explicit language headers
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Page load timeout')), 30000);
        scraperView.webContents.once('did-finish-load', () => { clearTimeout(timeout); resolve(); });
        scraperView.webContents.loadURL(url, {
          extraHeaders: `Accept-Language: ${hl}${gl ? '-' + gl : ''},${hl};q=0.9\n`
        });
      });

      // Dismiss cookie consent if present (EU/BR)
      try {
        await scraperView.webContents.executeJavaScript(`
          (function(){
            const btn = document.querySelector('button[aria-label*="ccept"], button[aria-label*="ceitar"], form[action*="consent"] button[value="1"]');
            if(btn) btn.click();
          })()
        `);
        await new Promise(r => setTimeout(r, 800));
      } catch(_) {}

      // Wait for YouTube SPA to hydrate and populate ytInitialData
      await new Promise(r => setTimeout(r, 2500));

      // ── Extract data from ytInitialData (JSON) ─────────────────────────
      if (mode === 'canais') {
        const rawResult = await scraperView.webContents.executeJavaScript(`
          (function(){
            try {
              const yt = window.ytInitialData;
              if (!yt) return { dbg: 'ytInitialData is null', items: [] };
              const sections = yt.contents?.twoColumnSearchResultsRenderer
                ?.primaryContents?.sectionListRenderer?.contents || [];
              if (!sections.length) return { dbg: 'no sections', items: [] };
              const results = [];
              for (const section of sections) {
                const sItems = section?.itemSectionRenderer?.contents || [];
                for (const item of sItems) {
                  const ch = item.channelRenderer;
                  if (!ch) continue;
                  const name = ch.title?.simpleText || '';
                  if (!name) continue;
                  const channelId = ch.channelId || '';
                  const canonicalUrl = ch.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || '';
                  const handle = canonicalUrl || ('@' + channelId);
                  const thumbs = ch.thumbnail?.thumbnails || [];
                  let avatarUrl = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : '';
                  if (avatarUrl.startsWith('//')) avatarUrl = 'https:' + avatarUrl;
                  if (avatarUrl.includes('=s')) avatarUrl = avatarUrl.replace(/=s[0-9]+-/, '=s176-');
                  const subs = ch.subscriberCountText?.simpleText || '0';
                  const videoCount = ch.videoCountText?.runs
                    ? ch.videoCountText.runs.map(function(r){return r.text}).join('')
                    : (ch.videoCountText?.simpleText || '0');
                  const description = ch.descriptionSnippet?.runs
                    ? ch.descriptionSnippet.runs.map(function(r){return r.text}).join('')
                    : '';
                  const urlPath = canonicalUrl
                    || ch.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
                    || '/channel/' + channelId;
                  const url = 'https://www.youtube.com' + urlPath;
                  results.push({ name: name, handle: handle, subs: subs, videoCount: videoCount, description: description, url: url, avatarUrl: avatarUrl });
                }
              }
              return { dbg: 'ok sections=' + sections.length, items: results };
            } catch(e) {
              return { dbg: 'err:' + e.message, items: [] };
            }
          })()
        `);

        const items = rawResult?.items || [];
        console.log('[Scraper] Channel debug:', rawResult?.dbg, '| found:', items.length);
        if (items.length === 0) {
          return { success: false, error: 'Nenhum canal encontrado. (' + (rawResult?.dbg || '?') + ')', data: [] };
        }

        if (items.length < maxResults) {
          console.log('[Scraper] Need more results (' + items.length + '/' + maxResults + '), starting deep scan...');
          if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Descendo a página para buscar mais canais (Meta: ${maxResults})...` });
          
          const knownUrls = new Set(items.map(i => i.url));
          let prevCount = 0;
          let unchangedCount = 0;
          let scrolls = 0;
          
          while (items.length < maxResults && unchangedCount < 5 && scrolls < 40) {
            scrolls++;
            if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Extraindo mais canais... (${items.length}/${maxResults}) - Rolagem ${scrolls}` });
            
            await scraperView.webContents.executeJavaScript('window.scrollTo(0, document.documentElement.scrollHeight)');
            await new Promise(r => setTimeout(r, 2500));
            
            const extraItems = await scraperView.webContents.executeJavaScript(`
              (function(){
                try {
                  return Array.from(document.querySelectorAll('ytd-channel-renderer')).map(function(el){
                    var name = (el.querySelector('#channel-title yt-formatted-string') || el.querySelector('#channel-title .yt-formatted-string'))?.textContent?.trim() || '';
                    if (!name) return null;
                    var link = el.querySelector('a#main-link, a.channel-link');
                    var url = link?.href || '';
                    var handle = el.querySelector('#channel-handle')?.textContent?.trim() || '';
                    var subs = el.querySelector('#subscribers')?.textContent?.trim() || '0';
                    var videoCount = el.querySelector('#video-count')?.textContent?.trim() || '0';
                    var desc = (el.querySelector('#description-text') || el.querySelector('yt-attributed-string'))?.textContent?.trim() || '';
                    var img = el.querySelector('yt-img-shadow img, #avatar img');
                    var avatarUrl = img?.src || '';
                    if (avatarUrl.startsWith('//')) avatarUrl = 'https:' + avatarUrl;
                    return { name: name, handle: handle, subs: subs, videoCount: videoCount, description: desc, url: url, avatarUrl: avatarUrl };
                  }).filter(function(c){ return c !== null; });
                } catch(e) { return []; }
              })()
            `);
            
            let addedThisScroll = 0;
            for (const extra of extraItems) {
              if (extra.url && !knownUrls.has(extra.url) && items.length < maxResults) {
                knownUrls.add(extra.url);
                items.push(extra);
                addedThisScroll++;
              }
            }
            
            if (addedThisScroll === 0) unchangedCount++;
            else unchangedCount = 0;
            
            console.log(`[Scraper] Deep scan: scroll ${scrolls}, total items: ${items.length}`);
          }
        }

        if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Extração concluída: ${Math.min(items.length, maxResults)} canais encontrados.` });
        return { success: true, data: items.slice(0, maxResults) };
      }

      // ── Videos mode ──────────────────────────────────────────────────────
      const rawResult = await scraperView.webContents.executeJavaScript(`
        (function(){
          try {
            const yt = window.ytInitialData;
            if (!yt) return { dbg: 'ytInitialData is null', items: [] };
            const sections = yt.contents?.twoColumnSearchResultsRenderer
              ?.primaryContents?.sectionListRenderer?.contents || [];
            if (!sections.length) return { dbg: 'no sections', items: [] };
            const results = [];
            for (const section of sections) {
              const sItems = section?.itemSectionRenderer?.contents || [];
              for (const item of sItems) {
                const v = item.videoRenderer;
                if (!v) continue;
                const title = v.title?.runs ? v.title.runs.map(function(r){return r.text}).join('') : '';
                if (!title) continue;
                const videoId = v.videoId || '';
                const url = 'https://www.youtube.com/watch?v=' + videoId;
                const thumbnailUrl = videoId ? 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg' : '';
                const channelName = v.ownerText?.runs?.[0]?.text || '';
                const channelUrlPath = v.ownerText?.runs?.[0]?.navigationEndpoint
                  ?.browseEndpoint?.canonicalBaseUrl || '';
                const channelUrl = channelUrlPath ? 'https://www.youtube.com' + channelUrlPath : '';
                const chThumbs = v.channelThumbnailSupportedRenderers
                  ?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails || [];
                let channelAvatarUrl = chThumbs.length > 0 ? chThumbs[chThumbs.length - 1].url : '';
                if (channelAvatarUrl.startsWith('//')) channelAvatarUrl = 'https:' + channelAvatarUrl;
                const viewCount = v.viewCountText?.simpleText
                  || (v.viewCountText?.runs ? v.viewCountText.runs.map(function(r){return r.text}).join('') : '0');
                const publishedAt = v.publishedTimeText?.simpleText || '';
                const duration = v.lengthText?.simpleText || '';
                results.push({ title: title, url: url, thumbnailUrl: thumbnailUrl, channelName: channelName,
                  channelUrl: channelUrl, channelAvatarUrl: channelAvatarUrl, viewCount: viewCount,
                  publishedAt: publishedAt, duration: duration });
              }
            }
            return { dbg: 'ok sections=' + sections.length, items: results };
          } catch(e) {
            return { dbg: 'err:' + e.message, items: [] };
          }
        })()
      `);

      const videoItems = rawResult?.items || [];
      console.log('[Scraper] Video debug:', rawResult?.dbg, '| found:', videoItems.length);
      if (videoItems.length === 0) {
        return { success: false, error: 'Nenhum vídeo encontrado. (' + (rawResult?.dbg || '?') + ')', data: [] };
      }

      // If we need more, scroll and extract from DOM
      if (videoItems.length < maxResults) {
        console.log('[Scraper] Need more videos (' + videoItems.length + '/' + maxResults + '), starting deep scan...');
        if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Descendo a página para buscar mais vídeos (Meta: ${maxResults})...` });
        
        const knownUrls = new Set(videoItems.map(i => i.url));
        let unchangedCount = 0;
        let scrolls = 0;
        
        while (videoItems.length < maxResults && unchangedCount < 5 && scrolls < 40) {
          scrolls++;
          if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Extraindo mais vídeos... (${videoItems.length}/${maxResults}) - Rolagem ${scrolls}` });
          
          await scraperView.webContents.executeJavaScript('window.scrollTo(0, document.documentElement.scrollHeight)');
          await new Promise(r => setTimeout(r, 2500));
          
          const extraVids = await scraperView.webContents.executeJavaScript(`
            (function(){
              try {
                return Array.from(document.querySelectorAll('ytd-video-renderer')).map(function(el){
                  var titleEl = el.querySelector('a#video-title, #video-title');
                  var title = titleEl?.textContent?.trim() || '';
                  if (!title) return null;
                  var href = titleEl?.getAttribute('href') || '';
                  var url = href.startsWith('http') ? href : 'https://www.youtube.com' + href;
                  var videoId = href.includes('v=') ? href.split('v=')[1]?.split('&')[0] : '';
                  var thumbnailUrl = videoId ? 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg' : '';
                  var chEl = el.querySelector('#channel-name a');
                  var channelName = chEl?.textContent?.trim() || '';
                  var channelUrl = chEl?.href || '';
                  var metas = el.querySelectorAll('#metadata-line span.inline-metadata-item');
                  var viewCount = metas[0]?.textContent?.trim() || '0';
                  var publishedAt = metas[1]?.textContent?.trim() || '';
                  var durEl = el.querySelector('ytd-thumbnail-overlay-time-status-renderer span#text');
                  var duration = durEl?.textContent?.trim() || '';
                  return { title:title, url:url, thumbnailUrl:thumbnailUrl, channelName:channelName,
                    channelUrl:channelUrl, channelAvatarUrl:'', viewCount:viewCount,
                    publishedAt:publishedAt, duration:duration };
                }).filter(function(v){ return v !== null; });
              } catch(e) { return []; }
            })()
          `);
          
          let addedThisScroll = 0;
          for (const extra of extraVids) {
            if (extra.url && !knownUrls.has(extra.url) && videoItems.length < maxResults) {
              knownUrls.add(extra.url);
              videoItems.push(extra);
              addedThisScroll++;
            }
          }
          
          if (addedThisScroll === 0) unchangedCount++;
          else unchangedCount = 0;
          
          console.log(`[Scraper] Deep scan: scroll ${scrolls}, total videos: ${videoItems.length}`);
        }
      }

      if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Extração concluída: ${Math.min(videoItems.length, maxResults)} vídeos encontrados.` });
      return { success: true, data: videoItems.slice(0, maxResults) };

    } catch (err) {
      console.error('[Scraper] Error:', err);
      return { success: false, error: err.message, data: [] };
    }
  });

  ipcMain.handle('espiao-save-report', async (_event, { csvContent, defaultName }) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(uiWindow, {
        title: 'Salvar Relatório',
        defaultPath: defaultName || 'Relatorio_Espiao.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      fs.writeFileSync(filePath, csvContent, 'utf8');
      return { success: true, filePath };
    } catch (e) {
      console.error('[Espiao] Save report error:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('espiao-get-keywords', async (_event, query) => {
    try {
      console.log(`[Scraper] Fetching keywords for: ${query}`);
      // Base API URL for YouTube autocomplete
      const buildUrl = (q) => `http://suggestqueries.google.com/complete/search?client=chrome&ds=yt&ie=utf-8&oe=utf-8&q=${encodeURIComponent(q)}`;

      const allKeywords = new Set();
      
      // 1. Exact query
      const exactResults = await fetchJson(buildUrl(query));
      exactResults.forEach(k => allKeywords.add(k));

      // 2. Alphabet variations for deep long-tail discovery
      const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
      const promises = alphabet.map(letter => fetchJson(buildUrl(`${query} ${letter}`)));
      const results = await Promise.all(promises);
      
      results.forEach(list => list.forEach(k => allKeywords.add(k)));

      const keywords = Array.from(allKeywords).filter(k => k.length > 0);
      console.log(`[Scraper] Keyword discovery found ${keywords.length} terms`);
      return { success: true, data: keywords };
    } catch (e) {
      console.error('[Espiao] Keyword discovery error:', e);
      return { success: false, error: e.message };
    }
  });
  let isTrendScanning = false;

  const fetchJson = async (url) => {
    try {
      const res = await fetch(url);
      const data = await res.json();
      return data[1] || [];
    } catch(e) {
      return [];
    }
  };

  // ── ESPIAO METRICS WORKER ───────────────────────────────────────────────
  global.trendMetricsQueue = [];
  global.isMetricsWorkerRunning = false;

  const processMetricsQueue = async (event, uiWindow, hl, gl) => {
    if (global.isMetricsWorkerRunning) return;
    global.isMetricsWorkerRunning = true;

    while (global.trendMetricsQueue.length > 0 && isTrendScanning) {
      const kw = global.trendMetricsQueue.shift();
      
      const metricMsg = `Deep Scan: "${kw}" (${global.trendMetricsQueue.length} na fila)...`;
      if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO_METRICS', message: metricMsg });
      
      const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(kw)}&sp=CAMSBAgFEAE%253D&hl=${hl}${gl ? '&gl='+gl : ''}`;
      
      try {
        const res = await fetch(ytUrl, { 
          headers: { 
            'Accept-Language': `${hl}${gl ? '-' + gl : ''},${hl};q=0.9`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          } 
        });
        const html = await res.text();
        const match = html.match(/var ytInitialData = (\{.*?\});/);
        let items = [];
        if (match && match[1]) {
          const data = JSON.parse(match[1]);
          const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          const videoItems = [];
          for (const section of contents) {
            if (section.itemSectionRenderer && section.itemSectionRenderer.contents) {
              for (const item of section.itemSectionRenderer.contents) {
                if (item.videoRenderer) {
                  videoItems.push(item.videoRenderer);
                }
              }
            }
          }
          
          const topVideos = videoItems.slice(0, 60);
          for (const v of topVideos) {
             const viewCount = v.viewCountText ? v.viewCountText.simpleText || v.viewCountText.runs?.[0]?.text : '';
             const publishedAt = v.publishedTimeText ? v.publishedTimeText.simpleText || v.publishedTimeText.runs?.[0]?.text : '';
             if (viewCount && publishedAt) {
               items.push({ viewCount, publishedAt });
             }
          }
        }
        event.sender.send('trend-keyword-metric', { keyword: kw, topVideos: items });
      } catch(e) {
        event.sender.send('trend-keyword-metric', { keyword: kw, topVideos: [] });
      }
      
      await new Promise(r => setTimeout(r, 600));
    }
    global.isMetricsWorkerRunning = false;
  };

  // ── ESPIAO: TREND SCANS ──────────────────────────────────────────────────

  ipcMain.on('stop-trend-scan', () => {
    isTrendScanning = false;
  });

  ipcMain.on('start-trend-scan', async (event, filters = {}) => {
    isTrendScanning = true;
    const hl = filters.hl || 'pt-BR';
    const gl = filters.gl || '';
    const dateSp = VIDEO_DATE_SP[filters.dateRange] || '';
    const spParam = dateSp ? `&sp=${dateSp}` : '';
    
    // Alphabet Generator (A-Z, AA-ZZ)
    function* alphabetGenerator() {
      const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
      let length = 1;
      while (true) {
        if (length === 1) {
          for (const l of letters) yield l;
        } else if (length === 2) {
          for (const l1 of letters) {
            for (const l2 of letters) {
              yield l1 + l2;
            }
          }
        } else {
          break; // Stop after 702 combinations
        }
        length++;
      }
    }

    const generator = alphabetGenerator();
    const seenKeywords = new Set();
    
    console.log(`[Scraper] Starting Alphabet Trend Scan (hl=${hl}, gl=${gl})`);
    
    // Clear cookies for pure regional results
    try { await scraperView.webContents.session.clearStorageData({ storages: ['cookies'] }); } catch(e) {}

    try {
      while (isTrendScanning) {
        const next = generator.next();
        if (next.done) break;
        const currentPrefix = next.value;
        
        const statusMsg = `Buscando tendências com a letra '${currentPrefix.toUpperCase()}'...`;
        event.sender.send('trend-status', statusMsg);
        if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: statusMsg });
        
        // 1. Fetch autocomplete suggestions for current prefix
        const fetchUrl = `https://suggestqueries.google.com/complete/search?client=chrome&ds=yt&q=${encodeURIComponent(currentPrefix)}&hl=${hl}&gl=${gl}&ie=utf-8&oe=utf-8`;
        const suggestions = await fetchJson(fetchUrl);
        
        const newKeywords = [];
        for (const kw of suggestions) {
          if (!seenKeywords.has(kw) && kw.length > 0) {
            seenKeywords.add(kw);
            newKeywords.push(kw);
          }
        }

        if (newKeywords.length > 0) {
          // Send keywords to UI immediately so they populate the grid
          event.sender.send('trend-keyword-found', newKeywords);
          
          // Push to background queue and start worker
          global.trendMetricsQueue.push(...newKeywords);
          processMetricsQueue(event, uiWindow, hl, gl);
        }
      }
      
      if (!isTrendScanning) {
        event.sender.send('trend-status', `Varredura pausada.`);
        if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: 'Varredura Global pausada.' });
      } else {
        event.sender.send('trend-status', `Varredura concluída (Z alcançado).`);
        if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: 'Varredura Global concluída.' });
      }
    } catch(e) {
      console.error(`[Scraper] Trend Scan error: ${e.message}`);
      event.sender.send('trend-status', `Erro na varredura: ${e.message}`);
      if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Erro na varredura: ${e.message}` });
    }
  });

  // ── ESPIAO: SUBNICHE SCAN (OCEANO AZUL) ──────────────────────────────────
  ipcMain.on('start-subniche-scan', async (event, { query, filters = {} }) => {
    isTrendScanning = true;
    const hl = filters.hl || 'pt-BR';
    const gl = filters.gl || '';
    
    
    event.sender.send('trend-status', `Buscando vídeos de referência para "${query}"...`);
    if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Buscando vídeos raiz para "${query}"...` });
    
    try {
      // 1. Buscamos vídeos relevantes (This Year, sorted by relevance or view count)
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgQIBRAB&hl=${hl}${gl ? '&gl='+gl : ''}`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'Accept-Language': `${hl}${gl ? '-' + gl : ''},${hl};q=0.9`, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const html = await searchRes.text();
      const match = html.match(/var ytInitialData = (\{.*?\});/);
      let videoIds = [];
      if (match && match[1]) {
        const data = JSON.parse(match[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
        for (const section of contents) {
          if (section.itemSectionRenderer && section.itemSectionRenderer.contents) {
            for (const item of section.itemSectionRenderer.contents) {
              if (item.videoRenderer && item.videoRenderer.videoId) {
                videoIds.push(item.videoRenderer.videoId);
              }
            }
          }
        }
      }
      
      const topIds = videoIds.slice(0, 30);
      event.sender.send('trend-status', `Raspando tags de ${topIds.length} vídeos... (pode demorar 10-15s)`);
      if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Extraindo tags de ${topIds.length} vídeos...` });
      
      const subnichesCount = {};
      const queryLower = query.toLowerCase();
      
      // 2. Acessa a página de cada vídeo em paralelo (batch de 10)
      const batchSize = 10;
      for (let i = 0; i < topIds.length; i += batchSize) {
        if (!isTrendScanning) break;
        const batch = topIds.slice(i, i + batchSize);
        await Promise.all(batch.map(async (vid) => {
          try {
            const url = `https://www.youtube.com/watch?v=${vid}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': hl } });
            const vHtml = await res.text();
            const tagMatch = vHtml.match(/<meta name="keywords" content="(.*?)">/);
            if (tagMatch && tagMatch[1]) {
              const tags = tagMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 2);
              for (const tag of tags) {
                if (tag === queryLower || tag.includes('youtube') || tag.includes('video')) continue;
                subnichesCount[tag] = (subnichesCount[tag] || 0) + 1;
              }
            }
          } catch(err) {}
        }));
      }
      
      if (!isTrendScanning) return;
      
      // 3. Ordena os subnichos mais frequentes
      const sortedSubniches = Object.entries(subnichesCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(entry => entry[0]);
        
      if (sortedSubniches.length > 0) {
        // Envia para o UI (O UI já tem o IPC para renderizar)
        event.sender.send('trend-keyword-found', sortedSubniches);
        
        // Empurra pra fila de métricas 30/60/90/365 e inicia
        global.trendMetricsQueue.push(...sortedSubniches);
        processMetricsQueue(event, uiWindow, hl, gl);
        
        event.sender.send('trend-status', `Oceano Azul encontrado! Explorando ${sortedSubniches.length} subnichos.`);
        if (uiWindow) uiWindow.webContents.send('ui-status-update', { id: 'ESPIAO', message: `Oceano Azul concluído.` });
      } else {
        event.sender.send('trend-status', `Nenhum subnicho relevante encontrado.`);
      }
      
    } catch(e) {
      console.error(`[Scraper] Subniche Scan error: ${e.message}`);
      event.sender.send('trend-status', `Erro na varredura de subnichos: ${e.message}`);
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
