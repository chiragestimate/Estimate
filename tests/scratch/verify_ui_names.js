const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';
const ARTIFACT_DIR = 'C:\\Users\\tirth\\.gemini\\antigravity\\brain\\f96c51f5-083a-43ab-b2cf-e51f633b1bac';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyUI() {
  console.log('=== VERIFYING UI DISPLAY NAMES & PACKAGING ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // 1. Login
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
  await page.type('#username', 'admin@anjani.test');
  await page.type('#password', 'Test@Agro2026!');
  await page.click('#login-btn');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // 2. Orders Page - Verify Dropdowns & Closed-State Display
  await page.goto(`${BASE_URL}/pages/orders.html`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  await page.click('button[onclick="openAdd()"]');
  await sleep(800);

  // Pick client and first product
  const clientVal = await page.$eval('#client-select option:nth-child(2)', o => o.value);
  await page.select('#client-select', clientVal);

  const prodVal = await page.$eval('.order-product-select option:nth-child(2)', o => o.value);
  await page.select('.order-product-select', prodVal);
  await sleep(600);

  // Capture Bottle Dropdown Options
  const bottleOptions = await page.$$eval('.order-bottle-select option', opts => opts.map(o => o.text));
  console.log('Bottle Dropdown Options:', bottleOptions);

  // Capture Box Dropdown Options
  const boxOptions = await page.$$eval('.order-box-select option', opts => opts.map(o => o.text));
  console.log('Box Dropdown Options:', boxOptions);

  // Take screenshot of New Sales Order modal
  await page.screenshot({ path: `${ARTIFACT_DIR}\\orders_dropdown_packaging_verified.png`, fullPage: false });

  // 3. Inventory Page - Verify Bottles and Boxes tabs
  await page.goto(`${BASE_URL}/pages/inventory.html`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // Switch to Bottles tab
  await page.click('button[data-tab="Bottles"]');
  await sleep(800);

  const bottleItemNames = await page.$$eval('#inventory-table tbody tr td.cell-bold div span:first-child', els => els.map(e => e.innerText));
  console.log('Inventory Page - Bottles tab names:', bottleItemNames);

  await page.screenshot({ path: `${ARTIFACT_DIR}\\inventory_bottles_tab_verified.png`, fullPage: false });

  // Switch to Boxes tab
  await page.click('button[data-tab="Boxes"]');
  await sleep(800);

  const boxItemNames = await page.$$eval('#inventory-table tbody tr td.cell-bold div span:first-child', els => els.map(e => e.innerText));
  console.log('Inventory Page - Boxes tab names:', boxItemNames);

  await page.screenshot({ path: `${ARTIFACT_DIR}\\inventory_boxes_tab_verified.png`, fullPage: false });

  await browser.close();
  console.log('\n=== UI VERIFICATION COMPLETED ===');
}

verifyUI().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
