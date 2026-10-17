const fs = require('fs');

let c = fs.readFileSync('pages/batch-calculator.html', 'utf8');
c = c.replace(/\r?\n\s*<link rel="stylesheet" href="\.\.\/assets\/css\/batch-calculator\.css[^"]*">/, '');
c = c.replace(
  /  <link rel="manifest" href="\.\.\/manifest\.json">\r?\n  <meta name="theme-color" content="#0C3925">\r?\n  <link rel="manifest" href="\.\.\/manifest\.json">\r?\n  <meta name="theme-color" content="#0C3925">/,
  '  <link rel="manifest" href="../manifest.json">\r\n  <meta name="theme-color" content="#0C3925">'
);
fs.writeFileSync('pages/batch-calculator.html', c, 'utf8');
console.log('Cleaned pages/batch-calculator.html successfully');
