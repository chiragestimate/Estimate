const fs = require('fs');

['Invoice Builder/js/main.js', 'apps/Invoice Builder/js/main.js'].forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const target = `    // Reset client preview text
    const pcName = $('p-client-name');
    if (pcName) pcName.textContent = 'Client Name';
    const pcSub = $('p-client-sub');
    if (pcSub) pcSub.textContent = 'Address | Phone | GSTIN';
    const pDueLine = $('p-due-line');
    if (pDueLine) pDueLine.style.display = 'none';`;

  const replacement = `    // Reset client preview text & address rows
    const pcName = $('p-client-name');
    if (pcName) pcName.textContent = 'Client Name';
    const pcAddr = $('p-client-addr-text');
    if (pcAddr) {
      pcAddr.textContent = '';
      pcAddr.style.display = 'none';
    }
    const pcSub = $('p-client-sub');
    if (pcSub) pcSub.textContent = '';
    const pDueLine = $('p-due-line');
    if (pDueLine) pDueLine.style.display = 'none';

    const pStateRow = $('p-client-state-row');
    if (pStateRow) pStateRow.style.display = 'none';
    const pPinRow = $('p-client-pin-row');
    if (pPinRow) pPinRow.style.display = 'none';
    const pPhoneRow = $('p-client-phone-row');
    if (pPhoneRow) pPhoneRow.style.display = 'none';
    const pGstinRow = $('p-client-gstin-row');
    if (pGstinRow) pGstinRow.style.display = 'none';
    const r1 = $('p-client-row-1');
    if (r1) r1.style.display = 'none';
    const r2 = $('p-client-row-2');
    if (r2) r2.style.display = 'none';`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', filePath);
  } else {
    console.warn('Target not found in', filePath);
  }
});

const a = fs.readFileSync('Invoice Builder/js/main.js', 'utf8');
const b = fs.readFileSync('apps/Invoice Builder/js/main.js', 'utf8');
console.log('Synchronized:', a === b, 'Length:', a.length);
