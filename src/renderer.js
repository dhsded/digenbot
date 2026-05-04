// === Theme Logic ===
let currentTheme = localStorage.getItem('digenTheme') || 'dark';

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        const btn = document.getElementById('themeToggleBtn');
        if(btn) btn.innerHTML = '<span class="tab-icon">🌗</span> <span class="tab-text">Tema Escuro</span>';
    } else {
        document.documentElement.removeAttribute('data-theme');
        const btn = document.getElementById('themeToggleBtn');
        if(btn) btn.innerHTML = '<span class="tab-icon">☀️</span> <span class="tab-text">Tema Claro</span>';
    }
}

// Inicializa imediatamente
applyTheme(currentTheme);

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('digenTheme', currentTheme);
            applyTheme(currentTheme);
            if (window.api && window.api.broadcastTheme) {
                window.api.broadcastTheme(currentTheme);
            }
        });
    }

    const toggleLogBtn = document.getElementById('toggleLogBtn');
    let logVisible = true;
    if (toggleLogBtn) {
        toggleLogBtn.addEventListener('click', () => {
            logVisible = !logVisible;
            document.getElementById('globalFooterLogContainer').style.display = logVisible ? 'flex' : 'none';
            toggleLogBtn.innerHTML = logVisible ? '<span class="tab-icon">📝</span> <span class="tab-text">Ocultar Log</span>' : '<span class="tab-icon">📝</span> <span class="tab-text">Mostrar Log</span>';
            if (window.api && window.api.toggleFooter) {
                window.api.toggleFooter(logVisible);
            }
        });
    }

    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const newWidth = sidebar.classList.contains('collapsed') ? 60 : 250;
            if (window.api && window.api.updateBounds) {
                window.api.updateBounds(newWidth);
            }
            const controls = document.getElementById('browserControls');
            if (controls && controls.style.display !== 'none') {
                controls.style.left = newWidth + 'px';
            }
        });
    }


});

const getSidebarWidth = () => {
    const sidebar = document.getElementById('sidebar');
    return sidebar && sidebar.classList.contains('collapsed') ? 60 : 250;
};

function updateBrowserControls(tabId) {
    const controls = document.getElementById('browserControls');
    if (controls) {
        const isExternal = ['digen', 'flow', 'meta', 'grok'].includes(tabId);
        if (isExternal) {
            controls.style.display = 'flex';
            controls.style.left = getSidebarWidth() + 'px';
        } else {
            controls.style.display = 'none';
        }
    }
}

// Browser Controls listeners
document.addEventListener('DOMContentLoaded', () => {
    const btnBack = document.getElementById('btnBrowserBack');
    const btnForward = document.getElementById('btnBrowserForward');
    const btnReload = document.getElementById('btnBrowserReload');
    const btnHome = document.getElementById('btnBrowserHome');

    if (btnBack) btnBack.addEventListener('click', () => { if (window.api && window.api.browserCommand) window.api.browserCommand('back'); });
    if (btnForward) btnForward.addEventListener('click', () => { if (window.api && window.api.browserCommand) window.api.browserCommand('forward'); });
    if (btnReload) btnReload.addEventListener('click', () => { if (window.api && window.api.browserCommand) window.api.browserCommand('reload'); });
    if (btnHome) btnHome.addEventListener('click', () => { if (window.api && window.api.browserCommand) window.api.browserCommand('home'); });
});

let taskCounter = 0;
// === Tab Navigation ===
const tabPanelBtn = document.getElementById('tabPanel');
const tabGeradoresBtn = document.getElementById('tabGeradores');
const tabCharactersBtn = document.getElementById('tabCharacters');
const tabVideoEditorBtn = document.getElementById('tabVideoEditor');
const panelArea = document.getElementById('panelArea');
const characterArea = document.getElementById('characterArea');
const geradoresArea = document.getElementById('geradoresArea');

const cardDigen = document.getElementById('cardDigen');
const cardFlow = document.getElementById('cardFlow');
const cardMeta = document.getElementById('cardMeta');

const tabStudioBtn = document.getElementById('tabStudio');
const tabSettingsBtn = document.getElementById('tabSettings');
const studioArea = document.getElementById('studioArea');
const settingsArea = document.getElementById('settingsArea');

function resetTabs() {
    if (tabPanelBtn) tabPanelBtn.classList.remove('active');
    if (tabGeradoresBtn) tabGeradoresBtn.classList.remove('active');
    if (tabCharactersBtn) tabCharactersBtn.classList.remove('active');
    if (tabVideoEditorBtn) tabVideoEditorBtn.classList.remove('active');
    if (tabStudioBtn) tabStudioBtn.classList.remove('active');
    if (tabSettingsBtn) tabSettingsBtn.classList.remove('active');
    if (typeof tabEspiaoBtn !== 'undefined' && tabEspiaoBtn) tabEspiaoBtn.classList.remove('active');
    
    if (panelArea) panelArea.classList.add('hidden');
    if (characterArea) characterArea.classList.add('hidden');
    if (geradoresArea) geradoresArea.classList.add('hidden');
    if (studioArea) studioArea.classList.add('hidden');
    if (settingsArea) settingsArea.classList.add('hidden');
}

