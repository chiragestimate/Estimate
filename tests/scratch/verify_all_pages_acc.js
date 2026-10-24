const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('--- Comprehensive Verification for Afield Crop Care & ACC ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 0. Authenticate properly via Supabase on login.html
  await page.goto('http://localhost:5174/login.html', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({
      email: 'admin@anjani.test',
      password: 'Test@Agro2026!'
    });
    localStorage.setItem('admin_user', 'admin@afieldcropcare.com');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_role', 'super_admin');
    localStorage.setItem('erp_active_company_id', '623');
    localStorage.setItem('active_company_id', '623');
    localStorage.setItem('active_company_code', 'ACC');
    localStorage.setItem('erp_active_company_name', 'Afield Crop Care');
  });

  // 1. Verify Warehouses Page
  console.log('Testing Warehouses page (pages/warehouses.html)...');
  await page.goto('http://localhost:5174/pages/warehouses.html', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => {
    const table = document.querySelector('#warehouses-table');
    return table && table.querySelectorAll('tbody tr').length > 0;
  }, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1500));

  const whBodyText = await page.evaluate(() => document.body.innerText);
  console.log('Warehouses page contains "WH-ACC-01":', whBodyText.includes('WH-ACC-01'));
  console.log('Warehouses page contains "Afield Crop Care Main Plant Warehouse":', whBodyText.includes('Afield Crop Care Main Plant Warehouse'));
  console.log('Warehouses page contains "WH-ACC-GAS":', whBodyText.includes('WH-ACC-GAS'));
  console.log('Warehouses page contains any "Anjani":', whBodyText.toLowerCase().includes('anjani'));

  // Take screenshot of warehouses table
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/warehouses_page_verified_acc.png' });

  // 2. Verify Orders Page & Brand Dropdown & Warehouse Dropdown
  console.log('\nTesting Orders page (pages/orders.html)...');
  await page.goto('http://localhost:5174/pages/orders.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const ordersBodyText = await page.evaluate(() => document.body.innerText);
  console.log('Orders page contains any "Anjani":', ordersBodyText.toLowerCase().includes('anjani'));

  // Open New Order Modal
  const brandOptions = await page.evaluate(async () => {
    if (typeof openNewOrderModal === 'function') await openNewOrderModal();
    const sel = document.getElementById('order-label-owner-select');
    return sel ? Array.from(sel.options).map(o => ({ value: o.value, text: o.text })) : [];
  });
  console.log('Order Brand Options:', brandOptions);

  // 3. Verify Topbar & Sidebar on Reload
  console.log('\nTesting Topbar/Sidebar brand reload on Dashboard (pages/dashboard.html)...');
  await page.goto('http://localhost:5174/pages/dashboard.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  const brandInfo = await page.evaluate(() => {
    const topName = document.getElementById('topbar-company-name')?.textContent;
    const topCode = document.querySelector('.company-pill-code')?.textContent || document.getElementById('topbar-company-code')?.textContent;
    const sideBrand = document.getElementById('sidebar-brand-name')?.textContent;
    return { topName, topCode, sideBrand };
  });
  console.log('Topbar / Sidebar brand info after reload:', brandInfo);

  // 4. Verify Invoice Builder
  console.log('\nTesting Invoice Builder (Invoice Builder/index.html)...');
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  const invoiceData = await page.evaluate(() => {
    const title = document.title;
    const bankBlock = document.getElementById('bank-block');
    const bankVisible = bankBlock && window.getComputedStyle(bankBlock).display !== 'none';
    const bankText = bankBlock ? bankBlock.innerText : '';
    const signName = document.getElementById('signature-name-display')?.innerText || document.getElementById('paper-authorized-signatory')?.innerText;
    return { title, bankVisible, bankText, signName };
  });
  console.log('Invoice Builder info:', invoiceData);

  await browser.close();
  console.log('\nAll checks complete!');
})();
