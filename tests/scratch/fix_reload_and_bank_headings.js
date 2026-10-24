const fs = require('fs');

// 1. Fix assets/js/shared-layout.js
let sl = fs.readFileSync('assets/js/shared-layout.js', 'utf8');

// Ensure getActiveCompanyName converts any cached 'Anjani Agri Care' to 'Afield Crop Care'
sl = sl.replace(/function getActiveCompanyName\(\) \{[\s\S]*?return localStorage\.getItem\('erp_active_company_name'\) \|\| 'Afield Crop Care';\s*\}/,
`function getActiveCompanyName() {
  if (window.TENANT_CONTEXT && window.TENANT_CONTEXT.getActiveCompany) {
    const act = window.TENANT_CONTEXT.getActiveCompany();
    if (act && act.name) {
      if (act.name === 'Anjani Agri Care') act.name = 'Afield Crop Care';
      return act.name;
    }
  }
  const stored = localStorage.getItem('erp_active_company_name');
  if (stored === 'Anjani Agri Care' || !stored) {
    localStorage.setItem('erp_active_company_name', 'Afield Crop Care');
    return 'Afield Crop Care';
  }
  return stored;
}`);

// Ensure updateDropdown in shared-layout replaces any 'Anjani Agri Care'
sl = sl.replace(/const updateDropdown = \(\) => \{[\s\S]*?const sidebarBrand = document\.getElementById\('sidebar-brand-name'\);/,
`const updateDropdown = () => {
    let active = (window.TENANT_CONTEXT && window.TENANT_CONTEXT.getActiveCompany)
      ? window.TENANT_CONTEXT.getActiveCompany()
      : { id: getActiveCompanyId(), name: getActiveCompanyName(), code: getActiveCompanyCode(), is_manufacturing: true };
    if (active && (active.name === 'Anjani Agri Care' || !active.name)) {
      active.name = 'Afield Crop Care';
      if (localStorage.getItem('erp_active_company_name') === 'Anjani Agri Care') {
        localStorage.setItem('erp_active_company_name', 'Afield Crop Care');
      }
    }
    const companies = (window.TENANT_CONTEXT && window.TENANT_CONTEXT.getAuthorizedCompanies)
      ? window.TENANT_CONTEXT.getAuthorizedCompanies()
      : [active];
    if (companies && Array.isArray(companies)) {
      companies.forEach(c => {
        if (c.name === 'Anjani Agri Care') c.name = 'Afield Crop Care';
      });
    }

    const nameEl = document.getElementById('topbar-company-name');
    const codeEl = document.getElementById('topbar-company-code');
    const sidebarBrand = document.getElementById('sidebar-brand-name');`);

fs.writeFileSync('assets/js/shared-layout.js', sl, 'utf8');
console.log('✓ Updated assets/js/shared-layout.js');

// 2. Fix assets/js/tenant-context.js
let tc = fs.readFileSync('assets/js/tenant-context.js', 'utf8');

tc = tc.replace(/this\._authorizedCompanies = \(companies && companies\.length > 0\) \? companies : \[\];/,
`this._authorizedCompanies = (companies && companies.length > 0) ? companies.map(c => ({
          ...c,
          name: c.name === 'Anjani Agri Care' ? 'Afield Crop Care' : c.name
        })) : [];`);

tc = tc.replace(/this\._activeCompany = matched \|\| \{/,
`if (matched && matched.name === 'Anjani Agri Care') {
          matched.name = 'Afield Crop Care';
        }
        this._activeCompany = matched || {`);

tc = tc.replace(/name: \(typeof localStorage !== 'undefined' && localStorage\.getItem\('erp_active_company_name'\)\) \|\| 'Afield Crop Care',/g,
`name: (typeof localStorage !== 'undefined' && (localStorage.getItem('erp_active_company_name') === 'Anjani Agri Care' ? 'Afield Crop Care' : (localStorage.getItem('erp_active_company_name') || 'Afield Crop Care'))),`);

fs.writeFileSync('assets/js/tenant-context.js', tc, 'utf8');
console.log('✓ Updated assets/js/tenant-context.js');

// 3. Fix assets/js/orders.js, inventory.js, user-roles.js
let ordersJs = fs.readFileSync('assets/js/orders.js', 'utf8');
ordersJs = ordersJs.replace(/name: 'Anjani Agri Care'/g, "name: 'Afield Crop Care'");
fs.writeFileSync('assets/js/orders.js', ordersJs, 'utf8');
console.log('✓ Updated assets/js/orders.js');

let invJs = fs.readFileSync('assets/js/inventory.js', 'utf8');
invJs = invJs.replace(/name: 'Anjani Agri Care'/g, "name: 'Afield Crop Care'");
fs.writeFileSync('assets/js/inventory.js', invJs, 'utf8');
console.log('✓ Updated assets/js/inventory.js');

let rolesJs = fs.readFileSync('assets/js/user-roles.js', 'utf8');
rolesJs = rolesJs.replace(/name: 'Anjani Agri Care'/g, "name: 'Afield Crop Care'");
fs.writeFileSync('assets/js/user-roles.js', rolesJs, 'utf8');
console.log('✓ Updated assets/js/user-roles.js');

// 4. Fix app.js to sanitize localStorage on load
let appJs = fs.readFileSync('assets/js/app.js', 'utf8');
if (!appJs.includes("if (localStorage.getItem('erp_active_company_name') === 'Anjani Agri Care')")) {
  appJs = `// Immediate company branding normalization
(function() {
  if (typeof localStorage !== 'undefined') {
    if (localStorage.getItem('erp_active_company_name') === 'Anjani Agri Care' || !localStorage.getItem('erp_active_company_name')) {
      localStorage.setItem('erp_active_company_name', 'Afield Crop Care');
    }
    if (localStorage.getItem('active_company_name') === 'Anjani Agri Care') {
      localStorage.setItem('active_company_name', 'Afield Crop Care');
    }
  }
})();\n` + appJs;
  fs.writeFileSync('assets/js/app.js', appJs, 'utf8');
  console.log('✓ Updated assets/js/app.js');
}

// 5. Restore Bank Details Headings in Invoice Builder & Commercial Tax Invoice modal
// In assets/js/dispatch-ui.js:
let dspUi = fs.readFileSync('assets/js/dispatch-ui.js', 'utf8');

const targetModalFooter = `            <!-- Footer: Bank Details (Headings Preserved) + Signature -->
            <div style="display:grid; grid-template-columns:1fr auto; gap:20px; border-top:2px solid #0C3925; padding-top:14px; margin-top:14px; align-items:flex-end;">
              <div>
                <div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#0C3925; margin-bottom:5px;">Payment Details</div>
                <div style="font-size:11.5px; line-height:1.5; color:#1e293b;">
                  <div><strong>Bank:</strong> <span id="modal-bank-name">—</span></div>
                  <div><strong>A/C No.:</strong> <span id="modal-bank-acc">—</span></div>
                  <div><strong>IFSC:</strong> <span id="modal-bank-ifsc">—</span></div>
                  <div><strong>UPI:</strong> <span id="modal-bank-upi">—</span></div>
                </div>
              </div>
              <div style="text-align:center; min-width:160px;">
                <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#64748b; margin-bottom:4px;">Authorized Signature</div>
                <div style="height:32px; display:flex; align-items:center; justify-content:center;">
                  <span style="font-family:'Brush Script MT', 'Segoe Script', cursive, sans-serif; font-size:22px; font-weight:700; color:#0C3925;">Chirag</span>
                </div>
                <div style="font-size:11.5px; font-weight:700; color:#000; border-top:1px solid #000; padding-top:4px;">Authorized Signatory</div>
              </div>
            </div>`;

dspUi = dspUi.replace(/<!-- Footer: Signature \(Bank details removed\) -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
  `${targetModalFooter}\n          </div>\n        </div>`);

fs.writeFileSync('assets/js/dispatch-ui.js', dspUi, 'utf8');
console.log('✓ Updated assets/js/dispatch-ui.js bank headings');

// 6. In Invoice Builder/index.html & apps/Invoice Builder/index.html
function restoreBankHeadingsHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');

  // Make sure #bank-block is visible (no display:none)
  c = c.replace(/<div class="bank-block" id="bank-block" style="display:none;">/g, '<div class="bank-block" id="bank-block">');

  fs.writeFileSync(filePath, c, 'utf8');
  console.log(`✓ Restored bank headings in ${filePath}`);
}
restoreBankHeadingsHtml('Invoice Builder/index.html');
restoreBankHeadingsHtml('apps/Invoice Builder/index.html');

// 7. In Invoice Builder/js/invoice-pdf.js & apps/Invoice Builder/js/invoice-pdf.js
function restoreBankHeadingsPdf(filePath) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');

  const oldPdfBank = `    // 7A. Left: Payment Details (Only rendered if details are provided)
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

  const restoredPdfBank = `    // 7A. Left: Payment Details (Headings always drawn as requested; values empty/dashed if not provided)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...C_DARK_GREEN);
    pdf.text('Payment Details', margin, footerY + 5.5);

    const bankLines = [
      { label: 'Bank: ', val: bankName || '—' },
      { label: 'A/C No.: ', val: bankAcc || '—' },
      { label: 'IFSC: ', val: bankIfsc || '—' },
      { label: 'UPI: ', val: bankUpi || '—' }
    ];

    let bLineY = footerY + 10.0;
    bankLines.forEach(bl => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...C_TEXT_MAIN);
      pdf.text(bl.label, margin, bLineY);

      const lblW = pdf.getTextWidth(bl.label);
      pdf.setFont('helvetica', 'normal');
      pdf.text(bl.val, margin + lblW + 1, bLineY);
      bLineY += 4.0;
    });`;

  if (c.includes(oldPdfBank)) {
    c = c.replace(oldPdfBank, restoredPdfBank);
  }

  fs.writeFileSync(filePath, c, 'utf8');
  console.log(`✓ Restored bank headings in PDF ${filePath}`);
}

restoreBankHeadingsPdf('Invoice Builder/js/invoice-pdf.js');
restoreBankHeadingsPdf('apps/Invoice Builder/js/invoice-pdf.js');

// 8. In Invoice Builder/js/main.js & apps/Invoice Builder/js/main.js
function fixMainJsBankDisplay(filePath) {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');

  // Remove the hiding of bank-block
  c = c.replace(/const bankBlock = \$\('bank-block'\);\s*const hasBankData = Boolean\(\(\$\('s-bank-name'\)\?\.value \|\| ''\)\.trim\(\) \|\| \(\$\('s-bank-acc'\)\?\.value \|\| ''\)\.trim\(\)\);\s*if \(bankBlock\) bankBlock\.style\.display = hasBankData \? '' : 'none';/g, '');

  fs.writeFileSync(filePath, c, 'utf8');
  console.log(`✓ Cleaned bank-block toggle in ${filePath}`);
}

fixMainJsBankDisplay('Invoice Builder/js/main.js');
fixMainJsBankDisplay('apps/Invoice Builder/js/main.js');

console.log('\nAll updates applied successfully!');
