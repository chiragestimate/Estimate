const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPurchasesEditAndDelete() {
  console.log('=== TESTING PURCHASES EDIT AND DELETE ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => console.log('  [Browser]', msg.text()));
  page.on('pageerror', err => console.log('  [PageError]', err.message));

  // 1. Login
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
  await page.type('#username', 'admin@anjani.test');
  await page.type('#password', 'Test@Agro2026!');
  await page.click('#login-btn');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // 2. Go to purchases page
  await page.goto(`${BASE_URL}/pages/purchases.html`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  let rowCount = await page.$$eval('#purchases-table tbody tr', trs => trs.length);
  let totalInfo = await page.$eval('#total-info', el => el.textContent);
  console.log(`1. Initial state: ${rowCount} rows rendered, totalInfo: "${totalInfo}"`);

  // 3. Test EDIT operation
  console.log('\n2. Testing Edit Purchase...');
  await page.click('#purchases-table tbody tr:first-child .action-btn.edit');
  await sleep(1000);

  // Update notes field in edit modal
  await page.$eval('textarea[name="notes"]', el => {
    el.value = 'Updated via QA Test ' + Date.now();
  });
  await sleep(300);

  // Click Save Purchase in modal
  await page.click('#purchase-modal .btn-primary');
  await page.waitForFunction(() => {
    const m = document.getElementById('purchase-modal');
    return !m || !m.classList.contains('open');
  }, { timeout: 10000 });
  await sleep(1000);

  let afterEditRows = await page.$$eval('#purchases-table tbody tr', trs => trs.length);
  let afterEditTotal = await page.$eval('#total-info', el => el.textContent);
  console.log(`  -> After Edit: ${afterEditRows} rows rendered, totalInfo: "${afterEditTotal}"`);
  if (afterEditRows === 0 || afterEditTotal.includes('0 purchases')) {
    throw new Error('FAILED: Purchases went blank after EDIT!');
  }
  console.log('  -> PASS: Edit successfully preserved all purchases without disappearing!');

  // 4. Test DELETE operation
  console.log('\n3. Testing Delete Purchase...');
  const rowsBeforeDelete = afterEditRows;
  await page.waitForSelector('#purchases-table tbody tr:first-child .action-btn.delete', { visible: true });
  await page.click('#purchases-table tbody tr:first-child .action-btn.delete');
  await sleep(600);

  await page.waitForSelector('#confirm-ok-btn', { visible: true });
  await page.click('#confirm-ok-btn');
  await page.waitForFunction(() => {
    const cm = document.getElementById('confirm-modal');
    return !cm || !cm.classList.contains('open');
  }, { timeout: 10000 });
  await sleep(1500);

  let afterDeleteRows = await page.$$eval('#purchases-table tbody tr', trs => trs.length);
  let afterDeleteTotal = await page.$eval('#total-info', el => el.textContent);
  console.log(`  -> After Delete: ${afterDeleteRows} rows rendered, totalInfo: "${afterDeleteTotal}"`);
  if (afterDeleteRows === 0 || afterDeleteTotal.includes('0 purchases')) {
    throw new Error('FAILED: Purchases went blank after DELETE!');
  }
  if (afterDeleteRows !== rowsBeforeDelete - 1) {
    throw new Error(`Expected ${rowsBeforeDelete - 1} rows after deletion, but found ${afterDeleteRows}`);
  }
  console.log('  -> PASS: Delete successfully decremented by exactly 1 item and remaining items stayed visible!');

  // Take screenshot as proof
  await page.screenshot({ path: 'C:\\Users\\tirth\\.gemini\\antigravity\\brain\\f96c51f5-083a-43ab-b2cf-e51f633b1bac\\purchases_edit_delete_fixed.png', fullPage: false });

  await browser.close();
  console.log('\n=== ALL PURCHASES TESTS PASSED SUCCESSFULLY ===');
}

testPurchasesEditAndDelete().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
