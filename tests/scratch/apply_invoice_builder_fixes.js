const fs = require('fs');
const path = require('path');

console.log('Applying comprehensive Invoice Builder automatic state detection and button removal fixes...');

// ─── 1. UPDATE invoice-pdf.js ────────────────────────────────────────────────
function updateInvoicePdf(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');

  // A. Update INDIAN_STATES to include all 28 states + 8 UTs
  const oldIndianStates = /const INDIAN_STATES = \[\s*'Andhra Pradesh'[\s\S]*?'Chandigarh'\s*\];/;
  const newIndianStates = `const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
    'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
    'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
    'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];`;
  code = code.replace(oldIndianStates, newIndianStates);

  // B. In resolveClientAddressAndState: do not default to Gujarat, preserve rawState
  const oldResolveBlock = /let finalState = isStateName\(rawState\) \|\| gstState;[\s\S]*?if \(!finalState\) finalState = 'Gujarat';/;
  const newResolveBlock = `let finalState = isStateName(rawState) || (rawState ? rawState.trim() : '') || gstState;
    if (!finalState) {
      if (cityAsState) finalState = cityAsState;
      else if (addrAsState) finalState = addrAsState;
      else {
        const allText = rawAddr + ' ' + rawCity;
        for (let j = 0; j < INDIAN_STATES.length; j++) {
          const re = new RegExp('\\\\b' + INDIAN_STATES[j] + '\\\\b', 'i');
          if (re.test(allText)) {
            finalState = INDIAN_STATES[j];
            break;
          }
        }
      }
    }
    if (!finalState) finalState = '';`;
  code = code.replace(oldResolveBlock, newResolveBlock);

  // C. In drawA4InvoicePdf: remove || 'Gujarat' from clientState and clientPos
  code = code.replace(
    /const clientState = isGst \? \(payload\.customer\?\.state \|\| \$\('s-client-state'\)\?\.value \|\| 'Gujarat'\) : '';/,
    "const clientState = payload.customer?.state || $('s-client-state')?.value || '';"
  );
  code = code.replace(
    /const clientPos = isGst \? \(payload\.customer\?\.placeOfSupply \|\| \$\('s-place-supply'\)\?\.value \|\| 'Gujarat'\) : '';/,
    "const clientPos = payload.customer?.placeOfSupply || $('s-place-supply')?.value || clientState || '';"
  );

  // D. In drawA4InvoicePdf: fluid rendering for Bill To State, Pincode, Phone, GSTIN
  const oldFluidBlock = /\/\/ Right side \(Bill To\): State and Pincode[\s\S]*?if \(cGstin\) \{[\s\S]*?pdf\.text\(cGstin, rightColX \+ subColOffset \+ pdf\.getTextWidth\('GSTIN: '\), curKvY\);\s*\}/;
  const newFluidBlock = `// Right side (Bill To): Fluid State and Pincode
    if (cState && cPin) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('State: ', rightColX, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(cState, rightColX + pdf.getTextWidth('State: '), curKvY);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Pincode: ', rightColX + subColOffset, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(cPin, rightColX + subColOffset + pdf.getTextWidth('Pincode: '), curKvY);
    } else if (cState) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('State: ', rightColX, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(cState, rightColX + pdf.getTextWidth('State: '), curKvY);
    } else if (cPin) {
      // Reposition Pincode to column start when State is missing
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Pincode: ', rightColX, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(cPin, rightColX + pdf.getTextWidth('Pincode: '), curKvY);
    }

    // Key-Values Row 2: Phone & GSTIN
    curKvY += 3.8;

    // Left side (Bill From): Phone and GSTIN
    if (compPhone) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Phone: ', leftColX, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(compPhone, leftColX + pdf.getTextWidth('Phone: '), curKvY);
    }
    if (compGstin) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('GSTIN: ', leftColX + subColOffset, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(compGstin, leftColX + subColOffset + pdf.getTextWidth('GSTIN: '), curKvY);
    }

    // Right side (Bill To): Fluid Phone and GSTIN
    if (cPhone && cGstin) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Phone: ', rightColX, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(cPhone, rightColX + pdf.getTextWidth('Phone: '), curKvY);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('GSTIN: ', rightColX + subColOffset, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(cGstin, rightColX + subColOffset + pdf.getTextWidth('GSTIN: '), curKvY);
    } else if (cPhone) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Phone: ', rightColX, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(cPhone, rightColX + pdf.getTextWidth('Phone: '), curKvY);
    } else if (cGstin) {
      // Reposition GSTIN to column start when Phone is missing
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('GSTIN: ', rightColX, curKvY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(cGstin, rightColX + pdf.getTextWidth('GSTIN: '), curKvY);
    }`;
  code = code.replace(oldFluidBlock, newFluidBlock);

  // E. Helper function getStateCodeFromName & exports
  if (!code.includes('getStateCodeFromName')) {
    code = code.replace(
      'window.resolveClientAddressAndState = resolveClientAddressAndState;',
      `function getStateCodeFromName(stateName) {
    if (!stateName) return '';
    const clean = String(stateName).trim().toLowerCase();
    for (const [code, name] of Object.entries(GST_STATE_MAP)) {
      if (name.toLowerCase() === clean) return code;
    }
    return '';
  }

  window.getStateCodeFromName = getStateCodeFromName;
  window.INDIAN_STATES = INDIAN_STATES;
  window.GST_STATE_MAP = GST_STATE_MAP;
  window.resolveClientAddressAndState = resolveClientAddressAndState;`
    );
  }

  fs.writeFileSync(filePath, code, 'utf-8');
  console.log('✓ Updated invoice-pdf.js at:', filePath);
}

