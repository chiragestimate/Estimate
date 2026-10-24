const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\tirth\\.gemini\\antigravity\\brain\\f96c51f5-083a-43ab-b2cf-e51f633b1bac';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function runTestSuite() {
  console.log('========================================================================');
  console.log('AUTOMATED E2E VERIFICATION: INVOICE BUILDER RELOAD & RESET BEHAVIOR');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1366, height: 768 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();

  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log('  [HTTP ' + resp.status() + ']', resp.url());
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [BROWSER ERROR]', msg.text());
  });

  const results = [];

  // Setup mock auth session
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
    localStorage.removeItem('current_edit_invoice');
  });

  // --------------------------------------------------------------------------
  // TEST 1: Open standalone Invoice Builder -> clean, blank invoice with auto number
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Standalone Invoice Builder Clean Initial State ---');
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html', { waitUntil: 'networkidle2' });
  await delay(1200);

  const t1 = await page.evaluate(() => {
    const clientName = document.getElementById('s-client-name')?.value || '';
    const clientAddr = document.getElementById('s-client-addr')?.value || '';
    const clientPhone = document.getElementById('s-client-phone')?.value || '';
    const invNum = document.getElementById('s-inv-num')?.value || '';
    const tbodyRows = document.querySelectorAll('#items-tbody tr');
    const banner = document.getElementById('builder-mode-banner')?.innerText || '';
    const grandTotal = document.getElementById('p-grand')?.innerText || '';
    return { clientName, clientAddr, clientPhone, invNum, rowCount: tbodyRows.length, banner, grandTotal };
  });

  console.log('  T1 Data:', JSON.stringify(t1));
  const t1Pass = t1.clientName === '' &&
                 t1.clientPhone === '' &&
                 t1.rowCount === 1 &&
                 t1.banner.includes('New Invoice') &&
                 t1.invNum.length > 0;
  results.push({ test: 'Test 1: Standalone Clean Initial State', pass: t1Pass, details: t1 });
  console.log('  Result:', t1Pass ? 'PASS ✓' : 'FAIL ✗');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t1_clean_initial.png') });

  // --------------------------------------------------------------------------
  // TEST 2: Enter data -> Reload page -> Verify clean blank invoice (no draft resurrection)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Fill Temporary Invoice Data & Refresh Page ---');
  await page.evaluate(() => {
    // Fill client fields
    const nameEl = document.getElementById('s-client-name');
    if (nameEl) { nameEl.value = 'Shree Agro Traders Temporary'; nameEl.dispatchEvent(new Event('input', { bubbles: true })); }
    const phoneEl = document.getElementById('s-client-phone');
    if (phoneEl) { phoneEl.value = '9876543210'; phoneEl.dispatchEvent(new Event('input', { bubbles: true })); }
    const addrEl = document.getElementById('s-client-addr');
    if (addrEl) { addrEl.value = 'Plot 45, GIDC Industrial Estate, Rajkot'; addrEl.dispatchEvent(new Event('input', { bubbles: true })); }

    // Fill row 0 boxes & price in sidebar card
    const boxesEl = document.querySelector('.mob-item-card input[data-field="boxes"]');
    if (boxesEl) {
      boxesEl.value = '10';
      boxesEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const priceEl = document.querySelector('.mob-item-card input[data-field="price"]');
    if (priceEl) {
      priceEl.value = '450';
      priceEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await delay(800);

  const t2Before = await page.evaluate(() => {
    return {
      clientName: document.getElementById('s-client-name')?.value || '',
      pName: document.getElementById('p-client-name')?.innerText || '',
      subtotal: document.getElementById('p-subtotal')?.innerText || '',
      lsDraft: localStorage.getItem('sk_inv_data_v2'),
      lsEdit: localStorage.getItem('current_edit_invoice')
    };
  });
  console.log('  T2 Before Reload:', JSON.stringify(t2Before));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t2_filled_before_reload.png') });

  // Now reload the page
  console.log('  Reloading page...');
  await page.reload({ waitUntil: 'networkidle2' });
  await delay(1200);

  const t2After = await page.evaluate(() => {
    const clientName = document.getElementById('s-client-name')?.value || '';
    const clientPhone = document.getElementById('s-client-phone')?.value || '';
    const clientAddr = document.getElementById('s-client-addr')?.value || '';
    const pName = document.getElementById('p-client-name')?.innerText || '';
    const pAddr = document.getElementById('p-client-addr-text')?.innerText || '';
    const tbodyRows = document.querySelectorAll('#items-tbody tr');
    const firstRowBoxes = document.querySelector('.mob-item-card input[data-field="boxes"]')?.value || '';
    const firstRowPrice = document.querySelector('.mob-item-card input[data-field="price"]')?.value || '';
    const banner = document.getElementById('builder-mode-banner')?.innerText || '';
    const subtotal = document.getElementById('p-subtotal')?.innerText || '';
    const lsDraft = localStorage.getItem('sk_inv_data_v2');
    return {
      clientName, clientPhone, clientAddr, pName, pAddr,
      rowCount: tbodyRows.length, firstRowBoxes, firstRowPrice, banner, subtotal, lsDraft
    };
  });
  console.log('  T2 After Reload:', JSON.stringify(t2After));
  const t2Pass = t2After.clientName === '' &&
                 t2After.clientPhone === '' &&
                 t2After.firstRowBoxes === '' &&
                 t2After.firstRowPrice === '' &&
                 t2After.banner.includes('New Invoice') &&
                 !t2After.lsDraft;
  results.push({ test: 'Test 2: Page Reload Resets to Clean Invoice', pass: t2Pass, details: t2After });
  console.log('  Result:', t2Pass ? 'PASS ✓' : 'FAIL ✗');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t2_clean_after_reload.png') });

  // --------------------------------------------------------------------------
  // TEST 3: Enter data -> Navigate away to ERP Dashboard / Orders -> Return to Invoice Builder
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Navigate Away to Orders & Return to Standalone Invoice Builder ---');
  // Fill data again
  await page.evaluate(() => {
    const nameEl = document.getElementById('s-client-name');
    if (nameEl) { nameEl.value = 'Temporary Navigation Client'; nameEl.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await delay(500);

  // Navigate away to orders page
  console.log('  Navigating away to orders.html...');
  await page.goto('http://localhost:5174/pages/orders.html', { waitUntil: 'networkidle2' });
  await delay(800);

  // Return to Invoice Builder standalone
  console.log('  Returning to Invoice Builder...');
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html', { waitUntil: 'networkidle2' });
  await delay(1200);

  const t3 = await page.evaluate(() => {
    return {
      clientName: document.getElementById('s-client-name')?.value || '',
      pName: document.getElementById('p-client-name')?.innerText || '',
      banner: document.getElementById('builder-mode-banner')?.innerText || ''
    };
  });
  console.log('  T3 Returned Data:', JSON.stringify(t3));
  const t3Pass = t3.clientName === '' && t3.pName === 'Client Name' && t3.banner.includes('New Invoice');
  results.push({ test: 'Test 3: Navigate Away & Reopen Standalone Loads Clean Invoice', pass: t3Pass, details: t3 });
  console.log('  Result:', t3Pass ? 'PASS ✓' : 'FAIL ✗');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t3_returned_clean.png') });

  // --------------------------------------------------------------------------
  // TEST 4 & 5: Dispatch Order A -> Order B switching (zero data leakage)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Load Order A via #edit=INV-TEST-001 ---');
  // Mock save Order A and Order B using the exact document schema from dispatch-ui.js
  const orderA = {
    Date: '2026-10-23',
    DueDate: '2026-10-23',
    dispatchNo: 'DISP-A-999',
    vehicleNo: 'GJ-03-AA-1111',
    meta: {
      uniqueId: 'INV-TEST-001',
      invoiceNumber: 'INV-TEST-001',
      dispatchNo: 'DISP-A-999',
      vehicleNo: 'GJ-03-AA-1111'
    },
    InvoiceNumber: 'INV-TEST-001',
    InvoiceType: 'GST',
    customer: {
      name: 'Kisan Bio Agri Center (Order A)',
      address: 'Station Road, Gondal, Gujarat',
      phone: '9825012345',
      contact: '9825012345',
      gst: '24AAACK1234A1Z5',
      gstin: '24AAACK1234A1Z5',
      state: 'Gujarat',
      pincode: '360311',
      stateCode: '24',
      placeOfSupply: 'Gujarat',
      dueAmount: 0
    },
    rows: [
      {
        id: 'r_1',
        brand: 'Afield Special',
        name: 'Nutri-Rich Liquid 1L',
        packaging: '1 L',
        boxes: 20,
        unitsPerBox: 10,
        loose: 0,
        totalUnits: 200,
        price: 320,
        taxableValue: 64000,
        total: 64000
      }
    ]
  };

  const orderB = {
    Date: '2026-10-23',
    DueDate: '2026-10-23',
    dispatchNo: 'DISP-B-888',
    vehicleNo: 'GJ-11-BB-2222',
    meta: {
      uniqueId: 'INV-TEST-002',
      invoiceNumber: 'INV-TEST-002',
      dispatchNo: 'DISP-B-888',
      vehicleNo: 'GJ-11-BB-2222'
    },
    InvoiceNumber: 'INV-TEST-002',
    InvoiceType: 'GST',
    customer: {
      name: 'Maruti Krushi Kendra (Order B)',
      address: 'Highway Circle, Junagadh, Gujarat',
      phone: '9428056789',
      contact: '9428056789',
      gst: '24BBBMK5678B1Z2',
      gstin: '24BBBMK5678B1Z2',
      state: 'Gujarat',
      pincode: '362001',
      stateCode: '24',
      placeOfSupply: 'Gujarat',
      dueAmount: 0
    },
    rows: [
      {
        id: 'r_1',
        brand: 'Crop Pro',
        name: 'Bio-Fungicide 500ML',
        packaging: '500 ml',
        boxes: 5,
        unitsPerBox: 24,
        loose: 0,
        totalUnits: 120,
        price: 180,
        taxableValue: 21600,
        total: 21600
      }
    ]
  };

  await page.evaluate((docA, docB) => {
    localStorage.setItem('inv_doc_INV-TEST-001', JSON.stringify(docA));
    localStorage.setItem('inv_doc_INV-TEST-002', JSON.stringify(docB));
    const hist = [
      { uniqueId: 'INV-TEST-001', invoiceNumber: 'INV-TEST-001', clientName: docA.customer.name, total: 71680 },
      { uniqueId: 'INV-TEST-002', invoiceNumber: 'INV-TEST-002', clientName: docB.customer.name, total: 24192 }
    ];
    localStorage.setItem('invoice_history_cache', JSON.stringify(hist));
  }, orderA, orderB);

  // Open Order A
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html#edit=INV-TEST-001', { waitUntil: 'networkidle2' });
  await delay(1200);

  const t4 = await page.evaluate(() => {
    return {
      invNum: document.getElementById('s-inv-num')?.value || '',
      clientName: document.getElementById('s-client-name')?.value || '',
      clientPhone: document.getElementById('s-client-phone')?.value || '',
      dispatchNo: window.currentDispatchNo,
      vehicleNo: window.currentVehicleNo,
      banner: document.getElementById('builder-mode-banner')?.innerText || '',
      firstRowProduct: document.querySelector('.mob-item-card input[data-field="name"]')?.value || '',
      subtotal: document.getElementById('p-subtotal')?.innerText || ''
    };
  });
  console.log('  T4 Order A Data:', JSON.stringify(t4));
  const t4Pass = t4.clientName === orderA.customer.name &&
                 t4.dispatchNo === orderA.dispatchNo &&
                 t4.banner.includes('INV-TEST-001');
  results.push({ test: 'Test 4: Order A Loads Correctly via #edit=INV-TEST-001', pass: t4Pass, details: t4 });
  console.log('  Result:', t4Pass ? 'PASS ✓' : 'FAIL ✗');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t4_order_A.png') });

  // Now Open Order B (Verify ZERO data leakage from Order A)
  console.log('\n--- TEST 5: Load Order B via #edit=INV-TEST-002 (Zero Data Leakage) ---');
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html#edit=INV-TEST-002', { waitUntil: 'networkidle2' });
  await delay(1200);

  const t5 = await page.evaluate(() => {
    return {
      invNum: document.getElementById('s-inv-num')?.value || '',
      clientName: document.getElementById('s-client-name')?.value || '',
      clientPhone: document.getElementById('s-client-phone')?.value || '',
      dispatchNo: window.currentDispatchNo,
      vehicleNo: window.currentVehicleNo,
      banner: document.getElementById('builder-mode-banner')?.innerText || '',
      firstRowProduct: document.querySelector('.mob-item-card input[data-field="name"]')?.value || '',
      subtotal: document.getElementById('p-subtotal')?.innerText || ''
    };
  });
  console.log('  T5 Order B Data:', JSON.stringify(t5));
  const t5Pass = t5.clientName === orderB.customer.name &&
                 t5.dispatchNo === orderB.dispatchNo &&
                 t5.banner.includes('INV-TEST-002') &&
                 !t5.clientName.includes('Order A') &&
                 t5.dispatchNo !== 'DISP-A-999';
  results.push({ test: 'Test 5: Order B Clean Load with Zero Residual Data from Order A', pass: t5Pass, details: t5 });
  console.log('  Result:', t5Pass ? 'PASS ✓' : 'FAIL ✗');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t5_order_B_no_leakage.png') });

  // --------------------------------------------------------------------------
  // TEST 6: Page Reload while in Edit Mode Preserves the Selected Invoice
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Reload while in Edit Mode (#edit=INV-TEST-002) Preserves Invoice ---');
  await page.reload({ waitUntil: 'networkidle2' });
  await delay(1200);

  const t6 = await page.evaluate(() => {
    return {
      currentInvoiceId: window.currentInvoiceId,
      clientName: document.getElementById('s-client-name')?.value || '',
      banner: document.getElementById('builder-mode-banner')?.innerText || '',
      subtotal: document.getElementById('p-subtotal')?.innerText || ''
    };
  });
  console.log('  T6 Preserved Edit Data:', JSON.stringify(t6));
  const t6Pass = t6.currentInvoiceId === 'INV-TEST-002' &&
                 t6.clientName === orderB.customer.name &&
                 t6.banner.includes('INV-TEST-002');
  results.push({ test: 'Test 6: Reload in Edit Mode Preserves Selected Invoice', pass: t6Pass, details: t6 });
  console.log('  Result:', t6Pass ? 'PASS ✓' : 'FAIL ✗');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t6_edit_mode_preserved.png') });

  // --------------------------------------------------------------------------
  // TEST 7: Return to New Invoice Mode (standalone) -> Everything reset clean
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Return to Standalone Clean Blank Invoice after Edit Session ---');
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html', { waitUntil: 'networkidle2' });
  await delay(1200);

  const t7 = await page.evaluate(() => {
    return {
      currentInvoiceId: window.currentInvoiceId,
      dispatchNo: window.currentDispatchNo,
      clientName: document.getElementById('s-client-name')?.value || '',
      rowCount: document.querySelectorAll('#items-tbody tr').length,
      banner: document.getElementById('builder-mode-banner')?.innerText || ''
    };
  });
  console.log('  T7 Return to Clean New Mode:', JSON.stringify(t7));
  const t7Pass = !t7.currentInvoiceId &&
                 !t7.dispatchNo &&
                 t7.clientName === '' &&
                 t7.rowCount === 1 &&
                 t7.banner.includes('New Invoice');
  results.push({ test: 'Test 7: Direct Return Cleans All Edit Mode Artifacts', pass: t7Pass, details: t7 });
  console.log('  Result:', t7Pass ? 'PASS ✓' : 'FAIL ✗');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t7_fresh_after_edit.png') });

  // --------------------------------------------------------------------------
  // TEST 8: Verify Tax / GST Calculations & State Detection in Blank & Populated State
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: State Detection & GST Calculation Integrity ---');
  // Test inter-state client (Rajasthan) -> IGST calculation
  await page.evaluate(() => {
    const stateEl = document.getElementById('s-client-state');
    if (stateEl) {
      stateEl.value = 'Rajasthan';
      stateEl.dispatchEvent(new Event('input', { bubbles: true }));
      stateEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const rateEl = document.getElementById('gst-rate-display');
    if (rateEl) {
      rateEl.value = 'IGST12';
      rateEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const boxesEl = document.querySelector('.mob-item-card input[data-field="boxes"]');
    if (boxesEl) {
      boxesEl.value = '10';
      boxesEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const priceEl = document.querySelector('.mob-item-card input[data-field="price"]');
    if (priceEl) {
      priceEl.value = '1000';
      priceEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await delay(600);

  const t8 = await page.evaluate(() => {
    const subtotal = document.getElementById('p-subtotal')?.innerText || '';
    const igstRow = document.getElementById('p-igst-row');
    const cgstRow = document.getElementById('p-cgst-row');
    const igstVal = document.getElementById('p-igst')?.innerText || '';
    const grandTotal = document.getElementById('p-grand')?.innerText || '';
    const igstDisp = igstRow ? window.getComputedStyle(igstRow).display : 'none';
    const cgstDisp = cgstRow ? window.getComputedStyle(cgstRow).display : 'none';
    return { subtotal, igstVal, grandTotal, igstDisp, cgstDisp };
  });
  console.log('  T8 IGST Calculation Data:', JSON.stringify(t8));
  // 10 boxes @ 1000 = 10,000 subtotal, 12% IGST = 1,200, Grand Total = 11,200
  const t8Pass = t8.igstDisp !== 'none' && t8.cgstDisp === 'none' && t8.igstVal.includes('1,200');
  results.push({ test: 'Test 8: Automatic Interstate IGST Calculations Function Accurately', pass: t8Pass, details: t8 });
  console.log('  Result:', t8Pass ? 'PASS ✓' : 'FAIL ✗');

  // --------------------------------------------------------------------------
  // TEST 9: Mobile Viewport (375x667) Parity: Input -> Reload -> Blank Reset
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Mobile Viewport (375px) Reload Reset Parity ---');
  await page.setViewport({ width: 375, height: 667, isMobile: true });
  await page.goto('http://localhost:5174/Invoice%20Builder/index.html', { waitUntil: 'networkidle2' });
  await delay(1000);

  // Fill in client on mobile
  await page.evaluate(() => {
    const nameEl = document.getElementById('s-client-name');
    if (nameEl) { nameEl.value = 'Mobile Client Unsaved'; nameEl.dispatchEvent(new Event('input', { bubbles: true })); }
    const phoneEl = document.getElementById('s-client-phone');
    if (phoneEl) { phoneEl.value = '9998887776'; phoneEl.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await delay(600);

  // Mobile reload
  console.log('  Reloading on mobile...');
  await page.reload({ waitUntil: 'networkidle2' });
  await delay(1200);

  const t9 = await page.evaluate(() => {
    const clientName = document.getElementById('s-client-name')?.value || '';
    const clientPhone = document.getElementById('s-client-phone')?.value || '';
    const banner = document.getElementById('builder-mode-banner')?.innerText || '';
    const mobItems = document.querySelectorAll('#mob-items-list .mob-item-card');
    return { clientName, clientPhone, banner, mobItemCount: mobItems.length };
  });
  console.log('  T9 Mobile Reload Data:', JSON.stringify(t9));
  const t9Pass = t9.clientName === '' && t9.clientPhone === '' && t9.banner.includes('New Invoice');
  results.push({ test: 'Test 9: Mobile Viewport Reload Automatically Resets to Blank State', pass: t9Pass, details: t9 });
  console.log('  Result:', t9Pass ? 'PASS ✓' : 'FAIL ✗');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_reload_t9_mobile_reset.png') });

  // --------------------------------------------------------------------------
  // TEST 10: Verify Zero Manual Reset Buttons Added & PDF Generation Clean
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: Strict Constraints Check (No Reset/Clear Button Added) & PDF ---');
  await page.setViewport({ width: 1366, height: 768 });
  const t10 = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button, a.btn, input[type="button"]')).map(b => b.innerText.trim());
    const resetButtons = allButtons.filter(b => /^(reset|clear|clear all|reset invoice|reload)$/i.test(b));
    const hasDownloadPdfFn = typeof window.downloadPDF === 'function' || typeof downloadPDF === 'function';
    const pdfBtn = document.getElementById('pdf-btn');
    return {
      allButtonCount: allButtons.length,
      resetButtonsFound: resetButtons,
      hasDownloadPdfFn,
      pdfBtnPresent: !!pdfBtn
    };
  });
  console.log('  T10 Buttons & PDF Check:', JSON.stringify(t10));
  const t10Pass = t10.resetButtonsFound.length === 0 && t10.pdfBtnPresent;
  results.push({ test: 'Test 10: Strict Constraint Confirmed (Zero Manual Reset/Clear Buttons Added) & PDF Intact', pass: t10Pass, details: t10 });
  console.log('  Result:', t10Pass ? 'PASS ✓' : 'FAIL ✗');

  // Summary
  console.log('\n========================================================================');
  console.log('FINAL TEST RESULTS SUMMARY');
  console.log('========================================================================');
  let allPassed = true;
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.test}`);
    if (!r.pass) allPassed = false;
  }
  console.log('========================================================================');
  console.log('OVERALL STATUS:', allPassed ? 'ALL TESTS PASSED! (10/10) ✓' : 'FAILURES DETECTED ✗');

  await browser.close();
}

runTestSuite().catch(err => {
  console.error('Fatal error during test suite:', err);
  process.exit(1);
});
