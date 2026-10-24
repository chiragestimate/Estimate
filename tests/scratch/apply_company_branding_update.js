const fs = require('fs');
const path = require('path');

const OLD_COMPANY = 'Anjani Agri Care';
const NEW_COMPANY = 'Afield Crop Care';

const OLD_PHONE = '9664675227';
const NEW_PHONE = '78787 77727';
const NEW_PHONE_CLEAN = '7878777727';

const OLD_EMAIL = 'skagro3105@gmail.com';
const NEW_EMAIL = 'afieldcropcare@gmail.com';

const OLD_ADDR_SHORT = 'Sr. No. 67 and 68, Plot No. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot';
const OLD_ADDR_1 = 'Sr. No. 67 & 68, Plot No. 33, Siddhi Vinayak Ind. Zone, Virva, Lodhika, Rajkot, Gujarat.';
const OLD_ADDR_2 = 'Sr. No. 67 and 68, Plot No. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot, Gujarat.';
const NEW_ADDR = 'SURVEY NO. 255, PLOT NO. 14, NEAR BALKRISHNA STEEL FORGING, SHITALA MATA TEMPLE ROAD, SHAPAR (VERAVAL) 360024 DISTRICT - RAJKOT, GUJARAT, INDIA.';

// 1. Update dispatch-ui.js
let dspUi = fs.readFileSync('assets/js/dispatch-ui.js', 'utf8');

// Replace company name, phone, email, address in dispatch-ui
dspUi = dspUi.replace(/<h2 style="font-size:21px; font-weight:800; color:#0C3925; margin:0; letter-spacing:-0.4px;">Anjani Agri Care<\/h2>/g,
  '<h2 style="font-size:21px; font-weight:800; color:#0C3925; margin:0; letter-spacing:-0.4px;">' + NEW_COMPANY + '</h2>');

dspUi = dspUi.replace(/<span>Sr\. No\. 67 & 68, Plot No\. 33, Siddhi Vinayak Ind\. Zone, Virva, Lodhika, Rajkot, Gujarat\.<\/span>/g,
  '<span>' + NEW_ADDR + '</span>');

dspUi = dspUi.replace(/\+91 96646 75227/g, '+91 ' + NEW_PHONE);
dspUi = dspUi.replace(/skagro3105@gmail\.com/g, NEW_EMAIL);

dspUi = dspUi.replace(/pdf\.text\('Anjani Agri Care', centerX, y \+ 6\.5, { align: 'center' }\);/g,
  `pdf.text('${NEW_COMPANY}', centerX, y + 6.5, { align: 'center' });`);

dspUi = dspUi.replace(/pdf\.text\('Sr\. No\. 67 & 68, Plot No\. 33, Siddhi Vinayak Ind\. Zone, Virva, Lodhika, Rajkot, Gujarat\.', centerX, y \+ 11\.5, { align: 'center' }\);/g,
  `pdf.text('${NEW_ADDR}', centerX, y + 11.5, { align: 'center' });`);

dspUi = dspUi.replace(/pdf\.text\('Phone: \+91 96646 75227  \|  Email: skagro3105@gmail\.com', centerX, y \+ 15\.5, { align: 'center' }\);/g,
  `pdf.text('Phone: +91 ${NEW_PHONE}  |  Email: ${NEW_EMAIL}', centerX, y + 15.5, { align: 'center' });`);

dspUi = dspUi.replace(/company: 'Anjani Agri Care',/g, `company: '${NEW_COMPANY}',`);
dspUi = dspUi.replace(/address: 'Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot, Gujarat\.',/g,
  `address: '${NEW_ADDR}',`);
dspUi = dspUi.replace(/phone: '9664675227',/g, `phone: '${NEW_PHONE_CLEAN}',`);
dspUi = dspUi.replace(/brand: 'Anjani Agri Care',/g, `brand: '${NEW_COMPANY}',`);

