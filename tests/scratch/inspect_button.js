const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.goto(BASE_URL + '/login.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({ email: 'admin@anjani.test', password: 'Test@Agro2026!' });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
  });
  await new Promise(r => setTimeout(r, 1200));

  await page.setViewport({ width: 320, height: 600 });
  await page.goto(BASE_URL + '/pages/reports.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 600));

  const debug = await page.evaluate(() => {
    const btn = document.querySelector('[data-tab="CustomerSales"]');
    const comp = window.getComputedStyle(btn);
    const container = document.getElementById('reports-tabs');
    const contComp = window.getComputedStyle(container);
    return {
      containerDisplay: contComp.display,
      containerGridCols: contComp.gridTemplateColumns,
      containerWidth: container.offsetWidth,
      btnWidth: btn.offsetWidth,
      btnScrollWidth: btn.scrollWidth,
      minWidth: comp.minWidth,
      maxWidth: comp.maxWidth,
      whiteSpace: comp.whiteSpace,
      wordBreak: comp.wordBreak,
      overflowWrap: comp.overflowWrap,
      fontSize: comp.fontSize,
      padding: comp.padding,
      boxSizing: comp.boxSizing
    };
  });
  console.log('CustomerSales 320px debug:', debug);
  await browser.close();
})();
