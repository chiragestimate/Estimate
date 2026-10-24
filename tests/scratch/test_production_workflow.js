const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({ email: 'admin@anjani.test', password: 'Test@Agro2026!' });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
    localStorage.setItem('active_company_id', '623');
    localStorage.setItem('active_company_code', 'AAC');
  });
  await new Promise(r => setTimeout(r, 1200));

  await page.goto(`${BASE_URL}/pages/production.html`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  // Open modal
  await page.evaluate(() => {
    window.openProductionModal();
  });
  await new Promise(r => setTimeout(r, 500));

  // Check initial state
  const state1 = await page.evaluate(() => {
    return {
      rowCount: document.querySelectorAll('.production-items-table tr.production-item-row').length
    };
  });

  // Add ingredient row
  await page.evaluate(() => {
    window.addIngredientRow();
  });
  await new Promise(r => setTimeout(r, 400));

  // Add finished product row
  await page.evaluate(() => {
    const pSel = document.getElementById('product-select');
    if (pSel && pSel.options.length > 1) {
      pSel.selectedIndex = 1;
      pSel.dispatchEvent(new Event('change'));
    }
    window.addFinishedProductRow();
  });
  await new Promise(r => setTimeout(r, 400));

  // Check state after adding 2 items
  const state2 = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.production-items-table tr.production-item-row'));
    return {
      rowCount: rows.length,
      actions: rows.map(r => r.classList.contains('is-increase') ? 'INCREASE' : 'DECREASE')
    };
  });

  // Remove first row
  await page.evaluate(() => {
    window.removeIngredientRow(0);
  });
  await new Promise(r => setTimeout(r, 400));

  const state3 = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.production-items-table tr.production-item-row'));
    return {
      rowCount: rows.length,
      actions: rows.map(r => r.classList.contains('is-increase') ? 'INCREASE' : 'DECREASE')
    };
  });

  console.log('WORKFLOW TEST:', { state1, state2, state3 });

  await browser.close();
})();
