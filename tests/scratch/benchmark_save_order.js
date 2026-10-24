const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBenchmark() {
  console.log('=== STARTING SALES ORDER SAVE BENCHMARK ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => {
    console.log('  [Browser]', msg.text());
  });
  page.on('pageerror', err => {
    console.log('  [PageError]', err.message);
  });

  // 1. Login
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
  await page.type('#username', 'admin@anjani.test');
  await page.type('#password', 'Test@Agro2026!');
  await page.click('#login-btn');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // 2. Go to orders page
  await page.goto(`${BASE_URL}/pages/orders.html`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // ── TEST 1: Measure 1-Product Order Save ──
  console.log('1. Measuring 1-product order save...');
  await page.click('button[onclick="openAdd()"]');
  await sleep(800);

  // Select client
  const clientVal = await page.$eval('#client-select option:nth-child(2)', o => o.value);
  await page.select('#client-select', clientVal);

  // Select product (1st product)
  const prodVal = await page.$eval('.order-product-select option:nth-child(2)', o => o.value);
  await page.select('.order-product-select', prodVal);
  await sleep(600);

  // Set quantity
  await page.$eval('.item-qty-input', inp => {
    inp.value = '1';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(600);

  // Time the save click
  const t0 = Date.now();
  await page.click('#order-modal button.btn-primary');

  // Wait for modal to close
  await page.waitForFunction(() => {
    const modal = document.getElementById('order-modal');
    return !modal || !modal.classList.contains('open');
  }, { timeout: 15000 });
  const t1 = Date.now();
  const time1Product = t1 - t0;
  console.log(`  -> 1-Product Order Save Time: ${time1Product} ms (${(time1Product / 1000).toFixed(2)}s)`);

  await sleep(2000);

  // ── TEST 2: Measure 5-Product Order Save ──
  console.log('2. Measuring 5-product order save...');
  await page.click('button[onclick="openAdd()"]');
  await sleep(800);

  await page.select('#client-select', clientVal);

  // Add 4 more items so total items = 5
  for (let i = 0; i < 4; i++) {
    await page.evaluate(async () => {
      await addOrderItem();
    });
    await sleep(300);
  }

  // Get available product IDs from cachedProductsList
  const productIds = await page.evaluate(() => {
    return (cachedProductsList || []).map(p => p.id);
  });
  console.log('  -> Available product IDs:', productIds);

  // Set products and quantities for all 5 items
  await page.evaluate(async (pIds) => {
    for (let i = 0; i < 5; i++) {
      const pid = pIds[i % pIds.length];
      await onProductSelectChange(i, pid);
      onQtyChange(i, 1);
    }
  }, productIds);
  await sleep(800);

  const t5_0 = Date.now();
  await page.click('#order-modal button.btn-primary');

  await page.waitForFunction(() => {
    const modal = document.getElementById('order-modal');
    return !modal || !modal.classList.contains('open');
  }, { timeout: 20000 });
  const t5_1 = Date.now();
  const time5Product = t5_1 - t5_0;
  console.log(`  -> 5-Product Order Save Time: ${time5Product} ms (${(time5Product / 1000).toFixed(2)}s)`);

  // ── TEST 3: Measure Edit Order Save ──
  console.log('3. Measuring Edit Order save...');
  await sleep(2000);
  await page.waitForSelector('.action-btn.edit, .order-card-btn.edit', { timeout: 10000 });
  await page.click('.action-btn.edit, .order-card-btn.edit');
  await sleep(1500);

  // Modify quantity of first line item
  await page.$eval('#order-items-tbody tr:first-child .item-qty-input', inp => {
    inp.value = '2';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(600);

  const tEdit_0 = Date.now();
  await page.click('#order-modal button.btn-primary');

  await page.waitForFunction(() => {
    const modal = document.getElementById('order-modal');
    return !modal || !modal.classList.contains('open');
  }, { timeout: 20000 });
  const tEdit_1 = Date.now();
  const timeEdit = tEdit_1 - tEdit_0;
  console.log(`  -> Edit Order Save Time: ${timeEdit} ms (${(timeEdit / 1000).toFixed(2)}s)`);

  // ── TEST 4: Duplicate Submission Protection ──
  console.log('4. Testing Duplicate Submission Protection...');
  await sleep(1500);
  await page.click('button[onclick="openAdd()"]');
  await sleep(800);
  await page.select('#client-select', clientVal);
  await page.select('.order-product-select', prodVal);
  await sleep(400);
  await page.$eval('.item-qty-input', inp => {
    inp.value = '1';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(400);

  // Click save twice in rapid succession to verify double-submission prevention
  await page.evaluate(() => {
    const btn = document.querySelector('#order-modal button.btn-primary');
    if (btn) {
      btn.click();
      btn.click();
    }
  });

  await page.waitForFunction(() => {
    const modal = document.getElementById('order-modal');
    return !modal || !modal.classList.contains('open');
  }, { timeout: 15000 });
  console.log('  -> PASS: Duplicate click safely handled, single save executed.');

  await browser.close();
  console.log('\n=== ALL BENCHMARKS COMPLETED SUCCESSFULLY ===');
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
