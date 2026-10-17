/* purchases.js */
let allPurchases = [], purchaseItems = [], editingPurchaseId = null;
let purchasableItems = [];

function updatePageDebug(text, color) {
  const el = document.getElementById('debug-page-status');
  if (el) {
    el.textContent = 'Page: ' + text;
    if (color) el.style.color = color;
  }
}

async function loadPurchases() {
  console.log('Loading purchases...');
  updatePageDebug('Loading Purchases...', '#0C3925');
  
  try {
    UTILS.renderTableSkeleton('purchases-table');
    await DB.initDB();
    
    // Load purchasable items, purchases, suppliers, and purchase_items in parallel
    const pQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('purchases').select('*').order('id', { ascending: false })) : window.dbClient.from('purchases').select('*').order('id', { ascending: false });
    const supQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('suppliers').select('*')) : window.dbClient.from('suppliers').select('*');
    const piQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('purchase_items').select('*')) : window.dbClient.from('purchase_items').select('*');

    const [, pRes, supRes, piRes] = await Promise.all([
      refreshPurchasableItems(),
      pQuery,
      supQuery,
      piQuery
    ]);

    if (pRes.error) throw pRes.error;
    allPurchases = pRes.data || [];
    const suppliersList = supRes.data || [];
    const allItems = piRes.data || [];
    
    allPurchases.forEach(p => {
      const match = suppliersList.find(s => s.id === p.supplier_id);
      p.supplier_display = match ? match.name : (p.supplier_name || '—');
      p.items = allItems.filter(it => it.purchase_id === p.id);
    });

    allPurchases = UTILS.sortLatestFirst(allPurchases, p => p.purchase_no || p.id);
    renderTable(allPurchases);
    await populateSupplierSelect();
    
    updatePageDebug('Ready (' + allPurchases.length + ')', '#0C3925');
    setTimeout(() => UTILS.initAllAutocompleteSelects(), 50);
    
    console.log('Purchases: All data loaded successfully');

  // Attach debounced search listener
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (typeof UTILS !== 'undefined' && UTILS.debounce) ? UTILS.debounce(filterAndRender, 250) : filterAndRender);
  }

  } catch (err) {
    console.error('Purchases loadPurchases failed:', err);
    updatePageDebug('FAILED', '#EF4444');
    APP.showToast('Failed to load purchases: ' + err.message, 'error');
  }
}

async function refreshPurchasableItems() {
  try {
    const prodQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('products').select('id, name, unit, item_size, packaging')) : window.dbClient.from('products').select('id, name, unit, item_size, packaging');
    const invQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('inventory_items').select('id, name, unit, item_size')) : window.dbClient.from('inventory_items').select('id, name, unit, item_size');

    const [pRes, iRes] = await Promise.all([
      prodQuery,
      invQuery
    ]);
    const p = pRes.data || [];
    const i = iRes.data || [];
    
    const combined = [
      ...i.map(x => ({ id: x.id, name: x.name, unit: x.unit || 'Nos', type: 'Inventory', item_size: x.item_size })),
      ...p.map(x => ({ id: x.id, name: x.name, unit: x.unit || 'Nos', type: 'Catalog', item_size: x.item_size || x.packaging }))
    ];
    
    const map = new Map();
    combined.forEach(x => {
      if (!x.name) return;
      const key = x.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { id: x.id, name: x.name.trim(), unit: x.unit || 'Nos', type: x.type, item_size: x.item_size });
      }
    });

    purchasableItems = Array.from(map.values());
  } catch (err) {
    console.error('refreshPurchasableItems failed:', err);
  }
}

let purchasesTableEnhancer = null;