// ─── 2. UPDATE storage.js ────────────────────────────────────────────────────
function updateStorage(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');

  // In extractInvoiceJSON:
  code = code.replace(
    /ClientState: isGst \? \(document\.getElementById\('s-client-state'\)\?\.value \|\| 'Gujarat'\) : '',/,
    "ClientState: document.getElementById('s-client-state')?.value || '',"
  );
  code = code.replace(
    /ClientStateCode: isGst \? \(document\.getElementById\('s-client-state-code'\)\?\.value \|\| '24'\) : '',/,
    "ClientStateCode: isGst ? (document.getElementById('s-client-state-code')?.value || '') : '',"
  );
  code = code.replace(
    /PlaceOfSupply: isGst \? \(document\.getElementById\('s-place-supply'\)\?\.value \|\| 'Gujarat'\) : '',/,
    "PlaceOfSupply: isGst ? (document.getElementById('s-place-supply')?.value || '') : '',"
  );
  code = code.replace(
    /state: document\.getElementById\('s-client-state'\)\?\.value \|\| 'Gujarat',/,
    "state: document.getElementById('s-client-state')?.value || '',"
  );
  code = code.replace(
    /stateCode: isGst \? \(document\.getElementById\('s-client-state-code'\)\?\.value \|\| '24'\) : '',/,
    "stateCode: isGst ? (document.getElementById('s-client-state-code')?.value || '') : '',"
  );
  code = code.replace(
    /placeOfSupply: isGst \? \(document\.getElementById\('s-place-supply'\)\?\.value \|\| 'Gujarat'\) : ''/,
    "placeOfSupply: isGst ? (document.getElementById('s-place-supply')?.value || '') : ''"
  );

  // In restoreInvoiceUI:
  code = code.replace(
    /const cState = res \? res\.state : \(cust\.state \|\| data\.ClientState \|\| 'Gujarat'\);/,
    "const cState = res ? res.state : (cust.state || data.ClientState || '');"
  );
  code = code.replace(
    /setVal\('s-client-state-code', data\.ClientStateCode \|\| cust\.stateCode \|\| '24'\);/,
    "setVal('s-client-state-code', data.ClientStateCode || cust.stateCode || (typeof getStateCodeFromName === 'function' ? getStateCodeFromName(cState) : '') || '');"
  );
  code = code.replace(
    /setVal\('s-place-supply', data\.PlaceOfSupply \|\| cust\.placeOfSupply \|\| 'Gujarat'\);/,
    "setVal('s-place-supply', data.PlaceOfSupply || cust.placeOfSupply || cState || '');"
  );

  code = code.replace(
    /setVal\('s-client-state', data\.ClientState \|\| 'Gujarat'\);/,
    "setVal('s-client-state', data.ClientState || '');"
  );
  code = code.replace(
    /setVal\('s-client-state-code', data\.ClientStateCode \|\| '24'\);/,
    "setVal('s-client-state-code', data.ClientStateCode || (typeof getStateCodeFromName === 'function' ? getStateCodeFromName(data.ClientState) : '') || '');"
  );
  code = code.replace(
    /setVal\('s-place-supply', data\.PlaceOfSupply \|\| 'Gujarat'\);/,
    "setVal('s-place-supply', data.PlaceOfSupply || data.ClientState || '');"
  );

  fs.writeFileSync(filePath, code, 'utf-8');
  console.log('✓ Updated storage.js at:', filePath);
}

