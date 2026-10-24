const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
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
    localStorage.setItem('active_company_code', 'AAC');
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}/pages/intercompany.html`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const reconBtn = document.querySelector('.tab-btn[data-tab="Reconciliation"]');
    if (reconBtn) reconBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const info = await page.evaluate(() => {
    const table = document.getElementById('recon-recipients-table');
    const wrap = table ? table.closest('.table-wrap') : null;
    const emptyRow = table ? table.querySelector('tr.empty-row') : null;
    const td = table ? table.querySelector('td') : null;
    const emptyState = table ? table.querySelector('.empty-state') : null;
    const svg = emptyState ? emptyState.querySelector('svg') : null;
    const p1 = emptyState ? emptyState.querySelector('p') : null;

    const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
    const tdRect = td ? td.getBoundingClientRect() : null;
    const eRect = emptyState ? emptyState.getBoundingClientRect() : null;
    const sRect = svg ? svg.getBoundingClientRect() : null;
    const pRect = p1 ? p1.getBoundingClientRect() : null;

    return {
      wrapRect,
      tdRect,
      eRect,
      sRect,
      pRect,
      wrapCenter: wrapRect ? wrapRect.left + wrapRect.width / 2 : 0,
      svgCenter: sRect ? sRect.left + sRect.width / 2 : 0,
      pCenter: pRect ? pRect.left + pRect.width / 2 : 0,
      tdComputed: td ? {
        display: getComputedStyle(td).display,
        padding: getComputedStyle(td).padding,
        textAlign: getComputedStyle(td).textAlign,
        width: getComputedStyle(td).width
      } : null,
      emptyStateComputed: emptyState ? {
        display: getComputedStyle(emptyState).display,
        textAlign: getComputedStyle(emptyState).textAlign,
        padding: getComputedStyle(emptyState).padding
      } : null
    };
  });
  console.log('MOBILE 375 RESULTS:', JSON.stringify(info, null, 2));
  await browser.close();
})();
