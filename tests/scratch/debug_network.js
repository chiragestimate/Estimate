const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function debugNetwork() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('response', async resp => {
    if (resp.status() >= 400) {
      let body = '';
      try { body = await resp.text(); } catch (_) {}
      console.log(`  [HTTP ${resp.status()}] ${resp.url()}: ${body}`);
    }
  });

  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
  await page.type('#username', 'admin@anjani.test');
  await page.type('#password', 'Test@Agro2026!');
  await page.click('#login-btn');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  await page.goto(`${BASE_URL}/pages/orders.html`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  await page.click('button[onclick="openAdd()"]');
  await sleep(800);

  const clientVal = await page.$eval('#client-select option:nth-child(2)', o => o.value);
  await page.select('#client-select', clientVal);

  const prodVal = await page.$eval('.order-product-select option:nth-child(2)', o => o.value);
  await page.select('.order-product-select', prodVal);
  await sleep(500);

  await page.$eval('.item-qty-input', inp => {
    inp.value = '1';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(500);

  console.log('Clicking Save...');
  await page.click('#order-modal button.btn-primary');
  await sleep(3500);

  await browser.close();
}

debugNetwork().catch(console.error);