if (tabPanelBtn) {
    tabPanelBtn.addEventListener('click', () => {
        resetTabs();
        tabPanelBtn.classList.add('active');
        panelArea.classList.remove('hidden');
        updateBrowserControls('panel');
        window.api.switchTab('panel', getSidebarWidth());
    });
}

if (tabGeradoresBtn) {
    tabGeradoresBtn.addEventListener('click', () => {
        resetTabs();
        tabGeradoresBtn.classList.add('active');
        geradoresArea.classList.remove('hidden');
        updateBrowserControls('panel');
        window.api.switchTab('panel', getSidebarWidth());
    });
}

if (cardDigen) {
    cardDigen.addEventListener('click', () => {
        resetTabs();
        if (tabGeradoresBtn) tabGeradoresBtn.classList.add('active');
        updateBrowserControls('digen');
        window.api.switchTab('digen', getSidebarWidth());
    });
}

if (cardFlow) {
    cardFlow.addEventListener('click', () => {
        resetTabs();
        if (tabGeradoresBtn) tabGeradoresBtn.classList.add('active');
        updateBrowserControls('flow');
        window.api.switchTab('flow', getSidebarWidth());
    });
}

if (cardMeta) {
    cardMeta.addEventListener('click', () => {
        resetTabs();
        if (tabGeradoresBtn) tabGeradoresBtn.classList.add('active');
        updateBrowserControls('meta');
        window.api.switchTab('meta', getSidebarWidth());
    });
}

if (tabCharactersBtn) {
    tabCharactersBtn.addEventListener('click', () => {
        resetTabs();
        tabCharactersBtn.classList.add('active');
        characterArea.classList.remove('hidden');
        updateBrowserControls('panel');
        window.api.switchTab('panel', getSidebarWidth());
    });
}

if (tabVideoEditorBtn) {
    tabVideoEditorBtn.addEventListener('click', () => {
        resetTabs();
        tabVideoEditorBtn.classList.add('active');
        updateBrowserControls('video_editor');
        window.api.switchTab('video_editor', getSidebarWidth());
    });
}

const tabEspiaoBtn = document.getElementById('tabEspiao');
if (tabEspiaoBtn) {
    tabEspiaoBtn.addEventListener('click', () => {
        resetTabs();
        tabEspiaoBtn.classList.add('active');
        updateBrowserControls('espiao');
        window.api.switchTab('espiao', getSidebarWidth());
    });
}

if (tabStudioBtn) {
    tabStudioBtn.addEventListener('click', () => {
        resetTabs();
        tabStudioBtn.classList.add('active');
        studioArea.classList.remove('hidden');
        window.api.switchTab('panel', getSidebarWidth());
        loadStudioTools();
    });
}

if (tabSettingsBtn) {
    tabSettingsBtn.addEventListener('click', () => {
        resetTabs();
        tabSettingsBtn.classList.add('active');
        settingsArea.classList.remove('hidden');
        window.api.switchTab('panel', getSidebarWidth());
    });
}

async function loadStudioTools() {
    const studioGrid = document.getElementById('studioGrid');
    if (!studioGrid) return;
    studioGrid.innerHTML = '';
    
    if (window.api && window.api.getTools) {
        const tools = await window.api.getTools();
        if (tools.length === 0) {
            studioGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">Nenhuma ferramenta encontrada na pasta Ferramentas.</p>';
            return;
        }
        
        tools.forEach(tool => {
            const card = document.createElement('div');
            card.className = 'generator-card';
            card.innerHTML = `
                <div class="card-icon">${tool.icon || '🛠️'}</div>
                <div class="card-title">${tool.name || tool.id}</div>
                <div class="card-desc">${tool.description || ''}</div>
            `;
            card.addEventListener('click', async () => {
                const originalText = card.innerHTML;
                card.innerHTML = `<div class="card-icon">⏳</div><div class="card-title">Iniciando...</div>`;
                
                try {
                    const result = await window.api.startTool(tool.id);
                    if (result.url) {
                        resetTabs();
                        if (tabStudioBtn) tabStudioBtn.classList.add('active');
                        updateBrowserControls('tool');
                        window.api.openToolView(result.url, getSidebarWidth());
                    } else {
                        alert('Erro ao iniciar a ferramenta: ' + (result.error || 'Desconhecido'));
                    }
                } catch (e) {
                    alert('Erro de IPC: ' + e.message);
                }
                
                card.innerHTML = originalText;
            });
            studioGrid.appendChild(card);
        });
    }
}

// Settings Persistence - Global API Keys (List)
const geminiApiKeyFile = document.getElementById('geminiApiKeyFile');
const apiKeyCountDisplay = document.getElementById('apiKeyCountDisplay');
const clearApiKeysBtn = document.getElementById('clearApiKeysBtn');

