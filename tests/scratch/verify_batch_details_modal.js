const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testModal() {
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

  // Test 1: Technical Tab -> Anjani Coragen-80 Ec (which is from P-03, Manoj Bhai)
  console.log('\n--- Checking Technical Tab (Anjani Coragen-80 Ec) ---');
  await page.click('button[data-tab="Technical"]');
  await new Promise(r => setTimeout(r, 1000));

  // Find eye button for Coragen (item id 47)
  const eyeButtons = await page.$$('.action-btn.view');
  console.log(`Found ${eyeButtons.length} view buttons on Technical tab.`);
  
  // Click second item (Coragen is ID 47)
  if (eyeButtons.length >= 2) {
    await eyeButtons[1].click();
    await new Promise(r => setTimeout(r, 1000));

    const modalData = await page.evaluate(() => {
      const modal = document.getElementById('batch-modal');
      const title = modal.querySelector('.modal-title')?.innerText;
      const subhead = modal.querySelector('#batch-content > div:first-child')?.innerText?.replace(/\n+/g, ' ');
      const ths = Array.from(modal.querySelectorAll('table thead th')).map(th => th.innerText.trim());
      const rows = Array.from(modal.querySelectorAll('table tbody tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
      });
      return { title, subhead, ths, rows };
    });

    console.log('Modal Title:', modalData.title);
    console.log('Modal Subhead:', modalData.subhead);
    console.log('Table Headers:', modalData.ths);
    console.log('Table Rows:', modalData.rows);

    await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/modal_verified_coragen_p03.png' });
    await page.click('#batch-modal .modal-close');
    await new Promise(r => setTimeout(r, 500));
  }

  // Test 2: Labels Tab -> Anjani Coragen-80 Ec 1 Litre (which is from P-07, Akshay Bhai)
  console.log('\n--- Checking Labels Tab (Item from P-07) ---');
  await page.click('button[data-tab="Labels"]');
  await new Promise(r => setTimeout(r, 1000));

  const labelEyeButtons = await page.$$('.action-btn.view');
  if (labelEyeButtons.length > 0) {
    await labelEyeButtons[0].click();
    await new Promise(r => setTimeout(r, 1000));

    const modalDataLabel = await page.evaluate(() => {
      const modal = document.getElementById('batch-modal');
      const ths = Array.from(modal.querySelectorAll('table thead th')).map(th => th.innerText.trim());
      const rows = Array.from(modal.querySelectorAll('table tbody tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
      });
      return { ths, rows };
    });

    console.log('Label Table Headers:', modalDataLabel.ths);
    console.log('Label Table Rows:', modalDataLabel.rows);

    await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/modal_verified_label_p07.png' });
    await page.click('#batch-modal .modal-close');
    await new Promise(r => setTimeout(r, 500));
  }

  // Test 3: Bottles Tab -> Imida Bottle 500 Ml (which has Opening Stock Open-02)
  console.log('\n--- Checking Bottles Tab (Opening Stock Open-02) ---');
  await page.click('button[data-tab="Bottles"]');
  await new Promise(r => setTimeout(r, 1000));

  const bottleEyeButtons = await page.$$('.action-btn.view');
  if (bottleEyeButtons.length >= 4) {
    // 500 Ml is usually row 4
    await bottleEyeButtons[3].click();
    await new Promise(r => setTimeout(r, 1000));

    const modalDataBottle = await page.evaluate(() => {
      const modal = document.getElementById('batch-modal');
      const rows = Array.from(modal.querySelectorAll('table tbody tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
      });
      return { rows };
    });

    console.log('Bottle Table Rows:', modalDataBottle.rows);

    await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/modal_verified_bottle_open02.png' });
    await page.click('#batch-modal .modal-close');
    await new Promise(r => setTimeout(r, 500));
  }

  await browser.close();
  console.log('\nAll tests complete.');
}

testModal().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
