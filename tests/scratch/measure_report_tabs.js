const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();

  // Login
  await page.goto(BASE_URL + '/login.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({ email: 'admin@anjani.test', password: 'Test@Agro2026!' });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
  });
  await new Promise(r => setTimeout(r, 1200));

  const viewports = [
    { name: 'desktop-1366', width: 1366, height: 768 },
    { name: 'laptop-1024', width: 1024, height: 768 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-430', width: 430, height: 932 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'mobile-360', width: 360, height: 780 },
    { name: 'mobile-320', width: 320, height: 600 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL + '/pages/reports.html', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    const tabsData = await page.evaluate(() => {
      const container = document.getElementById('reports-tabs');
      const tabs = Array.from(container.querySelectorAll('.tab-btn'));
      return {
        containerDisplay: window.getComputedStyle(container).display,
        containerWidth: container.offsetWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        tabs: tabs.map(t => {
          const rect = t.getBoundingClientRect();
          const comp = window.getComputedStyle(t);
          return {
            text: t.textContent.trim(),
            dataTab: t.getAttribute('data-tab'),
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            padding: comp.padding,
            fontSize: comp.fontSize,
            lineHeight: comp.lineHeight
          };
        })
      };
    });

    console.log(`\n=== Viewport: ${vp.name} (${vp.width}px) ===`);
    console.log(`Container: display=${tabsData.containerDisplay}, width=${tabsData.containerWidth}px | Page scroll/client: ${tabsData.scrollWidth}/${tabsData.clientWidth}`);
    tabsData.tabs.forEach(t => {
      console.log(`  [${t.dataTab}] "${t.text}" -> width: ${t.width}px, height: ${t.height}px, padding: ${t.padding}`);
    });
  }

  await browser.close();
})();
