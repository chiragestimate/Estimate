const fs = require('fs');

const files = [
  'Invoice Builder/js/main.js',
  'apps/Invoice Builder/js/main.js'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace legacy startNewInvoice(mode) at lines ~3076
  const oldLegacyStart = `async function startNewInvoice(mode) {
  if (!confirm('Start a new invoice? Unsaved data will be lost.')) return;
  rows = []; rowCounter = 0;
  window.currentInvoiceId = null;
  window._invoiceSavedOnce = false;
  window.currentInvoiceFinalized = false;
  ['s-client-name', 's-client-addr', 's-client-phone', 's-client-gstin', 's-client-due', 's-due-date', 's-intro'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  
  // Reset state fields
  const clientStateEl = $('s-client-state');
  if (clientStateEl) clientStateEl.value = 'Gujarat';
  const clientStateCodeEl = $('s-client-state-code');
  if (clientStateCodeEl) clientStateCodeEl.value = '24';
  const placeSupplyEl = $('s-place-supply');
  if (placeSupplyEl) placeSupplyEl.value = 'Gujarat';

  const today = getTodayInIndiaISO();
  const dateEl = $('s-inv-date'); if (dateEl) dateEl.value = today;

  setBillingMode(mode);

  // Fetch new number for the new invoice session after resetting state
  await setAutoInvoiceNumber(true);
  renderRows();
  ensureOneBlankItem();
  renderMobItems();
  refreshPaper();
  recalcAll();
  toast('New ' + (mode === 'gst' ? 'GST' : 'Non-GST') + ' invoice started');
  
  // Focus client name input for convenience
  $('s-client-name')?.focus();
}`;

  if (content.includes(oldLegacyStart)) {
    content = content.replace(oldLegacyStart, '// Legacy startNewInvoice alias redirected to unified startNewInvoice\n// (Removed shadowed declaration)');
    console.log(`[${file}] Removed legacy duplicate startNewInvoice.`);
  } else {
    console.warn(`[${file}] Warning: oldLegacyStart exact match not found!`);
  }

  // Update clearAll
  const oldClearAll = `async function clearAll() {
  if (!confirm('Start a new invoice? Unsaved data will be lost.')) return;
  rows = []; rowCounter = 0;
  window.currentInvoiceId = null;
  window._invoiceSavedOnce = false;
  window.currentInvoiceFinalized = false;
  ['s-client-name', 's-client-addr', 's-client-phone', 's-client-gstin', 's-client-due', 's-due-date', 's-intro'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  const today = getTodayInIndiaISO();
  const dateEl = $('s-inv-date'); if (dateEl) dateEl.value = today;

  // Fetch new number for the new invoice session after resetting state
  await setAutoInvoiceNumber(true);
  renderRows();
  ensureOneBlankItem();
  renderMobItems();
  refreshPaper();
  recalcAll();
  toast('New invoice started');
}`;

  const newClearAll = `async function clearAll() {
  return await startNewInvoice(true);
}`;

  if (content.includes(oldClearAll)) {
    content = content.replace(oldClearAll, newClearAll);
    console.log(`[${file}] Updated clearAll to delegate to startNewInvoice.`);
  } else {
    console.warn(`[${file}] Warning: oldClearAll exact match not found!`);
  }

  fs.writeFileSync(file, content, 'utf8');
}