function renderPurchasesSlice(data) {
  const tbody = document.querySelector('#purchases-table tbody');
  if (!tbody) return;
  tbody.innerHTML = data.map(p => {
    let itemsHtml = '—';
    if (p.items && p.items.length > 0) {
      itemsHtml = p.items.map(it => {
        const u = it.unit ? ` ${it.unit.trim()}` : '';
        const qtyText = it.quantity !== undefined && it.quantity !== null ? `${it.quantity}${u}` : '';
        const qtyBadge = qtyText ? `<span class="purchase-item-qty">(${qtyText})</span>` : '';
        return `<span class="purchase-item-tag"><span class="purchase-item-name">${it.item_name || 'Item'}</span>${qtyBadge}</span>`;
      }).join(', ');
    }

    return `<tr>
      <td class="cell-bold">${p.purchase_no}</td>
      <td class="cell-mono">${p.invoice_no || '—'}</td>
      <td>${p.supplier_display || '—'}</td>
      <td class="cell-items-summary">${itemsHtml}</td>
      <td>${UTILS.fmtDate(p.date)}</td>
      <td class="cell-amount">${UTILS.fmtCurrency(p.total_amount)}</td>
      <td class="cell-amount text-success">${UTILS.fmtCurrency(p.paid_amount || 0)}</td>
      <td class="cell-amount text-danger">${UTILS.fmtCurrency((parseFloat(p.total_amount) || 0) - (parseFloat(p.paid_amount) || 0))}</td>
      <td><div class="row-actions">
        <button class="action-btn edit" onclick="openEdit(${p.id})" title="Edit Purchase"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-btn delete" onclick="deletePurchase(${p.id})" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
  UTILS.applyMobileTableLabels('purchases-table');
}

function renderTable(data) {
  const tbody = document.querySelector('#purchases-table tbody');
  if (!tbody) return;
  const countEl = document.getElementById('total-info');
  if (countEl) countEl.textContent = `${data.length} purchase${data.length !== 1 ? 's' : ''}`;
  if (!data.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10"><div class="empty-state"><h3>No purchases found</h3></div></td></tr>`;
    const pag = document.querySelector('#purchases-table-wrap .pagination');
    if (pag) pag.style.display = 'none';
    return;
  }

  if (window.TableEnhancer) {
    if (!purchasesTableEnhancer) {
      purchasesTableEnhancer = new window.TableEnhancer({
        tableId: 'purchases-table',
        pageSize: 25,
        defaultSortKey: 'id',
        defaultSortOrder: 'desc',
        onRender: (pageSlice) => renderPurchasesSlice(pageSlice)
      });
    }
    purchasesTableEnhancer.setData(data);
    return;
  }

  renderPurchasesSlice(data.slice(0, 50));
}

function filterAndRender() {
  const q = document.getElementById('search-input')?.value.toLowerCase() || '';
  let filtered = allPurchases;
  if (q) {
    filtered = filtered.filter(p => {
      const itemsText = (p.items || []).map(it => it.item_name || '').join(' ').toLowerCase();
      return (p.purchase_no || '').toLowerCase().includes(q) || 
        (p.supplier_display || '').toLowerCase().includes(q) || 
        (p.invoice_no || '').toLowerCase().includes(q) ||
        (p.date || '').toLowerCase().includes(q) ||
        itemsText.includes(q);
    });
  }
  filtered = UTILS.sortLatestFirst(filtered, p => p.purchase_no || p.id);
  renderTable(filtered);
}

async function populateSupplierSelect() {
  const sel = document.getElementById('supplier-select');
  if (!sel) return;
  try {
    const { data: supData, error } = await window.dbClient.from('suppliers').select('*');
    const suppliers = error ? [] : supData || [];
    sel.innerHTML = '<option value="">Select Supplier</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (sel._ussInstance) {
      sel._ussInstance.updateOptions();
    } else if (window.UniversalSearchSelect) {
      new UniversalSearchSelect(sel);
      sel.dataset.ussInitialized = 'true';
    }
  } catch (err) {
    console.error('populateSupplierSelect failed:', err);
  }
}

async function openAdd() {
  editingPurchaseId = null;
  document.getElementById('modal-title').textContent = 'New Purchase Entry';
  const purchaseForm = document.getElementById('purchase-form');
  purchaseForm.reset();
  await refreshPurchasableItems();
  purchaseItems = [];
  await addPurchaseItem();
  UTILS.applyDefaultDateInputs(purchaseForm, { skipFieldNames: ['due_date'] });
  const sup = document.getElementById('supplier-select');
  if (sup) {
    sup.value = '';
    if (sup._ussInstance) {
      sup._ussInstance.updateOptions();
    } else if (window.UniversalSearchSelect) {
      new UniversalSearchSelect(sup);
      sup.dataset.ussInitialized = 'true';
    }
  }
  APP.openModal('purchase-modal');
}