// ─── 3. UPDATE api.js ────────────────────────────────────────────────────────
function updateApi(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');

  // A. In getClients: include City, State, Pincode in mapped objects
  const oldGetClientsMap = /return rawData\.map\(c => \(\{[\s\S]*?ClientID: String\(c\.id \|\| ''\),[\s\S]*?DueAmount: parseFloat\(c\.balance\) \|\| 0,[\s\S]*?due: parseFloat\(c\.balance\) \|\| 0\s*\}\)\);/;
  const newGetClientsMap = `return rawData.map(c => ({
      ClientID: String(c.id || ''),
      id: c.id,
      ClientName: c.name || '',
      name: c.name || '',
      Address: c.address || '',
      address: c.address || '',
      City: c.city || '',
      city: c.city || '',
      State: c.state || '',
      state: c.state || '',
      Pincode: c.pincode || c.pin || '',
      pincode: c.pincode || c.pin || '',
      Phone: c.contact || c.phone || '',
      phone: c.contact || c.phone || '',
      GSTIN: (c.gst || c.gstin || '').toUpperCase(),
      gst: (c.gst || c.gstin || '').toUpperCase(),
      DueAmount: parseFloat(c.balance) || 0,
      due: parseFloat(c.balance) || 0
    }));`;
  code = code.replace(oldGetClientsMap, newGetClientsMap);

  // B. In generateInvoiceFromDispatch: remove || 'Gujarat'
  code = code.replace(
    /state: clientRow\?\.state \|\| 'Gujarat',/,
    "state: clientRow?.state || '',"
  );
  code = code.replace(
    /state: resolvedClient\.state \|\| 'Gujarat',/,
    "state: resolvedClient.state || '',"
  );
  code = code.replace(
    /placeOfSupply: resolvedClient\.state \|\| 'Gujarat',/,
    "placeOfSupply: resolvedClient.state || '',"
  );
  code = code.replace(
    /stateCode: '24',/,
    "stateCode: (typeof getStateCodeFromName === 'function' ? getStateCodeFromName(resolvedClient.state) : '') || '',"
  );

  // C. In _buildInvoiceDocFromRemote: remove || 'Gujarat'
  code = code.replace(
    /const clientState = clientRow\?\.state \|\| \(clientAddr\.match\(\/\(\?:Gujarat\|Maharashtra\|Rajasthan\|Madhya Pradesh\|Punjab\|Haryana\|Delhi\)\/i\)\?\.\[0\]\) \|\| 'Gujarat';/,
    "const clientState = clientRow?.state || (clientAddr.match(/(?:Gujarat|Maharashtra|Rajasthan|Madhya Pradesh|Punjab|Haryana|Delhi)/i)?.[0]) || '';"
  );
  code = code.replace(
    /stateCode: '24',\s*placeOfSupply: 'Gujarat',/,
    "stateCode: (typeof getStateCodeFromName === 'function' ? getStateCodeFromName(clientState) : '') || '',\n      placeOfSupply: clientState || '',"
  );

  fs.writeFileSync(filePath, code, 'utf-8');
  console.log('✓ Updated api.js at:', filePath);
}

