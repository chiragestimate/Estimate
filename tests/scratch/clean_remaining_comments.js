const fs = require('fs');

function cleanFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(([from, to]) => {
    c = c.split(from).join(to);
  });
  fs.writeFileSync(filePath, c, 'utf8');
  console.log(`✓ Cleaned: ${filePath}`);
}

cleanFile('Invoice Builder/server.js', [
  ['Anjani Agri Care', 'Afield Crop Care']
]);

cleanFile('apps/Invoice Builder/server.js', [
  ['Anjani Agri Care', 'Afield Crop Care']
]);

cleanFile('Invoice Builder/js/invoice-pdf.js', [
  ['Anjani Agri Care Primary Theme Green', 'Afield Crop Care Primary Theme Green'],
  ['img[alt*="Anjani"]', 'img[alt*="Afield"]']
]);

cleanFile('apps/Invoice Builder/js/invoice-pdf.js', [
  ['Anjani Agri Care Primary Theme Green', 'Afield Crop Care Primary Theme Green'],
  ['img[alt*="Anjani"]', 'img[alt*="Afield"]']
]);

cleanFile('assets/js/intercompany-core.js', [
  ['(Anjani)', '(Afield Crop Care)'],
  ['Anjani ID 1', 'Afield Crop Care ID 1'],
  ['at Anjani', 'at Afield Crop Care']
]);

cleanFile('assets/css/tables.css', [
  ['ANJANI AGRI CARE UI COMPONENT SYSTEM', 'AFIELD CROP CARE UI COMPONENT SYSTEM']
]);

cleanFile('Invoice Builder/css/main.css', [
  ['ANJANI AGRI CARE UI COMPONENT SYSTEM', 'AFIELD CROP CARE UI COMPONENT SYSTEM']
]);

cleanFile('apps/Invoice Builder/css/main.css', [
  ['ANJANI AGRI CARE UI COMPONENT SYSTEM', 'AFIELD CROP CARE UI COMPONENT SYSTEM']
]);

cleanFile('Invoice Builder/css/override.css', [
  ['ANJANI AGRI CARE OFFICIAL PALETTE', 'AFIELD CROP CARE OFFICIAL PALETTE']
]);

cleanFile('apps/Invoice Builder/css/override.css', [
  ['ANJANI AGRI CARE OFFICIAL PALETTE', 'AFIELD CROP CARE OFFICIAL PALETTE']
]);

console.log('✓ All remaining comments and server logs cleaned!');
