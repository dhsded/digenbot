const fs = require('fs');

const html = fs.readFileSync('C:/Users/Dell/Documents/Gerador DIGEN/digen_dom_spy.html', 'utf8');

const textareas = html.match(/<textarea[^>]*>.*?<\/textarea>/gi) || [];
console.log("=== TEXTAREAS FOUND ===");
textareas.forEach(t => console.log(t.substring(0, 200)));

const fileInputs = html.match(/<input[^>]*type="file"[^>]*>/gi) || [];
console.log("\n=== FILE INPUTS FOUND ===");
fileInputs.forEach(i => console.log(i));

const uploadElements = html.match(/<[^>]*class="[^"]*(upload|image|avatar|dropzone)[^"]*"[^>]*>.*?<\/[^>]*>/gi) || [];
console.log("\n=== UPLOAD/IMAGE ELEMENTS ===");
// Just logging the open tag to avoid massive console logs
uploadElements.slice(0, 15).forEach(e => {
    const openTag = e.match(/<[^>]+>/)[0];
    console.log(openTag);
});

const buttons = html.match(/<button[^>]*>.*?<\/button>/gi) || [];
console.log("\n=== UPLOAD BUTTONS FOUND ===");
buttons.forEach(b => {
  if(b.toLowerCase().includes('upload') || b.toLowerCase().includes('image') || b.toLowerCase().includes('avatar') || b.toLowerCase().includes('refer')) {
    console.log(b.substring(0, 300));
  }
});
