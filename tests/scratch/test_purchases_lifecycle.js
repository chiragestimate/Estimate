const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFullPurchaseLifecycle() {
  console.log('=== FULL PURCHASES LIFECYCLE TEST (CREATE -> EDIT -> DELETE) ===\n');

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

  const initialCount = await page.$$eval('#purchases-table tbody tr', trs => trs.length);
  console.log(`1. Initial count: ${initialCount} purchases`);

  // 3. Create a New Purchase
  console.log('\n2. Creating a new purchase...');
  await page.click('button[onclick="openAdd()"]');
  await page.waitForSelector('#purchase-items-tbody tr:first-child .item-search-input', { visible: true, timeout: 10000 });
  await sleep(400);

  // Select supplier
  const supVal = await page.$eval('#supplier-select option:nth-child(2)', opt => opt.value);
  await page.select('#supplier-select', supVal);

  // Set item name, quantity and unit price
  await page.type('#purchase-items-tbody tr:first-child .item-search-input', 'Imida 1 LTR');
  await sleep(400);

  await page.$eval('#purchase-items-tbody tr:first-child td:nth-child(4) input', el => {
    el.value = '50';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.$eval('#purchase-items-tbody tr:first-child td:nth-child(5) input', el => {
    el.value = '100';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(400);

  // Click Save
  await page.click('#purchase-modal .btn-primary');
  await page.waitForFunction(() => {
    const m = document.getElementById('purchase-modal');
    return !m || !m.classList.contains('open');
  }, { timeout: 10000 });
  await sleep(1500);

  const afterCreateCount = await page.$$eval('#purchases-table tbody tr', trs => trs.length);
  console.log(`  -> After Create count: ${afterCreateCount} purchases`);
  if (afterCreateCount !== initialCount + 1) {
    throw new Error(`Expected ${initialCount + 1} purchases, got ${afterCreateCount}`);
  }
  console.log('  -> PASS: New purchase created and visible in table!');

  // 4. Edit the newly created purchase
  console.log('\n3. Editing the newly created purchase...');
  await page.click('#purchases-table tbody tr:first-child .action-btn.edit');
  await sleep(1000);

  await page.$eval('textarea[name="notes"]', el => {
    el.value = 'Notes updated in full lifecycle test';
  });
  await page.click('#purchase-modal .btn-primary');
  await page.waitForFunction(() => {
    const m = document.getElementById('purchase-modal');
    return !m || !m.classList.contains('open');
  }, { timeout: 10000 });
  await sleep(1500);

  const afterEditCount = await page.$$eval('#purchases-table tbody tr', trs => trs.length);
  console.log(`  -> After Edit count: ${afterEditCount} purchases`);
  if (afterEditCount !== afterCreateCount) {
    throw new Error(`Expected ${afterCreateCount} purchases, got ${afterEditCount}`);
  }
  console.log('  -> PASS: Purchase edited successfully and table retained all rows!');

  // 5. Delete the purchase
  console.log('\n4. Deleting the purchase...');
  await sleep(1000);
  await page.waitForSelector('#purchases-table tbody tr:first-child .action-btn.delete', { visible: true });
  await page.$eval('#purchases-table tbody tr:first-child .action-btn.delete', btn => btn.click());
  await sleep(600);

  await page.waitForSelector('#confirm-ok-btn', { visible: true });
  await page.$eval('#confirm-ok-btn', btn => btn.click());
  await page.waitForFunction(() => {
    const cm = document.getElementById('confirm-modal');
    return !cm || !cm.classList.contains('open');
  }, { timeout: 10000 });
  await sleep(1500);

  const afterDeleteCount = await page.$$eval('#purchases-table tbody tr', trs => trs.length);
  console.log(`  -> After Delete count: ${afterDeleteCount} purchases`);
  if (afterDeleteCount !== initialCount) {
    throw new Error(`Expected ${initialCount} purchases, got ${afterDeleteCount}`);
  }
  console.log('  -> PASS: Purchase deleted cleanly and table retained all remaining items!');

  await browser.close();
  console.log('\n=== FULL PURCHASES LIFECYCLE TEST PASSED! ===');
}

testFullPurchaseLifecycle().catch(err => {
  console.error('Lifecycle test failed:', err);
  process.exit(1);
});
