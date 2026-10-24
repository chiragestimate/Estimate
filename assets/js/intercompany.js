/**
 * assets/js/intercompany.js
 * Intercompany Stock Supply & Multi-Entity Reconciliation UI Controller
 */

let allTransfers = [];
let allRelationships = [];
let allCompanies = [];
let allWarehouses = [];
let allApprovedBatches = [];
let allProducts = [];
let allSalesOrders = [];
let activeTab = 'Transfers';
let activeTransfersFilter = '';
let activeTransfersSearch = '';
let currentActionTransferId = null;
let editingRelationshipId = null;

// ============================================================================
// INITIALIZATION & TAB SWITCHING
// ============================================================================
async function initIntercompanyModule() {
  console.log('Initializing Intercompany Supply & Reconciliation Module...');
  try {
    await DB.initDB();
    await window.TENANT_CONTEXT.init();

    // Fetch baseline metadata including products and active sales orders
    const ordersQuery = window.TENANT_CONTEXT 
      ? window.TENANT_CONTEXT.filter(window.dbClient.from('orders').select('*').order('id', { ascending: false }))
      : window.dbClient.from('orders').select('*').order('id', { ascending: false });

    const [cRes, wRes, bRes, pRes, oRes] = await Promise.all([
      window.dbClient.from('companies').select('*').order('id', { ascending: true }),
      window.dbClient.from('warehouses').select('*').order('id', { ascending: true }),
      window.dbClient.from('stock_batches').select('*').gt('current_qty', 0),
      window.dbClient.from('products').select('*').order('name', { ascending: true }),
      ordersQuery
    ]);

    allCompanies = cRes.data || [];
    allWarehouses = wRes.data || [];
    allApprovedBatches = (bRes.data || []).filter(b => b.is_quarantine !== true && (b.qc_status || 'Approved') === 'Approved');
    allProducts = pRes.data || [];
    allSalesOrders = oRes.data || [];

    // Setup tabs
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeTab = e.target.getAttribute('data-tab');

        document.getElementById('transfers-view').style.display = (activeTab === 'Transfers') ? '' : 'none';
        document.getElementById('reconciliation-view').style.display = (activeTab === 'Reconciliation') ? '' : 'none';
        document.getElementById('relationships-view').style.display = (activeTab === 'Relationships') ? '' : 'none';

        if (activeTab === 'Transfers') loadTransfers();
        else if (activeTab === 'Reconciliation') loadReconciliationDashboard();
        else if (activeTab === 'Relationships') loadRelationships();
      });
    });

    // Wire Transfers Toolbar with Debounce
    const debouncedTransfersSearch = (typeof UTILS !== 'undefined' && UTILS.debounce)
      ? UTILS.debounce(e => {
          activeTransfersSearch = e.target.value || '';
          renderTransfersTable();
        }, 250)
      : e => {
          activeTransfersSearch = e.target.value || '';
          renderTransfersTable();
        };

    document.getElementById('transfers-search-input')?.addEventListener('input', debouncedTransfersSearch);

    document.querySelectorAll('#transfers-status-pill-filters .cat-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('#transfers-status-pill-filters .cat-pill').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeTransfersFilter = e.target.getAttribute('data-status') || '';
        renderTransfersTable();
      });
    });

    // Listen for company switching to refresh authorized transfers
    window.addEventListener('companyChanged', () => {
      if (activeTab === 'Transfers') loadTransfers();
      else if (activeTab === 'Reconciliation') loadReconciliationDashboard();
      else if (activeTab === 'Relationships') loadRelationships();
    });
    if (window.TENANT_CONTEXT?.subscribe) {
      window.TENANT_CONTEXT.subscribe(() => {
        if (activeTab === 'Transfers') loadTransfers();
        else if (activeTab === 'Reconciliation') loadReconciliationDashboard();
        else if (activeTab === 'Relationships') loadRelationships();
      });
    }

    // Load initial tab
    await loadTransfers();

    // Check if navigated from Orders page with ?open_new_transfer=1 or ?import_order_id=...
    const urlParams = new URLSearchParams(window.location.search);
    const importOrderId = urlParams.get('import_order_id') || urlParams.get('order_id');
    if (urlParams.get('open_new_transfer') || importOrderId) {
      await openNewTransfer(importOrderId);
    }
  } catch (err) {
    console.error('initIntercompanyModule error:', err);
    APP.showToast('Failed to initialize module: ' + err.message, 'error');
  }
}

function getUserCompanyId() {
  if (window.TENANT_CONTEXT) {
    if (typeof window.TENANT_CONTEXT.getActiveCompanyId === 'function') {
      const id = window.TENANT_CONTEXT.getActiveCompanyId();
      if (id) return parseInt(id, 10);
    }
    if (typeof window.TENANT_CONTEXT.getCompanyId === 'function') {
      const id = window.TENANT_CONTEXT.getCompanyId();
      if (id) return parseInt(id, 10);
    }
  }
  const stored = localStorage.getItem('erp_active_company_id') || localStorage.getItem('active_company_id');
  if (stored) return parseInt(stored, 10);
  const mfg = allCompanies.find(c => c.is_manufacturing === true || (c.code || '').toUpperCase() === 'AAC');
  return mfg ? mfg.id : (allCompanies[0]?.id || 623);
}

function getRootCompanyId() {
  const mfg = allCompanies.find(c => c.is_manufacturing === true || (c.code || '').toUpperCase() === 'AAC');
  return mfg ? mfg.id : (allCompanies[0]?.id || 623);
}

// ============================================================================
// TAB 1: SUPPLY CHAIN TRANSFERS & DISPATCHES
// ============================================================================
async function loadTransfers() {
  try {
    UTILS.renderTableSkeleton('transfers-table');
    const userCompany = getUserCompanyId();
    const list = await window.INTERCOMPANY_SERVICE.getTransfers(window.dbClient, { userCompanyId: userCompany });
    allTransfers = list || [];
    renderTransfersTable();
  } catch (err) {
    console.error('loadTransfers failed:', err);
    APP.showToast('Failed to load transfers: ' + err.message, 'error');
    const tbody = document.querySelector('#transfers-table tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6">
        <div class="table-error-state">
          <p>Failed to load transfers: ${err.message || 'Unknown error'}</p>
          <button class="btn btn-secondary table-retry-btn" onclick="loadTransfers()">Retry</button>
        </div>
      </td></tr>`;
    }
    const pag = document.querySelector('#transfers-table-wrap .pagination');
    if (pag) pag.style.display = 'none';
  }
}

let transfersTableEnhancer = null;

function renderTransfersSlice(data) {
  const tbody = document.querySelector('#transfers-table tbody');
  if (!tbody) return;

  tbody.innerHTML = data.map(t => {
    const fromCo = allCompanies.find(c => c.id === t.from_company_id);
    const toCo = allCompanies.find(c => c.id === t.to_company_id);
    const fromWh = allWarehouses.find(w => w.id === t.from_warehouse_id);
    const toWh = allWarehouses.find(w => w.id === t.to_warehouse_id);

    const st = t.status || 'Draft';
    const statusBadge = UTILS.statusBadge(st);

    let supplyBadge = '<span class="badge badge-gray">Commercial Sale</span>';
    if (t.supply_type === 'CONSIGNMENT') {
      supplyBadge = '<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">Consignment Stock</span>';
    } else if (t.transaction_type === 'INTERNAL_TRANSFER' || t.supply_type === 'BRANCH_TRANSFER') {
      supplyBadge = '<span class="badge badge-neutral">Branch Transfer</span>';
    }

    // Action buttons based on status
    let actionsHtml = `
      <button class="action-btn view" onclick="viewTransfer(${t.id})" title="View Voucher"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
    `;

    if (st === 'Draft' || st === 'Pending Approval') {
      actionsHtml += `
        <button class="btn btn-sm btn-primary" onclick="openApproveTransfer(${t.id})" style="padding:2px 8px;font-size:11px;">Approve</button>
        <button class="btn btn-sm btn-secondary" onclick="cancelTransfer(${t.id})" style="padding:2px 8px;font-size:11px;color:var(--danger,#ef4444);" title="Cancel Transfer">Cancel</button>
      `;
    } else if (st === 'Approved') {
      actionsHtml += `
        <button class="btn btn-sm btn-success" onclick="openDispatchTransfer(${t.id})" style="padding:2px 8px;font-size:11px;background:#16a34a;color:#fff;">Dispatch</button>
        <button class="btn btn-sm btn-secondary" onclick="cancelTransfer(${t.id})" style="padding:2px 8px;font-size:11px;color:var(--danger,#ef4444);" title="Cancel Transfer">Cancel</button>
      `;
    } else if (st === 'In Transit' || st === 'Partially Received') {
      actionsHtml += `
        <button class="btn btn-sm btn-primary" onclick="openReceiveTransfer(${t.id})" style="padding:2px 8px;font-size:11px;">Receive</button>
        <button class="btn btn-sm btn-secondary" onclick="openRejectTransfer(${t.id})" style="padding:2px 8px;font-size:11px;color:var(--danger,#ef4444);">Reject</button>
      `;
    } else if (st === 'Received') {
      actionsHtml += `<button class="btn btn-sm btn-secondary" onclick="openReturnTransfer(${t.id})" style="padding:2px 8px;font-size:11px;color:var(--danger,#ef4444);">Return</button>`;
    } else if (st === 'Rejected') {
      actionsHtml += `<button class="btn btn-sm btn-secondary" onclick="resubmitTransfer(${t.id})" style="padding:2px 8px;font-size:11px;" title="Reopen as Draft">Resubmit</button>`;
    }

    const pkgBreakdown = UTILS.formatPackagingBreakdown({
      boxes: t.total_boxes_dispatched || 0,
      looseUnits: t.total_loose_dispatched || 0,
      totalUnits: t.total_dispatched_units || t.total_ordered_units || 0,
      unit: 'Units',
      compact: true
    });

    const dateStr = t.dispatch_date ? UTILS.fmtDate(t.dispatch_date) : (t.created_at ? UTILS.fmtDate(t.created_at.split('T')[0]) : '—');
    const vehicleBadge = t.vehicle_no ? `<span class="transfer-sub-badge" title="Vehicle: ${t.vehicle_no}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> ${t.vehicle_no}</span>` : '';

    return `
      <tr>
        <td class="col-transfer-no">
          <div class="transfer-primary-no">${t.transfer_no}</div>
          <div class="transfer-sub-date">${dateStr}</div>
          ${vehicleBadge}
        </td>
        <td class="col-arrangement">${supplyBadge}</td>
        <td class="col-from">
          <div class="co-name-from">${fromCo?.name || 'Company #'+t.from_company_id}</div>
          <div class="wh-name-sub">${fromWh?.name || 'Warehouse #'+t.from_warehouse_id}</div>
        </td>
        <td class="col-to">
          <div class="co-name-to">${toCo?.name || 'Company #'+t.to_company_id}</div>
          <div class="wh-name-sub">${toWh?.name || 'Warehouse #'+t.to_warehouse_id}</div>
        </td>
        <td class="col-items">
          <div class="items-units-bold">${t.total_dispatched_units || t.total_ordered_units || 0} Units</div>
          <div class="items-boxes-sub">${pkgBreakdown}</div>
        </td>
        <td class="col-amount cell-amount">
          <div class="amount-val">${UTILS.fmtCurrency(t.total_amount)}</div>
        </td>
        <td class="col-status">${statusBadge}</td>
        <td class="col-actions">
          <div class="row-actions" style="gap:4px;justify-content:center;">${actionsHtml}</div>
        </td>
      </tr>
    `;
  }).join('');

  UTILS.applyMobileTableLabels('transfers-table');
}

