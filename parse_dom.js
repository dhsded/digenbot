const fs = require('fs');

const html = fs.readFileSync('C:/Users/Dell/Documents/Gerador DIGEN/digen_dom_spy.html', 'utf8');

const textareas = html.match(/<textarea[^>]*>.*?<\/textarea>/gi) || [];
console.log("=== TEXTAREAS FOUND ===");
textareas.forEach(t => console.log(t.substring(0, 200)));

const inputs = html.match(/<input[^>]*type="text"[^>]*>/gi) || [];
console.log("\n=== TEXT INPUTS FOUND ===");
inputs.forEach(i => console.log(i.substring(0, 200)));

const buttons = html.match(/<button[^>]*>.*?<\/button>/gi) || [];
console.log("\n=== BUTTONS FOUND ===");
buttons.forEach(b => {
  if(b.toLowerCase().includes('gerar') || b.toLowerCase().includes('video') || b.toLowerCase().includes('create') || b.toLowerCase().includes('generate')) {
    console.log(b.substring(0, 300));
  }
});

const elementsWithGerar = html.match(/<[^>]*>[^<]*[Gg]erar[^<]*<\/[^>]*>/gi) || [];
console.log("\n=== ANY ELEMENT WITH 'Gerar' ===");
elementsWithGerar.slice(0, 10).forEach(e => console.log(e));
