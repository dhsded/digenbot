const { ipcRenderer } = require('electron');

let isProcessing = false;
let taskQueue = [];
let cancelFlag = false;

// Listener global para extração de DOM do Espião
ipcRenderer.on('extract-dom', () => {
    try {
        console.log("Extraindo DOM do Flow...");
        const html = document.documentElement.outerHTML;
        ipcRenderer.send('dump-dom', { source: 'flow', html: html });
        alert('DOM do Flow extraído! Verifique a pasta raiz do projeto.');
    } catch(e) {
        alert('Falha ao extrair DOM: ' + e.message);
    }
});

ipcRenderer.on('execute-flow-task', (event, taskData) => {
    console.log("[Flow Robot] Nova tarefa recebida:", taskData.id);
    taskQueue.push(taskData);
    if (!isProcessing) processQueue();
});

ipcRenderer.on('execute-stop-queue', () => {
    taskQueue = [];
    cancelFlag = true;
    isProcessing = false;
});

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Utilitários de busca resiliente ────────────────────────────────────────

/** Encontra botão por texto parcial (case-insensitive, multi-lang) */
function findButtonByText(...texts) {
    const all = document.querySelectorAll('button, [role="button"]');
    for (const el of all) {
        const t = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase().trim();
        if (texts.some(txt => t.includes(txt.toLowerCase()))) return el;
    }
    return null;
}

/** Encontra ícone Material Icon pelo nome */
function findButtonByIcon(...iconNames) {
    for (const name of iconNames) {
        // Texto direto
        const icon = Array.from(document.querySelectorAll('i, span.material-icons, span.material-symbols-outlined'))
            .find(el => el.textContent.trim() === name);
        if (icon) {
            // Sobe na árvore para encontrar o botão pai
            let node = icon;
            for (let i = 0; i < 5; i++) {
                node = node.parentElement;
                if (!node) break;
                if (node.tagName === 'BUTTON' || node.getAttribute('role') === 'button') return node;
            }
        }
    }
    return null;
}

/** Clica em um elemento de forma confiável (dispara todos eventos necessários) */
function reliableClick(el) {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.click();
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

// ── Passo 1: Novo Projeto ──────────────────────────────────────────────────

async function findAndClickNovoProjeto() {
    // Estratégia A: botão com texto
    let btn = findButtonByText('novo projeto', 'new project', 'criar projeto', 'new', 'criar');
    if (!btn) btn = findButtonByIcon('add_2', 'add', 'add_circle', 'create_new_folder');
    if (!btn) {
        // Estratégia B: primeiro botão com ícone "add" na toolbar
        btn = document.querySelector('button[aria-label*="ovo"], button[aria-label*="New"], button[aria-label*="Add"]');
    }
    if (btn) {
        reliableClick(btn);
        await wait(2500);
        return true;
    }
    // Não fatal — pode já estar em projeto limpo
    console.warn('[Flow Robot] Botão "Novo Projeto" não encontrado, continuando...');
    return false;
}

// ── Passo 2: Configurar Proporção ──────────────────────────────────────────

async function setConfigRatio(ratio) {
    // Estratégia A: botão de tune/settings
    let tuneBtn = findButtonByIcon('tune', 'settings', 'settings_applications');
    if (!tuneBtn) tuneBtn = findButtonByText('configurações', 'settings', 'tune', 'opções', 'options');
    if (!tuneBtn) {
        // Estratégia B: qualquer botão com aria-haspopup
        const popupBtns = document.querySelectorAll('button[aria-haspopup], button[aria-expanded]');
        tuneBtn = popupBtns[popupBtns.length - 1] || null;
    }

    if (!tuneBtn) {
        console.warn('[Flow Robot] Botão de configurações não encontrado — pulando configuração de ratio');
        // Não lança erro — o robô continua sem configurar o ratio
        return;
    }

    reliableClick(tuneBtn);
    await wait(1500);

    // Selecionar o ratio no menu/dialog aberto
    const ratioTexts = ratio === '9:16'
        ? ['retrato', 'portrait', '9:16', 'vertical']
        : ['paisagem', 'landscape', '16:9', 'horizontal'];

    // Procura em spans, divs, labels e radio buttons
    const candidates = document.querySelectorAll('span, div[role="option"], label, input[type="radio"] + *, [role="menuitem"]');
    for (const el of candidates) {
        const t = el.textContent.toLowerCase();
        if (ratioTexts.some(r => t.includes(r))) {
            reliableClick(el);
            await wait(800);
            break;
        }
    }

    // Fechar o menu apertando Escape ou clicando fora
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(800);
}

// ── Passo 3: Injetar Prompt ────────────────────────────────────────────────

async function typePrompt(promptText) {
    // Encontra textarea ou contenteditable
    let input = document.querySelector('textarea[placeholder], textarea');
    if (!input) input = document.querySelector('[contenteditable="true"][role="textbox"], [contenteditable="true"]');
    if (!input) throw new Error("Campo de prompt não encontrado no DOM do Flow");

    // Foca e limpa
    input.focus();
    await wait(300);

    if (input.tagName === 'TEXTAREA') {
        // Limpa e injeta via Lexical/React
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeSetter.call(input, promptText);
    } else {
        // Contenteditable
        input.innerHTML = '';
        input.textContent = promptText;
    }

    // Dispara eventos para que o React/Lexical processe
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
    await wait(1200);

    // Botão de gerar
    let genBtn = findButtonByIcon('auto_awesome', 'spark', 'send', 'play_arrow');
    if (!genBtn) genBtn = findButtonByText('gerar', 'generate', 'criar', 'run', 'go');
    if (!genBtn) {
        // Último recurso: Enter
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return;
    }
    await wait(300);
    reliableClick(genBtn);
}

// ── Passo 4: Extrair Imagem Gerada ────────────────────────────────────────

async function extractImageFromDOM(taskId) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 150; // 2.5 minutos

        const interval = setInterval(() => {
            attempts++;
            if (cancelFlag) {
                clearInterval(interval);
                reject(new Error("Cancelado"));
                return;
            }

            // Estratégia A: img com alt contendo "Flow Image" ou "Generated"
            let imgs = document.querySelectorAll('img[alt*="Flow Image"], img[alt*="Generated"], img[alt*="Gerado"]');

            // Estratégia B: qualquer img grande dentro de um container de resultado
            if (imgs.length === 0) {
                imgs = document.querySelectorAll('img[src*="lh3.googleusercontent"], img[src*="blob:"], img[src*="data:image/png"], img[src*="data:image/jpeg"]');
            }

            // Estratégia C: imgs grandes (> 200px) que não são ícones
            if (imgs.length === 0) {
                imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                    return img.naturalWidth > 200 && img.naturalHeight > 200
                        && !img.src.startsWith('data:image/svg')
                        && img.src && img.src !== window.location.href;
                });
            }

            if (imgs.length > 0) {
                const target = imgs[imgs.length - 1];
                if (target?.src && !target.src.startsWith('data:image/svg') && !target.src.endsWith('.svg')) {
                    clearInterval(interval);
                    console.log(`[Flow Robot] Imagem extraída para ${taskId}:`, target.src.substring(0, 80));
                    resolve(target.src);
                    return;
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error("Timeout: nenhuma imagem gerada após 2.5 minutos"));
            }
        }, 1000);
    });
}