function updateApiKeysDisplay() {
    if (!apiKeyCountDisplay) return;
    const keys = JSON.parse(localStorage.getItem('digenApiKeys') || '[]');
    apiKeyCountDisplay.innerText = `${keys.length} chaves carregadas`;
    if (clearApiKeysBtn) {
        clearApiKeysBtn.style.display = keys.length > 0 ? 'inline-block' : 'none';
    }
}

if (geminiApiKeyFile) {
    geminiApiKeyFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            const keys = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            if (keys.length > 0) {
                localStorage.setItem('digenApiKeys', JSON.stringify(keys));
                updateApiKeysDisplay();
                alert(`${keys.length} chaves importadas com sucesso!`);
            } else {
                alert('Nenhuma chave encontrada no arquivo.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

if (clearApiKeysBtn) {
    clearApiKeysBtn.addEventListener('click', () => {
        if(confirm('Tem certeza que deseja limpar todas as chaves?')) {
            localStorage.setItem('digenApiKeys', JSON.stringify([]));
            updateApiKeysDisplay();
        }
    });
}

const saveSettingsBtn = document.getElementById('saveSettingsBtn');
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        const originalText = saveSettingsBtn.innerText;
        saveSettingsBtn.innerText = '✅ Configurações Salvas!';
        setTimeout(() => {
            saveSettingsBtn.innerText = originalText;
        }, 2000);
    });
}

document.addEventListener('DOMContentLoaded', updateApiKeysDisplay);


// === Digen Conditional Architecture ===
const digenModels = {
   'rm_3.1': { name: 'Real Motion 3.1', times: ['5s', '8s', '10s'], resolutions: ['720P', '1080P'] },
   'rm_3.1_turbo': { name: 'Real Motion 3.1 Turbo', times: ['5s'], resolutions: ['480P'] },
   'rm_2.6_pro': { name: 'Real Motion 2.6 Pro', times: ['5s'], resolutions: ['2K 25FPS'] },
   'rm_2.6_remix': { name: 'Real Motion 2.6 Remix', times: ['5s', '10s'], resolutions: ['1080P'] },
   'runway_4.5': { name: 'Runway 4.5', times: ['5s', '8s', '10s'], resolutions: ['720P'] },
   'grok_video': { name: 'Grok Video', times: ['5s', '10s'], resolutions: ['480P', '1080P'] },
   'veo_3.1': { name: 'Google Veo 3.1 Fast', times: ['8s'], resolutions: ['720P'] }
};

function initDigenReactivity() {
    const platformRadios = document.querySelectorAll('input[name="genPlatform"]');
    const modeRadios = document.querySelectorAll('input[name="genMode"]');
    const imgSourceRadios = document.querySelectorAll('input[name="imgSource"]');
    
    const digenOptionsArea = document.getElementById('digenOptionsArea');
    const modelSelect = document.getElementById('digenModelSelect');
    const vaultPanel = document.getElementById('vaultPanel');
    const localPanel = document.getElementById('localPanel');
    
    function updateVisibility() {
        const p = document.querySelector('input[name="genPlatform"]:checked').value;
        const m = document.querySelector('input[name="genMode"]:checked').value;
        const metaOptionsArea = document.getElementById('metaOptionsArea');
        if (p === 'digen') {
            digenOptionsArea.style.display = 'block';
            const vidGroup = document.getElementById('digenVideoSettingsGroup');
            if (m === 'video') {
                if (vidGroup) vidGroup.style.display = 'block';
                renderDigenOptions();
            } else {
                if (vidGroup) vidGroup.style.display = 'none';
            }
        } else {
            digenOptionsArea.style.display = 'none';
        }
        
        if (p === 'meta') {
            if (metaOptionsArea) metaOptionsArea.style.display = 'block';
        } else {
            if (metaOptionsArea) metaOptionsArea.style.display = 'none';
        }
        
        const flowOptionsArea = document.getElementById('flowOptionsArea');
        if (p === 'flow') {
            if (flowOptionsArea) flowOptionsArea.style.display = 'block';
        } else {
            if (flowOptionsArea) flowOptionsArea.style.display = 'none';
        }
        
        // Esconder opções de imagem base se for Meta AI + Imagem
        const imgSourceTitle = document.getElementById('imgSourceTitle'); // Vamos precisar adicionar ID nisso depois se quisermos, mas o painel basta
        const imgSourceSelector = document.getElementById('imgSourceSelector');
        
        if (p === 'meta' && m === 'image') {
            if (imgSourceTitle) imgSourceTitle.style.display = 'none';
            if (imgSourceSelector) imgSourceSelector.style.display = 'none';
            vaultPanel.style.display = 'none';
            localPanel.style.display = 'none';
        } else {
            if (imgSourceTitle) imgSourceTitle.style.display = 'block';
            if (imgSourceSelector) imgSourceSelector.style.display = 'flex';
            // Re-aplicar visibilidade base
            const imgSourceMode = document.querySelector('input[name="imgSource"]:checked').value;
             if (imgSourceMode === 'vault') {
                 vaultPanel.style.display = 'block';
                 localPanel.style.display = 'none';
             } else {
                 vaultPanel.style.display = 'none';
                 localPanel.style.display = 'block';
             }
        }
    }

    platformRadios.forEach(r => r.addEventListener('change', updateVisibility));
    modeRadios.forEach(r => r.addEventListener('change', updateVisibility));
    
    imgSourceRadios.forEach(r => r.addEventListener('change', () => {
        if (r.value === 'vault') {
            vaultPanel.style.display = 'block';
            localPanel.style.display = 'none';
        } else {
            vaultPanel.style.display = 'none';
            localPanel.style.display = 'block';
        }
    }));
    
    // Character Vault Preview Logic
    const characterSelect = document.getElementById('characterSelect');
    const vaultPreviewContainer = document.getElementById('vaultPreviewContainer');
    const vaultPreviewImage = document.getElementById('vaultPreviewImage');

    if (characterSelect && vaultPreviewContainer) {
        characterSelect.addEventListener('change', () => {
            const selectedCharId = characterSelect.value;
            if (!selectedCharId) {
                vaultPreviewContainer.style.display = 'none';
                return;
            }
            const chars = JSON.parse(localStorage.getItem('digenCharacters') || '[]');
            const charData = chars.find(c => c.id === selectedCharId);
            if (charData) {
                const images = charData.images || (charData.imageBase64 ? [charData.imageBase64] : []);
                if (images.length > 0) {
                    vaultPreviewImage.src = images[0];
                    vaultPreviewContainer.style.display = 'block';
                } else {
                    vaultPreviewContainer.style.display = 'none';
                }
            } else {
                vaultPreviewContainer.style.display = 'none';
            }
        });
    }

    if (modelSelect) {
        modelSelect.addEventListener('change', renderDigenOptions);
    }
}

