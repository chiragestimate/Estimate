const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('1. Logging in on mobile...');
  await page.goto(BASE_URL + '/login.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({ email: 'admin@anjani.test', password: 'Test@Agro2026!' });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
  });
  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Navigate to Invoice Builder directly on mobile (clean state)...');
  await page.goto(BASE_URL + '/Invoice Builder/index.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  const cleanMobileState = await page.evaluate(() => {
    return {
      invNum: document.getElementById('s-inv-num')?.value,
      invNumDisplay: document.getElementById('s-inv-num-display')?.textContent,
      clientName: document.getElementById('s-client-name')?.value,
      activeMobileTab: document.querySelector('.mob-nav-tab.active')?.textContent.trim(),
      mobileTabsDisplay: window.getComputedStyle(document.getElementById('mobile-tabs')).display,
      sidebarDisplay: window.getComputedStyle(document.getElementById('sidebar')).display,
      mainDisplay: window.getComputedStyle(document.getElementById('main')).display,
      mainClasses: document.getElementById('main').className
    };
  });
  console.log('Clean mobile state:', cleanMobileState);

  console.log('3. Now simulate opening from Orders Dispatch: set dispatch doc & #edit=INV-01...');
  await page.goto(BASE_URL + '/pages/orders.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => {
    const tab = document.getElementById('tab-dispatches');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.evaluate(() => {
    const btn = document.querySelector('button[onclick*="viewGeneratedInvoice"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  const openHref = await page.evaluate(() => {
    const btn = document.getElementById('btn-open-invoice-builder');
    if (btn) {
      btn.click();
      return btn.href;
    }
    return null;
  });
  console.log('Open href on mobile:', openHref);

  console.log('4. Navigate to builder with that URL on mobile...');
  await page.goto(openHref, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const mobileEditedState = await page.evaluate(() => {
    return {
      url: window.location.href,
      currentInvoiceId: window.currentInvoiceId,
      invNum: document.getElementById('s-inv-num')?.value,
      clientName: document.getElementById('s-client-name')?.value,
      sidebarHidden: document.getElementById('sidebar').classList.contains('panel-hidden'),
      mainHidden: document.getElementById('main').classList.contains('panel-hidden')
    };
  });
  console.log('Mobile edited state:', mobileEditedState);

  console.log('5. Now navigate to Invoice Builder without hash on mobile...');
  await page.goto(BASE_URL + '/Invoice Builder/index.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const mobileRevisitState = await page.evaluate(() => {
    return {
      url: window.location.href,
      currentInvoiceId: window.currentInvoiceId,
      invNum: document.getElementById('s-inv-num')?.value,
      clientName: document.getElementById('s-client-name')?.value,
      hasResetBtn: !!document.getElementById('btn-new-invoice') || !!document.getElementById('mob-new-btn'),
      sidebarHidden: document.getElementById('sidebar').classList.contains('panel-hidden'),
      mainHidden: document.getElementById('main').classList.contains('panel-hidden')
    };
  });
  console.log('Mobile revisit state (independent):', mobileRevisitState);

  console.log('6. Reload on mobile...');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const mobileReloadState = await page.evaluate(() => {
    return {
      url: window.location.href,
      currentInvoiceId: window.currentInvoiceId,
      invNum: document.getElementById('s-inv-num')?.value,
      clientName: document.getElementById('s-client-name')?.value
    };
  });
  console.log('Mobile after reload state:', mobileReloadState);

  console.log('Errors caught:', errors);
  await browser.close();
})();
