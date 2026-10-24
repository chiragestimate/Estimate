const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5174/login.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({ email: 'admin@anjani.test', password: 'Test@Agro2026!' });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
    localStorage.setItem('active_company_id', '623');
    localStorage.setItem('active_company_code', 'AAC');
  });
  await new Promise(r => setTimeout(r, 1200));

  await page.goto('http://localhost:5174/pages/intercompany.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    document.querySelector('.tab-btn[data-tab="Reconciliation"]').click();
    const recTbody = document.querySelector('#recon-recipients-table tbody');
    if (recTbody) {
      recTbody.innerHTML = `
        <tr>
          <td style="font-weight:700;color:var(--primary);">Afield Chemical Corp <span class="badge badge-gray" style="font-size:10px;">ACC-01</span></td>
          <td><strong>5,000 Units</strong></td>
          <td style="color:#16a34a;font-weight:700;">4,800 Units</td>
          <td style="color:#0284c7;font-weight:700;">200 Units</td>
          <td><span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">1,500 Units</span></td>
          <td style="color:var(--danger,#ef4444);font-weight:600;">0</td>
          <td><span class="badge badge-warning">In Balance</span></td>
        </tr>
        <tr>
          <td style="font-weight:700;color:var(--primary);">Bharat Agro Care <span class="badge badge-gray" style="font-size:10px;">BAC-02</span></td>
          <td><strong>2,500 Units</strong></td>
          <td style="color:#16a34a;font-weight:700;">2,500 Units</td>
          <td style="color:#0284c7;font-weight:700;">0 Units</td>
          <td><span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">800 Units</span></td>
          <td style="color:var(--danger,#ef4444);font-weight:600;">0</td>
          <td><span class="badge badge-success">Fully Reconciled</span></td>
        </tr>
      `;
    }
  });
  await new Promise(r => setTimeout(r, 800));

  const diff = await page.evaluate(() => {
    const wrap = document.getElementById('recon-recipients-table-wrap');
    const table = document.getElementById('recon-recipients-table');
    const wrapRect = wrap.getBoundingClientRect();
    const all = Array.from(wrap.querySelectorAll('*'));
    const overflowing = all.filter(el => {
      const r = el.getBoundingClientRect();
      return r.right > wrapRect.right + 0.5;
    }).map(el => ({
      tag: el.tagName,
      className: el.className,
      text: el.innerText ? el.innerText.slice(0, 30) : '',
      right: Math.round(el.getBoundingClientRect().right),
      wrapRight: Math.round(wrapRect.right),
      overflow: Math.round(el.getBoundingClientRect().right - wrapRect.right)
    }));

    return {
      wrapClientWidth: wrap.clientWidth,
      wrapScrollWidth: wrap.scrollWidth,
      diff: wrap.scrollWidth - wrap.clientWidth,
      tableOffsetWidth: table.offsetWidth,
      tableScrollWidth: table.scrollWidth,
      overflowing
    };
  });
  console.log('SCROLL DIFFERENCE:', JSON.stringify(diff, null, 2));
  await browser.close();
})();
