const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';
const ARTIFACT_DIR = 'C:\\Users\\tirth\\.gemini\\antigravity\\brain\\f96c51f5-083a-43ab-b2cf-e51f633b1bac';

(async () => {
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
  await new Promise(r => setTimeout(r, 1000));

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

  console.log('========================================================================');
  console.log('COMPANY SWITCHER POPUP CENTERING & RESPONSIVE VERIFICATION');
  console.log('========================================================================\n');

  let allPassed = true;

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile });
    await page.goto(BASE_URL + '/pages/orders.html', { waitUntil: 'networkidle2' });

    await page.waitForSelector('#company-switcher-btn');
    await page.click('#company-switcher-btn');
    await new Promise(r => setTimeout(r, 400));

    const data = await page.evaluate((isMob) => {
      const btn = document.getElementById('company-switcher-btn');
      const menu = document.getElementById('company-dropdown-menu');
      const bRect = btn.getBoundingClientRect();
      const mRect = menu.getBoundingClientRect();
      const cs = window.getComputedStyle(menu);
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;

      // Check navigation items inside menu
      const navItems = Array.from(menu.querySelectorAll('.company-nav-item')).map(el => {
        const text = el.querySelector('.company-nav-label')?.textContent.trim() || el.textContent.trim();
        const r = el.getBoundingClientRect();
        return { text, visible: r.width > 0 && r.height > 0 };
      });

      const activeCard = menu.querySelector('.company-dropdown-item.active');
      const activeCardRect = activeCard ? activeCard.getBoundingClientRect() : null;

      const leftMargin = Math.round(mRect.left);
      const rightMargin = Math.round(window.innerWidth - mRect.right);
      const marginDiff = Math.abs(leftMargin - rightMargin);

      return {
        windowWidth: window.innerWidth,
        horizontalOverflow: scrollWidth > clientWidth ? (scrollWidth - clientWidth) : 0,
        btn: { left: Math.round(bRect.left), right: Math.round(bRect.right), width: Math.round(bRect.width) },
        menu: {
          left: Math.round(mRect.left),
          right: Math.round(mRect.right),
          width: Math.round(mRect.width),
          top: Math.round(mRect.top),
          leftMargin,
          rightMargin,
          marginDiff,
          isCenteredOnMobile: isMob ? (marginDiff <= 2) : true
        },
        activeCardVisible: activeCardRect ? (activeCardRect.width > 0 && activeCardRect.height > 0) : false,
        navItems
      };
    }, vp.isMobile);

    console.log(`Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`  - Menu Width: ${data.menu.width}px`);
    console.log(`  - Left Margin: ${data.menu.leftMargin}px | Right Margin: ${data.menu.rightMargin}px (Diff: ${data.menu.marginDiff}px)`);
    console.log(`  - Horizontal Overflow: ${data.horizontalOverflow}px`);
    console.log(`  - Active Card Visible: ${data.activeCardVisible}`);
    console.log(`  - Nav Items: ${data.navItems.map(n => n.text + (n.visible ? ' (OK)' : ' (HIDDEN)')).join(', ')}`);

    const isCentered = vp.isMobile ? (data.menu.marginDiff <= 2) : (data.menu.right <= vp.width);
    const noOverflow = data.horizontalOverflow === 0;
    const itemsOk = data.activeCardVisible && data.navItems.every(n => n.visible);

    const pass = isCentered && noOverflow && itemsOk;
    if (!pass) allPassed = false;
    console.log(`  - Result: ${pass ? 'PASS ✓' : 'FAIL ✗'}\n`);

    // Take screenshot
    const cleanName = vp.width + 'px';
    await page.screenshot({ path: `${ARTIFACT_DIR}/verify_switcher_centering_${cleanName}.png` });
  }

  // Also test clicking one of the navigation items to verify functionality
  console.log('Testing Navigation: Click "Companies & Branches"...');
  await page.setViewport({ width: 375, height: 667, isMobile: true });
  await page.goto(BASE_URL + '/pages/orders.html', { waitUntil: 'networkidle2' });
  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 300));
  await page.click('a.company-nav-item[href="companies.html"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('Navigated to URL:', page.url());
  const navSuccess = page.url().includes('companies.html');
  console.log(`Navigation Result: ${navSuccess ? 'PASS ✓' : 'FAIL ✗'}`);
  if (!navSuccess) allPassed = false;

  console.log('\n========================================================================');
  console.log('FINAL STATUS:', allPassed ? 'ALL VIEWPORTS AND CHECKS PASSED! ✓' : 'FAILURES OCCURRED ✗');
  console.log('========================================================================');

  await browser.close();
})();