async function openEdit(id) {
  editingPurchaseId = id;
  try {
    await refreshPurchasableItems();
    const { data: p, error } = await window.dbClient.from('purchases').select('*').eq('id', id).single();
    if (error) throw error;
    
    // Fetch line items for this purchase
    const { data: piData, error: piError } = await window.dbClient.from('purchase_items').select('*').eq('purchase_id', id);
    if (!piError && piData) {
      p.items = piData;
    }
    
    document.getElementById('modal-title').textContent = 'Edit Purchase';
    UTILS.populateForm('purchase-form', p);
    UTILS.applyDefaultDateInputs(document.getElementById('purchase-form'), { skipFieldNames: ['due_date'] });

    const sup = document.getElementById('supplier-select');
    if (sup) {
      sup.value = p.supplier_id || '';
      if (sup._ussInstance) {
        sup._ussInstance.updateOptions();
      } else if (window.UniversalSearchSelect) {
        new UniversalSearchSelect(sup);
        sup.dataset.ussInitialized = 'true';
      }
    }

    purchaseItems = p.items || [];
    
    // Map items list correctly
    purchaseItems.forEach(it => {
      it.total = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
    });

    renderPurchaseItems();
    APP.openModal('purchase-modal');
  } catch (err) {
    console.error(err);
    APP.showToast('Failed to load purchase details: ' + err.message, 'error');
  }
}

async function getNextPurchaseBatchNo(offset = 0) {
  try {
    const [{ data: batches }, { data: purItems }] = await Promise.all([
      window.dbClient.from('stock_batches').select('batch_no'),
      window.dbClient.from('purchase_items').select('batch_no')
    ]);
      
    let maxNum = 0;
    const all = [...(batches || []), ...(purItems || [])];
    for (const b of all) {
      if (b.batch_no && typeof b.batch_no === 'string') {
        const match = b.batch_no.match(/^(?:PUR|P)-(d+)$/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum && n < 100000) {
            maxNum = n;
          }
        }
      }
    }
    // Also consider any batch numbers already assigned in the current purchaseItems table
    for (const it of purchaseItems) {
      if (it.batch_no && typeof it.batch_no === 'string') {
        const match = it.batch_no.match(/^(?:PUR|P)-(d+)$/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum && n < 100000) {
            maxNum = n;
          }
        }
      }
    }
    const nextNum = maxNum + 1 + offset;
    return `P-${String(nextNum).padStart(2, '0')}`;
  } catch (err) {
    console.error('Error getting next purchase batch no:', err);
    return `P-${String(1 + offset).padStart(2, '0')}`;
  }
}

async function addPurchaseItem() {
  const nextBatch = await getNextPurchaseBatchNo(0);
  purchaseItems.push({ id: Date.now(), item_id: '', item_name: '', item_type: 'Catalog', quantity: 1, unit_price: 0, batch_no: nextBatch, expiry_date: '', total: 0 });
  renderPurchaseItems();
}

