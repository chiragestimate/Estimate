const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({ email: 'admin@anjani.test', password: 'Test@Agro2026!' });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
    localStorage.setItem('active_company_id', '623');
    localStorage.setItem('active_company_code', 'AAC');
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.goto(`${BASE_URL}/pages/production.html`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  // Open Record Production Modal
  await page.evaluate(() => {
    window.openProductionModal();
  });
  await new Promise(r => setTimeout(r, 600));

  // Select manufactured product
  await page.evaluate(() => {
    const pSel = document.getElementById('product-select');
    if (pSel && pSel.options.length > 1) {
      pSel.selectedIndex = 1;
      pSel.dispatchEvent(new Event('change'));
    }
    // Set quantity
    const qIn = document.getElementById('quantity-produced-input');
    if (qIn) {
      qIn.value = '500';
      qIn.dispatchEvent(new Event('input'));
    }
  });
  await new Promise(r => setTimeout(r, 500));

  // Click Add Finished Product as Output
  await page.evaluate(() => {
    window.addFinishedProductRow();
  });
  await new Promise(r => setTimeout(r, 600));

  const debug = await page.evaluate(() => {
    const modal = document.querySelector('#production-modal .modal');
    const modalBody = document.querySelector('#production-modal .modal-body');
    const card = document.querySelectorAll('#production-modal .product-form-card')[1];
    const table = document.querySelector('.production-items-table');
    const rows = Array.from(document.querySelectorAll('.production-items-table tr.production-item-row'));

    const rowDetails = rows.map((r, i) => {
      const rect = r.getBoundingClientRect();
      const cells = Array.from(r.querySelectorAll('td')).map(td => {
        const cRect = td.getBoundingClientRect();
        const input = td.querySelector('input, select, button');
        const iRect = input ? input.getBoundingClientRect() : null;
        return {
          className: td.className,
          tdWidth: Math.round(cRect.width),
          tdLeft: Math.round(cRect.left),
          tdRight: Math.round(cRect.right),
          inputWidth: iRect ? Math.round(iRect.width) : null,
          inputRight: iRect ? Math.round(iRect.right) : null
        };
      });

      return {
        rowIdx: i,
        action: r.classList.contains('is-increase') ? 'INCREASE' : 'DECREASE',
        width: Math.round(rect.width),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        overflowsModal: Math.round(rect.right) > Math.round(modal.getBoundingClientRect().right),
        cells
      };
    });

    return {
      viewportWidth: window.innerWidth,
      modalRect: {
        width: Math.round(modal.getBoundingClientRect().width),
        left: Math.round(modal.getBoundingClientRect().left),
        right: Math.round(modal.getBoundingClientRect().right)
      },
      modalBodyWidth: Math.round(modalBody.getBoundingClientRect().width),
      cardWidth: card ? Math.round(card.getBoundingClientRect().width) : null,
      tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
      rowDetails
    };
  });

  console.log('PRODUCTION MODAL DEBUG:', JSON.stringify(debug, null, 2));
  await browser.close();
})();
