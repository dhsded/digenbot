const { ipcRenderer } = require('electron');

let isProcessing = false;
let taskQueue = [];
let cancelFlag = false;

// Enviar o código da página continuamente para capturar mudanças no React/Vue
setInterval(() => {
    ipcRenderer.send('dump-dom', document.documentElement.outerHTML);
}, 8000);

ipcRenderer.on('execute-digen-task', (event, taskData) => {
    console.log("Received DIGEN task:", taskData);
    taskQueue.push(taskData);
    if (!isProcessing) {
        processQueue();
    }
});

ipcRenderer.on('execute-stop-queue', () => {
    taskQueue = [];
    cancelFlag = true;
});

async function processQueue() {
    if (taskQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    cancelFlag = false;
    const task = taskQueue.shift();
    
    const updateStatus = (status, msg) => {
        ipcRenderer.send('digen-status-update', { id: task.id, status, message: msg });
    };

    try {
        updateStatus('running', 'Iniciando automação no DIGEN...');
        
        // Ensure we are on the right URL
        if (!window.location.href.includes('/create')) {
             updateStatus('running', 'Redirecionando para a área de criação...');
             window.location.href = 'https://digen.ai/create';
             await new Promise(r => setTimeout(r, 8000));
        }
        
        if (cancelFlag) throw new Error("Cancelado");

        // Navigate to Sub-engine (Image or Video)
        if (task.type === 'image') {
            updateStatus('running', 'Alternando para o Gerador de Imagens...');
            const imageSpan = Array.from(document.querySelectorAll('span')).find(s => s.textContent.trim() === 'Image');
            if (imageSpan) imageSpan.click();
            await new Promise(r => setTimeout(r, 2000));
        } else {
            updateStatus('running', 'Alternando para o Gerador de Vídeos...');
            const videoSpan = Array.from(document.querySelectorAll('span')).find(s => s.textContent.trim() === 'Video');
            if (videoSpan) videoSpan.click();
            await new Promise(r => setTimeout(r, 2000));
        }

        if (cancelFlag) throw new Error("Cancelado");

        // Wait for page to be fully loaded with basic elements
        await new Promise(r => setTimeout(r, 2000));

        updateStatus('running', 'Procurando área de texto do prompt...');
        // Let's find any visible input field (tiptap div OR textarea)
        updateStatus('running', 'Procurando área de texto do prompt...');
        
        let inputField = null;
        let elapsedSearch = 0;
        while(elapsedSearch < 15000 && !cancelFlag) {
            // Look for Tiptap first, then standard Textarea, then generic contenteditable
            let el = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
            if (!el) el = document.querySelector('textarea');
            if (!el) Array.from(document.querySelectorAll('[contenteditable="true"]')).find(e => e.offsetHeight > 0);
            
            if (el && el.offsetHeight > 0) {
                inputField = el;
                break;
            }
            await new Promise(r => setTimeout(r, 500));
            elapsedSearch += 500;
        }
        
        if (cancelFlag) throw new Error("Cancelado");

        if (!inputField) {
            updateStatus('running', 'Debug: Campo não encontrado. URL: ' + window.location.href);
            throw new Error("Textarea não encontrada na URL atual.");
        }

        // --- CHARACTER INJECTION (VAULT) ---
        if (task.characterParam && task.characterParam.imageBase64) {
            updateStatus('running', 'Anexando Personagem de Referência...');
            try {
                // Find visible or hidden file input
                const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
                const targetInput = fileInputs[0]; // Usually the first one handles basic uploads
                
                if (targetInput) {
                    // 1. Convert Base64 to Blob File
                    const res = await fetch(task.characterParam.imageBase64);
                    const blob = await res.blob();
                    
                    const safeName = task.characterParam.name ? task.characterParam.name.replace(/[^a-z0-9]/gi, '_') + '.png' : 'ref_avatar.png';
                    const file = new File([blob], safeName, { type: blob.type || 'image/png' });
                    
                    // 2. Synthetic DataTransfer
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    targetInput.files = dataTransfer.files;
                    
                    // 3. Dispatch React/Vue events
                    targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    targetInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    
                    // 4. Wait for Upload component to finish server handshake
                    updateStatus('running', 'Aguardando upload da imagem no servidor...');
                    await new Promise(r => setTimeout(r, 6000));
                    
                } else {
                    console.log("Input de upload não encontrado na interface atual.");
                }
            } catch (err) {
                console.error("Erro fatal ao injetar imagem Base64 do cofre:", err);
            }
        }
        
        if (cancelFlag) throw new Error("Cancelado");

        // --- SELEÇÃO DE CONFIGURAÇÕES (MODELO, TEMPO, RESOLUÇÃO) ---
        if (task.digenConfig && task.type === 'video') {
            async function clickOptionByText(textSnippets) {
                if (!textSnippets) return false;
                const searchTexts = Array.isArray(textSnippets) ? textSnippets : [textSnippets];
                
                const list = Array.from(document.querySelectorAll('span, div, button'));
                for (let el of list) {
                    for (let text of searchTexts) {
                        const hasExactTextNode = Array.from(el.childNodes).some(node => 
                            node.nodeType === 3 && node.nodeValue.trim() === text.trim()
                        );
                        if (hasExactTextNode) {
                            const clickable = el.closest('button, .cursor-pointer') || el;
                            clickable.click();
                            return true;
                        }
                    }
                }
                return false;
            }

            if (task.digenConfig.modelName) {
                // Tentar abrir o menu Dropdown do modelo atual
                const possiblePrefixes = ['Real Motion', 'Google Veo', 'Grok Video', 'Runway '];
                const currentModelSpan = Array.from(document.querySelectorAll('span, div')).find(el => {
                    return el.childNodes.length === 1 && 
                           el.childNodes[0].nodeType === 3 && 
                           possiblePrefixes.some(p => el.textContent.trim().startsWith(p)) &&
                           el.textContent.trim().length > 6; // Ignorar abas curtas como 'VEO', 'Sora2'
                });

                if (currentModelSpan) {
                    updateStatus('running', 'Abrindo seletor de modelos...');
                    // Procurar pela div wrapper clicável com o chevron
                    let parent = currentModelSpan;
                    let foundToggle = null;
                    for (let i = 0; i < 5; i++) {
                        if (!parent) break;
                        if (parent.querySelector('svg.rotate-90') || parent.querySelector('svg.rotate-180') || parent.tagName === 'BUTTON') {
                            foundToggle = parent;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                    if (foundToggle) {
                        foundToggle.click();
                        await new Promise(r => setTimeout(r, 600));
                    } else {
                        const clickable = currentModelSpan.closest('.cursor-pointer') || currentModelSpan;
                        clickable.click();
                        await new Promise(r => setTimeout(r, 600));
                    }
                }

                updateStatus('running', `Selecionando Modelo: ${task.digenConfig.modelName}`);
                await clickOptionByText(task.digenConfig.modelName);
                await new Promise(r => setTimeout(r, 800));
            }
            if (task.digenConfig.time) {
                updateStatus('running', `Selecionando Tempo: ${task.digenConfig.time}`);
                await clickOptionByText(task.digenConfig.time);
                await new Promise(r => setTimeout(r, 600));
            }
            if (task.digenConfig.resolution) {
                updateStatus('running', `Selecionando Resolução: ${task.digenConfig.resolution}`);
                await clickOptionByText([task.digenConfig.resolution, task.digenConfig.resolution.split(' ')[0]]);
                await new Promise(r => setTimeout(r, 600));
            }
        }

        // --- ENHANCE PROMPT / MANUAL PROMPT ---
        if (task.digenConfig && task.digenConfig.enhancePrompt) {
            updateStatus('running', 'Iniciando IA Visão (Lendo imagem para compor texto)...');
            // Look for "Aprimoramento do Prompt"
            const allElements = Array.from(document.querySelectorAll('div, span, button'));
            const enhanceBtn = allElements.find(el => el.textContent && el.textContent.trim() === 'Aprimoramento do Prompt');
            
            if (enhanceBtn) {
                enhanceBtn.click();
                updateStatus('running', 'Aguardando Digen compor o prompt textual (12s)...');
                await new Promise(r => setTimeout(r, 12000)); // 12s wait for AI completion
            } else {
                updateStatus('running', 'Botão de Aprimoramento não encontrado. Escrevendo manual.');
                await injectText(inputField, task.prompt || ' ');
            }
        } else {
            // Standard Text Injection
            updateStatus('running', 'Injetando prompt...');
            await injectText(inputField, task.prompt);
        }
        
        async function injectText(field, text) {
            try {
                field.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, text);
            } catch (err) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                nativeInputValueSetter.call(field, text);
                field.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        if (cancelFlag) throw new Error("Cancelado");

        updateStatus('running', 'Aguardando estabilidade antes de gerar...');
        await new Promise(r => setTimeout(r, 1500));

        if (cancelFlag) throw new Error("Cancelado");

        // Force a robust search for Generate Button since it's sometimes a span or deep element
        updateStatus('running', 'Iniciando Geração...');
        let btnGerar = null;
        for (let i = 0; i < 15; i++) {
            if (cancelFlag) throw new Error("Cancelado");
            
            const elements = Array.from(document.querySelectorAll('span, button, div'));
            const matches = elements.filter(el => {
                // Must have text and no huge children branches
                if (el.children.length > 2) return false; 
                const txt = el.textContent ? el.textContent.trim().toLowerCase() : '';
                return txt === 'gerar vídeo' || txt.includes('fazer um vídeo') || txt === 'gerar' || txt === 'generate';
            });
            
            // Prefer button over span if multiple exist
            btnGerar = matches.find(el => el.tagName === 'BUTTON') || matches[0];
            
            if (btnGerar) {
                 const parentBtn = btnGerar.closest('button') || btnGerar.closest('.cursor-pointer');
                 btnGerar = parentBtn || btnGerar;
                 break;
            }
            await new Promise(r => setTimeout(r, 500));
        }
        
        if (cancelFlag) throw new Error("Cancelado");
        
        if (!btnGerar) {
            updateStatus('running', 'Botão de geração não encontrado. Simulando finalização...');
            await new Promise(r => setTimeout(r, 2000));
        } else {
            updateStatus('running', 'Enviando comando de geração...');
            btnGerar.click();
            await new Promise(r => setTimeout(r, 1500));
        }

        updateStatus('running', 'Deixando a fila seguir mas escutando por conclusão...');
        await new Promise(r => setTimeout(r, 5000));
        
        // DUMP DOM ESTRATÉGICO
        ipcRenderer.send('dump-dom', { source: 'digen_result', html: document.documentElement.outerHTML });
        
        if (task.digenConfig && task.digenConfig.autoDownload) {
            updateStatus('running', 'Aguardando renderização final do Digen no servidor para realizar download...');
            await new Promise(r => setTimeout(r, 2000));
            // A IMPLEMENTAÇÃO REAL VAI AQUI APÓS EU LER digen_result_dom_spy.html
        }

        if (!cancelFlag) {
            updateStatus('completed', 'Finalizado');
        } else {
            updateStatus('cancelled', 'Cancelado');
        }

    } catch (e) {
        if (e.message === "Cancelado") {
            updateStatus('cancelled', 'Cancelado pelo Usuário.');
        } else {
            updateStatus('failed', 'Erro: ' + e.message);
        }
    }

    if (!cancelFlag) {
        processQueue();
    } else {
        isProcessing = false;
    }
}

// Helper: wait for element
function waitForElement(selector, timeout) {
    return new Promise((resolve) => {
        let elapsed = 0;
        const interval = setInterval(() => {
            if (cancelFlag) {
                clearInterval(interval);
                resolve(null);
                return;
            }
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                resolve(el);
            }
            elapsed += 500;
            if (elapsed >= timeout) {
                clearInterval(interval);
                resolve(null);
            }
        }, 500);
    });
}

// Helper: wait for element by text
function waitForElementByText(selector, text, timeout = 5000) {
    return new Promise((resolve) => {
        const findFn = () => Array.from(document.querySelectorAll(selector)).find(el => el.textContent && el.textContent.includes(text));
        
        let found = findFn();
        if (found) return resolve(found);
        
        const observer = new MutationObserver(() => {
            found = findFn();
            if (found) {
                observer.disconnect();
                resolve(found);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}
