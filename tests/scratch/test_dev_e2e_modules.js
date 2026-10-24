const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2ETests() {
  console.log('=== STARTING COMPREHENSIVE DEV ENVIRONMENT MODULE E2E TESTING ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), text: msg.text() });
    }
  });

  const pageResults = [];

  // Helper page tester
  async function testPage(name, urlPath, waitForSelector) {
    try {
      console.log(`Testing page: ${name} (${urlPath})...`);
      await page.goto(`${BASE_URL}/${urlPath}`, { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1500);

      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 8000 });
      }

      const title = await page.title();
      pageResults.push({ name, url: urlPath, status: 'PASS', title });
      console.log(`  -> PASS: ${name} loaded successfully (Title: "${title}")`);
    } catch (err) {
      pageResults.push({ name, url: urlPath, status: 'FAIL', error: err.message });
      console.log(`  -> FAIL: ${name} error: ${err.message}`);
    }
  }

  // 1. Login flow
  console.log('1. Testing Login flow...');
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
  await page.type('#username', 'admin@anjani.test');
  await page.type('#password', 'Test@Agro2026!');
  await page.click('#login-btn');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
  console.log('  -> Current URL after login:', page.url());

  // 2. Dashboard
  await testPage('Dashboard', 'pages/dashboard.html', '.metric-card, .stat-card, h1, .navbar');

  // 3. Inventory Operations
  await testPage('Inventory Management', 'pages/inventory.html', '#inventory-table, .table, #inventoryTable');

  // 4. Purchases & Procurement
  await testPage('Purchases', 'pages/purchases.html', '#purchasesTable, .table, h1');

  // 5. Sales Orders
  await testPage('Sales Orders', 'pages/orders.html', '#ordersTable, .table, h1');

  // 6. Production & Manufacturing
  await testPage('Production & Formulations', 'pages/production.html', '#production-batches-table, .table, h1');

  // 7. Expenses & Financials
  await testPage('Expenses', 'pages/expenses.html', '#expenses-table, .table, h1');

  // 8. Reports & Analytics
  await testPage('Reports', 'pages/reports.html', '.report-card, .table, h1');

  // 9. Invoices
  await testPage('Invoice Builder', 'apps/Invoice%20Builder/index.html', 'body');

  // 10. Companies & Branches
  await testPage('Companies & Branches', 'pages/companies.html', '#companies-table, .table, h1');

  // 11. Security & Audit Logs
  await testPage('Security & Audit Logs', 'pages/audit-logs.html', '#auditTable, table, h1');

  console.log('\n=== E2E DEV TESTING SUMMARY ===');
  pageResults.forEach(r => {
    console.log(`[${r.status}] ${r.name} - ${r.url}`);
  });

  const criticalErrors = consoleErrors.filter(e =>
    !e.text.includes('favicon') && !e.text.includes('chrome-extension')
  );

  console.log(`\nCritical Console Errors Captured: ${criticalErrors.length}`);
  if (criticalErrors.length > 0) {
    criticalErrors.slice(0, 10).forEach(e => console.log(`  - [${e.url}] ${e.text}`));
  }

  await browser.close();
  console.log('\nBrowser test execution completed.');
}

runE2ETests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
