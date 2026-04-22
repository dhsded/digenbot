// === Theme Logic ===
let currentTheme = localStorage.getItem('digenTheme') || 'dark';

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        const btn = document.getElementById('themeToggleBtn');
        if(btn) btn.innerText = '🌗 Tema Escuro';
    } else {
        document.documentElement.removeAttribute('data-theme');
        const btn = document.getElementById('themeToggleBtn');
        if(btn) btn.innerText = '☀️ Tema Claro';
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
        });
    }

    const toggleLogBtn = document.getElementById('toggleLogBtn');
    let logVisible = true;
    if (toggleLogBtn) {
        toggleLogBtn.addEventListener('click', () => {
            logVisible = !logVisible;
            document.getElementById('globalFooterLogContainer').style.display = logVisible ? 'flex' : 'none';
            toggleLogBtn.innerText = logVisible ? '📝 Ocultar Log' : '📝 Mostrar Log';
            if (window.api && window.api.toggleFooter) {
                window.api.toggleFooter(logVisible);
            }
        });
    }
});

let taskCounter = 0;
// === Tab Navigation ===
const tabPanelBtn = document.getElementById('tabPanel');
const tabDigenBtn = document.getElementById('tabDigen');
const tabFlowBtn = document.getElementById('tabFlow');
const tabMetaBtn = document.getElementById('tabMeta');
const tabCharactersBtn = document.getElementById('tabCharacters');
const panelArea = document.getElementById('panelArea');
const characterArea = document.getElementById('characterArea');

function resetTabs() {
    tabPanelBtn.classList.remove('active');
    tabDigenBtn.classList.remove('active');
    tabFlowBtn.classList.remove('active');
    tabMetaBtn.classList.remove('active');
    tabCharactersBtn.classList.remove('active');
    panelArea.classList.add('hidden');
    characterArea.classList.add('hidden');
}

tabPanelBtn.addEventListener('click', () => {
    resetTabs();
    tabPanelBtn.classList.add('active');
    panelArea.classList.remove('hidden');
    window.api.switchTab('panel');
});

tabDigenBtn.addEventListener('click', () => {
    resetTabs();
    tabDigenBtn.classList.add('active');
    window.api.switchTab('digen');
});

tabFlowBtn.addEventListener('click', () => {
    resetTabs();
    tabFlowBtn.classList.add('active');
    window.api.switchTab('flow');
});

tabCharactersBtn.addEventListener('click', () => {
    resetTabs();
    tabCharactersBtn.classList.add('active');
    characterArea.classList.remove('hidden');
    window.api.switchTab('panel'); // hide digen view to show normal html panels
});

tabMetaBtn.addEventListener('click', () => {
    resetTabs();
    tabMetaBtn.classList.add('active');
    window.api.switchTab('meta');
});


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
            if (charData && charData.imageBase64) {
                vaultPreviewImage.src = charData.imageBase64;
                vaultPreviewContainer.style.display = 'block';
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
            
            const img = document.createElement('img');
            img.src = base64;
            img.className = 'batch-thumbnail';
            img.title = file.name;
            previewGrid.appendChild(img);
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
    if (platform === 'digen') {
        document.getElementById('tabDigen').click();
    } else if (platform === 'flow') {
        document.getElementById('tabFlow').click();
    } else if (platform === 'meta') {
        document.getElementById('tabMeta').click();
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
    div.innerHTML = `
        <div class="task-header">
            <span>ID: ${task.id.slice(-6)}</span>
            <span class="status-badge queued" id="badge_${task.id}">Aguardando</span>
        </div>
        <div class="task-prompt">${task.prompt}</div>
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
        // Add to grid
        const div = document.createElement('div');
        div.className = 'char-card';
        div.innerHTML = `
            <img src="${char.imageBase64}" alt="${char.name}">
            <div class="char-name" title="${char.name}">${char.name}</div>
            <button class="btn-delete-char" onclick="deleteCharacter('${char.id}')">Excluir</button>
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
        
        if (!nameInput.value.trim() || !fileInput.files[0]) {
            alert("Por favor, forneça um nome e selecione uma imagem.");
            return;
        }
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const base64Image = e.target.result;
            
            const chars = JSON.parse(localStorage.getItem('digenCharacters') || '[]');
            chars.push({
                id: 'char_' + Date.now(),
                name: nameInput.value.trim(),
                imageBase64: base64Image
            });
            
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
