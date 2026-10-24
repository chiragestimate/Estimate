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
  await new Promise(r => setTimeout(r, 800));

  await page.setViewport({ width: 375, height: 667, isMobile: true });
  await page.goto(BASE_URL + '/pages/orders.html', { waitUntil: 'networkidle2' });

  // Open switcher
  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 400));

  // Click Companies & Branches
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('a.company-nav-item[href="companies.html"]')
  ]);

  console.log('Successfully navigated to:', page.url());
  const pass = page.url().includes('companies.html');
  console.log('Result:', pass ? 'PASS ✓' : 'FAIL ✗');

  await browser.close();
})();
