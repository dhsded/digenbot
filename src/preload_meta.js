const { ipcRenderer } = require('electron');

let isProcessing = false;
let taskQueue = [];
let cancelFlag = false;

function base64ToFile(base64Data, filename) {
    if(!base64Data) return null;
    let [metadata, base64] = base64Data.split(',');
    if (!base64) {
        base64 = metadata;
        metadata = 'data:image/jpeg;base64'; 
    }
    const mimeMatch = metadata.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    const mime = (mimeMatch && mimeMatch.length > 1) ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(base64);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type: mime});
}

// dump dom after loads
window.addEventListener('load', () => {
    setTimeout(() => {
        ipcRenderer.send('dump-dom', { source: 'meta', html: document.documentElement.outerHTML });
    }, 5000);
});

ipcRenderer.on('execute-meta-task', (event, taskData) => {
    console.log("Received META task:", taskData);
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
        updateStatus('running', 'Iniciando automação no Meta AI...');
        
        await new Promise(r => setTimeout(r, 2000));
        if (cancelFlag) throw new Error("Cancelado");
        
        // --- 1. UPLOAD DA IMAGEM ---
        if (task.characterParam && task.characterParam.imageBase64) {
            updateStatus('running', 'Anexando imagem de referência...');
            const fileInput = document.querySelector('input[type="file"][accept*="image"]');
            if (fileInput) {
                const fileObj = base64ToFile(task.characterParam.imageBase64, 'reference.jpg');
                if (fileObj) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(fileObj);
                    fileInput.files = dataTransfer.files;
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                await new Promise(r => setTimeout(r, 1500)); // Aguarda upload
            } else {
                console.log("Input de arquivo oculto não encontrado no Meta.");
            }
        }
        if (cancelFlag) throw new Error("Cancelado");

        // --- 2. INJEÇÃO DO PROMPT ---
        updateStatus('running', 'Inserindo o prompt...');
        const promptText = task.type === 'video' ? `Animate this image: ${task.prompt}` : task.prompt;
        
        const textArea = document.querySelector('textarea[data-testid="composer-input"]');
        if (textArea) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            nativeInputValueSetter.call(textArea, promptText);
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
            textArea.dispatchEvent(new Event('change', { bubbles: true }));
            
            await new Promise(r => setTimeout(r, 500));
        } else {
            throw new Error("Textarea de prompt não encontrado no layout do Meta AI!");
        }
        if (cancelFlag) throw new Error("Cancelado");

        // --- 3. ENVIO DO COMANDO ---
        updateStatus('running', 'Enviando comando para gerar...');
        const sendBtn = document.querySelector('button[data-testid="composer-send-button"]');
        if (sendBtn) {
            sendBtn.removeAttribute('disabled'); // Prevenir desabilitação do React
            sendBtn.click();
        } else {
            // Fallback sintético: apertar "Enter"
            textArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        }

        // --- ESPERA GERAÇÃO ---
        updateStatus('running', 'Aguardando geração do Meta AI (15-20s)...');
        await new Promise(r => setTimeout(r, 20000));
        
        if (cancelFlag) throw new Error("Cancelado");
        
        // DUMP DOM ESTRATÉGICO PARA MAPEAMENTO
        // Capturamos a tela exatamente agora para aprender como o Meta exibe o resultado final!
        ipcRenderer.send('dump-dom', { source: 'meta_result', html: document.documentElement.outerHTML });
        
        // --- TENTATIVA DE DOWNLOAD ---
        if (task.metaConfig && task.metaConfig.autoDownload) {
            updateStatus('running', `Procurando mídia gerada para download automático na pasta escolhida...`);
            await new Promise(r => setTimeout(r, 2000));
            
            // Aqui precisaremos do mapeamento exato (o DOM dump acima) para não baixar ícones do site por engano.
            // Exemplo de como o log baterá na tela:
            let downloadLimit = task.metaConfig.downloadCount || 4;
            let startIndex = task.metaConfig.startIndex || 1;
            
            updateStatus('running', `Aguardando mapeamento: Planejado baixar ${downloadLimit} imagens a partir da numeração ${startIndex}...`);
            await new Promise(r => setTimeout(r, 2000));
            // A IMPLEMENTAÇÃO REAL VAI AQUI APÓS EU LER meta_result_dom_spy.html
            
            // Extrator refinado (apenas imagens genuinamente geradas pelo Meta na conversa)
            const images = Array.from(document.querySelectorAll('img[data-testid="generated-image"]'));
            if (images.length > 0) {
                // Seleciona do lote final mais recente do feed
                const recentImages = images.slice(-downloadLimit);
                let actualDownloadCount = Math.min(downloadLimit, recentImages.length);
                
                for(let k=0; k < actualDownloadCount; k++) {
                    const imgUrl = recentImages[k].src;
                    const cleanUrl = imgUrl.split('?')[0]; // Pode precisar baixar original, mas o split falha no facebook pois as assinaturas (?) são necessárias para auth!
                    const fileName = `${startIndex + k}.jpg`;
                    
                    updateStatus('running', `Baixando imagem ${k+1}/${actualDownloadCount} (${fileName})...`);
                    
                    ipcRenderer.send('download-silent', {
                        url: imgUrl, // URL original com hash completo
                        basePath: task.metaConfig.basePath,
                        folderName: task.metaConfig.folderName,
                        fileName: fileName
                    });
                    
                    await new Promise(r => setTimeout(r, 500));
                }
                updateStatus('running', `Download de ${actualDownloadCount} imagens concluído.`);
                await new Promise(r => setTimeout(r, 1000));
            } else {
                updateStatus('running', 'Aviso: Nenhuma imagem scontent encontrada no DOM.');
                await new Promise(r => setTimeout(r, 2000));
            }
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
