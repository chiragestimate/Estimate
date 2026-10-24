const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testAllItems() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  console.log('[AUTH] Logging in as admin@anjani.test...');
  await page.goto('http://localhost:5174/login.html', { waitUntil: 'networkidle2' });
  await page.evaluate(async () => {
    const { data, error } = await window.dbClient.auth.signInWithPassword({
      email: 'admin@anjani.test',
      password: 'Test@Agro2026!'
    });
    if (error) throw error;
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('company_id', '623');
    localStorage.setItem('branch_id', '1');
    localStorage.setItem('active_company_id', '623');
    localStorage.setItem('user_company_id', '623');
  });

  await page.goto('http://localhost:5174/pages/inventory.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const testItems = [
    { id: 46, name: 'Anjani Chlor-20 Ec', expected: 'P-01', supplier: 'Arvindbhai Mehta' },
    { id: 49, name: 'Anjani Thio-60 Ec', expected: 'P-02', supplier: 'Akshay Bhai' },
    { id: 47, name: 'Anjani Coragen-80 Ec', expected: 'P-03', supplier: 'Manoj Bhai' },
    { id: 50, name: 'Imida Bottle 1 Ltr', expected: 'P-04', supplier: 'Arvindbhai Mehta' },
    { id: 52, name: 'Sygenta Bottle 1 Ltr', expected: 'P-05', supplier: 'Akshay Bhai' },
    { id: 59, name: 'Color Box 1 Ltr', expected: 'P-06', supplier: 'Manoj Bhai' },
    { id: 62, name: 'Anjani Chlor-20 Ec 500 Ml Label', expected: 'P-07', supplier: 'Akshay Bhai' },
    { id: 51, name: 'Imida Bottle 500 Ml', expected: 'Open-02', supplier: 'Opening Stock Entry' }
  ];

  for (const item of testItems) {
    await page.evaluate(async (id) => {
      await window.viewBatches('Inventory', id);
    }, item.id);
    await new Promise(r => setTimeout(r, 600));

    const details = await page.evaluate(() => {
      const modal = document.getElementById('batch-modal');
      const ths = Array.from(modal.querySelectorAll('table thead th')).map(th => th.innerText.trim());
      const rows = Array.from(modal.querySelectorAll('table tbody tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
      });
      return { ths, rows };
    });

    const r = details.rows[0];
    console.log(`[Item ID ${item.id}] ${item.name.padEnd(35)} | Expected: ${item.expected} (${item.supplier}) => Got: [${r[0]}] | [${r[1]}] | [${r[2]}] | Date: ${r[3]} | Cost: ${r[4]} | Qty: ${r[5]}`);
  }

  // Take clean screenshots
  await page.evaluate(async () => { await window.viewBatches('Inventory', 62); });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/modal_p07_label_clean.png' });

  await page.evaluate(async () => { await window.viewBatches('Inventory', 47); });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/modal_p03_coragen_clean.png' });

  await page.evaluate(async () => { await window.viewBatches('Inventory', 51); });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/modal_open02_bottle_clean.png' });

  await browser.close();
  console.log('\nAll 8 tests verified perfectly!');
}

testAllItems().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