dspUi = dspUi.replace(/<div style="font-size:20px; font-weight:800; color:#0C3925 !important; letter-spacing:-0.4px;">Anjani Agri Care<\/div>/g,
  `<div style="font-size:20px; font-weight:800; color:#0C3925 !important; letter-spacing:-0.4px;">${NEW_COMPANY}</div>`);

dspUi = dspUi.replace(/<span>Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot, Gujarat\.<\/span>/g,
  `<span>${NEW_ADDR}</span>`);

dspUi = dspUi.replace(/<div style="font-size:13\.5px; font-weight:700; color:#0f172a;">Anjani Agri Care<\/div>/g,
  `<div style="font-size:13.5px; font-weight:700; color:#0f172a;">${NEW_COMPANY}</div>`);

dspUi = dspUi.replace(/Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot/g,
  NEW_ADDR);

// Update Bank Details and Signature in dispatch-ui modal footer
const oldModalFooter = `            <!-- Footer: Bank Details + Signature (Always Visible on Page 1) -->
            <div style="display:grid; grid-template-columns:1fr auto auto; gap:20px; border-top:2px solid #0C3925; padding-top:14px; margin-top:14px; align-items:flex-end;">
              <div>
                <div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#0C3925; margin-bottom:5px;">Payment Details</div>
                <div style="font-size:11.5px; line-height:1.5; color:#1e293b;">
                  <div><strong>Bank:</strong> PUNJAB NATIONAL BANK</div>
                  <div><strong>A/C No.:</strong> 9178002100002019</div>
                  <div><strong>IFSC:</strong> PUNB0917800</div>
                  <div><strong>UPI:</strong> 9427213943m@pnb</div>
                </div>
              </div>
              <div id="modal-qr-block" style="text-align:center; min-width:90px;">
                <div id="qr-canvas" style="width:90px; height:90px; margin:0 auto; display:flex; align-items:center; justify-content:center;"></div>
                <div style="font-size:9.5px; font-weight:700; color:#64748b; margin-top:4px;">Scan to Pay</div>
              </div>
              <div style="text-align:center; min-width:160px;">
                <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#64748b; margin-bottom:4px;">Authorized Signature</div>
                <div style="height:32px; display:flex; align-items:center; justify-content:center;">
                  <span style="font-family:'Brush Script MT', 'Segoe Script', cursive, sans-serif; font-size:22px; font-weight:700; color:#0C3925;">Tirth</span>
                </div>
                <div style="font-size:11.5px; font-weight:700; color:#000; border-top:1px solid #000; padding-top:4px;">Authorized Signatory</div>
              </div>
            </div>`;

const newModalFooter = `            <!-- Footer: Signature (Bank details removed) -->
            <div style="display:flex; justify-content:space-between; border-top:2px solid #0C3925; padding-top:14px; margin-top:14px; align-items:flex-end;">
              <div style="font-size:11.5px; color:#64748b; line-height:1.5;">
                <div style="font-weight:600; color:#0C3925;">Thank you for your business!</div>
                <div style="font-size:10px; color:#94a3b8; margin-top:2px;">This is a computer-generated commercial tax invoice.</div>
              </div>
              <div style="text-align:center; min-width:160px;">
                <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#64748b; margin-bottom:4px;">Authorized Signature</div>
                <div style="height:32px; display:flex; align-items:center; justify-content:center;">
                  <span style="font-family:'Brush Script MT', 'Segoe Script', cursive, sans-serif; font-size:22px; font-weight:700; color:#0C3925;">Chirag</span>
                </div>
                <div style="font-size:11.5px; font-weight:700; color:#000; border-top:1px solid #000; padding-top:4px;">Authorized Signatory</div>
              </div>
            </div>`;

if (dspUi.includes(oldModalFooter)) {
  dspUi = dspUi.replace(oldModalFooter, newModalFooter);
} else {
  // Replace Tirth with Chirag in signature
  dspUi = dspUi.replace(/>Tirth<\/span>/g, '>Chirag</span>');
}

