const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testInventoryPage() {
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

  console.log('Navigating to inventory page...');
  await page.goto('http://localhost:5174/pages/inventory.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const tabs = ['Technical', 'Bottles', 'Boxes', 'Labels'];
  for (const tab of tabs) {
    const tabBtn = await page.$(`button[data-tab="${tab}"]`);
    if (tabBtn) {
      await tabBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    const rows = await page.evaluate(() => {
      const trs = Array.from(document.querySelectorAll('#inventory-table tbody tr'));
      return trs.map(tr => {
        const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        return {
          name: tds[0]?.replace(/\n+/g, ' '),
          category: tds[1],
          stock: tds[2],
          unit: tds[3],
          avgCost: tds[4],
          totalVal: tds[5],
          status: tds[6]
        };
      });
    });

    console.log(`\n=== TAB: ${tab} (Rows: ${rows.length}) ===`);
    rows.forEach(r => {
      console.log(`Item: ${(r.name || '').padEnd(35)} | Stock: ${(r.stock || '').padStart(6)} | Unit: ${(r.unit || '').padEnd(6)} | AvgCost: ${(r.avgCost || '').padStart(8)} | TotalValue: ${r.totalVal}`);
    });
  }

  // Take screenshots of Technical and Labels tabs
  const tabTech = await page.$('button[data-tab="Technical"]');
  if (tabTech) await tabTech.click();
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/inventory_all_stock_1000_technicals.png' });

  const tabLabels = await page.$('button[data-tab="Labels"]');
  if (tabLabels) await tabLabels.click();
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/inventory_all_stock_1000_labels.png' });

  await browser.close();
  console.log('\nVerification complete and screenshots saved.');
}

testInventoryPage().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
