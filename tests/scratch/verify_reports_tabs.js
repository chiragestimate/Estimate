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
    { name: 'desktop-1366', width: 1366, height: 768, isMobile: false },
    { name: 'laptop-1024', width: 1024, height: 768, isMobile: false },
    { name: 'tablet-768', width: 768, height: 1024, isMobile: true },
    { name: 'mobile-430', width: 430, height: 932, isMobile: true },
    { name: 'mobile-390', width: 390, height: 844, isMobile: true },
    { name: 'mobile-375', width: 375, height: 812, isMobile: true },
    { name: 'mobile-360', width: 360, height: 780, isMobile: true },
    { name: 'mobile-320', width: 320, height: 600, isMobile: true }
  ];

  let allPassed = true;

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL + '/pages/reports.html', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));

    const result = await page.evaluate((isMobile) => {
      const container = document.getElementById('reports-tabs');
      const tabs = Array.from(container.querySelectorAll('.tab-btn'));
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const overflow = scrollWidth > clientWidth ? (scrollWidth - clientWidth) : 0;

      const tabInfo = tabs.map(t => {
        const rect = t.getBoundingClientRect();
        return {
          tab: t.getAttribute('data-tab'),
          text: t.textContent.trim(),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          left: Math.round(rect.left * 10) / 10,
          top: Math.round(rect.top * 10) / 10
        };
      });

      return {
        overflow,
        tabInfo
      };
    }, vp.isMobile);

    console.log(`\n======================================================`);
    console.log(`Viewport: ${vp.name} (${vp.width}px x ${vp.height}px)`);
    console.log(`Horizontal Overflow: ${result.overflow}px`);
    result.tabInfo.forEach(t => {
      console.log(`  - [${t.tab}] "${t.text}": ${t.width}px x ${t.height}px`);
    });

    if (result.overflow > 0) {
      console.error(`FAIL: Horizontal overflow detected in ${vp.name}!`);
      allPassed = false;
    }

    if (!vp.isMobile) {
      // Desktop checks: all tabs must have width 190px and height 42px
      const widths = result.tabInfo.map(t => t.width);
      const heights = result.tabInfo.map(t => t.height);
      const allEqualWidth = widths.every(w => Math.abs(w - 190) <= 1);
      const allEqualHeight = heights.every(h => Math.abs(h - 42) <= 1);

      if (!allEqualWidth) {
        console.error(`FAIL: Desktop tabs do not have 190px uniform width: ${widths.join(', ')}`);
        allPassed = false;
      }
      if (!allEqualHeight) {
        console.error(`FAIL: Desktop tabs do not have 42px uniform height: ${heights.join(', ')}`);
        allPassed = false;
      }
    } else {
      // Mobile checks: Row 1 tabs (Overview & CustomerSales) must have equal width
      const overview = result.tabInfo.find(t => t.tab === 'Overview');
      const customerSales = result.tabInfo.find(t => t.tab === 'CustomerSales');
      const productSales = result.tabInfo.find(t => t.tab === 'ProductSales');
      const monthlyTrends = result.tabInfo.find(t => t.tab === 'MonthlyTrends');

      if (overview.width !== customerSales.width) {
        console.error(`FAIL: Row 1 tabs unequal: Overview=${overview.width}px, CustomerSales=${customerSales.width}px`);
        allPassed = false;
      }
      if (productSales.width !== monthlyTrends.width) {
        console.error(`FAIL: Row 2 tabs unequal: ProductSales=${productSales.width}px, MonthlyTrends=${monthlyTrends.width}px`);
        allPassed = false;
      }
      if (overview.width !== productSales.width) {
        console.error(`FAIL: Column 1 tabs unequal across rows: Overview=${overview.width}px, ProductSales=${productSales.width}px`);
        allPassed = false;
      }
      // Check height consistency: all should be 46px
      const heights = [overview.height, customerSales.height, productSales.height, monthlyTrends.height];
      const allEqualHeight = heights.every(h => Math.abs(h - 46) <= 1);
      if (!allEqualHeight) {
        console.error(`FAIL: Mobile tab heights unequal: ${heights.join(', ')}`);
        allPassed = false;
      }
    }
  }

  // Test Tab Switching Functionality
  console.log(`\n======================================================`);
  console.log(`Testing Tab Switching Functionality...`);
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(BASE_URL + '/pages/reports.html', { waitUntil: 'networkidle0' });

  const tabSwitchResults = await page.evaluate(async () => {
    const tabs = Array.from(document.querySelectorAll('#reports-tabs .tab-btn'));
    const tabDetails = [];

    for (const tab of tabs) {
      const tabKey = tab.getAttribute('data-tab');
      tab.click();
      await new Promise(r => setTimeout(r, 150));

      const active = tab.classList.contains('active');
      const cs = window.getComputedStyle(tab);
      const bg = cs.backgroundColor;
      const color = cs.color;

      // Find visible tab pane
      const panes = Array.from(document.querySelectorAll('.report-tab-pane'));
      const visiblePane = panes.find(p => window.getComputedStyle(p).display !== 'none');

      tabDetails.push({
        tabKey,
        isActive: active,
        bgColor: bg,
        textColor: color,
        visiblePaneId: visiblePane ? visiblePane.id : 'none'
      });
    }

    return tabDetails;
  });

  console.log(JSON.stringify(tabSwitchResults, null, 2));
  const switchingWorks = tabSwitchResults.every(r => r.isActive && r.visiblePaneId.length > 4);
  if (!switchingWorks) {
    console.error(`FAIL: Tab switching failed!`);
    allPassed = false;
  } else {
    console.log(`PASS: All tabs switch cleanly and show active styles!`);
  }

  // Save official screenshots for artifacts
  await page.setViewport({ width: 1366, height: 768 });
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/reports_tabs_fixed_desktop_1366.png' });

  await page.setViewport({ width: 375, height: 812 });
  // Scroll to tabs for clear screenshot
  await page.evaluate(() => {
    const el = document.getElementById('reports-tabs');
    if (el) {
      const rect = el.getBoundingClientRect();
      window.scrollTo(0, window.pageYOffset + rect.top - 80);
    }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/reports_tabs_fixed_mobile_375.png' });

  console.log(`\nOverall Test Result: ${allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED!'}`);
  await browser.close();
})();