// Clear bank details in payload
dspUi = dspUi.replace(/bank: \{\s*name: 'PUNJAB NATIONAL BANK',\s*account: '9178002100002019',\s*ifsc: 'PUNB0917800',\s*upi: '9427213943m@pnb'\s*\}/g,
  `bank: { name: '', account: '', ifsc: '', upi: '' }`);
dspUi = dspUi.replace(/showQR: true/g, 'showQR: false');

fs.writeFileSync('assets/js/dispatch-ui.js', dspUi, 'utf8');
console.log('✓ Updated assets/js/dispatch-ui.js');

// 2. Update Invoice Builder/index.html & apps/Invoice Builder/index.html
function updateInvoiceBuilderHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');

  c = c.replace(/value="Anjani Agri Care"/g, `value="${NEW_COMPANY}"`);
  c = c.replace(/Anjani Agri Care/g, NEW_COMPANY);
  c = c.replace(/Anjani ERP/g, 'Afield ERP');
  c = c.replace(/value="Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot"/g, `value="${NEW_ADDR}"`);
  c = c.replace(/value="9664675227"/g, `value="${NEW_PHONE}"`);
  c = c.replace(/96646 75227/g, NEW_PHONE);
  c = c.replace(/skagro3105@gmail\.com/g, NEW_EMAIL);
  c = c.replace(/Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot, Gujarat\./g, NEW_ADDR);
  c = c.replace(/Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot/g, NEW_ADDR);

  // Clear bank input values
  c = c.replace(/value="PUNJAB NATIONAL BANK"/g, 'value=""');
  c = c.replace(/value="9178002100002019"/g, 'value=""');
  c = c.replace(/value="PUNB0917800"/g, 'value=""');
  c = c.replace(/value="9427213943m@pnb"/g, 'value=""');

  // Change signature text Tirth to Chirag
  c = c.replace(/>Tirth<\/div>/g, '>Chirag</div>');

  // Hide bank block by default if bank details are removed
  c = c.replace(/<div class="bank-block" id="bank-block">/g, '<div class="bank-block" id="bank-block" style="display:none;">');

  fs.writeFileSync(filePath, c, 'utf8');
  console.log(`✓ Updated ${filePath}`);
}

updateInvoiceBuilderHtml('Invoice Builder/index.html');
updateInvoiceBuilderHtml('apps/Invoice Builder/index.html');