function renderDigenOptions() {
    const modelKey = document.getElementById('digenModelSelect').value;
    const modelData = digenModels[modelKey];
    if (!modelData) return;
    
    const timeContainer = document.getElementById('digenTimeContainer');
    const resContainer = document.getElementById('digenResContainer');
    
    timeContainer.innerHTML = modelData.times.map((t, i) => `
        <label><input type="radio" name="digenTime" value="${t}" ${i===0?'checked':''}> ${t}</label>
    `).join('');
    
    resContainer.innerHTML = modelData.resolutions.map((r, i) => `
        <label><input type="radio" name="digenRes" value="${r}" ${i===0?'checked':''}> ${r}</label>
    `).join('');
}


// === Batch Implementation ===
let batchImages = [];
const batchInput = document.getElementById('batchInput');
if (batchInput) {
    batchInput.addEventListener('change', async (e) => {
        batchImages = [];
        const previewGrid = document.getElementById('batchPreviewGrid');
        previewGrid.innerHTML = '';
        
        const files = Array.from(e.target.files);
        // Sort files alphanumerically
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        
        for (const file of files) {
            const base64 = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.readAsDataURL(file);
            });
            
            batchImages.push({
                id: 'batch_' + Date.now() + Math.random(),
                name: file.name,
                imageBase64: base64
            });
            
            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.display = 'inline-block';
            
            const img = document.createElement('img');
            img.src = base64;
            img.className = 'batch-thumbnail';
            img.title = file.name;
            
            const btn = document.createElement('button');
            btn.innerHTML = '🔍';
            btn.style.position = 'absolute';
            btn.style.top = '4px';
            btn.style.right = '4px';
            btn.style.background = 'rgba(0,0,0,0.6)';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.borderRadius = '50%';
            btn.style.width = '20px';
            btn.style.height = '20px';
            btn.style.fontSize = '9px';
            btn.style.cursor = 'pointer';
            btn.style.zIndex = '10';
            btn.title = 'Dar Zoom';
            btn.onclick = () => { if(window.openGlobalImageViewer) window.openGlobalImageViewer(base64); };
            
            container.appendChild(img);
            container.appendChild(btn);
            previewGrid.appendChild(container);
        }
    });
}


// === File Upload Logic ===
document.getElementById('importTxtBtn').addEventListener('click', () => {
    document.getElementById('promptTextFile').click();
});

document.getElementById('promptTextFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const text = ev.target.result;
        const currentVal = document.getElementById('promptInput').value.trim();
        document.getElementById('promptInput').value = currentVal ? currentVal + '\n' + text : text;
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
});

// Configurar o botão de seleção de pasta (Meta AI)
document.addEventListener('DOMContentLoaded', () => {
    const setupFolderBtn = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', async () => {
                const folder = await window.api.selectFolder();
                if (folder) {
                    document.getElementById(inputId).value = folder;
                }
            });
        }
    };
    
    setupFolderBtn('metaSelectFolderBtn', 'metaBasePath');
    setupFolderBtn('digenSelectFolderBtn', 'digenBasePath');
    setupFolderBtn('flowSelectFolderBtn', 'flowBasePath');
});

