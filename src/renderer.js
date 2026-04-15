let taskCounter = 0;

// === Tab Navigation ===
const tabPanelBtn = document.getElementById('tabPanel');
const tabDigenBtn = document.getElementById('tabDigen');
const panelArea = document.getElementById('panelArea');

tabPanelBtn.addEventListener('click', () => {
    tabPanelBtn.classList.add('active');
    tabDigenBtn.classList.remove('active');
    panelArea.classList.remove('hidden');
    // Hide Digen BrowserView
    window.api.switchTab('panel');
});

tabDigenBtn.addEventListener('click', () => {
    tabDigenBtn.classList.add('active');
    tabPanelBtn.classList.remove('active');
    panelArea.classList.add('hidden');
    // Show Digen BrowserView
    window.api.switchTab('digen');
});


// === Logic ===
document.getElementById('queueBtn').addEventListener('click', () => {
    const promptEl = document.getElementById('promptInput');
    const promptText = promptEl.value.trim();
    
    if (!promptText) return;

    const taskId = `task_${Date.now()}_${++taskCounter}`;
    
    const taskData = {
        id: taskId,
        prompt: promptText,
        status: 'queued'
    };

    addTaskToUI(taskData);
    
    // Send to main process to route to digen window
    window.api.queueTask(taskData);
    
    promptEl.value = '';
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