function renderTransfersTable() {
  const tbody = document.querySelector('#transfers-table tbody');
  if (!tbody) return;

  let data = allTransfers;
  if (activeTransfersFilter) {
    data = data.filter(t => (t.status || '').toLowerCase() === activeTransfersFilter.toLowerCase());
  }
  if (activeTransfersSearch) {
    const q = activeTransfersSearch.toLowerCase();
    data = data.filter(t => {
      const fromCo = allCompanies.find(c => c.id === t.from_company_id);
      const toCo = allCompanies.find(c => c.id === t.to_company_id);
      return `${t.transfer_no} ${t.vehicle_no || ''} ${t.eway_bill_no || ''} ${fromCo?.name || ''} ${toCo?.name || ''}`.toLowerCase().includes(q);
    });
  }

  const totalInfo = document.getElementById('transfers-total-info');
  if (totalInfo) totalInfo.textContent = `${data.length} transfer${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><div class="empty-state"><h3>No stock transfers found</h3><p>Click "+ New Stock Transfer" to create an intercompany transfer.</p></div></td></tr>`;
    const pag = document.querySelector('#transfers-table-wrap .pagination');
    if (pag) pag.style.display = 'none';
    return;
  }

  if (window.TableEnhancer) {
    if (!transfersTableEnhancer) {
      transfersTableEnhancer = new window.TableEnhancer({
        tableId: 'transfers-table',
        pageSize: 25,
        defaultSortKey: 'id',
        defaultSortOrder: 'desc',
        onRender: (pageSlice) => renderTransfersSlice(pageSlice)
      });
    }
    transfersTableEnhancer.setData(data);
    return;
  }

  renderTransfersSlice(data.slice(0, 50));
}

// ============================================================================
// TRANSFER MODAL WORKFLOWS
// ============================================================================
async function openNewTransfer(preselectedOrderId = null) {
  document.getElementById('tr-slip-no').value = `ICT-${Date.now().toString().slice(-6)}`;
  document.getElementById('tr-dispatch-date').value = new Date().toISOString().split('T')[0];

  const activeCompanies = allCompanies.filter(c => (c.status || 'Active') === 'Active');
  const userCoId = getUserCompanyId();

  // Determine intelligent default Supplying and Receiving companies
  const defaultFromCoId = activeCompanies.some(c => c.id === userCoId) ? userCoId : (activeCompanies[0]?.id || 623);
  
  // Find partner from relationships or pick second active company
  const partnerRel = allRelationships.find(r => r.supplier_company_id === defaultFromCoId);
  let defaultToCoId = partnerRel ? partnerRel.customer_company_id : null;
  if (!defaultToCoId || !activeCompanies.some(c => c.id === defaultToCoId)) {
    const otherCo = activeCompanies.find(c => c.id !== defaultFromCoId);
    defaultToCoId = otherCo ? otherCo.id : defaultFromCoId;
  }

  // Populate From Company
  const fromCoSelect = document.getElementById('tr-from-company');
  fromCoSelect.innerHTML = activeCompanies.map(c => 
    `<option value="${c.id}" ${c.id === defaultFromCoId ? 'selected' : ''}>${c.name} (${c.code})</option>`
  ).join('');

  // Populate To Company
  const toCoSelect = document.getElementById('tr-to-company');
  toCoSelect.innerHTML = activeCompanies.map(c => 
    `<option value="${c.id}" ${c.id === defaultToCoId ? 'selected' : ''}>${c.name} (${c.code})</option>`
  ).join('');

  onFromCompanyChange(fromCoSelect.value);
  onToCompanyChange(toCoSelect.value);

  // Populate Order Auto-Fill dropdown
  const orderSelect = document.getElementById('tr-import-order-select');
  if (orderSelect) {
    orderSelect.innerHTML = '<option value="">-- Choose Sales Order to Auto-Fill --</option>' +
      (allSalesOrders || []).map(o => {
        const cName = o.client_name ? ` • ${o.client_name}` : '';
        const amt = o.total_amount ? ` • ${UTILS.fmtCurrency(o.total_amount)}` : '';
        return `<option value="${o.id}">Order #${o.order_no || o.id}${cName}${amt}</option>`;
      }).join('');
    orderSelect.value = preselectedOrderId ? String(preselectedOrderId) : '';
  }

  const statusEl = document.getElementById('tr-order-import-status');
  if (statusEl) {
    statusEl.style.display = 'none';
    statusEl.innerHTML = '';
  }

  // Initialize line items table structure with packaging size column
  const container = document.getElementById('transfer-items-container');
  container.innerHTML = `
    <table class="line-items-table" style="width:100%;font-size:12.5px;">
      <thead>
        <tr style="background:var(--bg);border-bottom:1px solid var(--border);">
          <th style="min-width:260px;">Product & Pack Size</th>
          <th style="width:110px;">Units</th>
          <th style="width:100px;">Units/Box</th>
          <th style="width:120px;">Unit Price (₹)</th>
          <th style="width:130px;">Total (₹)</th>
          <th style="width:40px;"></th>
        </tr>
      </thead>
      <tbody id="tr-items-tbody"></tbody>
    </table>
  `;

  if (preselectedOrderId) {
    await onImportOrderSelected(preselectedOrderId);
  } else {
    addTransferItemRow();
  }

  updateTransferSummaryCard();
  APP.openModal('transfer-modal');
}

function onFromCompanyChange(coId) {
  const fromWhSelect = document.getElementById('tr-from-warehouse');
  if (!fromWhSelect) return;

  const parsedId = parseInt(coId, 10);
  const whs = allWarehouses.filter(w => w.company_id === parsedId && (w.status || 'Active') === 'Active');

  if (!whs.length) {
    fromWhSelect.innerHTML = '<option value="" disabled selected>No warehouses configured for this company. Configure in Companies & Branches.</option>';
    fromWhSelect.value = '';
    onFromWarehouseChange('');
    updateTransferSummaryCard();
    return;
  }

  fromWhSelect.innerHTML = '<option value="" disabled selected>-- Select Source Warehouse --</option>' + 
    whs.map(w => `<option value="${w.id}">${w.name} (${w.warehouse_type || 'General'}${w.code ? ' • ' + w.code : ''})</option>`).join('');

  // Requirement: Do not silently select the first warehouse.
  fromWhSelect.value = '';
  onFromWarehouseChange('');
  validateWarehouseSelections();
  updateTransferSummaryCard();
}

function onFromWarehouseChange(whId) {
  validateWarehouseSelections();
  updateItemBatchDropdowns();
  updateTransferSummaryCard();
}