// === Logic ===
document.getElementById('queueBtn').addEventListener('click', () => {
    const promptEl = document.getElementById('promptInput');
    const promptText = promptEl.value.trim();
    const prompts = promptText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    
    const mode = document.querySelector('input[name="genMode"]:checked').value;
    const platform = document.querySelector('input[name="genPlatform"]:checked').value;
    const imgSource = document.querySelector('input[name="imgSource"]:checked').value;
    
    let digenConfig = null;
    if (platform === 'digen') {
        const digenBasePathInput = document.getElementById('digenBasePath');
        const digenFolderNameInput = document.getElementById('digenFolderName');
        const digenAutoDownloadSwitch = document.getElementById('digenAutoDownloadToggle');
        
        let localDigenConfig = {
            autoDownload: digenAutoDownloadSwitch ? digenAutoDownloadSwitch.checked : true,
            basePath: digenBasePathInput ? digenBasePathInput.value.trim() : '',
            folderName: digenFolderNameInput ? digenFolderNameInput.value.trim() : ''
        };
        
        if (localDigenConfig.autoDownload && !localDigenConfig.basePath) {
            alert("Para Download Automático (Digen), por favor preencha o Caminho Base no Computador.");
            return;
        }
        
        if (mode === 'video') {
            const timeInput = document.querySelector('input[name="digenTime"]:checked');
            const resInput = document.querySelector('input[name="digenRes"]:checked');
            const enhanceSwitch = document.getElementById('enhancePromptToggle');
            
            digenConfig = {
                ...localDigenConfig,
                model: document.getElementById('digenModelSelect').value,
                modelName: digenModels[document.getElementById('digenModelSelect').value]?.name || '',
                time: timeInput ? timeInput.value : '',
                resolution: resInput ? resInput.value : '',
                enhancePrompt: enhanceSwitch ? enhanceSwitch.checked : false
            };
        } else {
            // Mode image for Digen
            digenConfig = { ...localDigenConfig };
        }
    }
    
    // Flow Config Fetch
    let flowConfig = null;
    if (platform === 'flow') {
        const flowBasePathInput = document.getElementById('flowBasePath');
        const flowFolderNameInput = document.getElementById('flowFolderName');
        const flowAutoDownloadSwitch = document.getElementById('flowAutoDownloadToggle');
        flowConfig = {
            autoDownload: flowAutoDownloadSwitch ? flowAutoDownloadSwitch.checked : true,
            basePath: flowBasePathInput ? flowBasePathInput.value.trim() : '',
            folderName: flowFolderNameInput ? flowFolderNameInput.value.trim() : ''
        };
        
        if (flowConfig.autoDownload && !flowConfig.basePath) {
            alert("Para Download Automático (Flow), por favor preencha o Caminho Base no Computador.");
            return;
        }
    }
    
    let metaConfig = null;
    if (platform === 'meta') {
        const autoDownloadSwitch = document.getElementById('metaAutoDownloadToggle');
        const countSelect = document.getElementById('metaDownloadCount');
        const basePathInput = document.getElementById('metaBasePath');
        const folderNameInput = document.getElementById('metaFolderName');
        
        metaConfig = {
            autoDownload: autoDownloadSwitch ? autoDownloadSwitch.checked : true,
            downloadCount: countSelect ? parseInt(countSelect.value, 10) : 4,
            basePath: basePathInput ? basePathInput.value.trim() : '',
            folderName: folderNameInput ? folderNameInput.value.trim() : ''
        };
        
        if (metaConfig.autoDownload && !metaConfig.basePath) {
            alert("Para Download Automático, por favor preencha o Caminho Base no Computador.");
            return;
        }
    }

    let itemsToProcess = [];
    
    if (imgSource === 'vault') {
        const charSelect = document.getElementById('characterSelect');
        const selectedCharId = charSelect ? charSelect.value : '';
        let charData = null;
        if (selectedCharId) {
             const chars = JSON.parse(localStorage.getItem('digenCharacters') || '[]');
             charData = chars.find(c => c.id === selectedCharId);
        }
        
        // Block if not image mode OR if platform is not meta, and there is no charData
        if (!charData && mode !== 'image' && platform !== 'meta') {
            alert('Por favor, selecione um personagem do cofre.');
            return;
        }
        
        const count = Math.max(1, prompts.length);
        for (let i = 0; i < count; i++) {
            itemsToProcess.push(charData);
        }
    } else {
        if (batchImages.length === 0) {
            alert("Nenhuma imagem selecionada no pacote de Lote!");
            return;
        }
        itemsToProcess = [...batchImages];
        
        // Modal Check
        if (itemsToProcess.length > prompts.length && prompts.length > 0) {
             const missingCount = itemsToProcess.length - prompts.length;
             document.getElementById('mismatchText').innerText = `Existem ${itemsToProcess.length} imagens no lote, mas apenas ${prompts.length} prompts informados. Faltam ${missingCount} prompts. O que deseja fazer?`;
             document.getElementById('mismatchModalOverlay').style.display = 'flex';
             
             window.pendingTaskState = { items: itemsToProcess, prompts, mode, platform, digenConfig, metaConfig };
             return;
        }
    }
    
    if (prompts.length === 0 && (!digenConfig || !digenConfig.enhancePrompt)) {
        alert("Insira pelo menos um prompt ou ative a IA Visual.");
        return;
    }

    buildAndFireTasks(itemsToProcess, prompts, mode, platform, digenConfig, metaConfig, flowConfig, false);
});