// ─── 4. UPDATE main.js ───────────────────────────────────────────────────────
function updateMain(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');

  // A. In normalizeClientRow: include City, State, Pincode
  const oldNormalizeClient = /function normalizeClientRow\(item\) \{\s*return \{[\s\S]*?DueAmount: parseFloat[\s\S]*?\};\s*\}/;
  const newNormalizeClient = `function normalizeClientRow(item) {
  return {
    ClientID: String(item.ClientID || item.id || '').trim(),
    ClientName: String(item.ClientName || item['Client Name'] || item.client || item.name || '').trim(),
    Address: String(item.Address || item.address || '').trim(),
    City: String(item.City || item.city || '').trim(),
    State: String(item.State || item.state || item.shipping_state || item.billing_state || '').trim(),
    Pincode: String(item.Pincode || item.pincode || item.pin || item.Pin || '').trim(),
    Phone: String(item.Phone || item.phone || item.Mobile || item.mobile || '').trim(),
    GSTIN: String(item.GSTIN || item.gstin || item.gst || item.GST || '').trim(),
    DueAmount: parseFloat(item.DueAmount || item['Due Amount'] || item.dueAmount || item.due || 0) || 0,
  };
}`;
  code = code.replace(oldNormalizeClient, newNormalizeClient);

  // B. In fetchClients: remove state: 'Gujarat'
  code = code.replace(
    /cleanAddress: c\.city \|\| c\.address \|\| '',\s*state: 'Gujarat',/,
    "cleanAddress: c.city || c.address || '',\n        state: c.state || '',"
  );

  // C. In updateBillToPreview: fluid preview formatting and no default Gujarat
  const oldUpdateBillTo = /function updateBillToPreview\(\) \{[\s\S]*?pSub\.textContent = \[cleanAddr \|\| rawAddr[\s\S]*?\}\s*\}/;
  const newUpdateBillTo = `function updateBillToPreview() {
  const clientName = $('s-client-name')?.value || 'Client Name';
  let rawAddr = $('s-client-addr')?.value || '';
  let rawState = $('s-client-state')?.value || '';
  let rawPin = $('s-client-pincode')?.value || '';
  const phone = formatPhoneDisplay($('s-client-phone')?.value || '');
  const gstin = ($('s-client-gstin')?.value || '').toUpperCase();

  const resolveFn = (typeof window !== 'undefined' && window.resolveClientAddressAndState)
    ? window.resolveClientAddressAndState
    : (typeof resolveClientAddressAndState === 'function' ? resolveClientAddressAndState : null);

  const res = resolveFn ? resolveFn({
    address: rawAddr,
    state: rawState,
    pincode: rawPin,
    gstin: gstin
  }) : {
    cleanAddress: rawAddr,
    state: rawState,
    pincode: rawPin
  };

  const cleanAddr = res.cleanAddress;
  const state = res.state || '';
  const pin = res.pincode || '';

  const pClientName = $('p-client-name');
  if (pClientName) pClientName.textContent = clientName;

  const pClientAddr = $('p-client-addr-text');
  if (pClientAddr) {
    const dispAddr = cleanAddr || rawAddr;
    pClientAddr.textContent = dispAddr || '';
    pClientAddr.style.display = dispAddr ? 'block' : 'none';
  }

  const pStateText = $('p-client-state-text');
  const pStateRow = $('p-client-state-row');
  if (pStateText) pStateText.textContent = state;
  if (pStateRow) pStateRow.style.display = state ? 'block' : 'none';

  const pPinText = $('p-client-pin-text');
  const pPinRow = $('p-client-pin-row');
  if (pPinText) pPinText.textContent = pin;
  if (pPinRow) pPinRow.style.display = pin ? 'block' : 'none';

  const r1 = $('p-client-row-1');
  if (r1) r1.style.display = (state || pin) ? 'flex' : 'none';

  const pPhoneText = $('p-client-phone-text');
  const pPhoneRow = $('p-client-phone-row');
  if (pPhoneText) pPhoneText.textContent = phone;
  if (pPhoneRow) pPhoneRow.style.display = phone ? 'block' : 'none';

  const pGstinText = $('p-client-gstin-text');
  const pGstinRow = $('p-client-gstin-row');
  if (pGstinText) pGstinText.textContent = gstin;
  if (pGstinRow) pGstinRow.style.display = gstin ? 'block' : 'none';

  const r2 = $('p-client-row-2');
  if (r2) r2.style.display = (phone || gstin) ? 'flex' : 'none';

  const pSub = $('p-client-sub');
  if (pSub) {
    pSub.textContent = [cleanAddr || rawAddr, phone ? \`Phone: \${phone}\` : '', gstin ? \`GSTIN: \${gstin}\` : ''].filter(Boolean).join(' | ');
  }
}`;
  code = code.replace(oldUpdateBillTo, newUpdateBillTo);

  // D. In bindSidebarInputs: add state change listener and GSTIN state detection
  const oldBindInputs = /\['s-client-name', 's-client-addr', 's-client-state', 's-client-pincode', 's-client-phone', 's-client-gstin'\]\.forEach\(\(id\) => \{[\s\S]*?updateBillToPreview\(\);\s*autoSave\(\);\s*\}\);/;
  const newBindInputs = `['s-client-name', 's-client-addr', 's-client-state', 's-client-pincode', 's-client-phone', 's-client-gstin'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (id === 's-client-gstin') {
        const up = normalizeGSTIN(el.value);
        if (el.value !== up) el.value = up;
        const stateEl = $('s-client-state');
        if (stateEl && !stateEl.value && up.length >= 2) {
          const code = up.slice(0, 2);
          const gstMap = (typeof GST_STATE_MAP !== 'undefined') ? GST_STATE_MAP : (window.GST_STATE_MAP || {});
          if (gstMap[code]) {
            stateEl.value = gstMap[code];
            const posEl = $('s-place-supply');
            if (posEl) posEl.value = gstMap[code];
            const scEl = $('s-client-state-code');
            if (scEl) scEl.value = code;
          }
        }
      }
      if (id === 's-client-state') {
        const val = el.value.trim();
        const getCodeFn = (typeof getStateCodeFromName === 'function') ? getStateCodeFromName : (window.getStateCodeFromName || null);
        const code = getCodeFn ? getCodeFn(val) : '';
        const scEl = $('s-client-state-code');
        if (scEl) scEl.value = code;
        const posEl = $('s-place-supply');
        if (posEl) posEl.value = val;
      }
      if (id === 's-client-addr') {
        const pinInput = $('s-client-pincode');
        if (pinInput && !pinInput.value) {
          const pm = el.value.match(/\\b\\d{6}\\b/);
          if (pm) pinInput.value = pm[0];
        }
      }
      updateBillToPreview();
      autoSave();
    });
  });`;
  code = code.replace(oldBindInputs, newBindInputs);

  // E. In applyClientSelection: correctly set state & state code
  const oldApplyClient = /function applyClientSelection\(client\) \{[\s\S]*?setClientDue\(due\);/;
  const newApplyClient = `function applyClientSelection(client) {
  if (!client) return;
  const name = client.ClientName || client.name || '';
  const resolveFn = (typeof window !== 'undefined' && window.resolveClientAddressAndState)
    ? window.resolveClientAddressAndState
    : (typeof resolveClientAddressAndState === 'function' ? resolveClientAddressAndState : null);

  const res = resolveFn ? resolveFn({
    address: client.Address || client.address || '',
    city: client.City || client.city || '',
    state: client.State || client.state || '',
    pincode: client.Pincode || client.pincode || client.pin || '',
    gstin: client.GSTIN || client.gstin || client.gst || ''
  }) : {
    cleanAddress: client.Address || client.address || '',
    state: client.State || client.state || '',
    pincode: client.Pincode || client.pincode || ''
  };

  const addr = res.cleanAddress;
  const state = res.state || '';
  const pin = res.pincode || '';
  const phone = client.Phone || client.phone || '';
  const gstin = client.GSTIN || client.gstin || '';
  const due = client.DueAmount != null ? client.DueAmount : (client.dueAmount != null ? client.dueAmount : 0);

  const nameEl = $('s-client-name');
  const addrEl = $('s-client-addr');
  const stateEl = $('s-client-state');
  const pinEl = $('s-client-pincode');
  const phoneEl = $('s-client-phone');
  const gstinEl = $('s-client-gstin');
  const stateCodeEl = $('s-client-state-code');
  const posEl = $('s-place-supply');

  if (nameEl) nameEl.value = name;
  if (addrEl) addrEl.value = addr;
  if (stateEl) stateEl.value = state;
  if (pinEl) pinEl.value = pin;
  if (phoneEl) phoneEl.value = phone;
  if (gstinEl) gstinEl.value = gstin;
  if (posEl) posEl.value = state;
  if (stateCodeEl) {
    const getCodeFn = (typeof getStateCodeFromName === 'function') ? getStateCodeFromName : (window.getStateCodeFromName || null);
    stateCodeEl.value = getCodeFn ? getCodeFn(state) : '';
  }
  setClientDue(due);`;
  code = code.replace(oldApplyClient, newApplyClient);

  // F. In prepareNextInvoiceDraft: do NOT default to Gujarat
  code = code.replace(
    /if \(clientStateEl\) clientStateEl\.value = 'Gujarat';\s*const clientStateCodeEl = \$\('s-client-state-code'\);\s*if \(clientStateCodeEl\) clientStateCodeEl\.value = '24';\s*const placeSupplyEl = \$\('s-place-supply'\);\s*if \(placeSupplyEl\) placeSupplyEl\.value = 'Gujarat';/,
    "if (clientStateEl) clientStateEl.value = '';\n  const clientStateCodeEl = $('s-client-state-code');\n  if (clientStateCodeEl) clientStateCodeEl.value = '';\n  const placeSupplyEl = $('s-place-supply');\n  if (placeSupplyEl) placeSupplyEl.value = '';"
  );

  // G. In updateEditModeBanner: remove references to actionBtn
  const oldBannerFn = /function updateEditModeBanner\(\) \{[\s\S]*?window\.updateEditModeBanner = updateEditModeBanner;/;
  const newBannerFn = `function updateEditModeBanner() {
  const banner = $('builder-mode-banner');
  const text = $('builder-mode-text');
  if (!banner || !text) return;

  if (window.currentInvoiceId) {
    banner.className = 'mode-edit';
    banner.style.background = '#eff6ff';
    banner.style.borderColor = '#bfdbfe';
    banner.style.color = '#1e40af';
    const dispLabel = window.currentDispatchNo ? ' (' + window.currentDispatchNo + ')' : '';
    text.innerHTML = '<span><strong>Editing Invoice:</strong> ' + window.currentInvoiceId + dispLabel + '</span>';
  } else {
    banner.className = 'mode-new';
    banner.style.background = '#f0fdf4';
    banner.style.borderColor = '#bbf7d0';
    banner.style.color = '#166534';
    const num = ($('s-inv-num')?.value || '').trim();
    text.innerHTML = '<span><strong>New Invoice</strong>' + (num && num !== '—' ? ' (#' + num + ')' : '') + '</span>';
  }
}
window.updateEditModeBanner = updateEditModeBanner;`;
  code = code.replace(oldBannerFn, newBannerFn);

  // H. In bootApp & clean invoice fallbacks:
  code = code.replace(
    /if \(clientStateEl\) clientStateEl\.value = 'Gujarat';\s*const clientStateCodeEl = \$\('s-client-state-code'\);\s*if \(clientStateCodeEl\) clientStateCodeEl\.value = '24';\s*const placeSupplyEl = \$\('s-place-supply'\);\s*if \(placeSupplyEl\) placeSupplyEl\.value = 'Gujarat';/g,
    "if (clientStateEl) clientStateEl.value = '';\n    const clientStateCodeEl = $('s-client-state-code');\n    if (clientStateCodeEl) clientStateCodeEl.value = '';\n    const placeSupplyEl = $('s-place-supply');\n    if (placeSupplyEl) placeSupplyEl.value = '';"
  );
  code = code.replace(
    /const clientStateEl = \$\('s-client-state'\);\s*if \(clientStateEl\) clientStateEl\.value = 'Gujarat';\s*const clientStateCodeEl = \$\('s-client-state-code'\);\s*if \(clientStateCodeEl\) clientStateCodeEl\.value = '24';\s*const placeSupplyEl = \$\('s-place-supply'\);\s*if \(placeSupplyEl\) placeSupplyEl\.value = 'Gujarat';/,
    "const clientStateEl = $('s-client-state');\n    if (clientStateEl) clientStateEl.value = '';\n    const clientStateCodeEl = $('s-client-state-code');\n    if (clientStateCodeEl) clientStateCodeEl.value = '';\n    const placeSupplyEl = $('s-place-supply');\n    if (placeSupplyEl) placeSupplyEl.value = '';"
  );

  // I. In onClientStateChange & onStateCodeInput:
  code = code.replace(
    /const pps = \$\('p-place-supply'\); if \(pps\) pps\.textContent = \(placeSelect \? placeSelect\.value : select\.value\) \|\| 'Gujarat';/g,
    "const pps = $('p-place-supply'); if (pps) pps.textContent = (placeSelect ? placeSelect.value : select.value) || '';"
  );

  fs.writeFileSync(filePath, code, 'utf-8');
  console.log('✓ Updated main.js at:', filePath);
}

// ─── 5. UPDATE dispatch-ui.js ────────────────────────────────────────────────
function updateDispatchUi(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  code = code.replace(
    /state: clientData\?\.state \|\| 'Gujarat',/,
    "state: clientData?.state || '',"
  );
  fs.writeFileSync(filePath, code, 'utf-8');
  console.log('✓ Updated dispatch-ui.js at:', filePath);
}

// Apply to Invoice Builder
updateInvoicePdf(path.join(__dirname, '..', '..', 'Invoice Builder', 'js', 'invoice-pdf.js'));
updateStorage(path.join(__dirname, '..', '..', 'Invoice Builder', 'js', 'storage.js'));
updateApi(path.join(__dirname, '..', '..', 'Invoice Builder', 'js', 'api.js'));
updateMain(path.join(__dirname, '..', '..', 'Invoice Builder', 'js', 'main.js'));

// Apply to apps/Invoice Builder
updateInvoicePdf(path.join(__dirname, '..', '..', 'apps', 'Invoice Builder', 'js', 'invoice-pdf.js'));
updateStorage(path.join(__dirname, '..', '..', 'apps', 'Invoice Builder', 'js', 'storage.js'));
updateApi(path.join(__dirname, '..', '..', 'apps', 'Invoice Builder', 'js', 'api.js'));
updateMain(path.join(__dirname, '..', '..', 'apps', 'Invoice Builder', 'js', 'main.js'));

// Apply to dispatch-ui.js
updateDispatchUi(path.join(__dirname, '..', '..', 'assets', 'js', 'dispatch-ui.js'));

console.log('All file updates applied successfully!');