function onToCompanyChange(coId) {
  const toWhSelect = document.getElementById('tr-to-warehouse');
  if (!toWhSelect) return;

  const parsedId = parseInt(coId, 10);
  const whs = allWarehouses.filter(w => w.company_id === parsedId && (w.status || 'Active') === 'Active');

  if (!whs.length) {
    toWhSelect.innerHTML = '<option value="" disabled selected>No warehouses configured for this company. Configure in Companies & Branches.</option>';
    toWhSelect.value = '';
    validateWarehouseSelections();
    updateTransferSummaryCard();
    return;
  }

  toWhSelect.innerHTML = '<option value="" disabled selected>-- Select Destination Warehouse --</option>' + 
    whs.map(w => `<option value="${w.id}">${w.name} (${w.warehouse_type || 'General'}${w.code ? ' • ' + w.code : ''})</option>`).join('');

  toWhSelect.value = '';
  validateWarehouseSelections();
  updateTransferSummaryCard();
}

function onToWarehouseChange(whId) {
  validateWarehouseSelections();
  updateTransferSummaryCard();
}

function validateWarehouseSelections() {
  const fromCo = parseInt(document.getElementById('tr-from-company')?.value, 10);
  const toCo = parseInt(document.getElementById('tr-to-company')?.value, 10);
  const fromWhSelect = document.getElementById('tr-from-warehouse');
  const toWhSelect = document.getElementById('tr-to-warehouse');
  const fromWhId = parseInt(fromWhSelect?.value, 10);
  const toWhId = parseInt(toWhSelect?.value, 10);
  const errorEl = document.getElementById('tr-wh-error-msg');
  const saveBtn = document.getElementById('save-transfer-btn');

  if (fromCo && toCo && fromCo === toCo && fromWhId && toWhId && fromWhId === toWhId) {
    if (errorEl) {
      errorEl.textContent = 'Invalid Selection: Origin and Destination warehouse cannot be the same warehouse for an internal transfer.';
      errorEl.style.display = 'block';
    }
    toWhSelect.value = '';
    if (saveBtn) saveBtn.disabled = true;
    return false;
  }

  if (errorEl) {
    errorEl.style.display = 'none';
  }
  if (saveBtn) saveBtn.disabled = false;
  return true;
}

function onSupplyTypeChange(type) {
  const pricingSelect = document.getElementById('tr-pricing-terms');
  if (type === 'CONSIGNMENT') pricingSelect.value = 'Consignment Value';
  else if (type === 'BRANCH_TRANSFER') pricingSelect.value = 'Cost Plus 5%';
  else pricingSelect.value = 'Dealer Wholesale';
  updateTransferSummaryCard();
}

function updateTransferSummaryCard() {
  const card = document.getElementById('tr-live-summary-card');
  if (!card) return;

  const fromCoSelect = document.getElementById('tr-from-company');
  const fromWhSelect = document.getElementById('tr-from-warehouse');
  const toCoSelect = document.getElementById('tr-to-company');
  const toWhSelect = document.getElementById('tr-to-warehouse');
  const supplyTypeSelect = document.getElementById('tr-supply-type');
  const pricingSelect = document.getElementById('tr-pricing-terms');

  const fromCoName = fromCoSelect?.options[fromCoSelect.selectedIndex]?.text || 'Not selected';
  const fromWhName = fromWhSelect?.value ? fromWhSelect.options[fromWhSelect.selectedIndex]?.text : 'Select warehouse';
  const toCoName = toCoSelect?.options[toCoSelect.selectedIndex]?.text || 'Not selected';
  const toWhName = toWhSelect?.value ? toWhSelect.options[toWhSelect.selectedIndex]?.text : 'Select warehouse';
  const supplyArrangement = supplyTypeSelect?.options[supplyTypeSelect.selectedIndex]?.text || 'Commercial Sale';
  const pricingTerms = pricingSelect?.value || 'Transfer Price';

  let totalUnits = 0;
  let totalBoxes = 0;
  let totalAmount = 0;
  let lineCount = 0;

  document.querySelectorAll('#tr-items-tbody tr').forEach(row => {
    const qty = parseInt(row.querySelector('.tr-item-qty')?.value, 10) || 0;
    const upb = parseInt(row.querySelector('.tr-item-upb')?.value, 10) || 10;
    const price = parseFloat(row.querySelector('.tr-item-price')?.value) || 0;
    if (qty > 0) {
      lineCount++;
      totalUnits += qty;
      totalBoxes += Math.floor(qty / upb);
      totalAmount += (qty * price);
    }
  });

  card.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:8px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;">
        <span style="font-size:11px;color:var(--primary);font-weight:700;text-transform:uppercase;">Origin (Where stock leaves)</span>
        <div style="font-weight:700;color:#0f172a;">${fromCoName}</div>
        <div style="font-size:11.5px;color:#64748b;">${fromWhName}</div>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;">
        <span style="font-size:11px;color:#0284c7;font-weight:700;text-transform:uppercase;">Destination (Where stock arrives)</span>
        <div style="font-weight:700;color:#0f172a;">${toCoName}</div>
        <div style="font-size:11.5px;color:#64748b;">${toWhName}</div>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;">
        <span style="font-size:11px;color:#b45309;font-weight:700;text-transform:uppercase;">Arrangement & Pricing</span>
        <div style="font-weight:700;color:#0f172a;">${pricingTerms}</div>
        <div style="font-size:11.5px;color:#64748b;">${supplyArrangement.split('(')[0].trim()}</div>
      </div>
      <div style="background:#ffffff;border:1.5px solid #86efac;border-radius:6px;padding:8px 12px;background:#f0fdf4;">
        <span style="font-size:11px;color:#166534;font-weight:700;text-transform:uppercase;">Transfer Summary</span>
        <div style="font-weight:800;color:#166534;font-size:14px;">${totalUnits} Units (${totalBoxes} Boxes)</div>
        <div style="font-size:12px;font-weight:700;color:#0f172a;">Total: ${UTILS.fmtCurrency(totalAmount)} <span style="font-size:11px;font-weight:400;color:#64748b;">(${lineCount} line${lineCount !== 1 ? 's' : ''})</span></div>
      </div>
    </div>
  `;
}

function addTransferItemRow(prefillData = null) {
  const tbody = document.getElementById('tr-items-tbody');
  if (!tbody) return;

  const rowId = `item-row-${Date.now()}-${Math.floor(Math.random()*10000)}`;
  const tr = document.createElement('tr');
  tr.id = rowId;

  // Real products loaded from database
  const selectedProdId = prefillData?.product_id ? String(prefillData.product_id) : '';
  let prodOptions = '';
  if (allProducts && allProducts.length > 0) {
    prodOptions = allProducts.map(p => 
      `<option value="${p.id}" data-price="${p.sell_price || p.purchase_price || 350}" data-unit="${p.unit || 'Litre'}" ${String(p.id) === selectedProdId ? 'selected' : ''}>${p.name}</option>`
    ).join('');
  } else {
    prodOptions = `
      <option value="66" data-price="2400" data-unit="Litre" ${selectedProdId==='66'?'selected':''}>Anjani Coragen-80 Ec</option>
      <option value="63" data-price="650" data-unit="Litre" ${selectedProdId==='63'?'selected':''}>Anjani Chlor-20 Ec</option>
      <option value="64" data-price="950" data-unit="Litre" ${selectedProdId==='64'?'selected':''}>Anjani Profe-40 Ec</option>
      <option value="65" data-price="870" data-unit="Litre" ${selectedProdId==='65'?'selected':''}>Anjani Thio-60 Ec</option>
    `;
  }

  const qty = prefillData ? (parseInt(prefillData.quantity || prefillData.ordered_units || prefillData.total_units, 10) || 0) : 100;
  const upb = prefillData ? (parseInt(prefillData.units_per_box || prefillData.bottles_per_box, 10) || 10) : 10;
  const price = prefillData ? (parseFloat(prefillData.unit_price) || 0) : 350;
  const pack = prefillData ? (prefillData.packing_size || prefillData.packaging_size || '1 Litre') : '1 Litre';
  const total = qty * price;

  tr.innerHTML = `
    <td>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <select class="form-select tr-item-prod" onchange="onItemProductChange(this)" style="font-size:12px;padding:6px 8px;">
          ${prodOptions}
        </select>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;color:var(--text-muted);font-weight:600;">Size:</span>
          <input class="form-input tr-item-pack" type="text" value="${pack}" placeholder="Pack Size" style="font-size:11px;padding:2px 6px;height:24px;width:105px;" onchange="updateTransferSummaryCard()">
        </div>
      </div>
      <input type="hidden" class="tr-item-batch" value="86" data-batch-no="BATCH-PLANT-01">
    </td>
    <td>
      <input class="form-input tr-item-qty" type="number" min="1" value="${qty}" oninput="recalcTransferRow('${rowId}')" style="font-weight:700;padding:6px 8px;">
    </td>
    <td>
      <input class="form-input tr-item-upb" type="number" min="1" value="${upb}" oninput="recalcTransferRow('${rowId}')" style="padding:6px 8px;">
    </td>
    <td>
      <input class="form-input tr-item-price" type="number" min="0" value="${price}" oninput="recalcTransferRow('${rowId}')" style="padding:6px 8px;">
    </td>
    <td class="cell-amount tr-item-total" style="font-weight:700;">${UTILS.fmtCurrency(total)}</td>
    <td>
      <button type="button" class="action-btn delete" onclick="document.getElementById('${rowId}').remove(); updateTransferSummaryCard();" style="padding:4px;" title="Remove row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  updateItemBatchDropdowns();
  
  // If not prefilled, trigger initial product change to set default price
  if (!prefillData) {
    const firstProdSelect = tr.querySelector('.tr-item-prod');
    if (firstProdSelect) onItemProductChange(firstProdSelect);
  }
  
  if (window.UniversalSearchSelect) {
    window.UniversalSearchSelect.initAll(tr);
  }
}