// ── Orquestrador Principal ────────────────────────────────────────────────

async function processQueue() {
    if (taskQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    cancelFlag = false;
    const task = taskQueue.shift();

    const updateStatus = (status, msg) => {
        console.log(`[Flow Robot][${task.id}] ${status}: ${msg}`);
        ipcRenderer.send('digen-status-update', { id: task.id, status, message: msg });
    };

    try {
        updateStatus('running', '🤖 Robô iniciado no Google Flow...');

        // 1. Novo Projeto
        await findAndClickNovoProjeto();
        if (cancelFlag) throw new Error("Cancelado");

        // 2. Configurar proporção
        const ratio = task.flowConfig?.ratio || task.aspectRatio || '16:9';
        updateStatus('running', `📐 Configurando proporção (${ratio})...`);
        await setConfigRatio(ratio);
        if (cancelFlag) throw new Error("Cancelado");

        // 3. Injetar prompt
        const prompt = task.flowConfig?.prompt || task.prompt || "A cinematic scene";
        updateStatus('running', '✍️ Injetando prompt...');
        await typePrompt(prompt);
        if (cancelFlag) throw new Error("Cancelado");

        // 4. Aguardar e extrair imagem
        updateStatus('running', '⏳ Aguardando Nano Banana 2 gerar...');
        const imageSrc = await extractImageFromDOM(task.id);

        // 5. Salvar no HD via main.js
        updateStatus('running', '💾 Salvando imagem no HD...');
        ipcRenderer.send('save-storyboard-image', {
            taskId: task.id,
            sceneId: task.flowConfig?.sceneId || task.id,
            src: imageSrc
        });

        updateStatus('completed', '✅ Imagem gerada e salva com sucesso!');

    } catch (e) {
        if (e.message === "Cancelado") {
            updateStatus('cancelled', 'Cancelado pelo usuário.');
        } else {
            console.error('[Flow Robot] Erro:', e);
            updateStatus('failed', '❌ Erro: ' + e.message);
            // Notifica erro para ativar fallback no React
            ipcRenderer.send('save-storyboard-image', {
                taskId: task.id,
                sceneId: task.flowConfig?.sceneId || task.id,
                error: true
            });
        }
    }

    if (!cancelFlag) {
        await wait(1500);
        processQueue();
    } else {
        isProcessing = false;
    }
}
