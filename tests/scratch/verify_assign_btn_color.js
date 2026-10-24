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
  await new Promise(r => setTimeout(r, 1000));

  const testViewports = [
    { name: 'desktop-1366', width: 1366, height: 768 },
    { name: 'laptop-1024', width: 1024, height: 768 },
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'mobile-320', width: 320, height: 600 }
  ];

  let allPassed = true;

  for (const vp of testViewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL + '/pages/user-roles.html', { waitUntil: 'networkidle0' });

    // Switch to roles tab
    await page.evaluate(() => {
      switchRbacTab('roles');
    });
    await new Promise(r => setTimeout(r, 400));

    const check = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#roles-table .btn-assign'));
      return btns.map((b, idx) => {
        const span = b.querySelector('span');
        const svg = b.querySelector('svg');
        const bCs = window.getComputedStyle(b);
        const spanCs = span ? window.getComputedStyle(span) : null;
        const svgCs = svg ? window.getComputedStyle(svg) : null;
        return {
          idx,
          text: span ? span.textContent.trim() : b.textContent.trim(),
          btnBg: bCs.backgroundColor,
          btnColor: bCs.color,
          spanColor: spanCs ? spanCs.color : 'no-span',
          svgStroke: svgCs ? svgCs.stroke : 'no-svg'
        };
      });
    });

    console.log(`\n=== Viewport: ${vp.name} (${vp.width}px) ===`);
    console.log(`Found ${check.length} Assign buttons.`);
    
    // Check first 3 buttons
    check.slice(0, 3).forEach(c => {
      console.log(`Button #${c.idx + 1}: text="${c.text}", btnBg="${c.btnBg}", spanColor="${c.spanColor}", svgStroke="${c.svgStroke}"`);
    });

    // Verify all spans are rgb(255, 255, 255)
    const failedSpans = check.filter(c => c.spanColor !== 'rgb(255, 255, 255)');
    if (failedSpans.length > 0) {
      console.error(`FAIL: ${failedSpans.length} buttons do NOT have white text in ${vp.name}!`);
      allPassed = false;
    } else {
      console.log(`PASS: All Assign button spans are #ffffff (rgb(255, 255, 255)) in ${vp.name}`);
    }
  }

  // Save screenshots
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(BASE_URL + '/pages/user-roles.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => switchRbacTab('roles'));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/roles_system_roles_assign_desktop_1366.png' });

  await page.setViewport({ width: 375, height: 812 });
  await page.evaluate(() => {
    const el = document.querySelector('#roles-table tbody tr');
    if (el) el.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/roles_system_roles_assign_mobile_375.png' });

  console.log(`\nOverall Result: ${allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED'}`);
  await browser.close();
})();