function onItemBatchChange(selectEl) {
  updateTransferSummaryCard();
}

function onItemProductChange(selectEl) {
  const row = selectEl.closest('tr');
  const opt = selectEl.options[selectEl.selectedIndex];
  const price = opt.getAttribute('data-price') || 350;
  const priceInput = row.querySelector('.tr-item-price');
  if (priceInput) priceInput.value = price;
  updateItemBatchDropdowns();
  recalcTransferRow(row.id);
}

function updateItemBatchDropdowns() {
  const fromWhId = parseInt(document.getElementById('tr-from-warehouse')?.value, 10);
  document.querySelectorAll('#tr-items-tbody tr').forEach(row => {
    const prodId = parseInt(row.querySelector('.tr-item-prod')?.value, 10);
    const batchInput = row.querySelector('.tr-item-batch');
    if (!batchInput) return;

    // Silently assign QC-Approved batch or fallback plant batch
    const matching = (allApprovedBatches || []).filter(b => (!fromWhId || b.warehouse_id === fromWhId || b.warehouse_id === 1));
    const prodMatching = matching.filter(b => b.product_id === prodId);
    const candidateBatches = prodMatching.length > 0 ? prodMatching : matching;
    const chosenBatch = candidateBatches[0] || (allApprovedBatches && allApprovedBatches[0]) || { id: 86, batch_no: 'BATCH-PLANT-01' };

    batchInput.value = chosenBatch.id || 86;
    batchInput.setAttribute('data-batch-no', chosenBatch.batch_no || 'BATCH-PLANT-01');
  });
}

function recalcTransferRow(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const qty = parseInt(row.querySelector('.tr-item-qty')?.value, 10) || 0;
  const price = parseFloat(row.querySelector('.tr-item-price')?.value) || 0;
  const total = qty * price;
  const totalEl = row.querySelector('.tr-item-total');
  if (totalEl) totalEl.textContent = UTILS.fmtCurrency(total);
  updateTransferSummaryCard();
}

/**
 * 1-Click Auto-Fill from Sales Order:
 * Automatically loads all product lines, packaging sizes, quantities, and prices
 * from the selected order without requiring manual re-entry.
 */
async function onImportOrderSelected(orderId) {
  if (!orderId) return;
  const statusEl = document.getElementById('tr-order-import-status');
  try {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<span class="spinner-sm" style="display:inline-block;width:12px;height:12px;border:2px solid #16a34a;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin-right:6px;vertical-align:middle;"></span> Fetching order items...';
    }

    let order = (allSalesOrders || []).find(o => String(o.id) === String(orderId));
    if (!order && window.dbClient) {
      const { data: oData } = await window.dbClient.from('orders').select('*').eq('id', orderId).single();
      order = oData;
    }
    if (!order) throw new Error(`Order #${orderId} was not found.`);

    // 1. Fetch raw order_items
    let rawItems = [];
    if (window.dbClient) {
      const { data: itemsData } = await window.dbClient.from('order_items').select('*').eq('order_id', orderId).order('id', { ascending: true });
      rawItems = itemsData || [];
    }

    // 2. Fetch rich items_meta from DISPATCH_META in order.notes if available
    let metaItems = [];
    if (order.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(order.notes)) {
      try {
        const jsonStr = order.notes.replace(/^[\s\S]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed.items_meta)) metaItems = parsed.items_meta;
      } catch (e) {
        console.warn('Could not parse items_meta:', e);
      }
    }

    // Compile items to import with robust rate and packaging resolution
    let itemsToImport = [];
    if (rawItems.length > 0) {
      itemsToImport = rawItems.map(it => {
        // Find matching metadata if available
        const matchMeta = metaItems.find(m => 
          String(m.product_id) === String(it.product_id) && 
          (String(m.packing_size || '').toLowerCase() === String(it.packing_size || '').toLowerCase())
        );

        const catalogProd = allProducts.find(p => String(p.id) === String(it.product_id));
        const upb = matchMeta?.bottles_per_box || matchMeta?.units_per_box || it.bottles_per_box || 10;
        const price = parseFloat(it.unit_price) || parseFloat(matchMeta?.unit_price) || (catalogProd?.sell_price || catalogProd?.purchase_price || 350);
        const qty = parseInt(it.quantity || it.total_units || matchMeta?.ordered_units || 100, 10);

        return {
          product_id: it.product_id,
          product_name: it.product_name || catalogProd?.name || 'Agrochemical Product',
          packing_size: it.packing_size || matchMeta?.packing_size || matchMeta?.packaging_size || '1 Litre',
          quantity: qty,
          units_per_box: upb,
          unit_price: price,
          total: qty * price
        };
      });
    } else if (metaItems.length > 0) {
      itemsToImport = metaItems.map(m => {
        const catalogProd = allProducts.find(p => String(p.id) === String(m.product_id));
        const price = parseFloat(m.unit_price) || (catalogProd?.sell_price || catalogProd?.purchase_price || 350);
        const qty = parseInt(m.ordered_units || m.total_units || m.quantity || 100, 10);
        return {
          product_id: m.product_id,
          product_name: m.product_name || catalogProd?.name || 'Agrochemical Product',
          packing_size: m.packing_size || m.packaging_size || '1 Litre',
          quantity: qty,
          units_per_box: m.bottles_per_box || m.units_per_box || 10,
          unit_price: price,
          total: qty * price
        };
      });
    }

    if (!itemsToImport.length) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:var(--danger,#ef4444);">⚠️ No product lines found on Order #${order.order_no || order.id}.</span>`;
      }
      return;
    }

    // Clear placeholder rows
    const tbody = document.getElementById('tr-items-tbody');
    if (tbody) tbody.innerHTML = '';

    // Populate every line item automatically
    for (const item of itemsToImport) {
      addTransferItemRow(item);
    }

    // Auto-fill order reference and instructions
    const slipNo = document.getElementById('tr-slip-no');
    if (slipNo) {
      const cleanNo = (order.order_no || `O-${order.id}`).replace(/\s+/g, '');
      slipNo.value = `ICT-${cleanNo}`;
    }

    const notesEl = document.getElementById('tr-notes');
    if (notesEl && !notesEl.value) {
      notesEl.value = `Intercompany supply to fulfill Sales Order #${order.order_no || order.id} for client: ${order.client_name || 'Dealer'}`;
    }

    updateTransferSummaryCard();

    const totalUnits = itemsToImport.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalVal = itemsToImport.reduce((sum, it) => sum + (it.total || 0), 0);

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `✅ <strong>Auto-filled ${itemsToImport.length} products (${totalUnits} units • ${UTILS.fmtCurrency(totalVal)})</strong> from Sales Order <strong>#${order.order_no || order.id}</strong> (${order.client_name || 'Client'}). All quantities, packaging sizes, and rates populated!`;
    }
    APP.showToast(`Auto-filled ${itemsToImport.length} products from Order #${order.order_no || order.id}!`, 'success');
  } catch (err) {
    console.error('onImportOrderSelected error:', err);
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `<span style="color:var(--danger,#ef4444);">Failed to import order: ${err.message}</span>`;
    }
    APP.showToast('Failed to import order: ' + err.message, 'error');
  }
}

function clearImportedOrderItems() {
  const tbody = document.getElementById('tr-items-tbody');
  if (tbody) tbody.innerHTML = '';
  addTransferItemRow();
  const orderSelect = document.getElementById('tr-import-order-select');
  if (orderSelect) orderSelect.value = '';
  const statusEl = document.getElementById('tr-order-import-status');
  if (statusEl) {
    statusEl.style.display = 'none';
    statusEl.innerHTML = '';
  }
  updateTransferSummaryCard();
  APP.showToast('Cleared line items. Ready for manual entry.', 'info');
}

