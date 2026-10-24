const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

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
  await new Promise(r => setTimeout(r, 1200));

  let allPassed = true;

  console.log(`\n======================================================`);
  console.log(`PART 1: TESTING ACTIVE COMPANY SWITCHER DROPDOWN`);
  console.log(`======================================================`);

  const viewports = [
    { name: 'desktop-1366', width: 1366, height: 768, isMobile: false },
    { name: 'laptop-1024', width: 1024, height: 768, isMobile: false },
    { name: 'mobile-430', width: 430, height: 932, isMobile: true },
    { name: 'mobile-390', width: 390, height: 844, isMobile: true },
    { name: 'mobile-360', width: 360, height: 780, isMobile: true },
    { name: 'mobile-320', width: 320, height: 600, isMobile: true }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL + '/pages/reports.html', { waitUntil: 'networkidle0' });

    // Click company switcher button
    await page.click('#company-switcher-btn');
    await new Promise(r => setTimeout(r, 300));

    const check = await page.evaluate((isMob) => {
      const btn = document.getElementById('company-switcher-btn');
      const menu = document.getElementById('company-dropdown-menu');
      const bRect = btn.getBoundingClientRect();
      const mRect = menu.getBoundingClientRect();
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;

      // Check icons
      const navLinks = Array.from(menu.querySelectorAll('.company-nav-item'));
      const iconChecks = navLinks.map(l => {
        const svg = l.querySelector('svg');
        const text = l.querySelector('.company-nav-label')?.textContent.trim() || l.textContent.trim();
        const svgRect = svg ? svg.getBoundingClientRect() : null;
        return {
          text,
          href: l.getAttribute('href'),
          hasSvg: !!svg,
          iconWidth: svgRect ? Math.round(svgRect.width) : 0,
          iconHeight: svgRect ? Math.round(svgRect.height) : 0
        };
      });

      // Check company card
      const compName = menu.querySelector('.company-item-name')?.textContent.trim();
      const badgeText = menu.querySelector('.company-badge-pill')?.textContent.trim();
      const subText = menu.querySelector('.company-card-sub')?.textContent.trim();
      const nameRect = menu.querySelector('.company-item-name')?.getBoundingClientRect();

      return {
        overflow: scrollWidth > clientWidth ? (scrollWidth - clientWidth) : 0,
        btn: { left: Math.round(bRect.left), right: Math.round(bRect.right), bottom: Math.round(bRect.bottom), width: Math.round(bRect.width) },
        menu: { left: Math.round(mRect.left), right: Math.round(mRect.right), top: Math.round(mRect.top), width: Math.round(mRect.width), height: Math.round(mRect.height) },
        iconChecks,
        companyCard: {
          name: compName,
          badge: badgeText,
          sub: subText,
          nameHeight: nameRect ? Math.round(nameRect.height) : 0
        }
      };
    }, vp.isMobile);

    console.log(`\nViewport: ${vp.name} (${vp.width}px x ${vp.height}px)`);
    console.log(`  - Horizontal Overflow: ${check.overflow}px`);
    console.log(`  - Button: left=${check.btn.left}px, right=${check.btn.right}px, width=${check.btn.width}px`);
    console.log(`  - Menu: left=${check.menu.left}px, right=${check.menu.right}px, width=${check.menu.width}px, top=${check.menu.top}px`);
    console.log(`  - Company Card: "${check.companyCard.name}" [${check.companyCard.badge}] | Sub: "${check.companyCard.sub}"`);
    console.log(`  - Menu Nav Items:`);
    check.iconChecks.forEach(ic => {
      console.log(`      * [${ic.text}] -> ${ic.href} (Icon: ${ic.iconWidth}x${ic.iconHeight}px, hasSvg=${ic.hasSvg})`);
    });

    // Verification checks
    if (check.overflow > 0) {
      console.error(`FAIL: Horizontal overflow in ${vp.name}!`);
      allPassed = false;
    }
    if (check.menu.left < 0 || check.menu.right > vp.width) {
      console.error(`FAIL: Menu extends beyond viewport in ${vp.name}! left=${check.menu.left}, right=${check.menu.right}, vpWidth=${vp.width}`);
      allPassed = false;
    }
    if (!check.iconChecks.every(ic => ic.hasSvg && ic.iconWidth >= 14 && ic.iconHeight >= 14)) {
      console.error(`FAIL: Navigation icons broken in ${vp.name}!`);
      allPassed = false;
    }
  }

  // Save Screenshots for Part 1
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(BASE_URL + '/pages/reports.html', { waitUntil: 'networkidle0' });
  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/company_switcher_desktop_1366.png' });

  await page.setViewport({ width: 375, height: 812 });
  await page.click('#company-switcher-btn');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/company_switcher_mobile_375.png' });

  console.log(`\n======================================================`);
  console.log(`PART 2: TESTING ORDERS -> DISPATCH SEND ON WHATSAPP`);
  console.log(`======================================================`);

  // Navigate to orders page
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(BASE_URL + '/pages/orders.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Test WhatsApp sharing logic directly
  const waTestResult = await page.evaluate(async () => {
    const results = {};

    // 1. Verify sendInvoiceWhatsApp function exists
    results.functionExists = typeof window.sendInvoiceWhatsApp === 'function';

    // 2. Set up test invoice doc
    const testDoc = {
      InvoiceNumber: 'INV-01',
      date: '22-10-2026',
      orderNo: 'ORD-2026-001',
      dispatchNo: 'DSP-2026-001',
      billTo: {
        name: 'Kisan Krishi Kendra',
        contact: '9876543210',
        address: 'Main Market, Rajkot'
      },
      calculations: {
        grandTotal: 45000
      },
      rows: [
        { name: 'Chlorpyrifos 20% EC', packaging: '1 Litre', qty: 50, price: 900, total: 45000 }
      ]
    };
    window.currentViewInvoiceDoc = testDoc;

    // Test A: Native share supported case
    let nativeShareCalledWith = null;
    let fallbackOpenedUrl = null;
    let downloadPdfCalled = false;

    // Mock downloadInvoicePDF
    const origDownload = window.DISPATCH_UI.downloadInvoicePDF;
    window.DISPATCH_UI.downloadInvoicePDF = () => { downloadPdfCalled = true; };

    // Mock window.open
    const origOpen = window.open;
    window.open = (url) => { fallbackOpenedUrl = url; };

    // Simulate navigator.share with files
    const origCanShare = navigator.canShare;
    const origShare = navigator.share;

    navigator.canShare = () => true;
    navigator.share = async (data) => {
      nativeShareCalledWith = {
        title: data.title,
        text: data.text,
        fileCount: data.files ? data.files.length : 0,
        fileName: data.files && data.files[0] ? data.files[0].name : null,
        fileType: data.files && data.files[0] ? data.files[0].type : null
      };
      return Promise.resolve();
    };

    // Invoke sendInvoiceWhatsApp
    await window.DISPATCH_UI.sendInvoiceWhatsApp();

    results.nativeShareSuccess = {
      calledWith: nativeShareCalledWith,
      didNotDownload: !downloadPdfCalled
    };

    // Test B: User cancelled native share
    downloadPdfCalled = false;
    navigator.share = async () => {
      const err = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    };
    await window.DISPATCH_UI.sendInvoiceWhatsApp();
    results.userCancelled = {
      didNotDownloadOnCancel: !downloadPdfCalled
    };

    // Test C: Native share NOT supported (e.g. HTTP LAN connection)
    navigator.canShare = () => false;
    fallbackOpenedUrl = null;
    downloadPdfCalled = false;
    await window.DISPATCH_UI.sendInvoiceWhatsApp();
    results.fallbackWithoutFileShare = {
      openedWhatsappUrl: fallbackOpenedUrl,
      didNotForceDownload: !downloadPdfCalled
    };

    // Restore
    window.DISPATCH_UI.downloadInvoicePDF = origDownload;
    window.open = origOpen;
    if (origCanShare) navigator.canShare = origCanShare;
    if (origShare) navigator.share = origShare;

    return results;
  });

  console.log('WhatsApp Sharing Test Results:', JSON.stringify(waTestResult, null, 2));

  if (!waTestResult.functionExists) {
    console.error('FAIL: sendInvoiceWhatsApp function does not exist!');
    allPassed = false;
  }
  if (!waTestResult.nativeShareSuccess.calledWith || !waTestResult.nativeShareSuccess.didNotDownload) {
    console.error('FAIL: Native share did not pass file or triggered download!');
    allPassed = false;
  }
  if (!waTestResult.userCancelled.didNotDownloadOnCancel) {
    console.error('FAIL: Share cancellation triggered unwanted download!');
    allPassed = false;
  }
  if (!waTestResult.fallbackWithoutFileShare.openedWhatsappUrl || !waTestResult.fallbackWithoutFileShare.didNotForceDownload) {
    console.error('FAIL: Fallback did not open WhatsApp URL or forced download!');
    allPassed = false;
  }

  console.log(`\nOverall Test Result: ${allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED'}`);
  await browser.close();
})();
