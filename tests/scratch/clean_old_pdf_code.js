const fs = require('fs');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const startMarker = 'function drawVectorInvoicePdf(pdf, payload) {';
  const endMarker = 'async function incrementInvoiceNumber() {';

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.error('Markers not found in ' + filePath, { startIdx, endIdx });
    return false;
  }

  const replacement = `// High-precision text & vector PDF generation is implemented in js/invoice-pdf.js
// drawA4InvoicePdf and generateAndDownloadInvoicePDF are available globally via invoice-pdf.js

`;

  const newContent = content.slice(0, startIdx) + replacement + content.slice(endIdx);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully cleaned ' + filePath);
  return true;
}

cleanFile('Invoice Builder/js/main.js');
cleanFile('apps/Invoice Builder/js/main.js');
