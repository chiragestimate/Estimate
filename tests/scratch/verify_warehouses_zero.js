const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function verifyWarehouses() {
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

  console.log('Navigating to warehouses page...');
  await page.goto('http://localhost:5174/pages/warehouses.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const warehouses = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.warehouse-card, #warehouses-table tbody tr, .wh-table-row, .table-wrap tbody tr'));
    return rows.map(r => r.innerText.replace(/\n+/g, ' '));
  });

  console.log('Warehouses on page:');
  warehouses.forEach(w => console.log(' -> ', w));

  // Screenshot Gas Godown
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/warehouses_gas_godown_0_units.png' });
  await browser.close();
  console.log('Screenshot saved.');
}

verifyWarehouses().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
