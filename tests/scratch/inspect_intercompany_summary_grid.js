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

  await page.goto(`${BASE_URL}/pages/intercompany.html`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const reconBtn = document.querySelector('.tab-btn[data-tab="Reconciliation"]');
    if (reconBtn) reconBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const debug = await page.evaluate(() => {
    const body = document.body;
    const main = document.querySelector('main') || document.querySelector('.main-content');
    const container = document.getElementById('reconciliation-view');
    const grid = document.getElementById('intercompany-summary-grid');
    const cards = Array.from(grid ? grid.querySelectorAll('.summary-metric-card') : []);
    const winWidth = window.innerWidth;

    const gridRect = grid ? grid.getBoundingClientRect() : null;
    const containerRect = container ? container.getBoundingClientRect() : null;
    const bodyRect = body.getBoundingClientRect();

    const cardDetails = cards.map((c, i) => {
      const r = c.getBoundingClientRect();
      const label = c.querySelector('.summary-metric-label');
      const val = c.querySelector('.summary-metric-value');
      const sub = c.querySelector('.summary-metric-subtext');
      return {
        idx: i,
        width: Math.round(r.width),
        left: Math.round(r.left),
        right: Math.round(r.right),
        overflowsWindow: Math.round(r.right) > winWidth,
        computed: {
          width: getComputedStyle(c).width,
          minWidth: getComputedStyle(c).minWidth,
          maxWidth: getComputedStyle(c).maxWidth,
          padding: getComputedStyle(c).padding
        },
        label: label ? {
          text: label.innerText,
          scrollWidth: label.scrollWidth,
          clientWidth: label.clientWidth,
          whiteSpace: getComputedStyle(label).whiteSpace
        } : null,
        val: val ? {
          text: val.innerText,
          scrollWidth: val.scrollWidth,
          clientWidth: val.clientWidth
        } : null,
        sub: sub ? {
          text: sub.innerText,
          scrollWidth: sub.scrollWidth,
          clientWidth: sub.clientWidth,
          whiteSpace: getComputedStyle(sub).whiteSpace
        } : null
      };
    });

    return {
      windowWidth: winWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      containerRect: containerRect ? {
        width: Math.round(containerRect.width),
        left: Math.round(containerRect.left),
        right: Math.round(containerRect.right)
      } : null,
      gridRect: gridRect ? {
        width: Math.round(gridRect.width),
        left: Math.round(gridRect.left),
        right: Math.round(gridRect.right)
      } : null,
      gridComputed: grid ? {
        display: getComputedStyle(grid).display,
        gridTemplateColumns: getComputedStyle(grid).gridTemplateColumns,
        gap: getComputedStyle(grid).gap,
        width: getComputedStyle(grid).width,
        maxWidth: getComputedStyle(grid).maxWidth,
        marginLeft: getComputedStyle(grid).marginLeft,
        marginRight: getComputedStyle(grid).marginRight
      } : null,
      cardDetails
    };
  });

  console.log('INTERCOMPANY SUMMARY GRID DEBUG:', JSON.stringify(debug, null, 2));

  await browser.close();
})();
