const fs = require('fs');
const html = fs.readFileSync('meta_result_dom_spy.html', 'utf8');

// The strategy is to find chat messages in the document.
// Meta typically uses <div role="article" or similar. But since we do not know the exact selector,
// we can find the containers that *enclose* 4 images.
const parts = html.split('<img');
console.log('Total img tags:', parts.length - 1);

// Let's use JSDOM if installed, but gerador-digen package.json is basic. We'll use naive regex.
// Find the last chunk of images by looking at prompt messages.
// A generated image typically has `data-testid="generated-image"` or something similar.
const testidMatch = html.match(/data-testid="([^"]+)"/g);
if (testidMatch) {
    const uniqueIds = [...new Set(testidMatch)];
    console.log("Unique testids containing 'image' or 'media':", uniqueIds.filter(id => id.includes('image') || id.includes('media') || id.includes('result')));
}

// Let's check the images right before the text input.
// The text input usually has placeholder "Describe an image or video" or testid "composer-input"
const composerIndex = html.indexOf('data-testid="composer-input"');
if (composerIndex > -1) {
    console.log("Found composer-input");
    // Get the HTML *before* the composer to find the feed.
    const beforeComposer = html.substring(0, composerIndex);
    const imgsBefore = [...beforeComposer.matchAll(/src="([^"]+scontent[^"]+)"/g)];
    if (imgsBefore.length > 0) {
        console.log(`Found ${imgsBefore.length} scontent images before the composer.`);
        console.log("Last 4 images before composer:");
        imgsBefore.slice(-4).forEach((m, i) => console.log(`  ${i+1}: ${m[1].substring(0,80)}`));
    }
}
