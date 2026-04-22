const fs = require('fs');
const html = fs.readFileSync('meta_dom_spy.html', 'utf-8');

const m_textareas = html.match(/<textarea[^>]*>/g);
console.log('Textareas:', m_textareas || 'None');

const m_inputs = html.match(/<input[^>]*type=[\"']?file[\"']?[^>]*>/g);
console.log('File Inputs:', m_inputs || 'None');

const m_contentEditable = html.match(/<[^>]*contenteditable[^>]*>/g);
console.log('Content Editables:', m_contentEditable || 'None');

// Buttons with aria labels containing send, generate, create, etc
console.log('Checking buttons...');
const m_buttons = Array.from(html.matchAll(/<button[^>]*>/g)).map(m => m[0]);
m_buttons.forEach(b => {
    let aria = b.match(/aria-label=["']([^"']+)["']/);
    if(aria) {
        if(/send|create|generate|criar|animar|submit/i.test(aria[1])) {
            console.log('Found action button:', b);
        }
    }
});
