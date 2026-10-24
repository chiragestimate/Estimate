const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
  });

  page.on('pageerror', err => {
    console.error(`[PAGE UNCAUGHT ERROR]`, err);
  });

  console.log('1. Logging in...');
  await page.goto(BASE_URL + '/login.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({ email: 'admin@anjani.test', password: 'Test@Agro2026!' });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
  });
  await new Promise(r => setTimeout(r, 1200));

  console.log('2. Navigating to Orders page...');
  await page.goto(BASE_URL + '/pages/orders.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('3. Switching to Dispatch tab...');
  await page.evaluate(() => {
    const tab = document.getElementById('tab-dispatches') || document.querySelector('[data-tab="dispatches"]');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  console.log('4. Clicking real view invoice button in dispatch table...');
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('button[onclick*="viewGeneratedInvoice"]');
    if (btn) {
      console.log('Found button:', btn.outerHTML);
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked viewGeneratedInvoice button:', clicked);
  await new Promise(r => setTimeout(r, 2000));

  // Inspect the modal and Open in Invoice Builder button
  const modalInfo = await page.evaluate(() => {
    const modal = document.getElementById('view-invoice-modal');
    const openBtn = document.getElementById('btn-open-invoice-builder');
    return {
      modalDisplay: modal ? window.getComputedStyle(modal).display : 'no modal',
      openBtnHref: openBtn ? openBtn.href : null,
      openBtnVisible: openBtn ? (openBtn.offsetWidth > 0 && openBtn.offsetHeight > 0) : false
    };
  });
  console.log('Modal & Open in Builder info:', modalInfo);

  // Click Open in Invoice Builder
  const targetUrl = await page.evaluate(() => {
    const openBtn = document.getElementById('btn-open-invoice-builder');
    if (openBtn) {
      openBtn.click();
      return openBtn.href;
    }
    return null;
  });
  console.log('Target URL from Open in Builder click:', targetUrl);

  const storageAfterClick = await page.evaluate(() => {
    const res = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.includes('inv') || k.includes('edit')) {
        res[k] = localStorage.getItem(k).substring(0, 120);
      }
    }
    return res;
  });
  console.log('Storage after clicking Open in Builder:', storageAfterClick);

  console.log('5. Navigating to the Builder URL that was opened...');
  await page.goto(targetUrl, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  let builderState = await page.evaluate(() => {
    return {
      url: window.location.href,
      currentInvoiceId: window.currentInvoiceId,
      currentInvoiceFinalized: window.currentInvoiceFinalized,
      invNumVal: document.getElementById('s-inv-num')?.value,
      invNumDisplay: document.getElementById('s-inv-num-display')?.textContent,
      clientName: document.getElementById('s-client-name')?.value,
      clientAddr: document.getElementById('s-client-addr')?.value,
      clientPhone: document.getElementById('s-client-phone')?.value,
      rowCount: window.rows ? window.rows.length : -1,
      rows: window.rows,
      grandTotal: document.getElementById('p-grand-total')?.textContent
    };
  });
  console.log('Invoice Builder opened via dispatch state:', builderState);

  console.log('6. Now navigating to "actual Invoice Builder page" without hash (/Invoice Builder/index.html)...');
  await page.goto(BASE_URL + '/Invoice Builder/index.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  let actualBuilderState = await page.evaluate(() => {
    return {
      url: window.location.href,
      currentInvoiceId: window.currentInvoiceId,
      currentInvoiceFinalized: window.currentInvoiceFinalized,
      invNumVal: document.getElementById('s-inv-num')?.value,
      invNumDisplay: document.getElementById('s-inv-num-display')?.textContent,
      clientName: document.getElementById('s-client-name')?.value,
      clientAddr: document.getElementById('s-client-addr')?.value,
      clientPhone: document.getElementById('s-client-phone')?.value,
      rowCount: window.rows ? window.rows.length : -1,
      rows: window.rows,
      grandTotal: document.getElementById('p-grand-total')?.textContent,
      draftKey: localStorage.getItem('inv_builder_draft') ? 'exists' : 'none',
      editKey: localStorage.getItem('current_edit_invoice') ? 'exists' : 'none',
      lsKey: localStorage.getItem('sk_inv_data_v2') ? 'exists' : 'none'
    };
  });
  console.log('Actual Invoice Builder page state:', actualBuilderState);

  console.log('7. Try clicking "ERP Dashboard" or other buttons, or typing new invoice data...');
  const canEdit = await page.evaluate(() => {
    try {
      const nameInput = document.getElementById('s-client-name');
      const invNumInput = document.getElementById('s-inv-num');
      const saveBtn = document.getElementById('save-cloud-btn');
      return {
        nameDisabled: nameInput?.disabled,
        nameReadOnly: nameInput?.readOnly,
        invNumDisabled: invNumInput?.disabled,
        saveBtnDisabled: saveBtn?.disabled,
        saveBtnClickable: !!saveBtn
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Inputs editable status:', canEdit);

  console.log('8. Reloading Invoice Builder page...');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const afterReloadState = await page.evaluate(() => {
    return {
      url: window.location.href,
      currentInvoiceId: window.currentInvoiceId,
      currentInvoiceFinalized: window.currentInvoiceFinalized,
      invNumVal: document.getElementById('s-inv-num')?.value,
      invNumDisplay: document.getElementById('s-inv-num-display')?.textContent,
      clientName: document.getElementById('s-client-name')?.value,
      rowCount: window.rows ? window.rows.length : -1,
      rows: window.rows
    };
  });
  console.log('After reload state:', afterReloadState);

  await browser.close();
})();
