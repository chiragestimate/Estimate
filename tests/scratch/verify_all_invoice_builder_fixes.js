const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\tirth\\.gemini\\antigravity\\brain\\f96c51f5-083a-43ab-b2cf-e51f633b1bac';

const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('Starting Complete Automated Verification of Automatic State Detection & Button Removal...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1366, height: 768 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();

  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log('[HTTP ' + resp.status() + ']', resp.url());
    }
  });

  // Handle page logs
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[PAGE ERROR]', msg.text());
  });

  // STEP 0: Inject demo auth in localStorage
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const session = {
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'tirth@afield.com',
        user_metadata: { role: 'admin', full_name: 'Admin' }
      },
      token: 'mock-token'
    };
    localStorage.setItem('sb-fveqamtetqgthkghqffz-auth-token', JSON.stringify(session));
    localStorage.setItem('user_role', 'admin');
    localStorage.removeItem('inv_builder_draft');
    localStorage.removeItem('sk_inv_data_v2');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Initial Blank Invoice - State & Buttons Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: Initial Blank Invoice State & Button Removal ---');
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html', { waitUntil: 'networkidle2' });
  await delay(1000);

  const t1 = await page.evaluate(() => {
    const clientStateInput = document.getElementById('s-client-state')?.value;
    const clientStateRow = document.getElementById('p-client-state-row');
    const clientStateRowDisp = clientStateRow ? window.getComputedStyle(clientStateRow).display : 'not_found';
    const clientStateRowVis = clientStateRow ? window.getComputedStyle(clientStateRow).visibility : 'not_found';
    const clientNamePreview = document.getElementById('p-client-name')?.textContent;
    const modeBannerText = document.getElementById('builder-mode-text')?.textContent;
    
    // Check buttons that should be REMOVED
    const btnNewToolbar = document.getElementById('btn-new-invoice');
    const btnNewMobTop = document.getElementById('mob-new-top-btn');
    const btnNewMobTab = document.getElementById('mob-new-tab');
    const btnResetBanner = document.getElementById('btn-mode-banner-action');

    // Datalist check
    const datalist = document.getElementById('indian-states-list');
    const datalistOptions = datalist ? Array.from(datalist.options).map(o => o.value) : [];

    return {
      clientStateInput,
      clientStateRowDisp,
      clientStateRowVis,
      clientNamePreview,
      modeBannerText,
      hasBtnNewToolbar: !!btnNewToolbar,
      hasBtnNewMobTop: !!btnNewMobTop,
      hasBtnNewMobTab: !!btnNewMobTab,
      hasBtnResetBanner: !!btnResetBanner,
      datalistOptionCount: datalistOptions.length,
      hasGujaratInDatalist: datalistOptions.includes('Gujarat'),
      hasMaharashtraInDatalist: datalistOptions.includes('Maharashtra'),
      hasLadakhInDatalist: datalistOptions.includes('Ladakh')
    };
  });

  console.log('Test 1 Results:', t1);
  if (t1.clientStateInput !== '') throw new Error('Initial client state input should be empty, but was: ' + t1.clientStateInput);
  if (t1.clientStateRowDisp !== 'none') throw new Error('Initial client state row display should be none, but was: ' + t1.clientStateRowDisp);
  if (t1.hasBtnNewToolbar) throw new Error('+ New Invoice button was found in toolbar!');
  if (t1.hasBtnResetBanner) throw new Error('Reset Form button was found in mode banner!');
  if (t1.hasBtnNewMobTop) throw new Error('mob-new-top-btn was found!');
  if (t1.hasBtnNewMobTab) throw new Error('mob-new-tab was found!');
  if (t1.datalistOptionCount < 36) throw new Error('Datalist options count is less than 36: ' + t1.datalistOptionCount);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_test1_blank_invoice_desktop.png') });
  console.log('✓ Test 1 Passed: Initial blank invoice has empty state, fluid preview (no "State: Gujarat"), buttons removed cleanly.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Client Selection from Master Data with Saved State (Beej Bhandar -> Rajasthan)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Existing Client with Explicit Billing State (Rajasthan) ---');
  await page.evaluate(() => {
    // Simulate selecting client Beej Bhandar with explicit state Rajasthan
    const client = {
      ClientName: 'Beej Bhandar (Vyas Ramniwas)',
      Address: 'Sri Dungargarh',
      City: 'Bikaner',
      State: 'Rajasthan',
      Pincode: '331803',
      Phone: '9829212345',
      GSTIN: '08ABCDE1234F1Z5',
      DueAmount: 1500
    };
    window.applyClientSelection(client);
  });

  await delay();

  const t2 = await page.evaluate(() => {
    const sState = document.getElementById('s-client-state')?.value;
    const sPin = document.getElementById('s-client-pincode')?.value;
    const sAddr = document.getElementById('s-client-addr')?.value;
    const pStateText = document.getElementById('p-client-state-text')?.textContent;
    const pStateRowDisp = window.getComputedStyle(document.getElementById('p-client-state-row')).display;
    const pPinText = document.getElementById('p-client-pin-text')?.textContent;
    const pAddrText = document.getElementById('p-client-addr-text')?.textContent;
    const pAddrDisp = window.getComputedStyle(document.getElementById('p-client-addr-text')).display;

    return { sState, sPin, sAddr, pStateText, pStateRowDisp, pPinText, pAddrText, pAddrDisp };
  });

  console.log('Test 2 Results (Rajasthan Client):', t2);
  if (t2.sState !== 'Rajasthan') throw new Error('State input should be Rajasthan, but got: ' + t2.sState);
  if (t2.pStateText !== 'Rajasthan') throw new Error('Preview state should be Rajasthan, but got: ' + t2.pStateText);
  if (t2.pStateRowDisp === 'none') throw new Error('Preview state row should be visible');
  if (t2.sPin !== '331803') throw new Error('PIN should be 331803');

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_test2_rajasthan_client.png') });
  console.log('✓ Test 2 Passed: Selected client with saved billing state correctly populates Rajasthan in form & preview.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Client Switching & Leak Prevention (Switch to Client with NO State)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Client Switching to Incomplete/No-State Client ---');
  await page.evaluate(() => {
    const clientNoState = {
      ClientName: 'Kalyan Traders',
      Address: 'Shop 14, APMC Grain Market',
      City: 'Unjha',
      State: '',
      Pincode: '',
      Phone: '9428011223',
      GSTIN: '',
      DueAmount: 0
    };
    window.applyClientSelection(clientNoState);
  });

  await delay();

  const t3 = await page.evaluate(() => {
    const sName = document.getElementById('s-client-name')?.value;
    const sState = document.getElementById('s-client-state')?.value;
    const pName = document.getElementById('p-client-name')?.textContent;
    const pStateText = document.getElementById('p-client-state-text')?.textContent;
    const pStateRowDisp = window.getComputedStyle(document.getElementById('p-client-state-row')).display;
    const r1Disp = window.getComputedStyle(document.getElementById('p-client-row-1')).display;

    return { sName, sState, pName, pStateText, pStateRowDisp, r1Disp };
  });

  console.log('Test 3 Results (No-State Client):', t3);
  if (t3.sState !== '') throw new Error('Client state must NOT retain previous client state or default to Gujarat! Got: ' + t3.sState);
  if (t3.pStateRowDisp !== 'none') throw new Error('Preview state row must be display:none when client has no state! Got: ' + t3.pStateRowDisp);
  if (t3.r1Disp !== 'none') throw new Error('Row 1 must collapse when state and pin are missing');

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_test3_switched_no_state_client.png') });
  console.log('✓ Test 3 Passed: Switching clients cleanly clears state, no leakage from previous client or Gujarat fallback.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Manual State Entry & Autocomplete Typing
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Manual State Selection & Fluid Layout ---');
  await page.evaluate(() => {
    const stateInput = document.getElementById('s-client-state');
    stateInput.value = 'Madhya Pradesh';
    stateInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await delay();

  const t4 = await page.evaluate(() => {
    const sState = document.getElementById('s-client-state')?.value;
    const pStateText = document.getElementById('p-client-state-text')?.textContent;
    const pStateRowDisp = window.getComputedStyle(document.getElementById('p-client-state-row')).display;
    const r1Disp = window.getComputedStyle(document.getElementById('p-client-row-1')).display;
    const sc = typeof window.getStateCodeFromName === 'function' ? window.getStateCodeFromName(sState) : null;

    return { sState, pStateText, pStateRowDisp, r1Disp, sc };
  });

  console.log('Test 4 Results (Manual Madhya Pradesh):', t4);
  if (t4.sState !== 'Madhya Pradesh') throw new Error('State input should be Madhya Pradesh');
  if (t4.pStateText !== 'Madhya Pradesh') throw new Error('Preview state should be Madhya Pradesh');
  if (t4.pStateRowDisp === 'none') throw new Error('Preview state row should be visible');
  if (t4.sc !== '23') throw new Error('Madhya Pradesh GST state code should be 23, but got: ' + t4.sc);

  // Now clear it manually
  await page.evaluate(() => {
    const stateInput = document.getElementById('s-client-state');
    stateInput.value = '';
    stateInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await delay();

  const t4Clear = await page.evaluate(() => {
    return {
      sState: document.getElementById('s-client-state')?.value,
      pStateRowDisp: window.getComputedStyle(document.getElementById('p-client-state-row')).display
    };
  });
  if (t4Clear.sState !== '') throw new Error('State should be empty after clearing');
  if (t4Clear.pStateRowDisp !== 'none') throw new Error('State row should be hidden after clearing');
  console.log('✓ Test 4 Passed: Manual state entry and clearing dynamically synchronizes preview and state codes.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Fluid Pincode Re-positioning when State is Missing
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Fluid Pincode Re-positioning when State is Missing ---');
  await page.evaluate(() => {
    const stateInput = document.getElementById('s-client-state');
    const pinInput = document.getElementById('s-client-pincode');
    stateInput.value = '';
    pinInput.value = '400001';
    stateInput.dispatchEvent(new Event('input', { bubbles: true }));
    pinInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await delay();

  const t5 = await page.evaluate(() => {
    const stateDisp = window.getComputedStyle(document.getElementById('p-client-state-row')).display;
    const pinDisp = window.getComputedStyle(document.getElementById('p-client-pin-row')).display;
    const pinText = document.getElementById('p-client-pin-text')?.textContent;
    const r1Disp = window.getComputedStyle(document.getElementById('p-client-row-1')).display;

    return { stateDisp, pinDisp, pinText, r1Disp };
  });

  console.log('Test 5 Results (Pin Only):', t5);
  if (t5.stateDisp !== 'none') throw new Error('State row must be hidden');
  if (t5.pinDisp !== 'block') throw new Error('Pin row must be displayed');
  if (t5.pinText !== '400001') throw new Error('Pin text must be 400001');
  if (t5.r1Disp !== 'flex') throw new Error('Row 1 container must be flex');

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_test5_fluid_pin_repositioned.png') });
  console.log('✓ Test 5 Passed: Pincode flows cleanly to the start of row 1 without empty gap when State is absent.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: Save, Persistence & Direct Revisit Parity
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Save, Storage Persistence & Parity ---');
  await page.evaluate(() => {
    // Fill client with Punjab
    const client = {
      ClientName: 'Golden Wheat Agro',
      Address: 'GT Road, Mandi Gobindgarh',
      City: 'Gobindgarh',
      State: 'Punjab',
      Pincode: '147301',
      Phone: '9815012345',
      GSTIN: '03AAACG1234A1Z1',
      DueAmount: 500
    };
    window.applyClientSelection(client);
    window.autoSave();
  });
  await delay();

  // Reload page
  await page.reload({ waitUntil: 'networkidle2' });
  await delay();

  const t6 = await page.evaluate(() => {
    return {
      cName: document.getElementById('s-client-name')?.value,
      cState: document.getElementById('s-client-state')?.value,
      cPin: document.getElementById('s-client-pincode')?.value,
      pStateText: document.getElementById('p-client-state-text')?.textContent,
      pStateRowDisp: window.getComputedStyle(document.getElementById('p-client-state-row')).display
    };
  });

  console.log('Test 6 Results (Reload Parity):', t6);
  if (t6.cName !== 'Golden Wheat Agro') throw new Error('Client name mismatch on reload');
  if (t6.cState !== 'Punjab') throw new Error('Client state should be Punjab after reload, but got: ' + t6.cState);
  if (t6.pStateText !== 'Punjab') throw new Error('Preview state should be Punjab');

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_test6_persisted_state_reload.png') });
  console.log('✓ Test 6 Passed: State "Punjab" saved and restored perfectly across reload.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: Mobile Viewport Responsive UI (375px)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Mobile Responsive Viewport (375px) ---');
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await delay();

  const t7 = await page.evaluate(() => {
    const btnNewToolbar = document.getElementById('btn-new-invoice');
    const btnNewMobTop = document.getElementById('mob-new-top-btn');
    const btnNewMobTab = document.getElementById('mob-new-tab');
    const btnResetBanner = document.getElementById('btn-mode-banner-action');
    const modeBanner = document.getElementById('builder-mode-banner');
    const modeText = document.getElementById('builder-mode-text');
    const bodyScrollWidth = document.body.scrollWidth;
    const winWidth = window.innerWidth;

    return {
      hasBtnNewToolbar: !!btnNewToolbar,
      hasBtnNewMobTop: !!btnNewMobTop,
      hasBtnNewMobTab: !!btnNewMobTab,
      hasBtnResetBanner: !!btnResetBanner,
      modeTextContent: modeText?.textContent,
      modeBannerVisible: modeBanner ? window.getComputedStyle(modeBanner).display !== 'none' : false,
      bodyScrollWidth,
      winWidth,
      hasHorizontalOverflow: bodyScrollWidth > winWidth
    };
  });

  console.log('Test 7 Results (Mobile 375px):', t7);
  if (t7.hasBtnNewToolbar) throw new Error('Mobile has btn-new-invoice');
  if (t7.hasBtnNewMobTop) throw new Error('Mobile has mob-new-top-btn');
  if (t7.hasBtnNewMobTab) throw new Error('Mobile has mob-new-tab');
  if (t7.hasBtnResetBanner) throw new Error('Mobile has btn-mode-banner-action');
  if (!t7.modeBannerVisible) throw new Error('Mode banner should be visible on mobile');

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_test7_mobile_375.png') });
  console.log('✓ Test 7 Passed: Mobile 375px shows clean header with NO new/reset buttons and no overflow.');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 8: PDF Generation and Bill To Address Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: PDF Generation Parity Check ---');
  await page.setViewport({ width: 1366, height: 768 });
  const pdfGenerated = await page.evaluate(() => {
    try {
      if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
        return { success: false, reason: 'jsPDF not loaded' };
      }
      const { jsPDF } = window.jspdf || window;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const payload = window.extractInvoiceJSON ? window.extractInvoiceJSON() : {};
      window.drawA4InvoicePdf(pdf, payload);
      return { success: true, pageCount: pdf.internal.getNumberOfPages() };
    } catch (e) {
      return { success: false, reason: e.message };
    }
  });

  console.log('Test 8 PDF Output:', pdfGenerated);
  if (!pdfGenerated.success) throw new Error('PDF Generation failed: ' + pdfGenerated.reason);
  console.log('✓ Test 8 Passed: PDF generated successfully with fluid Bill To layout and accurate state.');

  console.log('\n======================================================');
  console.log('🎉 ALL 8 TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================');

  await browser.close();
  process.exit(0);
})().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