// 3. Update Invoice Builder/js/invoice-pdf.js & apps/Invoice Builder/js/invoice-pdf.js
function updateInvoicePdfJs(filePath) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');

  c = c.replace(/'Anjani Agri Care'/g, `'${NEW_COMPANY}'`);
  c = c.replace(/"Anjani Agri Care"/g, `"${NEW_COMPANY}"`);
  c = c.replace(/Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot/g, NEW_ADDR);
  c = c.replace(/9664675227/g, NEW_PHONE_CLEAN);
  c = c.replace(/skagro3105@gmail\.com/g, NEW_EMAIL);

  // Signature: Tirth -> Chirag
  c = c.replace(/pdf\.text\('Tirth', sigCenterX, footerY \+ 13\.5, { align: 'center' }\);/g,
    `pdf.text('Chirag', sigCenterX, footerY + 13.5, { align: 'center' });`);
  c = c.replace(/\/\/ Draw "Tirth" as signature text/g, '// Draw "Chirag" as signature text');

  // Make Payment Details only render if bankName or bankAcc exist
  const oldBankDraw = `    // 7A. Left: Payment Details
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...C_DARK_GREEN);
    pdf.text('Payment Details', margin, footerY + 5.5);

    const bankLines = [
      { label: 'Bank: ', val: bankName },
      { label: 'A/C No.: ', val: bankAcc },
      { label: 'IFSC: ', val: bankIfsc },
      { label: 'UPI: ', val: bankUpi }
    ];

    let bLineY = footerY + 10.0;
    bankLines.forEach(bl => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...C_TEXT_MAIN);
      pdf.text(bl.label, margin, bLineY);

      const lblW = pdf.getTextWidth(bl.label);
      pdf.setFont('helvetica', 'normal');
      pdf.text(bl.val || '—', margin + lblW + 1, bLineY);
      bLineY += 4.0;
    });`;

  const newBankDraw = `    // 7A. Left: Payment Details (Only rendered if details are provided)
    const hasBank = Boolean((bankName && bankName.trim()) || (bankAcc && bankAcc.trim()) || (bankIfsc && bankIfsc.trim()));
    if (hasBank) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...C_DARK_GREEN);
      pdf.text('Payment Details', margin, footerY + 5.5);

      const bankLines = [
        bankName ? { label: 'Bank: ', val: bankName } : null,
        bankAcc ? { label: 'A/C No.: ', val: bankAcc } : null,
        bankIfsc ? { label: 'IFSC: ', val: bankIfsc } : null,
        bankUpi ? { label: 'UPI: ', val: bankUpi } : null
      ].filter(Boolean);

      let bLineY = footerY + 10.0;
      bankLines.forEach(bl => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...C_TEXT_MAIN);
        pdf.text(bl.label, margin, bLineY);

        const lblW = pdf.getTextWidth(bl.label);
        pdf.setFont('helvetica', 'normal');
        pdf.text(bl.val || '—', margin + lblW + 1, bLineY);
        bLineY += 4.0;
      });
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...C_TEXT_MUTED);
      pdf.text('Thank you for your business.', margin, footerY + 10.0);
    }`;

  if (c.includes(oldBankDraw)) {
    c = c.replace(oldBankDraw, newBankDraw);
  }

  // Only draw QR if showQr and bankUpi is present
  c = c.replace(/if \(showQr\) \{/g, 'if (showQr && bankUpi && bankUpi.trim()) {');

  fs.writeFileSync(filePath, c, 'utf8');
  console.log(`✓ Updated ${filePath}`);
}

updateInvoicePdfJs('Invoice Builder/js/invoice-pdf.js');
updateInvoicePdfJs('apps/Invoice Builder/js/invoice-pdf.js');

// 4. Update Invoice Builder/js/main.js & apps/Invoice Builder/js/main.js
function updateInvoiceMainJs(filePath) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');

  c = c.replace(/'Anjani Agri Care'/g, `'${NEW_COMPANY}'`);
  c = c.replace(/"Anjani Agri Care"/g, `"${NEW_COMPANY}"`);
  c = c.replace(/Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot/g, NEW_ADDR);
  c = c.replace(/9664675227/g, NEW_PHONE_CLEAN);
  c = c.replace(/skagro3105@gmail\.com/g, NEW_EMAIL);
  c = c.replace(/username: 'Tirth', password: 'Tirth', mobile: '9664675227'/g, `username: 'Chirag', password: 'Chirag', mobile: '${NEW_PHONE_CLEAN}'`);

  // Update bankBlock visibility in updatePreview
  const bankBlockSync = `  const bankBlock = $('bank-block');
  const hasBankData = Boolean(($('s-bank-name')?.value || '').trim() || ($('s-bank-acc')?.value || '').trim());
  if (bankBlock) bankBlock.style.display = hasBankData ? '' : 'none';`;

  if (!c.includes('const hasBankData =')) {
    c = c.replace(/function updateBillFromPreview\(\) \{/g, `function updateBillFromPreview() {\n${bankBlockSync}`);
  }

  fs.writeFileSync(filePath, c, 'utf8');
  console.log(`✓ Updated ${filePath}`);
}

updateInvoiceMainJs('Invoice Builder/js/main.js');
updateInvoiceMainJs('apps/Invoice Builder/js/main.js');

