const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';
const ARTIFACT_DIR = 'C:\\Users\\tirth\\.gemini\\antigravity\\brain\\f96c51f5-083a-43ab-b2cf-e51f633b1bac';

(async () => {
  console.log('========================================================================');
  console.log('COMPREHENSIVE VERIFICATION: COMPANY SWITCHER POPUP CENTERING & FUNCTIONALITY');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();

  // Login
  await page.goto(BASE_URL + '/login.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dbClient && window.dbClient.auth);
  await page.evaluate(async () => {
    await window.dbClient.auth.signInWithPassword({ email: 'admin@anjani.test', password: 'Test@Agro2026!' });
    localStorage.setItem('admin_user', 'admin@anjani.test');
    localStorage.setItem('admin_logged_in', 'true');
    localStorage.setItem('erp_active_company_id', '623');
  });
  await new Promise(r => setTimeout(r, 800));

  const results = [];

  const viewports = [
    { name: '320px (Narrow Mobile)', width: 320, height: 600, isMobile: true },
    { name: '360px (Small Mobile)', width: 360, height: 740, isMobile: true },
    { name: '375px (iPhone SE)', width: 375, height: 667, isMobile: true },
    { name: '390px (iPhone 12/13/14)', width: 390, height: 844, isMobile: true },
    { name: '412px (Android Standard)', width: 412, height: 915, isMobile: true },
    { name: '430px (iPhone Pro Max)', width: 430, height: 932, isMobile: true },
    { name: '1024px (Laptop/Tablet)', width: 1024, height: 768, isMobile: false },
    { name: '1366px (Desktop)', width: 1366, height: 768, isMobile: false }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile });
    await page.goto(BASE_URL + '/pages/orders.html', { waitUntil: 'networkidle2' });

    // Open switcher
    await page.waitForSelector('#company-switcher-btn');
    await page.click('#company-switcher-btn');
    await new Promise(r => setTimeout(r, 350));

    const check = await page.evaluate((isMob) => {
      const btn = document.getElementById('company-switcher-btn');
      const menu = document.getElementById('company-dropdown-menu');
      const bRect = btn.getBoundingClientRect();
      const mRect = menu.getBoundingClientRect();
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;

      const leftMargin = Math.round(mRect.left);
      const rightMargin = Math.round(window.innerWidth - mRect.right);
      const marginDiff = Math.abs(leftMargin - rightMargin);

      const navItems = Array.from(menu.querySelectorAll('.company-nav-item')).map(el => {
        const text = el.querySelector('.company-nav-label')?.textContent.trim() || el.textContent.trim();
        const r = el.getBoundingClientRect();
        return { text, visible: r.width > 0 && r.height > 0 };
      });

      const activeCard = menu.querySelector('.company-dropdown-item.active');
      const activeCardRect = activeCard ? activeCard.getBoundingClientRect() : null;

      return {
        horizontalOverflow: scrollWidth > clientWidth ? (scrollWidth - clientWidth) : 0,
        menuWidth: Math.round(mRect.width),
        leftMargin,
        rightMargin,
        marginDiff,
        isCenteredOnMobile: isMob ? (marginDiff <= 2) : true,
        activeCardVisible: activeCardRect ? (activeCardRect.width > 0 && activeCardRect.height > 0) : false,
        allNavItemsVisible: navItems.length === 3 && navItems.every(n => n.visible)
      };
    }, vp.isMobile);

    const isPass = check.isCenteredOnMobile && (check.horizontalOverflow === 0) && check.activeCardVisible && check.allNavItemsVisible;
    results.push({ name: `Viewport ${vp.name}`, pass: isPass, details: check });

    console.log(`[${isPass ? 'PASS' : 'FAIL'}] Viewport ${vp.name}: width=${check.menuWidth}px, left=${check.leftMargin}px, right=${check.rightMargin}px, diff=${check.marginDiff}px`);

    // Screenshot
    const shotPath = path.join(ARTIFACT_DIR, `switcher_centered_${vp.width}px.png`);
    await page.screenshot({ path: shotPath });
  }

  // TEST: Open & Close toggle on mobile
  console.log('\nTesting Open/Close Toggle on mobile (375px)...');
  await page.setViewport({ width: 375, height: 667, isMobile: true });
  await page.goto(BASE_URL + '/pages/orders.html', { waitUntil: 'networkidle2' });
  
  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 200));
  const openState1 = await page.evaluate(() => document.getElementById('company-dropdown-menu').classList.contains('open'));

  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 200));
  const openState2 = await page.evaluate(() => document.getElementById('company-dropdown-menu').classList.contains('open'));

  const togglePass = openState1 && !openState2;
  console.log(`[${togglePass ? 'PASS' : 'FAIL'}] Toggle button: openThenClosed = ${togglePass}`);
  results.push({ name: 'Toggle button open/close', pass: togglePass });

  // TEST: Dismiss on click outside
  console.log('Testing Dismiss on Click Outside...');
  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 200));
  await page.click('body', { offset: { x: 10, y: 350 } });
  await new Promise(r => setTimeout(r, 200));
  const isDismissed = await page.evaluate(() => !document.getElementById('company-dropdown-menu').classList.contains('open'));
  console.log(`[${isDismissed ? 'PASS' : 'FAIL'}] Dismiss on outside click: closed = ${isDismissed}`);
  results.push({ name: 'Dismiss on outside click', pass: isDismissed });

  // TEST: Warehouses navigation
  console.log('Testing Navigation to Warehouses...');
  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 200));
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('a.company-nav-item[href="warehouses.html"]')
  ]);
  const onWarehouses = page.url().includes('warehouses.html');
  console.log(`[${onWarehouses ? 'PASS' : 'FAIL'}] Navigation to warehouses.html: ${page.url()}`);
  results.push({ name: 'Navigation to warehouses.html', pass: onWarehouses });

  // TEST: Intercompany Links navigation
  console.log('Testing Navigation to Intercompany...');
  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 200));
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('a.company-nav-item[href="intercompany.html"]')
  ]);
  const onIntercompany = page.url().includes('intercompany.html');
  console.log(`[${onIntercompany ? 'PASS' : 'FAIL'}] Navigation to intercompany.html: ${page.url()}`);
  results.push({ name: 'Navigation to intercompany.html', pass: onIntercompany });

  // TEST: Notifications dropdown unaffected
  console.log('Testing Notifications Dropdown unaffected...');
  await page.waitForSelector('#notif-center-btn');
  await page.click('#notif-center-btn');
  await new Promise(r => setTimeout(r, 200));
  const notifOpen = await page.evaluate(() => {
    const notifMenu = document.getElementById('notif-dropdown-menu');
    return notifMenu && notifMenu.classList.contains('open');
  });
  console.log(`[${notifOpen ? 'PASS' : 'FAIL'}] Notifications dropdown opens cleanly: ${notifOpen}`);
  results.push({ name: 'Notifications dropdown unaffected', pass: notifOpen });

  console.log('\n========================================================================');
  const allPassed = results.every(r => r.pass);
  console.log('OVERALL RESULT:', allPassed ? 'ALL TESTS PASSED SUCCESSFULLY! ✓' : 'FAILURES DETECTED ✗');
  console.log('========================================================================');

  await browser.close();
})();
