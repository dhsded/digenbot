const fs = require('fs');

const html = fs.readFileSync('C:/Users/Dell/Documents/Gerador DIGEN/digen_dom_spy.html', 'utf8');

const regex = /<([^>]+class="[^"]*"[^>]*)>([^<]+)<\/\w+>/g;
let match;
console.log("=== ELEMENTS WITH TEXT ===");
let count = 0;
while ((match = regex.exec(html)) !== null) {
    const text = match[2].trim();
    if (text.length > 3 && text.length < 50) {
        console.log(`[Text]: ${text} | [Tag]: <${match[1].split(' ')[0]}>`);
        count++;
    }
}
console.log("Total text fragments:", count);