// Modal Actions
document.getElementById('mismatchCancelBtn').addEventListener('click', () => {
    document.getElementById('mismatchModalOverlay').style.display = 'none';
    window.pendingTaskState = null;
});

document.getElementById('mismatchAutoPromptBtn').addEventListener('click', () => {
    document.getElementById('mismatchModalOverlay').style.display = 'none';
    if (window.pendingTaskState) {
        const state = window.pendingTaskState;
        buildAndFireTasks(state.items, state.prompts, state.mode, state.platform, state.digenConfig, state.metaConfig, state.flowConfig, true);
        window.pendingTaskState = null;
    }
});

function buildAndFireTasks(imagesList, promptsList, mode, platform, baseConfig, metaConfig, flowConfig, autoPromptMissing) {
    for (let i = 0; i < imagesList.length; i++) {
        const charData = imagesList[i];
        let pText = promptsList[i];
        let taskConfig = baseConfig ? { ...baseConfig } : null;
        
        // Calcular o StartIndex do lote (para numerar imagens do Meta) se aplicavel
        let taskMetaConfig = metaConfig ? { ...metaConfig } : null;
        if (taskMetaConfig && taskMetaConfig.autoDownload) {
            taskMetaConfig.startIndex = (i * taskMetaConfig.downloadCount) + 1;
        }
        
        if (!pText) {
             if (autoPromptMissing && taskConfig) {
                 taskConfig.enhancePrompt = true;
             }
             pText = promptsList[promptsList.length - 1] || ''; // Fallback para o ultimo se não auto-prompt, ou vazio se ativado auto-prompt
             if (autoPromptMissing) pText = '';
        }
        
        const taskId = `task_${Date.now()}_${++taskCounter}`;
        
        const taskData = {
            id: taskId,
            prompt: pText,
            type: mode,
            platform: platform,
            status: 'queued',
            characterParam: charData,
            digenConfig: taskConfig
        };
        // Set specific task config based on platform
        if (platform === 'meta') {
            taskData.metaConfig = taskMetaConfig;
        } else if (platform === 'flow') {
            taskData.flowConfig = flowConfig;
        }

        addTaskToUI(taskData);
        window.api.queueTask(taskData);
    }

    // Auto-switch to destination platform
    if (platform === 'digen' && cardDigen) {
        cardDigen.click();
    } else if (platform === 'flow' && cardFlow) {
        cardFlow.click();
    } else if (platform === 'meta' && cardMeta) {
        cardMeta.click();
    }
}

// === Stop Execution ===
document.getElementById('stopBtn').addEventListener('click', () => {
    window.api.stopQueue();
    // Update local UI
    const queuedItems = document.querySelectorAll('.task-item');
    queuedItems.forEach(item => {
        if (!item.classList.contains('completed')) {
            item.className = 'task-item cancelled';
            item.style.borderColor = '#ff4d4f';
            
            const badgeId = item.id.replace('task_', 'badge_task_');
            const msgId = item.id.replace('task_', 'msg_task_');
            
            const badge = document.getElementById(badgeId);
            if (badge) {
                badge.className = 'status-badge';
                badge.style.background = '#ff4d4f';
                badge.innerText = 'X Cancelado';
            }
            
            const msg = document.getElementById(msgId);
            if (msg) msg.innerText = 'Execução interrompida.';
        }
    });
});

// === Clear Queue ===
document.getElementById('clearBtn').addEventListener('click', () => {
    const list = document.getElementById('taskList');
    list.innerHTML = '';
});

function addTaskToUI(task) {
    const list = document.getElementById('taskList');
    const div = document.createElement('div');
    div.id = task.id;
    div.className = 'task-item';
    
    let imageHtml = '';
    if (task.characterParam && task.characterParam.preview) {
        imageHtml = `<img src="${task.characterParam.preview}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; flex-shrink: 0; border: 1px solid var(--surface-border);">`;
    }

    div.innerHTML = `
        <div class="task-header">
            <span>ID: ${task.id.slice(-6)}</span>
            <span class="status-badge queued" id="badge_${task.id}">Aguardando</span>
        </div>
        <div style="display: flex; gap: 10px; align-items: flex-start; margin-top: 8px;">
            ${imageHtml}
            <div class="task-prompt" style="flex: 1; margin: 0;">${task.prompt}</div>
        </div>
        <div class="task-message" id="msg_${task.id}" style="font-size: 11px; color: #aaa; margin-top: 4px;">Na fila...</div>
    `;
    list.insertBefore(div, list.firstChild);
}