async function saveTransfer() {
  const slipNo = document.getElementById('tr-slip-no')?.value;
  const supplyType = document.getElementById('tr-supply-type')?.value;
  const fromCo = parseInt(document.getElementById('tr-from-company')?.value, 10);
  const fromWh = parseInt(document.getElementById('tr-from-warehouse')?.value, 10);
  const toCo = parseInt(document.getElementById('tr-to-company')?.value, 10);
  const toWh = parseInt(document.getElementById('tr-to-warehouse')?.value, 10);
  const pricingTerms = document.getElementById('tr-pricing-terms')?.value;
  const dispatchDate = document.getElementById('tr-dispatch-date')?.value;
  const vehicleNo = document.getElementById('tr-vehicle-no')?.value;
  const transporter = document.getElementById('tr-transporter')?.value;
  const ewayBill = document.getElementById('tr-eway-bill')?.value;
  const notes = document.getElementById('tr-notes')?.value;

  if (!fromCo || !toCo) {
    APP.showToast('Please select both supplying and receiving companies.', 'error');
    return;
  }

  if (!fromWh) {
    APP.showToast('Please select a valid Source Warehouse where stock leaves.', 'error');
    document.getElementById('tr-from-warehouse')?.focus();
    return;
  }

  if (!toWh) {
    APP.showToast('Please select a valid Destination Warehouse where stock arrives.', 'error');
    document.getElementById('tr-to-warehouse')?.focus();
    return;
  }

  if (fromCo === toCo && fromWh === toWh) {
    APP.showToast('Source Warehouse and Destination Warehouse cannot be the same for an internal transfer.', 'error');
    return;
  }

  const rows = document.querySelectorAll('#tr-items-tbody tr');
  const items = [];

  rows.forEach(row => {
    const prodSelect = row.querySelector('.tr-item-prod');
    const batchInput = row.querySelector('.tr-item-batch');
    const packInput = row.querySelector('.tr-item-pack');
    const qty = parseInt(row.querySelector('.tr-item-qty')?.value, 10) || 0;
    const upb = parseInt(row.querySelector('.tr-item-upb')?.value, 10) || 10;
    const price = parseFloat(row.querySelector('.tr-item-price')?.value) || 0;

    if (qty > 0) {
      items.push({
        product_id: parseInt(prodSelect?.value, 10) || 66,
        product_name: prodSelect?.options[prodSelect.selectedIndex]?.text || 'Agrochemical Product',
        packaging_size: packInput?.value || '1 Litre',
        source_stock_batch_id: parseInt(batchInput?.value, 10) || 86,
        source_batch_no: batchInput?.getAttribute('data-batch-no') || (batchInput?.options ? batchInput.options[batchInput.selectedIndex]?.getAttribute('data-batch-no') : null) || 'BATCH-PLANT-01',
        quantity: qty,
        units_per_box: upb,
        unit_price: price
      });
    }
  });

  if (!items.length) {
    APP.showToast('Please add at least one line item with quantity > 0.', 'error');
    return;
  }

  try {
    APP.showToast('Creating stock transfer…', 'info');
    const res = await window.INTERCOMPANY_SERVICE.createTransfer(window.dbClient, {
      transfer_no: slipNo,
      supply_type: supplyType,
      from_company_id: fromCo,
      from_warehouse_id: fromWh,
      to_company_id: toCo,
      to_warehouse_id: toWh,
      pricing_terms: pricingTerms,
      dispatch_date: dispatchDate,
      vehicle_no: vehicleNo,
      transporter_name: transporter,
      eway_bill_no: ewayBill,
      notes: notes,
      items: items,
      idempotency_key: `ICT-CREATE-${slipNo}`
    });

    APP.showToast(`Stock Transfer #${res.transfer.transfer_no} created successfully!`, 'success');
    APP.closeModal('transfer-modal');
    await loadTransfers();
  } catch (err) {
    APP.showToast('Transfer creation failed: ' + err.message, 'error');
  }
}

// ============================================================================
// WORKFLOW ACTIONS: APPROVE, DISPATCH, RECEIVE, REJECT, RETURN
// ============================================================================
async function openApproveTransfer(transferId) {
  APP.showConfirm('Authorize and approve this intercompany supply transfer for commercial dispatch?', async () => {
    try {
      await window.INTERCOMPANY_SERVICE.approveTransfer(window.dbClient, {
        transferId: transferId,
        approvedBy: 'Supply Chain Manager',
        userCompanyId: getUserCompanyId()
      });
      APP.showToast('Transfer authorized & approved for dispatch!', 'success');
      await loadTransfers();
    } catch (err) {
      APP.showToast('Approval failed: ' + err.message, 'error');
    }
  });
}

async function cancelTransfer(transferId) {
  const t = allTransfers.find(x => x.id === transferId);
  if (!t) return;

  APP.showConfirm(
    `Are you sure you want to cancel Transfer #${t.transfer_no}? This will mark the transfer as Cancelled without affecting inventory.`,
    async () => {
      try {
        APP.showSpinner();
        const { error } = await window.dbClient.from('intercompany_transfers').update({
          status: 'Cancelled',
          notes: (t.notes ? t.notes + '\n' : '') + `[Cancelled on ${new Date().toLocaleDateString()}]`
        }).eq('id', transferId);

        if (error) throw error;
        APP.showToast(`Transfer #${t.transfer_no} has been cancelled.`, 'info');
        await loadTransfers();
      } catch (err) {
        console.error('cancelTransfer error:', err);
        APP.showToast('Failed to cancel transfer: ' + err.message, 'error');
      } finally {
        APP.hideSpinner();
      }
    },
    {
      title: 'Cancel Transfer',
      confirmText: 'Cancel Transfer',
      isDanger: true
    }
  );
}

async function resubmitTransfer(transferId) {
  const t = allTransfers.find(x => x.id === transferId);
  if (!t) return;

  APP.showConfirm(
    `Reopen Transfer #${t.transfer_no} back to Draft state for corrections and resubmission?`,
    async () => {
      try {
        APP.showSpinner();
        const { error } = await window.dbClient.from('intercompany_transfers').update({
          status: 'Draft',
          notes: (t.notes ? t.notes + '\n' : '') + `[Resubmitted to Draft on ${new Date().toLocaleDateString()}]`
        }).eq('id', transferId);

        if (error) throw error;
        APP.showToast(`Transfer #${t.transfer_no} reopened as Draft.`, 'success');
        await loadTransfers();
      } catch (err) {
        console.error('resubmitTransfer error:', err);
        APP.showToast('Failed to resubmit transfer: ' + err.message, 'error');
      } finally {
        APP.hideSpinner();
      }
    },
    {
      title: 'Resubmit Transfer',
      confirmText: 'Reopen as Draft'
    }
  );
}

async function openDispatchTransfer(transferId) {
  currentActionTransferId = transferId;
  const details = await window.INTERCOMPANY_SERVICE.getTransferDetails(window.dbClient, transferId);
  if (!details || !details.transfer) return;
  const t = details.transfer;

  const body = document.getElementById('dispatch-transfer-body');
  body.innerHTML = `
    <div style="background:rgba(22, 163, 74, 0.08);padding:12px;border-radius:8px;border:1px solid rgba(22, 163, 74, 0.3);margin-bottom:14px;font-size:13px;">
      <div style="font-weight:700;color:#16a34a;margin-bottom:4px;">IN-TRANSIT POSTING & SINGLE-POSTING DEDUCTION</div>
      <p style="margin:0;font-size:12px;color:var(--text);">
        Confirming gate exit will physically deduct <strong>${t.total_dispatched_units} units</strong> from source factory warehouse <strong>EXACTLY ONCE</strong>.
        Destination stock will NOT be credited until physical receipt is confirmed.
      </p>
    </div>

    <div class="form-grid product-form-grid" style="gap:10px;">
      <div class="form-group">
        <label class="form-label">Gate Officer / Dispatcher</label>
        <input class="form-input" id="disp-officer" value="Plant Gate Officer">
      </div>
      <div class="form-group">
        <label class="form-label">Vehicle Registration No</label>
        <input class="form-input" id="disp-veh" value="${t.vehicle_no || ''}" placeholder="GJ-01-AB-1234">
      </div>
      <div class="form-group">
        <label class="form-label">Transporter Name</label>
        <input class="form-input" id="disp-trans" value="${t.transporter_name || ''}" placeholder="Shreeji Logistics">
      </div>
      <div class="form-group">
        <label class="form-label">Government E-Way Bill No</label>
        <input class="form-input" id="disp-ewb" value="${t.eway_bill_no || ''}" placeholder="EWB-2026-98124">
      </div>
    </div>
  `;

  APP.openModal('dispatch-transfer-modal');
}

async function submitDispatchTransfer() {
  if (!currentActionTransferId) return;
  const dispatchedBy = document.getElementById('disp-officer')?.value || 'Gate Officer';
  const veh = document.getElementById('disp-veh')?.value;
  const trans = document.getElementById('disp-trans')?.value;
  const ewb = document.getElementById('disp-ewb')?.value;

  try {
    APP.showToast('Posting dispatch and deducting source inventory…', 'info');
    const res = await window.INTERCOMPANY_SERVICE.dispatchTransfer(window.dbClient, {
      transferId: currentActionTransferId,
      dispatchedBy: dispatchedBy,
      vehicleNo: veh,
      transporterName: trans,
      ewayBillNo: ewb,
      userCompanyId: getUserCompanyId()
    });

    APP.showToast(`Transfer #${res.transferNo} is now In Transit! Stock deducted.`, 'success');
    APP.closeModal('dispatch-transfer-modal');
    await loadTransfers();
  } catch (err) {
    APP.showToast('Dispatch failed: ' + err.message, 'error');
  }
}

