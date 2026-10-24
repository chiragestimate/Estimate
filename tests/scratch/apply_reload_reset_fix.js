const fs = require('fs');
const path = require('path');

function updateMainJs(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');

  // 1. Update autoSave to not write unfinalized drafts to persistent LS_KEY
  const oldAutoSave = /function autoSave\(\) \{[\s\S]*?safeStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\);\s*\}\s*catch\s*\{\s*\}\s*\}/;
  const newAutoSave = `function autoSave() {
  try {
    // If currently editing an existing invoice (e.g. from Orders Dispatch or History),
    // update the cached document for this specific invoice ID
    if (window.currentInvoiceId) {
      try {
        const editDoc = typeof extractInvoiceJSON === 'function' ? extractInvoiceJSON(window.currentInvoiceId) : null;
        if (editDoc) {
          safeStorage.setItem('inv_doc_' + window.currentInvoiceId, JSON.stringify(editDoc));
          safeStorage.setItem('current_edit_invoice', JSON.stringify(editDoc));
        }
      } catch (_) {}
      return;
    }

    // In new invoice mode:
    // Do NOT write unfinalized drafts to persistent localStorage under LS_KEY.
    // Temporary inputs remain in memory so that a normal page refresh or reopening
    // the standalone builder always initializes a fresh, blank invoice.
  } catch (_) { }
}`;
  code = code.replace(oldAutoSave, newAutoSave);

  // 2. Update loadSaved to not resurrect stale drafts
  const oldLoadSaved = /function loadSaved\(\) \{[\s\S]*?safeStorage\.removeItem\(LS_KEY\);\s*return false;\s*\}\s*\}/;
  const newLoadSaved = `function loadSaved() {
  // Automatic draft resurrection is disabled so that refreshing or reopening
  // the Invoice Builder in new-invoice mode always initializes a fresh blank invoice.
  try {
    safeStorage.removeItem(LS_KEY);
    safeStorage.removeItem('inv_builder_draft');
  } catch (_) {}
  return false;
}`;
  code = code.replace(oldLoadSaved, newLoadSaved);

  // 3. Update loadInvoiceById to perform a clean-slate reset before restoring invoice
  const oldLoadInvoiceById = /async function loadInvoiceById\(editId\) \{[\s\S]*?if \(invoiceData && restoreFn\) \{[\s\S]*?window\.currentInvoiceId = editId;[\s\S]*?restoreFn\(invoiceData\);/;
  const newLoadInvoiceById = `async function loadInvoiceById(editId) {
  if (!editId) return false;
  console.log('[InvoiceBuilder] Loading invoice:', editId);
  try {
    toast('Loading invoice ' + editId + '...');
    const invoiceData = await apiGetInvoice(editId);
    const restoreFn = (typeof window !== 'undefined' && window.restoreInvoiceUI) ? window.restoreInvoiceUI : (typeof restoreInvoiceUI === 'function' ? restoreInvoiceUI : null);
    if (invoiceData && restoreFn) {
      // 1. Completely reset form and preview state before loading new invoice data
      // This guarantees zero data leakage from previously opened orders or dispatches
      ['s-client-name', 's-client-addr', 's-client-phone', 's-client-gstin', 's-client-due', 's-due-date'].forEach(id => {
        const el = $(id);
        if (el) el.value = '';
      });
      const clientStateEl = $('s-client-state');
      if (clientStateEl) clientStateEl.value = '';
      const clientStateCodeEl = $('s-client-state-code');
      if (clientStateCodeEl) clientStateCodeEl.value = '';
      const placeSupplyEl = $('s-place-supply');
      if (placeSupplyEl) placeSupplyEl.value = '';
      window.currentDispatchNo = '';
      window.currentVehicleNo = '';
      const dispEl = $('p-disp-line');
      if (dispEl) dispEl.style.display = 'none';
      const vehEl = $('p-veh-line');
      if (vehEl) vehEl.style.display = 'none';
      const pDueLine = $('p-due-line');
      if (pDueLine) pDueLine.style.display = 'none';
      rows = [];
      rowCounter = 0;

      // 2. Set currentInvoiceId and restore invoiceData
      window.currentInvoiceId = editId;
      window._invoiceSavedOnce = true;
      window.currentInvoiceFinalized = true;
      restoreFn(invoiceData);`;
  code = code.replace(oldLoadInvoiceById, newLoadInvoiceById);

  // 4. Update bootApp to always initialize a fresh blank invoice for new invoice mode
  const oldBootAppDraftSection = /\/\/ 2\. If not edit mode, try restoring saved draft[\s\S]*?\/\/ Proactively generate invoice number for new records ONLY[\s\S]*?updateEditModeBanner\(\);/;
  const newBootAppDraftSection = `// 2. In new invoice mode (no valid editId), ALWAYS initialize a fresh blank invoice
  if (!editLoaded) {
    window.currentInvoiceId = null;
    window.currentDispatchNo = '';
    window.currentVehicleNo = '';
    window.currentInvoiceFinalized = false;
    window._invoiceSavedOnce = false;

    // Purge any temporary draft keys so abandoned/temporary data never survives
    try {
      safeStorage.removeItem(LS_KEY);
      safeStorage.removeItem('inv_builder_draft');
      safeStorage.removeItem('current_edit_invoice');
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('current_edit_invoice');
      }
    } catch (_) {}

    // Reset customer and dispatch inputs
    ['s-client-name', 's-client-addr', 's-client-phone', 's-client-gstin', 's-client-due', 's-due-date'].forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });

    const clientStateEl = $('s-client-state');
    if (clientStateEl) clientStateEl.value = '';
    const clientStateCodeEl = $('s-client-state-code');
    if (clientStateCodeEl) clientStateCodeEl.value = '';
    const placeSupplyEl = $('s-place-supply');
    if (placeSupplyEl) placeSupplyEl.value = '';

    const curDateEl = $('s-inv-date');
    if (curDateEl) curDateEl.value = today;

    // Reset dispatch & vehicle lines on preview
    const dispEl = $('p-disp-line');
    if (dispEl) dispEl.style.display = 'none';
    const vehEl = $('p-veh-line');
    if (vehEl) vehEl.style.display = 'none';

    // Reset client preview text & address rows
    const pcName = $('p-client-name');
    if (pcName) pcName.textContent = 'Client Name';
    const pcAddr = $('p-client-addr-text');
    if (pcAddr) {
      pcAddr.textContent = '';
      pcAddr.style.display = 'none';
    }
    const pcSub = $('p-client-sub');
    if (pcSub) pcSub.textContent = '';
    const pDueLine = $('p-due-line');
    if (pDueLine) pDueLine.style.display = 'none';

    const pStateRow = $('p-client-state-row');
    if (pStateRow) pStateRow.style.display = 'none';
    const pPinRow = $('p-client-pin-row');
    if (pPinRow) pPinRow.style.display = 'none';
    const pPhoneRow = $('p-client-phone-row');
    if (pPhoneRow) pPhoneRow.style.display = 'none';
    const pGstinRow = $('p-client-gstin-row');
    if (pGstinRow) pGstinRow.style.display = 'none';
    const r1 = $('p-client-row-1');
    if (r1) r1.style.display = 'none';
    const r2 = $('p-client-row-2');
    if (r2) r2.style.display = 'none';

    // Reset rows to 1 clean blank item
    rows = [];
    rowCounter = 0;
    ensureOneBlankItem();

    // Proactively generate next invoice number
    await setAutoInvoiceNumber(true);

    // Update edit banner UI
    updateEditModeBanner();

    // Re-render and recalculate
    renderRows();
    renderMobItems();
    refreshPaper();
    recalcAll();
  } else {
    updateEditModeBanner();
  }`;
  code = code.replace(oldBootAppDraftSection, newBootAppDraftSection);

  // 5. In saveToCloud, update URL hash to #edit=... and clean LS_KEY
  code = code.replace(
    /if \(result && result\.uniqueId\) \{\s*window\.currentInvoiceId = result\.uniqueId;\s*\}/,
    `if (result && result.uniqueId) {
      window.currentInvoiceId = result.uniqueId;
      try {
        history.replaceState(null, '', '#edit=' + encodeURIComponent(result.uniqueId));
      } catch (_) {}
      try {
        safeStorage.removeItem(LS_KEY);
      } catch (_) {}
    }`
  );

  fs.writeFileSync(filePath, code, 'utf-8');
  console.log('✓ Successfully applied reload reset fix to:', filePath);
}

updateMainJs(path.join(__dirname, '..', '..', 'Invoice Builder', 'js', 'main.js'));
updateMainJs(path.join(__dirname, '..', '..', 'apps', 'Invoice Builder', 'js', 'main.js'));
console.log('Done.');
