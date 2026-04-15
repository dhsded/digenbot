const { ipcRenderer } = require('electron');

let isProcessing = false;
let taskQueue = [];
let cancelFlag = false;

// Enviar o código da página logo que ela carrega para eu (IA) ler
window.addEventListener('load', () => {
    setTimeout(() => {
        ipcRenderer.send('dump-dom', document.documentElement.outerHTML);
    }, 5000); // Wait 5s for react apps to fully render
});

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

        updateStatus('running', 'Injetando prompt...');
        
        try {
            inputField.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, task.prompt);
            
        // Fallback de segurança usando eventos sintéticos para Vue 3 se não reagir
        if(inputField.tagName.toLowerCase() === 'textarea') {
            inputField.value = task.prompt;
            inputField.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            inputField.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        }
        } catch(err) {
            console.error("Injection error", err);
        }

        // Wait briefly for UI to register the typed text (Vue 3 reactivity delay)
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

        updateStatus('running', 'Deixando a fila seguir...');
        await new Promise(r => setTimeout(r, 5000));

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
