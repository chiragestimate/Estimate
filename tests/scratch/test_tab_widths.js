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

  const testStyle = `
    @media (min-width: 769px) {
      #reports-tabs.reports-tabs {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
        width: 100% !important;
        overflow-x: visible !important;
        margin-bottom: 20px !important;
      }
      #reports-tabs.reports-tabs .tab-btn {
        flex: 0 0 190px !important;
        width: 190px !important;
        min-width: 190px !important;
        max-width: 190px !important;
        height: 42px !important;
        min-height: 42px !important;
        max-height: 42px !important;
        padding: 4px 8px !important;
        font-size: 12.5px !important;
        font-weight: 600 !important;
        line-height: 1.25 !important;
        text-align: center !important;
        justify-content: center !important;
        display: inline-flex !important;
        align-items: center !important;
        white-space: normal !important;
        word-break: break-word !important;
        box-sizing: border-box !important;
        border-radius: 8px !important;
        margin: 0 !important;
      }
    }
    @media (max-width: 768px) {
      #reports-tabs.reports-tabs {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
        width: 100% !important;
        box-sizing: border-box !important;
        overflow-x: visible !important;
        margin-bottom: 18px !important;
      }
      #reports-tabs.reports-tabs .tab-btn {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: 46px !important;
        min-height: 46px !important;
        max-height: 46px !important;
        padding: 4px 6px !important;
        font-size: 11.5px !important;
        font-weight: 600 !important;
        line-height: 1.25 !important;
        text-align: center !important;
        justify-content: center !important;
        display: flex !important;
        align-items: center !important;
        white-space: normal !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        hyphens: auto !important;
        box-sizing: border-box !important;
        border-radius: 8px !important;
        margin: 0 !important;
      }
      #reports-tabs.reports-tabs .tab-btn:last-child {
        grid-column: 1 / -1 !important;
      }
    }
  `;

  // Check desktop 1366
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(BASE_URL + '/pages/reports.html', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: testStyle });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/reports_tabs_test_1366.png' });

  // Check mobile 375
  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/reports_tabs_test_375.png' });

  // Test clicking tab switching
  const switchTest = await page.evaluate(async () => {
    const tabs = Array.from(document.querySelectorAll('#reports-tabs .tab-btn'));
    const results = [];
    for (const tab of tabs) {
      tab.click();
      await new Promise(res => setTimeout(res, 200));
      const targetId = 'tab-' + tab.getAttribute('data-tab').toLowerCase().replace('sales', '-sales').replace('trends', '-trends').replace('summary', '-summary');
      const activeBtn = tab.classList.contains('active');
      results.push({
        tab: tab.getAttribute('data-tab'),
        isActive: activeBtn,
        bg: window.getComputedStyle(tab).backgroundColor,
        color: window.getComputedStyle(tab).color
      });
    }
    return results;
  });

  console.log('Tab Switching Results:', JSON.stringify(switchTest, null, 2));
  console.log('Screenshots saved!');
  await browser.close();
})();