function renderPurchaseItems() {
  const tbody = document.getElementById('purchase-items-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = purchaseItems.map((it, idx) => `
    <tr>
      <td style="min-width:220px;">
        <span class="mobile-label">Item Name</span>
        <input type="text" 
               class="form-input item-search-input" 
               value="${it.item_name || ''}" 
               placeholder="Search catalog/inventory or type name..." 
               autocomplete="off" 
               onfocus="showItemSuggestions(${idx}, this)" 
               oninput="onItemSearchInput(${idx}, this)" 
               onblur="hideItemSuggestionsLater(${idx})">
      </td>
      <td>
        <span class="mobile-label">Batch #</span>
        <input type="text" class="form-input" value="${it.batch_no || ''}" placeholder="Batch #" onchange="updateItem(${idx}, 'batch_no', this.value)">
      </td>
      <td>
        <span class="mobile-label">Expiry Date</span>
        <input type="date" class="form-input" value="${it.expiry_date ? it.expiry_date.split('T')[0] : ''}" onchange="updateItem(${idx}, 'expiry_date', this.value)">
      </td>
      <td>
        <span class="mobile-label">Quantity</span>
        <input type="number" class="form-input" value="${it.quantity}" onchange="updateItem(${idx}, 'quantity', this.value)">
      </td>
      <td>
        <span class="mobile-label">Unit Price (₹)</span>
        <input type="number" class="form-input" value="${it.unit_price}" onchange="updateItem(${idx}, 'unit_price', this.value)">
      </td>
      <td class="cell-amount" id="item-total-${idx}">
        <span class="mobile-label">Total</span>
        ${UTILS.fmtCurrency(it.total)}
      </td>
      <td>
        <span class="mobile-label">Remove</span>
        <button class="action-btn delete" onclick="removePurchaseItem(${idx})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
      </td>
    </tr>
  `).join('');
  
  calculateTotal();
}

let activeSearchInput = null;

function getSuggestionsPortal() {
  let portal = document.getElementById('item-suggestions-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'item-suggestions-portal';
    portal.className = 'uss-portal-custom';
    portal.style.position = 'absolute';
    portal.style.zIndex = '999999';
    portal.style.background = 'var(--surface, #121e18)';
    portal.style.border = '1px solid var(--border, rgba(12, 57, 37, 0.25))';
    portal.style.borderRadius = 'var(--radius-sm, 8px)';
    portal.style.maxHeight = '240px';
    portal.style.overflowY = 'auto';
    portal.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(12, 57, 37, 0.15)';
    portal.style.backdropFilter = 'blur(12px)';
    portal.style.display = 'none';
    document.body.appendChild(portal);
  }
  return portal;
}

function showItemSuggestions(idx, inputEl) {
  renderSuggestionsList(idx, inputEl);
}

function onItemSearchInput(idx, inputEl) {
  const val = inputEl.value;
  updateItem(idx, 'item_name', val);
  renderSuggestionsList(idx, inputEl);
}

function renderSuggestionsList(idx, inputEl) {
  activeSearchInput = { idx, el: inputEl };
  const portal = getSuggestionsPortal();
  const query = inputEl.value || '';
  const q = query.trim().toLowerCase();
  
  // Filter matches
  const matches = purchasableItems.filter(m => m.name && m.name.toLowerCase().includes(q));

  // Hide portal if no relevant matching item exists
  if (matches.length === 0) {
    portal.style.display = 'none';
    portal.innerHTML = '';
    return;
  }

  // Position portal relative to inputEl in viewport
  const rect = inputEl.getBoundingClientRect();
  portal.style.top = `${rect.bottom + window.scrollY + 4}px`;
  portal.style.left = `${rect.left + window.scrollX}px`;
  portal.style.width = `${Math.max(rect.width, 240)}px`;

  portal.innerHTML = matches.map(m => {
    const safeName = m.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const typeBadge = m.type ? `<span style="font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 999px; background: rgba(12, 57, 37, 0.12); color: var(--accent, #0C3925); border: 1px solid rgba(12, 57, 37, 0.2);">${m.type}</span>` : '';
    return `<div class="suggestion-item" 
         style="padding: 10px 14px; cursor: pointer; color: var(--text-primary, #f8fafc); font-size: 13px; font-family: inherit; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease, color 0.15s ease;"
         onmouseenter="this.style.background='rgba(12, 57, 37, 0.12)'; this.style.color='var(--accent, #0C3925)';"
         onmouseleave="this.style.background='transparent'; this.style.color='var(--text-primary, #f8fafc)';"
         onmousedown="selectItemSuggestion(${idx}, '${safeName}')">
      <span style="font-weight: 500;">${m.name}</span>
      ${typeBadge}
    </div>`;
  }).join('');
  portal.style.display = 'block';
}

function selectItemSuggestion(idx, name) {
  if (activeSearchInput && activeSearchInput.el) {
    activeSearchInput.el.value = name;
  }
  updateItem(idx, 'item_name', name);
  const portal = getSuggestionsPortal();
  portal.style.display = 'none';
}

function hideItemSuggestionsLater() {
  setTimeout(() => {
    const portal = getSuggestionsPortal();
    portal.style.display = 'none';
  }, 200);
}

function updateItem(idx, key, val) {
  const it = purchaseItems[idx];
  if (!it) return;

  if (key === 'item_name' || key === 'item_key') {
    const nameTrimmed = (val || '').trim();
    it.item_name = nameTrimmed;
    const match = purchasableItems.find(m => m.name.toLowerCase() === nameTrimmed.toLowerCase());
    if (match) {
      it.item_id = match.id;
      it.item_type = match.type;
      it.unit = match.unit || 'Nos';
    } else {
      it.item_id = '';
      it.item_type = 'Catalog';
      it.unit = 'Nos';
    }
  } else {
    it[key] = val;
  }
  
  it.total = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
  const totalCell = document.getElementById(`item-total-${idx}`);
  if (totalCell) {
    totalCell.textContent = UTILS.fmtCurrency(it.total);
  }
  calculateTotal();
}

function removePurchaseItem(idx) {
  purchaseItems.splice(idx, 1);
  renderPurchaseItems();
}

function calculateTotal() {
  const total = purchaseItems.reduce((s, it) => s + it.total, 0);
  document.getElementById('purchase-total-display').textContent = UTILS.fmtCurrency(total);
}

async function savePurchaseDirect(payload, items) {
  const isEdit = !!editingPurchaseId;
  let purchaseId = editingPurchaseId;
  let purchaseNo = '';
  const affectedItemIds = new Set();

  if (isEdit) {
    const updateData = {
      invoice_no: payload.p_invoice_no || '',
      supplier_id: payload.p_supplier_id ? parseInt(payload.p_supplier_id, 10) : null,
      supplier_name: payload.p_supplier_name || '',
      date: payload.p_date,
      due_date: payload.p_due_date || null,
      status: payload.p_status || 'Pending',
      total_amount: payload.p_total_amount || 0,
      paid_amount: payload.p_paid_amount || 0,
      notes: payload.p_notes || ''
    };
    const { error: updErr } = await window.dbClient.from('purchases').update(updateData).eq('id', purchaseId);
    if (updErr) throw updErr;

    // Fetch old batch item_ids to sync them later
    const { data: oldBatches } = await window.dbClient.from('stock_batches').select('item_id').eq('purchase_id', purchaseId);
    if (oldBatches) {
      oldBatches.forEach(b => { if (b.item_id) affectedItemIds.add(b.item_id); });
    }

    // Remove old items and old batches to re-sync
    await window.dbClient.from('purchase_items').delete().eq('purchase_id', purchaseId);
    await window.dbClient.from('stock_batches').delete().eq('purchase_id', purchaseId);
  } else {
    // Generate next sequential purchase number P-01, P-02...
    const { data: existingPurchases } = await window.dbClient.from('purchases').select('purchase_no');
    let maxNum = 0;
    (existingPurchases || []).forEach(p => {
      const match = String(p.purchase_no || '').match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    purchaseNo = `P-${String(maxNum + 1).padStart(2, '0')}`;

    const insertData = {
      purchase_no: purchaseNo,
      invoice_no: payload.p_invoice_no || '',
      supplier_id: payload.p_supplier_id ? parseInt(payload.p_supplier_id, 10) : null,
      supplier_name: payload.p_supplier_name || '',
      date: payload.p_date,
      due_date: payload.p_due_date || null,
      status: payload.p_status || 'Pending',
      total_amount: payload.p_total_amount || 0,
      paid_amount: payload.p_paid_amount || 0,
      notes: payload.p_notes || ''
    };
    const stampedInsert = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.stamp(insertData) : insertData;
    const { data: insData, error: insErr } = await window.dbClient.from('purchases').insert([stampedInsert]).select();
    if (insErr) throw insErr;
    purchaseId = insData[0].id;
  }

  // Insert purchase line items
  if (items && items.length > 0) {
    const needsBatch = items.some(it => !it.batch_no || !it.batch_no.trim());
    let initialBatchNo = '';
    let startBatchNum = 1;
    if (needsBatch) {
      initialBatchNo = await getNextPurchaseBatchNo(0);
      const m = initialBatchNo.match(/^(?:PUR|P)-(\d+)$/i);
      if (m) startBatchNum = parseInt(m[1], 10);
    }

    let unassignedBatchOffset = 0;
    const resolvedItems = [];
    for (const it of items) {
      let bNo = it.batch_no ? it.batch_no.trim() : '';
      if (!bNo) {
        bNo = `P-${String(startBatchNum + unassignedBatchOffset).padStart(2, '0')}`;
        unassignedBatchOffset++;
      }
      resolvedItems.push({
        ...it,
        batch_no: bNo
      });
    }

    const pItems = resolvedItems.map(it => ({
      purchase_id: purchaseId,
      item_id: it.item_id ? parseInt(it.item_id, 10) : null,
      item_name: it.item_name || '',
      item_type: it.item_type || 'Inventory',
      quantity: parseFloat(it.quantity) || 0,
      unit_price: parseFloat(it.unit_price) || 0,
      batch_no: it.batch_no,
      expiry_date: it.expiry_date || null,
      total: parseFloat(it.total) || 0
    }));
    const stampedPItems = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.stamp(pItems) : pItems;
    const { error: itemsErr } = await window.dbClient.from('purchase_items').insert(stampedPItems);
    if (itemsErr) throw itemsErr;

    // If Delivered, create stock batches and log inward movements for inventory tracking
    if (payload.p_status === 'Delivered') {
      const itemsForReceipt = resolvedItems.filter(it => it.item_id).map(it => ({
        itemId: parseInt(it.item_id, 10),
        itemName: it.item_name || '',
        quantity: parseFloat(it.base_quantity || it.quantity) || 0,
        unitPrice: parseFloat(it.unit_price) || 0,
        unit: it.unit || 'Nos',
        batchNo: it.batch_no,
        expiryDate: it.expiry_date || null
      }));

      if (window.INVENTORY_SERVICE && window.INVENTORY_SERVICE.receivePurchaseReceipt) {
        await window.INVENTORY_SERVICE.receivePurchaseReceipt({
          purchaseId: purchaseId,
          purchaseNo: purchaseNo,
          supplierId: payload.p_supplier_id ? parseInt(payload.p_supplier_id, 10) : null,
          purchaseDate: payload.p_date,
          items: itemsForReceipt
        });
      } else {
        const stockBatches = resolvedItems.filter(it => it.item_id).map(it => ({
          item_id: parseInt(it.item_id, 10),
          item_name: it.item_name || '',
          item_type: 'Inventory',
          batch_no: it.batch_no,
          purchase_id: purchaseId,
          supplier_id: payload.p_supplier_id ? parseInt(payload.p_supplier_id, 10) : null,
          purchase_date: payload.p_date,
          purchase_price: parseFloat(it.unit_price) || 0,
          initial_qty: parseFloat(it.base_quantity || it.quantity) || 0,
          current_qty: parseFloat(it.base_quantity || it.quantity) || 0,
          unit: it.unit || 'Nos',
          expiry_date: it.expiry_date || null
        }));

        if (stockBatches.length > 0) {
          const stampedBatches = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.stamp(stockBatches) : stockBatches;
          await window.dbClient.from('stock_batches').insert(stampedBatches);
        }
      }
    }

    // Synchronize all affected inventory items
    resolvedItems.forEach(it => {
      if (it.item_id) affectedItemIds.add(parseInt(it.item_id, 10));
    });
    for (const itemId of affectedItemIds) {
      await window.INVENTORY_SERVICE.syncItemStock(itemId);
    }
  }

  return { success: true, purchase_id: purchaseId, purchase_no: purchaseNo };
}

async function deletePurchaseDirect(id) {
  const { data: oldBatches } = await window.dbClient.from('stock_batches').select('item_id').eq('purchase_id', id);
  const affectedItemIds = new Set((oldBatches || []).map(b => b.item_id));

  await window.dbClient.from('stock_batches').delete().eq('purchase_id', id);
  await window.dbClient.from('purchase_items').delete().eq('purchase_id', id);
  try {
    await window.dbClient.from('stock_movements').delete().eq('txn_id', id);
  } catch (_) {}
  const { error } = await window.dbClient.from('purchases').delete().eq('id', id);
  if (error) throw error;

  for (const itemId of affectedItemIds) {
    await window.INVENTORY_SERVICE.syncItemStock(itemId);
  }
  return { success: true };
}

async function savePurchase() {
  const d = UTILS.getFormData('purchase-form');
  if (!d.supplier_id) { APP.showToast('Please select a supplier', 'error'); return; }
  if (purchaseItems.length === 0) { APP.showToast('Please add at least one item', 'error'); return; }
  
  const supplierSelect = document.getElementById('supplier-select');
  const supplierName = supplierSelect ? supplierSelect.options[supplierSelect.selectedIndex].text : '';
  const total = purchaseItems.reduce((s, it) => s + it.total, 0);
  
  const saveBtn = document.querySelector('#purchase-modal .btn-primary');
  if (saveBtn) APP.setButtonLoading(saveBtn, true, editingPurchaseId ? 'Updating...' : 'Saving...');

  try {
    const rpcPayload = {
      p_invoice_no: d.invoice_no || '',
      p_supplier_id: d.supplier_id,
      p_supplier_name: supplierName,
      p_date: d.date || UTILS.todayStr(),
      p_due_date: d.due_date || null,
      p_status: d.status || 'Pending',
      p_total_amount: total,
      p_paid_amount: parseFloat(d.paid_amount) || 0.00,
      p_notes: d.notes || ''
    };

    // Prepare line items with base quantity conversion
    const itemsPayload = purchaseItems.map(it => {
      let baseQty = parseFloat(it.quantity) || 0;
      let unit = 'Nos';
      
      const match = purchasableItems.find(m => m.id === it.item_id && m.type === it.item_type);
      if (match) {
        unit = match.unit;
        if (match.item_size) {
          const packSizeMl = UTILS.parsePackSizeInMl(match.item_size);
          if (packSizeMl > 0) {
            const baseUnit = UTILS.normalizeUnit(unit);
            if (baseUnit === 'Litre' || baseUnit === 'Kg') {
              baseQty = (packSizeMl / 1000) * baseQty;
            } else if (baseUnit === 'Ml' || baseUnit === 'Gram') {
              baseQty = packSizeMl * baseQty;
            }
          }
        }
      }

      return {
        item_id: it.item_id || null,
        item_name: it.item_name,
        item_type: it.item_type || 'Inventory',
        quantity: parseFloat(it.quantity) || 0,
        base_quantity: baseQty,
        unit_price: parseFloat(it.unit_price) || 0,
        batch_no: it.batch_no || '',
        expiry_date: it.expiry_date || null,
        total: parseFloat(it.total) || 0,
        unit: unit
      };
    });

    rpcPayload.p_items = itemsPayload;

    if (editingPurchaseId) {
      rpcPayload.p_purchase_id = editingPurchaseId;
      await savePurchaseDirect(rpcPayload, itemsPayload);
      APP.showToast('Purchase updated and inventory synced!', 'success');
    } else {
      const res = await savePurchaseDirect(rpcPayload, itemsPayload);
      const createdNo = res.purchase_no;
      APP.showToast(`Purchase ${createdNo || ''} created and inventory synced!`, 'success');
    }

    APP.closeModal('purchase-modal');
    loadPurchases();
  } catch (err) {
    console.error('savePurchase failed:', err);
    APP.showToast('Failed to save purchase: ' + err.message, 'error');
  } finally {
    if (saveBtn) APP.setButtonLoading(saveBtn, false);
  }
}

async function deletePurchase(id) {
  APP.showConfirm('Delete this purchase and all its line items?', async () => {
    try {
      await deletePurchaseDirect(id);
      APP.showToast('Purchase and associated batches deleted', 'success');
      loadPurchases();
    } catch (err) {
      console.error(err);
      APP.showToast('Failed to delete: ' + err.message, 'error');
    }
  });
}

loadPurchases();


// Auto migrate any legacy PUR- batch numbers to standard P- sequence
(async function migrateLegacyPurchaseBatches() {
  try {
    if (!window.dbClient) return;
    const { data: oldBatches } = await window.dbClient.from('stock_batches').select('id, batch_no').ilike('batch_no', 'PUR-%');
    if (oldBatches && oldBatches.length > 0) {
      for (const b of oldBatches) {
        const updatedNo = b.batch_no.replace(/^PUR-(\d+)$/i, 'P-$1');
        await window.dbClient.from('stock_batches').update({ batch_no: updatedNo }).eq('id', b.id);
      }
      console.log('Migrated legacy stock_batches PUR- to P-');
    }
    const { data: oldItems } = await window.dbClient.from('purchase_items').select('id, batch_no').ilike('batch_no', 'PUR-%');
    if (oldItems && oldItems.length > 0) {
      for (const it of oldItems) {
        const updatedNo = it.batch_no.replace(/^PUR-(\d+)$/i, 'P-$1');
        await window.dbClient.from('purchase_items').update({ batch_no: updatedNo }).eq('id', it.id);
      }
      console.log('Migrated legacy purchase_items PUR- to P-');
    }
  } catch (err) {
    console.warn('Batch migration notice:', err);
  }
})();