async function openReceiveTransfer(transferId) {
  currentActionTransferId = transferId;
  const details = await window.INTERCOMPANY_SERVICE.getTransferDetails(window.dbClient, transferId);
  if (!details || !details.transfer) return;
  const t = details.transfer;
  const items = details.items || [];

  const body = document.getElementById('receive-transfer-body');
  body.innerHTML = `
    <div style="background:rgba(2, 132, 199, 0.08);padding:12px;border-radius:8px;border:1px solid rgba(2, 132, 199, 0.3);margin-bottom:14px;font-size:13px;">
      <div style="font-weight:700;color:#0284c7;margin-bottom:4px;">RECIPIENT DESTINATION STOCK CREDITING</div>
      <p style="margin:0;font-size:12px;color:var(--text);">
        Confirming receipt will credit sound units into recipient warehouse.
        ${t.supply_type === 'CONSIGNMENT' ? '<strong>CONSIGNMENT NOTICE:</strong> Goods will be stored at recipient depot but remain legally owned by Anjani Agri Care.' : ''}
      </p>
    </div>

    <div style="margin-bottom:14px;">
      <h5 style="margin:0 0 8px;font-size:13px;">Physical Inspection & Breakdown</h5>
      <table class="line-items-table" style="width:100%;font-size:12px;">
        <thead>
          <tr style="background:var(--bg);border-bottom:1px solid var(--border);">
            <th>Product</th>
            <th>Batch No</th>
            <th>Dispatched</th>
            <th style="width:110px;">Sound Received</th>
            <th style="width:100px;">Damaged</th>
            <th style="width:100px;">Shortage</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr data-item-id="${it.id}">
              <td style="font-weight:600;">${it.product_name}</td>
              <td><code>${it.source_batch_no}</code></td>
              <td><strong>${it.dispatched_units}</strong></td>
              <td>
                <input class="form-input rcpt-rec-units" type="number" min="0" max="${it.dispatched_units}" value="${it.dispatched_units}" style="padding:4px 6px;font-weight:700;">
              </td>
              <td>
                <input class="form-input rcpt-dam-units" type="number" min="0" value="0" style="padding:4px 6px;color:var(--danger,#ef4444);">
              </td>
              <td>
                <input class="form-input rcpt-sho-units" type="number" min="0" value="0" style="padding:4px 6px;color:#d97706;">
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="form-grid product-form-grid" style="gap:10px;">
      <div class="form-group">
        <label class="form-label">Inspected & Received By</label>
        <input class="form-input" id="rcpt-by" value="Warehouse Inward Officer">
      </div>
      <div class="form-group">
        <label class="form-label">Receipt Date</label>
        <input class="form-input" id="rcpt-date" type="date" value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>
  `;

  APP.openModal('receive-transfer-modal');
}

async function submitReceiveTransfer() {
  if (!currentActionTransferId) return;
  const receivedBy = document.getElementById('rcpt-by')?.value || 'Receiver';

  const rows = document.querySelectorAll('#receive-transfer-body tbody tr');
  const itemReceipts = [];

  rows.forEach(row => {
    const itemId = parseInt(row.getAttribute('data-item-id'), 10);
    const rec = parseInt(row.querySelector('.rcpt-rec-units')?.value, 10) || 0;
    const dam = parseInt(row.querySelector('.rcpt-dam-units')?.value, 10) || 0;
    const sho = parseInt(row.querySelector('.rcpt-sho-units')?.value, 10) || 0;

    itemReceipts.push({
      item_id: itemId,
      received_units: rec,
      damaged_units: dam,
      shortage_units: sho,
      rejected_units: 0,
      returned_units: 0
    });
  });

  try {
    APP.showToast('Crediting destination inventory & updating receipt…', 'info');
    const res = await window.INTERCOMPANY_SERVICE.receiveTransfer(window.dbClient, {
      transferId: currentActionTransferId,
      receivedBy: receivedBy,
      itemReceipts: itemReceipts,
      userCompanyId: getUserCompanyId()
    });

    APP.showToast(`Transfer received! Credited ${res.totalReceived} units into destination warehouse.`, 'success');
    APP.closeModal('receive-transfer-modal');
    await loadTransfers();
  } catch (err) {
    APP.showToast('Receipt failed: ' + err.message, 'error');
  }
}

async function openRejectTransfer(transferId) {
  APP.showConfirm('Reject this in-transit delivery? Goods will NOT be credited to destination warehouse.', async () => {
    try {
      await window.INTERCOMPANY_SERVICE.rejectDelivery(window.dbClient, {
        transferId: transferId,
        rejectedBy: 'Recipient QC Inspector',
        reason: 'Physical inspection failed at destination gate',
        userCompanyId: getUserCompanyId()
      });
      APP.showToast('Delivery rejected and moved to return queue.', 'warning');
      await loadTransfers();
    } catch (err) {
      APP.showToast('Rejection failed: ' + err.message, 'error');
    }
  });
}

async function openReturnTransfer(transferId) {
  currentActionTransferId = transferId;
  const details = await window.INTERCOMPANY_SERVICE.getTransferDetails(window.dbClient, transferId);
  if (!details || !details.transfer) return;
  const t = details.transfer;

  const body = document.getElementById('return-transfer-body');
  body.innerHTML = `
    <div style="background:rgba(239, 68, 68, 0.08);padding:12px;border-radius:8px;border:1px solid rgba(239, 68, 68, 0.3);margin-bottom:14px;font-size:13px;">
      <div style="font-weight:700;color:var(--danger,#ef4444);margin-bottom:4px;">RESTORE FACTORY INVENTORY</div>
      <p style="margin:0;font-size:12px;color:var(--text);">
        Reversing this transfer will safely restore <strong>${t.total_dispatched_units} units</strong> back into the source factory warehouse batch.
      </p>
    </div>

    <div class="form-group" style="margin-bottom:10px;">
      <label class="form-label">Return Reason</label>
      <input class="form-input" id="ret-reason" value="Delivery return to factory godown">
    </div>
    <div class="form-group">
      <label class="form-label">Authorized Supervisor</label>
      <input class="form-input" id="ret-supervisor" value="Plant Head">
    </div>
  `;

  APP.openModal('return-transfer-modal');
}

async function submitReturnTransfer() {
  if (!currentActionTransferId) return;
  const reason = document.getElementById('ret-reason')?.value;
  const supervisor = document.getElementById('ret-supervisor')?.value;

  try {
    APP.showToast('Restoring source factory inventory…', 'info');
    const res = await window.INTERCOMPANY_SERVICE.returnTransferStock(window.dbClient, {
      transferId: currentActionTransferId,
      returnedBy: supervisor,
      reason: reason,
      userCompanyId: getUserCompanyId()
    });

    APP.showToast('Transfer returned and source inventory restored!', 'success');
    APP.closeModal('return-transfer-modal');
    await loadTransfers();
  } catch (err) {
    APP.showToast('Return failed: ' + err.message, 'error');
  }
}

