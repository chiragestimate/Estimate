const fs = require('fs');
const path = require('path');

function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getAllHtmlFiles(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const htmlFiles = getAllHtmlFiles('.');
const missingAssets = [];

htmlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check CSS
  const cssRegex = /<link[^>]+href=["']([^"']+\.css)[^"']*["']/g;
  let match;
  while ((match = cssRegex.exec(content)) !== null) {
    const href = match[1];
    if (href.startsWith('http') || href.startsWith('//')) continue;
    const resolved = path.resolve(path.dirname(file), href);
    if (!fs.existsSync(resolved)) {
      missingAssets.push({ file, type: 'css', href, resolved });
    }
  }

  // Check JS
  const jsRegex = /<script[^>]+src=["']([^"']+\.js)[^"']*["']/g;
  while ((match = jsRegex.exec(content)) !== null) {
    const src = match[1];
    if (src.startsWith('http') || src.startsWith('//')) continue;
    const resolved = path.resolve(path.dirname(file), src);
    if (!fs.existsSync(resolved)) {
      missingAssets.push({ file, type: 'js', src, resolved });
    }
  }
});

console.log('Total HTML files scanned:', htmlFiles.length);
console.log('Missing assets found:', JSON.stringify(missingAssets, null, 2));