// Receive updates from Digen automation
window.api.onStatusUpdate((update) => {
    const item = document.getElementById(update.id);
    const globalFooterLog = document.getElementById('globalFooterLog');

    if (update.message) {
        if (globalFooterLog) {
            globalFooterLog.innerText = `[${update.id.slice(-6)}] ${update.message}`;
        }
    }

    if (!item) return;

    const badge = document.getElementById(`badge_${update.id}`);
    const msg = document.getElementById(`msg_${update.id}`);

    if (update.status) {
        item.className = `task-item ${update.status}`;
        badge.className = `status-badge ${update.status}`;
        
        if (update.status === 'running') badge.innerHTML = `<div class="loader"></div> Executando`;
        if (update.status === 'completed') badge.innerText = `Concluído`;
    }

    if (update.message) {
        msg.innerText = update.message;
    }
});

// === Character Vault Logic ===
function loadCharacters() {
    const chars = JSON.parse(localStorage.getItem('digenCharacters') || '[]');
    const grid = document.getElementById('characterGrid');
    const select = document.getElementById('characterSelect');
    
    if (!grid || !select) return;
    
    grid.innerHTML = '';
    select.innerHTML = '<option value="">Nenhum / Padrão</option>';
    
    chars.forEach(char => {
        // Migration and normalization check
        let normalizedImages = [];
        const oldImages = char.images || (char.imageBase64 ? [char.imageBase64] : []);
        
        oldImages.forEach(img => {
            if (typeof img === 'string') {
                normalizedImages.push({ type: 'digen', base64: img });
            } else if (img && img.base64) {
                normalizedImages.push(img);
            }
        });
        
        char.images = normalizedImages;
        if (char.images.length === 0) return;
        
        // Find a representative image (prefer digen/geral)
        const mainImageObj = char.images.find(i => i.type === 'digen') || char.images[0];
        const mainImage = mainImageObj.base64;

        // Count tags for badges
        const countMap = {};
        char.images.forEach(img => {
            countMap[img.type] = (countMap[img.type] || 0) + 1;
        });
        
        let badgesHtml = '';
        if (countMap['digen']) badgesHtml += `<span style="display:inline-block; margin:2px; padding:2px 4px; background:#4f46e5; color:white; border-radius:4px; font-size:9px;">Geral: ${countMap['digen']}</span>`;
        if (countMap['veo_element']) badgesHtml += `<span style="display:inline-block; margin:2px; padding:2px 4px; background:#0ea5e9; color:white; border-radius:4px; font-size:9px;">VEO Elem: ${countMap['veo_element']}</span>`;
        if (countMap['veo_initial']) badgesHtml += `<span style="display:inline-block; margin:2px; padding:2px 4px; background:#10b981; color:white; border-radius:4px; font-size:9px;">VEO Início: ${countMap['veo_initial']}</span>`;
        if (countMap['veo_final']) badgesHtml += `<span style="display:inline-block; margin:2px; padding:2px 4px; background:#ef4444; color:white; border-radius:4px; font-size:9px;">VEO Fim: ${countMap['veo_final']}</span>`;

        // Add to grid
        const div = document.createElement('div');
        div.className = 'char-card';
        div.innerHTML = `
            <div style="position: relative;">
                <img src="${mainImage}" alt="${char.name}">
                <button onclick="if(window.openGlobalImageViewer) window.openGlobalImageViewer('${mainImage}')" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 10px; cursor: pointer; z-index: 10;" title="Dar Zoom">🔍</button>
            </div>
            <div class="char-name" title="${char.name}">${char.name}</div>
            <div class="badges-container" style="margin-top: 4px; line-height: 1.2;">${badgesHtml}</div>
            <button class="btn-delete-char" onclick="deleteCharacter('${char.id}')">Excluir Base</button>
        `;
        grid.appendChild(div);
        
        // Add to select
        const opt = document.createElement('option');
        opt.value = char.id;
        opt.innerText = char.name;
        select.appendChild(opt);
    });
}

const saveCharBtn = document.getElementById('saveCharBtn');
if (saveCharBtn) {
    saveCharBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('charName');
        const fileInput = document.getElementById('charImage');
        const typeSelect = document.getElementById('charImageType');
        
        if (!nameInput.value.trim() || !fileInput.files[0]) {
            alert("Por favor, forneça um nome e selecione uma imagem.");
            return;
        }
        
        const charName = nameInput.value.trim();
        const imageType = typeSelect ? typeSelect.value : 'digen';
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const base64Image = e.target.result;
            
            let chars = JSON.parse(localStorage.getItem('digenCharacters') || '[]');
            
            // Normalize existing and check for existing name
            let existingChar = null;
            chars = chars.map(c => {
                let normalizedImages = [];
                const oldImages = c.images || (c.imageBase64 ? [c.imageBase64] : []);
                oldImages.forEach(img => {
                    if (typeof img === 'string') {
                        normalizedImages.push({ type: 'digen', base64: img });
                    } else if (img && img.base64) {
                        normalizedImages.push(img);
                    }
                });
                c.images = normalizedImages;

                if (c.name.toLowerCase() === charName.toLowerCase()) {
                    existingChar = c;
                }
                return c;
            });
            
            if (existingChar) {
                existingChar.images.push({ type: imageType, base64: base64Image });
            } else {
                chars.push({
                    id: 'char_' + Date.now(),
                    name: charName,
                    images: [{ type: imageType, base64: base64Image }]
                });
            }
            
            localStorage.setItem('digenCharacters', JSON.stringify(chars));
            
            // Reset and reload
            nameInput.value = '';
            fileInput.value = '';
            loadCharacters();
        };
        
        reader.readAsDataURL(file);
    });
}

