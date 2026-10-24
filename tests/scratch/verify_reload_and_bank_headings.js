const puppeteer = require('puppeteer-core');
const assert = require('assert');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1:5174';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('--- Starting Verification: Company Name on Reload & Bank Headings ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 1. Authenticate
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({
      email: 'admin@anjani.test',
      password: 'Test@Agro2026!'
    });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
    localStorage.setItem('active_company_id', '623');
    localStorage.setItem('active_company_code', 'ACC');
    localStorage.setItem('erp_active_company_name', 'Afield Crop Care');
  });

  // 2. Navigate to orders.html and test initial load & after full reload
  await page.goto(`${BASE_URL}/pages/orders.html`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.allOrders && window.allOrders.length > 0, { timeout: 10000 });
  await sleep(1500); // Allow all background tenant-context DB queries to finish

  const namesAfterLoad = await page.evaluate(() => {
    return {
      topbar: document.getElementById('topbar-company-name')?.textContent,
      sidebar: document.getElementById('sidebar-brand-name')?.textContent,
      mobile: document.getElementById('topbar-mobile-brand-name')?.textContent
    };
  });
  console.log('Company names after initial page load:', namesAfterLoad);
  assert.strictEqual(namesAfterLoad.topbar, 'Afield Crop Care');
  assert.strictEqual(namesAfterLoad.sidebar, 'Afield Crop Care');

  // Reload the page
  console.log('Reloading page...');
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2000); // Wait for post-reload async DB synchronization

  const namesAfterReload = await page.evaluate(() => {
    return {
      topbar: document.getElementById('topbar-company-name')?.textContent,
      sidebar: document.getElementById('sidebar-brand-name')?.textContent,
      mobile: document.getElementById('topbar-mobile-brand-name')?.textContent
    };
  });
  console.log('Company names after page reload completes:', namesAfterReload);
  assert.strictEqual(namesAfterReload.topbar, 'Afield Crop Care');
  assert.strictEqual(namesAfterReload.sidebar, 'Afield Crop Care');
  console.log('✓ Verified: Company name PERMANENTLY stays "Afield Crop Care" after reload!');

  // 3. Switch to Dispatches tab & inspect Commercial Invoice modal
  console.log('Checking Commercial Tax Invoice modal bank headings and signature...');
  await page.evaluate(() => {
    const dspTab = document.querySelector('.tabs .tab-btn[data-tab="Dispatches"]');
    if (dspTab) dspTab.click();
  });
  await sleep(1000);

  // Open invoice via DISPATCH_UI
  await page.evaluate(async () => {
    const dsp = (window.allDispatches || []).find(d => d.dispatch_no === 'DSP-02') || (window.allDispatches || [])[0];
    if (dsp && window.DISPATCH_UI) {
      await window.DISPATCH_UI.viewGeneratedInvoice(dsp.id);
    }
  });
  await sleep(1500);

  const modalFooterCheck = await page.evaluate(() => {
    const modal = document.getElementById('view-invoice-paper');
    if (!modal) return null;
    const text = modal.innerText || modal.textContent;
    return {
      hasPaymentDetails: text.toLowerCase().includes('payment details'),
      hasBankHeading: text.includes('Bank:'),
      hasAccHeading: text.includes('A/C No.:'),
      hasIfscHeading: text.includes('IFSC:'),
      hasUpiHeading: text.includes('UPI:'),
      hasChirag: text.includes('Chirag'),
      hasTirth: text.includes('Tirth'),
      hasAnjani: text.includes('Anjani Agri Care')
    };
  });
  console.log('Commercial Invoice Modal check:', modalFooterCheck);
  assert.strictEqual(modalFooterCheck.hasPaymentDetails, true);
  assert.strictEqual(modalFooterCheck.hasBankHeading, true);
  assert.strictEqual(modalFooterCheck.hasAccHeading, true);
  assert.strictEqual(modalFooterCheck.hasIfscHeading, true);
  assert.strictEqual(modalFooterCheck.hasUpiHeading, true);
  assert.strictEqual(modalFooterCheck.hasChirag, true);
  assert.strictEqual(modalFooterCheck.hasTirth, false);
  console.log('✓ Verified: Modal contains Bank Details headings intact and Chirag signature!');

  // 4. Test Standalone Invoice Builder
  console.log('Checking Standalone Invoice Builder bank headings and signature...');
  await page.goto(`${BASE_URL}/Invoice%20Builder/index.html`, { waitUntil: 'networkidle2' });
  const builderCheck = await page.evaluate(() => {
    const paper = document.getElementById('invoice-paper');
    const text = paper ? (paper.innerText || paper.textContent) : '';
    const bankBlock = document.getElementById('bank-block');
    return {
      bankBlockVisible: bankBlock && bankBlock.style.display !== 'none',
      hasPaymentDetails: text.toLowerCase().includes('payment details'),
      hasBankHeading: text.includes('Bank:'),
      hasAccHeading: text.includes('A/C No.:'),
      hasIfscHeading: text.includes('IFSC:'),
      hasUpiHeading: text.includes('UPI:'),
      sigText: document.getElementById('sig-text')?.textContent
    };
  });
  console.log('Invoice Builder check:', builderCheck);
  assert.strictEqual(builderCheck.bankBlockVisible, true);
  assert.strictEqual(builderCheck.hasPaymentDetails, true);
  assert.strictEqual(builderCheck.hasBankHeading, true);
  assert.strictEqual(builderCheck.hasAccHeading, true);
  assert.strictEqual(builderCheck.hasIfscHeading, true);
  assert.strictEqual(builderCheck.hasUpiHeading, true);
  assert.strictEqual(builderCheck.sigText, 'Chirag');
  console.log('✓ Verified: Standalone Invoice Builder has Bank Headings visible & Chirag signature!');

  await browser.close();
  console.log('\n🎉 ALL RELOAD & BANK HEADINGS CHECKS PASSED PERFECTLY!');
})();
