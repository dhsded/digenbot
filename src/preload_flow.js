const { ipcRenderer } = require('electron');

let isProcessing = false;
let taskQueue = [];
let cancelFlag = false;

// dump dom after loads
window.addEventListener('load', () => {
    setTimeout(() => {
        ipcRenderer.send('dump-dom', document.documentElement.outerHTML);
    }, 5000);
});

ipcRenderer.on('execute-flow-task', (event, taskData) => {
    console.log("Received FLOW task:", taskData);
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
        updateStatus('running', 'Iniciando automação no Google Flow...');
        
        // Wait briefly for flow
        await new Promise(r => setTimeout(r, 2000));
        if (cancelFlag) throw new Error("Cancelado");

        updateStatus('running', 'Processo futuro de Injeção Meta/VEO...');
        await new Promise(r => setTimeout(r, 3000));
        
        if (!cancelFlag) {
            updateStatus('completed', 'Flow Finalizado (Mock)');
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