async function viewTransfer(transferId) {
  try {
    const details = await window.INTERCOMPANY_SERVICE.getTransferDetails(window.dbClient, transferId);
    if (!details || !details.transfer) return;
    const t = details.transfer;
    const items = details.items || [];

    const fromCo = allCompanies.find(c => c.id === t.from_company_id);
    const toCo = allCompanies.find(c => c.id === t.to_company_id);
    const fromWh = allWarehouses.find(w => w.id === t.from_warehouse_id);
    const toWh = allWarehouses.find(w => w.id === t.to_warehouse_id);

    const content = document.getElementById('view-transfer-content');
    content.innerHTML = `
      <div style="border: 2px solid var(--border); padding: 20px; border-radius: 8px; background: var(--bg);">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid var(--border); padding-bottom: 14px; margin-bottom: 14px;">
          <div>
            <h3 style="margin:0; font-size:20px; font-weight:800; color:var(--text);">COMMERCIAL SUPPLY CHAIN VOUCHER</h3>
            <p style="margin:3px 0 0; font-size:12px; color:var(--text-muted);">Transfer No: <strong style="color:var(--text);">${t.transfer_no}</strong> | Arrangement: <strong>${t.supply_type}</strong></p>
          </div>
          <div style="text-align:right;">
            <span class="badge ${t.status === 'Received' ? 'badge-success' : 'badge-info'}" style="font-size:13px; padding:4px 10px;">${t.status}</span>
            <p style="margin:4px 0 0; font-size:11px; color:var(--text-muted);">${t.source_stock_deducted ? 'Source Deducted: YES' : 'Source Deducted: NO'}</p>
          </div>
        </div>

        <!-- Entity Pair Info -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px; font-size:13px;">
          <div style="background:rgba(12,57,37,0.06); padding:10px; border-radius:6px; border:1px solid rgba(12,57,37,0.2);">
            <div style="font-size:11px; text-transform:uppercase; color:var(--primary); font-weight:700; margin-bottom:4px;">From: Supplier / Manufacturer</div>
            <div style="font-size:15px; font-weight:800; color:var(--text);">${fromCo?.name || 'Company #'+t.from_company_id}</div>
            <div style="font-size:12px; color:var(--text-muted);">Origin: ${fromWh?.name || 'Warehouse #'+t.from_warehouse_id}</div>
            ${t.source_invoice_no ? `<div style="font-size:11px; margin-top:4px;">Outward Invoice: <strong>${t.source_invoice_no}</strong></div>` : ''}
          </div>
          <div style="background:rgba(2,132,199,0.06); padding:10px; border-radius:6px; border:1px solid rgba(2,132,199,0.2);">
            <div style="font-size:11px; text-transform:uppercase; color:#0284c7; font-weight:700; margin-bottom:4px;">To: Recipient Entity</div>
            <div style="font-size:15px; font-weight:800; color:var(--text);">${toCo?.name || 'Company #'+t.to_company_id}</div>
            <div style="font-size:12px; color:var(--text-muted);">Destination: ${toWh?.name || 'Warehouse #'+t.to_warehouse_id}</div>
            ${t.destination_purchase_no ? `<div style="font-size:11px; margin-top:4px;">Inward Voucher: <strong>${t.destination_purchase_no}</strong></div>` : ''}
          </div>
        </div>

        <!-- Items Table -->
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px; font-size:14px; font-weight:700;">Itemized Batch Movements</h4>
          <table class="line-items-table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg); border-bottom:1px solid var(--border);">
                <th>Product SKU</th>
                <th>Pack Size</th>
                <th>Source Batch</th>
                <th>Dispatched</th>
                <th>Received</th>
                <th>Damaged / Short</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => `
                <tr>
                  <td style="font-weight:600;">${it.product_name}</td>
                  <td><span class="badge badge-neutral">${it.packaging_size}</span></td>
                  <td><code>${it.source_batch_no}</code></td>
                  <td><strong>${it.dispatched_units}</strong> units</td>
                  <td style="color:#16a34a; font-weight:700;">${it.received_units || 0}</td>
                  <td style="color:var(--danger,#ef4444);">${(it.damaged_units||0) + (it.shortage_units||0)}</td>
                  <td class="cell-amount">${UTILS.fmtCurrency(it.total_amount)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--border); font-weight:800;">
                <td colspan="3">TOTAL COMMERCIAL VALUE</td>
                <td>${t.total_dispatched_units} Units</td>
                <td style="color:#16a34a;">${t.total_received_units} Units</td>
                <td style="color:var(--danger,#ef4444);">${(t.total_damaged_units||0)+(t.total_shortage_units||0)}</td>
                <td class="cell-amount" style="color:var(--primary); font-size:14px;">${UTILS.fmtCurrency(t.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Signatures / Audit Trail -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; border-top:1px dashed var(--border); padding-top:14px; font-size:11.5px; color:var(--text-muted);">
          <div>
            <strong>1. Transfer Approved:</strong><br>
            ${t.approved_by || 'Pending'}
          </div>
          <div>
            <strong>2. Factory Dispatch Gate:</strong><br>
            ${t.dispatched_by || 'Pending'}<br>
            ${t.dispatch_date ? UTILS.fmtDate(t.dispatch_date) : ''}
          </div>
          <div>
            <strong>3. Recipient Inward Depot:</strong><br>
            ${t.received_by || 'Pending'}<br>
            ${t.receipt_date ? UTILS.fmtDate(t.receipt_date) : ''}
          </div>
        </div>
      </div>
    `;

    APP.openModal('view-transfer-modal');
  } catch (err) {
    APP.showToast('Failed to view voucher: ' + err.message, 'error');
  }
}

function printTransferSlip() {
  window.print();
}

// ============================================================================
// TAB 2: RECONCILIATION DASHBOARD
// ============================================================================
async function loadReconciliationDashboard() {
  try {
    const report = await window.INTERCOMPANY_SERVICE.getReconciliationReport(window.dbClient, { ownerCompanyId: getRootCompanyId() });

    // Update KPI Metric Cards
    document.getElementById('recon-owned-units').textContent = `${report.totalOwnedStock} Units`;
    document.getElementById('recon-intransit-units').textContent = `${report.totalInTransit} Units`;
    document.getElementById('recon-consign-units').textContent = `${report.totalConsignmentStock} Units`;

    const totalDiscrepancies = report.discrepancies.reduce((sum, d) => sum + (d.damaged + d.shortage + d.rejected), 0);
    document.getElementById('recon-discrepancy-units').textContent = `${totalDiscrepancies} Units`;

    // Render Recipient Company Matrix Table
    const recTbody = document.querySelector('#recon-recipients-table tbody');
    if (recTbody) {
      if (!report.recipientBreakdown.length) {
        recTbody.innerHTML = `
          <tr class="empty-row">
            <td colspan="7" class="empty-cell">
              <div class="empty-state recon-empty-state">
                <div class="recon-empty-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:24px;height:24px;display:block;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <p class="recon-empty-title">No recipient companies configured</p>
                <p class="recon-empty-desc">Configure company trading links to track cross-company stock supply.</p>
              </div>
            </td>
          </tr>
        `;
      } else {
        recTbody.innerHTML = report.recipientBreakdown.map(r => `
          <tr>
            <td style="font-weight:700;color:var(--primary);">${escapeHtml(r.company_name)} <span class="badge badge-gray" style="font-size:10px;">${escapeHtml(r.company_code)}</span></td>
            <td><strong>${(r.total_supplied || 0).toLocaleString()} Units</strong></td>
            <td style="color:#16a34a;font-weight:700;">${(r.total_received || 0).toLocaleString()} Units</td>
            <td style="color:#0284c7;font-weight:700;">${(r.in_transit || 0).toLocaleString()} Units</td>
            <td>
              <span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">
                ${(r.consignment_stock || 0).toLocaleString()} Units
              </span>
            </td>
            <td style="color:var(--danger,#ef4444);font-weight:600;">
              ${r.damaged + r.shortage > 0 ? `${(r.damaged || 0).toLocaleString()} Damaged / ${(r.shortage || 0).toLocaleString()} Short` : '0'}
            </td>
            <td>
              <span class="badge ${r.in_transit === 0 && (r.damaged + r.shortage === 0) ? 'badge-success' : 'badge-warning'}">
                ${r.in_transit === 0 && (r.damaged + r.shortage === 0) ? 'Fully Reconciled' : 'In Balance'}
              </span>
            </td>
          </tr>
        `).join('');
      }
      if (typeof UTILS !== 'undefined' && UTILS.applyMobileTableLabels) {
        UTILS.applyMobileTableLabels('recon-recipients-table');
      }
    }

    // Render Warehouse Distribution Table
    const whTbody = document.querySelector('#recon-warehouses-table tbody');
    if (whTbody) {
      if (!report.warehouseStock.length) {
        whTbody.innerHTML = `
          <tr class="empty-row">
            <td colspan="4" class="empty-cell">
              <div class="empty-state" style="padding:24px 16px;text-align:center;">
                <p style="margin:0;font-size:13px;font-weight:600;color:var(--text-primary);">No warehouse physical stock records found</p>
              </div>
            </td>
          </tr>
        `;
      } else {
        whTbody.innerHTML = report.warehouseStock.map(w => {
          const co = allCompanies.find(c => c.id === w.company_id);
          const coName = co ? `${escapeHtml(co.name)} <span class="badge badge-gray" style="font-size:10px;margin-left:4px;">${escapeHtml(co.code)}</span>` : ('Company #' + w.company_id);
          return `
            <tr>
              <td class="cell-wh-name" style="font-weight:600;">${escapeHtml(w.name)}</td>
              <td class="cell-wh-entity">${coName}</td>
              <td class="cell-wh-stock">
                <div class="recon-stock-val">
                  <span class="recon-stock-num">${(w.total_units || 0).toLocaleString()}</span>
                  <span class="recon-stock-unit">Units</span>
                </div>
              </td>
              <td class="cell-wh-consign">
                ${w.consignment_units > 0 
                  ? `<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">${w.consignment_units.toLocaleString()} Units (Consignment)</span>` 
                  : '<span class="text-muted">None</span>'}
              </td>
            </tr>
          `;
        }).join('');
      }

      if (typeof UTILS !== 'undefined' && UTILS.applyMobileTableLabels) {
        UTILS.applyMobileTableLabels('recon-warehouses-table');
      }
    }
  } catch (err) {
    console.error('loadReconciliationDashboard failed:', err);
    APP.showToast('Failed to load reconciliation dashboard: ' + err.message, 'error');
  }
}

// ============================================================================
// TAB 3: TRADING RELATIONSHIPS MATRIX (PRESERVED FUNCTIONALITY)
// ============================================================================
async function loadRelationships() {
  try {
    UTILS.renderTableSkeleton('relationships-table');
    const { data: rData } = await window.dbClient.from('intercompany_relationships').select('*').order('id', { ascending: true });
    allRelationships = rData || [];
    renderRelationshipsTable(allRelationships);

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.oninput = () => {
        const q = (searchInput.value || '').toLowerCase().trim();
        let filtered = allRelationships;
        if (q) {
          filtered = filtered.filter(r => {
            const sup = allCompanies.find(c => c.id === r.supplier_company_id);
            const cust = allCompanies.find(c => c.id === r.customer_company_id);
            return (r.relationship_type || '').toLowerCase().includes(q) ||
              (r.price_tier || '').toLowerCase().includes(q) ||
              (sup && sup.name.toLowerCase().includes(q)) ||
              (cust && cust.name.toLowerCase().includes(q));
          });
        }
        renderRelationshipsTable(filtered);
      };
    }
  } catch (err) {
    console.error('loadRelationships failed:', err);
    APP.showToast('Failed to load relationships: ' + err.message, 'error');
  }
}

function renderRelationshipsTable(data) {
  const tbody = document.querySelector('#relationships-table tbody');
  if (!tbody) return;

  const totalInfo = document.getElementById('total-info');
  if (totalInfo) totalInfo.textContent = `${data.length} relationship${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><div class="empty-state"><h3>No relationships configured</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => {
    const sup = allCompanies.find(c => c.id === r.supplier_company_id);
    const cust = allCompanies.find(c => c.id === r.customer_company_id);

    return `
      <tr>
        <td>
          <div style="font-weight:700;color:#0C3925;">${sup ? sup.name : 'Unknown'}</div>
          <span class="badge badge-gray" style="font-size:10px;">${sup ? sup.code : ''} • Manufacturer</span>
        </td>
        <td>
          <div style="font-weight:700;color:#0e7490;">${cust ? cust.name : 'Unknown'}</div>
          <span class="badge badge-gray" style="font-size:10px;">${cust ? cust.code : ''} • Recipient</span>
        </td>
        <td><span class="badge badge-info">${(typeof UTILS !== 'undefined' && UTILS.escapeHtml) ? UTILS.escapeHtml(r.relationship_type || 'Distributor') : (r.relationship_type || 'Distributor')}</span></td>
        <td><span class="badge badge-gray">${r.price_tier || 'Standard'}</span></td>
        <td>
          ${r.auto_sync_orders 
            ? '<span class="badge badge-success">SYNC ENABLED</span>' 
            : '<span class="text-muted" style="font-size:12px;">Manual</span>'}
        </td>
        <td>
          <div class="row-actions" style="justify-content:flex-end;gap:4px;">
            <button class="action-btn edit" onclick="openEditRelationship(${r.id})" title="Edit Link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn delete" onclick="deleteRelationship(${r.id})" title="Delete Relationship" style="color:var(--danger,#ef4444);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  UTILS.applyMobileTableLabels('relationships-table');
}

async function deleteRelationship(id) {
  const rel = allRelationships.find(r => r.id === id);
  if (!rel) return;

  const sup = allCompanies.find(c => c.id === rel.supplier_company_id);
  const cust = allCompanies.find(c => c.id === rel.customer_company_id);
  const supName = sup ? sup.name : `Company #${rel.supplier_company_id}`;
  const custName = cust ? cust.name : `Company #${rel.customer_company_id}`;

  APP.showSpinner();
  try {
    // Check for active in-flight transfers if the intercompany_transfers table exists
    try {
      if (window.dbClient) {
        const { data: activeTransfers, error } = await window.dbClient
          .from('intercompany_transfers')
          .select('id, transfer_no, status')
          .eq('from_company_id', rel.supplier_company_id)
          .eq('to_company_id', rel.customer_company_id)
          .in('status', ['Draft', 'Approved', 'In Transit']);

        const isTableMissing = error && (error.code === 'PGRST205' || (error.message && (error.message.includes('schema cache') || error.message.includes('not find the table'))));
        if (error && !isTableMissing) {
          console.warn('[Intercompany] Transfer check warning:', error.message);
        }

        if (activeTransfers && activeTransfers.length > 0) {
          APP.showToast(`Cannot delete relationship: ${activeTransfers.length} active transfer(s) are in progress between ${supName} and ${custName}. Resolve them first.`, 'warning');
          return;
        }
      }
    } catch (checkErr) {
      console.warn('[Intercompany] Dependency check bypassed:', checkErr);
    }

    APP.showConfirm(
      `Are you sure you want to remove the trading relationship between ${supName} and ${custName}? Historical completed transfers will remain intact.`,
      async () => {
        try {
          APP.showSpinner();
          // Delete from remote database
          if (window.dbClient) {
            const { error: delErr } = await window.dbClient.from('intercompany_relationships').delete().eq('id', id);
            if (delErr && delErr.code !== 'PGRST205') {
              throw delErr;
            }
          }

          // Update local memory and localStorage
          allRelationships = allRelationships.filter(r => r.id !== id);
          try {
            localStorage.setItem('erp_intercompany_relationships', JSON.stringify(allRelationships));
          } catch (_) {}

          APP.showToast('Trading relationship removed successfully.', 'success');
          renderRelationshipsTable(allRelationships);
        } catch (delError) {
          console.error('deleteRelationship error:', delError);
          APP.showToast('Failed to delete relationship: ' + delError.message, 'error');
        } finally {
          APP.hideSpinner();
        }
      },
      {
        title: 'Delete Trading Relationship',
        confirmText: 'Delete Relationship',
        isDanger: true
      }
    );
  } catch (err) {
    console.error('deleteRelationship check failed:', err);
    APP.showToast('Failed to process relationship deletion: ' + err.message, 'error');
  } finally {
    APP.hideSpinner();
  }
}

function openAddRelationship() {
  editingRelationshipId = null;
  document.getElementById('relationship-modal-title').textContent = 'New Intercompany Relationship';
  document.getElementById('relationship-form').reset();
  populateCompanySelects();
  APP.openModal('relationship-modal');
}

function openEditRelationship(id) {
  const rel = allRelationships.find(r => r.id === id);
  if (!rel) return;

  editingRelationshipId = id;
  document.getElementById('relationship-modal-title').textContent = 'Edit Intercompany Relationship';
  populateCompanySelects(rel.supplier_company_id, rel.customer_company_id);

  const form = document.getElementById('relationship-form');
  form.relationship_type.value = rel.relationship_type || 'Distributor';
  form.price_tier.value = rel.price_tier || 'Standard Trade';
  form.auto_sync_orders.checked = !!rel.auto_sync_orders;
  form.notes.value = rel.notes || '';

  APP.openModal('relationship-modal');
}

function populateCompanySelects(selectedSupId = null, selectedCustId = null) {
  const supSelect = document.getElementById('supplier-company-select');
  const custSelect = document.getElementById('customer-company-select');
  if (!supSelect || !custSelect) return;

  const userCoId = getUserCompanyId();
  const defSupId = selectedSupId || userCoId;
  const defCustId = selectedCustId || (allCompanies.find(c => c.id !== defSupId)?.id || defSupId);

  supSelect.innerHTML = allCompanies.map(c => 
    `<option value="${c.id}" ${c.id === defSupId ? 'selected' : ''}>${c.name} (${c.code})</option>`
  ).join('');

  custSelect.innerHTML = allCompanies.map(c => 
    `<option value="${c.id}" ${c.id === defCustId ? 'selected' : ''}>${c.name} (${c.code})</option>`
  ).join('');
}

async function saveRelationship() {
  const form = document.getElementById('relationship-form');
  const supId = parseInt(form.supplier_company_id.value, 10);
  const custId = parseInt(form.customer_company_id.value, 10);

  if (supId === custId) {
    APP.showToast('Supplier and Customer entities must be different companies.', 'error');
    return;
  }

  const payload = {
    tenant_id: 1,
    supplier_company_id: supId,
    customer_company_id: custId,
    relationship_type: form.relationship_type.value,
    price_tier: form.price_tier.value,
    auto_sync_orders: form.auto_sync_orders.checked,
    notes: form.notes.value
  };

  try {
    if (editingRelationshipId) {
      await window.dbClient.from('intercompany_relationships').update(payload).eq('id', editingRelationshipId);
      APP.showToast('Relationship updated successfully!', 'success');
    } else {
      await window.dbClient.from('intercompany_relationships').insert([payload]);
      APP.showToast('New relationship established!', 'success');
    }

    APP.closeModal('relationship-modal');
    loadRelationships();
  } catch (err) {
    APP.showToast('Failed to save relationship: ' + err.message, 'error');
  }
}

// Explicit window bindings for modal handlers and external callers
window.openNewTransfer = openNewTransfer;
window.onImportOrderSelected = onImportOrderSelected;
window.clearImportedOrderItems = clearImportedOrderItems;
window.addTransferItemRow = addTransferItemRow;
window.recalcTransferRow = recalcTransferRow;
window.onFromCompanyChange = onFromCompanyChange;
window.onFromWarehouseChange = onFromWarehouseChange;
window.onToCompanyChange = onToCompanyChange;
window.onToWarehouseChange = onToWarehouseChange;
window.onSupplyTypeChange = onSupplyTypeChange;
window.onItemProductChange = onItemProductChange;
window.onItemBatchChange = onItemBatchChange;
window.saveTransfer = saveTransfer;

// Start on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initIntercompanyModule();
});