// 5. Update Invoice Builder/js/storage.js & apps/Invoice Builder/js/storage.js
function updateInvoiceStorageJs(filePath) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');

  c = c.replace(/'Anjani Agri Care'/g, `'${NEW_COMPANY}'`);
  c = c.replace(/"Anjani Agri Care"/g, `"${NEW_COMPANY}"`);
  c = c.replace(/9664675227/g, NEW_PHONE_CLEAN);
  c = c.replace(/skagro3105@gmail\.com/g, NEW_EMAIL);

  fs.writeFileSync(filePath, c, 'utf8');
  console.log(`✓ Updated ${filePath}`);
}

updateInvoiceStorageJs('Invoice Builder/js/storage.js');
updateInvoiceStorageJs('apps/Invoice Builder/js/storage.js');

// 6. Update shared-layout.js
let sharedLayout = fs.readFileSync('assets/js/shared-layout.js', 'utf8');
sharedLayout = sharedLayout.replace(/'Anjani Agri Care'/g, `'${NEW_COMPANY}'`);
sharedLayout = sharedLayout.replace(/>Anjani Agri Care<\/div>/g, `>${NEW_COMPANY}</div>`);
fs.writeFileSync('assets/js/shared-layout.js', sharedLayout, 'utf8');
console.log('✓ Updated assets/js/shared-layout.js');

// 7. Update tenant-context.js & companies.js
let tenantCtx = fs.readFileSync('assets/js/tenant-context.js', 'utf8');
tenantCtx = tenantCtx.replace(/'Anjani Agri Care'/g, `'${NEW_COMPANY}'`);
fs.writeFileSync('assets/js/tenant-context.js', tenantCtx, 'utf8');
console.log('✓ Updated assets/js/tenant-context.js');

let compJs = fs.readFileSync('assets/js/companies.js', 'utf8');
compJs = compJs.replace(/Anjani Agri Care/g, NEW_COMPANY);
fs.writeFileSync('assets/js/companies.js', compJs, 'utf8');
console.log('✓ Updated assets/js/companies.js');

// 8. Update login.html, index.html, manifest.json, profile.html
let loginHtml = fs.readFileSync('login.html', 'utf8');
loginHtml = loginHtml.replace(/Anjani Agri Care/g, NEW_COMPANY);
loginHtml = loginHtml.replace(/Anjani ERP/g, 'Afield ERP');
fs.writeFileSync('login.html', loginHtml, 'utf8');
console.log('✓ Updated login.html');

let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(/Anjani Agri Care/g, NEW_COMPANY);
indexHtml = indexHtml.replace(/Anjani ERP/g, 'Afield ERP');
fs.writeFileSync('index.html', indexHtml, 'utf8');
console.log('✓ Updated index.html');

let manifestJson = fs.readFileSync('manifest.json', 'utf8');
manifestJson = manifestJson.replace(/Anjani Agri Care/g, NEW_COMPANY);
manifestJson = manifestJson.replace(/Anjani ERP/g, 'Afield ERP');
fs.writeFileSync('manifest.json', manifestJson, 'utf8');
console.log('✓ Updated manifest.json');

let profileHtml = fs.readFileSync('pages/profile.html', 'utf8');
profileHtml = profileHtml.replace(/Anjani Agri Care/g, NEW_COMPANY);
profileHtml = profileHtml.replace(/Sr\. No\. 67 and 68, Plot No\. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot, Gujarat\./g, NEW_ADDR);
fs.writeFileSync('pages/profile.html', profileHtml, 'utf8');
console.log('✓ Updated pages/profile.html');

// 9. Update all HTML titles in pages/*.html
const pages = fs.readdirSync('pages');
for (const p of pages) {
  if (p.endsWith('.html')) {
    const fullPath = path.join('pages', p);
    let content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('Anjani Agri Care') || content.includes('Anjani ERP')) {
      content = content.replace(/Anjani Agri Care/g, NEW_COMPANY);
      content = content.replace(/Anjani ERP/g, 'Afield ERP');
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✓ Updated pages/${p}`);
    }
  }
}

console.log('\nAll files updated with Afield Crop Care branding successfully!');