window.deleteCharacter = function(id) {
    if(!confirm("Tem certeza que deseja excluir este personagem base do Cofre?")) return;
    let chars = JSON.parse(localStorage.getItem('digenCharacters') || '[]');
    chars = chars.filter(c => c.id !== id);
    localStorage.setItem('digenCharacters', JSON.stringify(chars));
    loadCharacters();
};

// Init characters on load
document.addEventListener('DOMContentLoaded', () => {
    loadCharacters();
    initDigenReactivity();
});

// --- GLOBAL IMAGE VIEWER LOGIC ---
(function() {
    const viewer = document.getElementById('globalImageViewer');
    const viewerImage = document.getElementById('viewerImage');
    const zoomInBtn = document.getElementById('viewerZoomInBtn');
    const zoomOutBtn = document.getElementById('viewerZoomOutBtn');
    const resetBtn = document.getElementById('viewerResetBtn');
    const closeBtn = document.getElementById('viewerCloseBtn');

    if (!viewer || !viewerImage) return;

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX, startY;

    function updateTransform() {
        viewerImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function resetZoom() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
    }

    window.openGlobalImageViewer = function(src) {
        viewerImage.src = src;
        resetZoom();
        viewer.style.display = 'flex';
    };

    closeBtn.addEventListener('click', () => {
        viewer.style.display = 'none';
        viewerImage.src = '';
        if (window.api && window.api.closeImageViewer) window.api.closeImageViewer();
    });

    zoomInBtn.addEventListener('click', () => {
        scale = Math.min(scale + 0.5, 5);
        updateTransform();
    });

    zoomOutBtn.addEventListener('click', () => {
        scale = Math.max(scale - 0.5, 0.5);
        updateTransform();
    });

    resetBtn.addEventListener('click', resetZoom);

    // Mouse wheel zoom
    viewer.addEventListener('wheel', (e) => {
        if (e.deltaY < 0) {
            scale = Math.min(scale + 0.2, 5);
        } else {
            scale = Math.max(scale - 0.2, 0.5);
        }
        updateTransform();
    });

    // Panning (Drag)
    viewerImage.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        viewerImage.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        viewerImage.style.cursor = 'grab';
    });
})();

if (window.api && window.api.onOpenImageViewer) {
    window.api.onOpenImageViewer((src) => {
        if (window.openGlobalImageViewer) {
            window.openGlobalImageViewer(src);
        }
    });
}

if (window.api && window.api.onToolQueueTask) {
    window.api.onToolQueueTask((data) => {
        // Find existing task counter to avoid collisions (approximate by timestamp if global is not accessible)
        const taskId = `task_${Date.now()}_tool_${Math.floor(Math.random() * 1000)}`;
        
        const taskData = {
            id: taskId,
            prompt: data.prompt || '',
            type: 'txt2img',
            platform: data.platform || 'digen',
            status: 'queued',
            characterParam: data.imageUrl ? { preview: data.imageUrl, imageBase64: data.imageUrl } : null,
            digenConfig: {}
        };

        if (data.platform === 'meta') {
            taskData.metaConfig = {};
        } else if (data.platform === 'flow') {
            taskData.flowConfig = {};
        }

        if (typeof addTaskToUI === 'function') {
            addTaskToUI(taskData);
        }
        
        if (window.api && window.api.queueTask) {
            window.api.queueTask(taskData);
        }

        // Explicitly switch the view to 'panel' so the central panel is brought to the front
        // This ensures the tool view is hidden and the user sees the execution queue.
        const tabPanelBtn = document.getElementById('tabPanel');
        if (tabPanelBtn) tabPanelBtn.click();
    });
}

// --- Vault UI Controls ---
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('characterGrid');
    if (!grid) return;

    // Load preferences
    const savedSize = localStorage.getItem('digenVaultSize') || 'md';
    const savedView = localStorage.getItem('digenVaultView') || 'grid';

    // Apply
    grid.className = `character-grid size-${savedSize} view-${savedView}`;

    // Set radios
    const sizeRadio = document.querySelector(`input[name="vaultSize"][value="${savedSize}"]`);
    const viewRadio = document.querySelector(`input[name="vaultView"][value="${savedView}"]`);
    if (sizeRadio) sizeRadio.checked = true;
    if (viewRadio) viewRadio.checked = true;

    // Listeners
    document.querySelectorAll('input[name="vaultSize"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            localStorage.setItem('digenVaultSize', val);
            grid.classList.remove('size-sm', 'size-md', 'size-lg');
            grid.classList.add(`size-${val}`);
        });
    });

    document.querySelectorAll('input[name="vaultView"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            localStorage.setItem('digenVaultView', val);
            grid.classList.remove('view-grid', 'view-list');
            grid.classList.add(`view-${val}`);
        });
    });
});
