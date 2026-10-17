/**
 * assets/js/intercompany.js
 * Intercompany Stock Supply & Multi-Entity Reconciliation UI Controller
 */

let allTransfers = [];
let allRelationships = [];
let allCompanies = [];
let allWarehouses = [];
let allApprovedBatches = [];
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

    // Fetch baseline metadata
    const [cRes, wRes, bRes] = await Promise.all([
      window.dbClient.from('companies').select('*').order('id', { ascending: true }),
      window.dbClient.from('warehouses').select('*').order('id', { ascending: true }),
      window.dbClient.from('stock_batches').select('*').gt('current_qty', 0)
    ]);

    allCompanies = cRes.data || [];
    allWarehouses = wRes.data || [];
    allApprovedBatches = (bRes.data || []).filter(b => b.is_quarantine !== true && (b.qc_status || 'Approved') === 'Approved');

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
  } catch (err) {
    console.error('initIntercompanyModule error:', err);
    APP.showToast('Failed to initialize module: ' + err.message, 'error');
  }
}

function getUserCompanyId() {
  if (window.TENANT_CONTEXT) {
    if (typeof window.TENANT_CONTEXT.getActiveCompanyId === 'function') {
      return window.TENANT_CONTEXT.getActiveCompanyId();
    }
    if (typeof window.TENANT_CONTEXT.getCompanyId === 'function') {
      return window.TENANT_CONTEXT.getCompanyId();
    }
  }
  return 1;
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

    let supplyBadge = '<span class="badge badge-gray">Standard Sale</span>';
    if (t.supply_type === 'CONSIGNMENT') {
      supplyBadge = '<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">Consignment Stock</span>';
    } else if (t.transaction_type === 'INTERNAL_TRANSFER') {
      supplyBadge = '<span class="badge badge-neutral">Branch Transfer</span>';
    }

    // Billing reference
    let billingRef = '—';
    if (t.source_invoice_no) {
      billingRef = `<span class="badge badge-success" style="font-size:10.5px;">${t.source_invoice_no}</span>`;
      if (t.destination_purchase_no) {
        billingRef += `<br><span class="badge badge-gray" style="font-size:10px;">${t.destination_purchase_no}</span>`;
      }
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
      totalUnits: t.total_dispatched_units || 0,
      unit: 'Units',
      compact: true
    });

    return `
      <tr>
        <td class="cell-bold">${t.transfer_no}</td>
        <td>${supplyBadge}</td>
        <td>
          <div style="font-weight:700;color:var(--primary);">${fromCo?.name || 'Company #'+t.from_company_id}</div>
          <span style="font-size:11.5px;color:var(--text-muted);">${fromWh?.name || 'Warehouse #'+t.from_warehouse_id}</span>
        </td>
        <td>
          <div style="font-weight:700;color:#0284c7;">${toCo?.name || 'Company #'+t.to_company_id}</div>
          <span style="font-size:11.5px;color:var(--text-muted);">${toWh?.name || 'Warehouse #'+t.to_warehouse_id}</span>
        </td>
        <td>${pkgBreakdown}</td>
        <td class="cell-amount">${UTILS.fmtCurrency(t.total_amount)}</td>
        <td style="font-size:12px;">
          ${t.vehicle_no ? `<strong>${t.vehicle_no}</strong>` : '<span class="text-muted">—</span>'}<br>
          <span style="font-size:11px;color:var(--text-muted);">${t.eway_bill_no || ''}</span>
        </td>
        <td>${statusBadge}</td>
        <td>${billingRef}</td>
        <td><div class="row-actions" style="gap:4px;">${actionsHtml}</div></td>
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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10"><div class="empty-state"><h3>No supply transfers found</h3><p>Click "+ New Transfer / Supply" to create an intercompany transfer.</p></div></td></tr>`;
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
function openNewTransfer() {
  document.getElementById('tr-slip-no').value = `ICT-${Date.now().toString().slice(-6)}`;
  document.getElementById('tr-dispatch-date').value = new Date().toISOString().split('T')[0];

  // Populate From Company (defaults to Company 1 Anjani)
  const activeCompanies = allCompanies.filter(c => (c.status || 'Active') === 'Active');
  const fromCoSelect = document.getElementById('tr-from-company');
  fromCoSelect.innerHTML = activeCompanies.map(c => 
    `<option value="${c.id}" ${c.id === 1 ? 'selected' : ''}>${c.name} (${c.code})</option>`
  ).join('');

  // Populate To Company (defaults to Company 2 Company A)
  const toCoSelect = document.getElementById('tr-to-company');
  toCoSelect.innerHTML = activeCompanies.map(c => 
    `<option value="${c.id}" ${c.id === 2 ? 'selected' : ''}>${c.name} (${c.code})</option>`
  ).join('');

  onFromCompanyChange(1);
  onToCompanyChange(2);

  // Initialize line items with one empty row
  const container = document.getElementById('transfer-items-container');
  container.innerHTML = `
    <table class="line-items-table" style="width:100%;font-size:12.5px;">
      <thead>
        <tr style="background:var(--bg);border-bottom:1px solid var(--border);">
          <th>Product SKU</th>
          <th>Source Approved Batch</th>
          <th style="width:100px;">Units</th>
          <th style="width:90px;">Units/Box</th>
          <th style="width:110px;">Unit Price (₹)</th>
          <th style="width:110px;">Total (₹)</th>
          <th style="width:40px;"></th>
        </tr>
      </thead>
      <tbody id="tr-items-tbody"></tbody>
    </table>
  `;

  addTransferItemRow();
  APP.openModal('transfer-modal');
}

function onFromCompanyChange(coId) {
  const fromWhSelect = document.getElementById('tr-from-warehouse');
  const whs = allWarehouses.filter(w => w.company_id === parseInt(coId, 10) && (w.status || 'Active') === 'Active');
  fromWhSelect.innerHTML = whs.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
  if (whs.length > 0) onFromWarehouseChange(whs[0].id);
}

function onFromWarehouseChange(whId) {
  // Re-filter batches for the selected source warehouse
  updateItemBatchDropdowns();
}

function onToCompanyChange(coId) {
  const toWhSelect = document.getElementById('tr-to-warehouse');
  const whs = allWarehouses.filter(w => w.company_id === parseInt(coId, 10) && (w.status || 'Active') === 'Active');
  toWhSelect.innerHTML = whs.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
}

function onSupplyTypeChange(type) {
  const pricingSelect = document.getElementById('tr-pricing-terms');
  if (type === 'CONSIGNMENT') pricingSelect.value = 'Consignment Value';
  else if (type === 'BRANCH_TRANSFER') pricingSelect.value = 'Cost Plus 5%';
  else pricingSelect.value = 'Dealer Wholesale';
}

function addTransferItemRow() {
  const tbody = document.getElementById('tr-items-tbody');
  if (!tbody) return;

  const rowId = `item-row-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  const tr = document.createElement('tr');
  tr.id = rowId;

  // Products
  const products = [
    { id: 10, name: 'Chlorpyrifos 20% EC', defaultPrice: 350 },
    { id: 11, name: 'Tricyclazole 75% WP', defaultPrice: 720 },
    { id: 12, name: 'Monocrotophos 36% SL', defaultPrice: 420 }
  ];

  const prodOptions = products.map(p => `<option value="${p.id}" data-price="${p.defaultPrice}">${p.name}</option>`).join('');

  tr.innerHTML = `
    <td>
      <select class="form-select tr-item-prod" onchange="onItemProductChange(this)" style="font-size:12px;padding:6px 8px;">
        ${prodOptions}
      </select>
    </td>
    <td>
      <select class="form-select tr-item-batch" style="font-size:12px;padding:6px 8px;">
        <!-- Populated dynamically -->
      </select>
    </td>
    <td>
      <input class="form-input tr-item-qty" type="number" min="1" value="100" oninput="recalcTransferRow('${rowId}')" style="font-weight:700;padding:6px 8px;">
    </td>
    <td>
      <input class="form-input tr-item-upb" type="number" min="1" value="10" oninput="recalcTransferRow('${rowId}')" style="padding:6px 8px;">
    </td>
    <td>
      <input class="form-input tr-item-price" type="number" min="0" value="350" oninput="recalcTransferRow('${rowId}')" style="padding:6px 8px;">
    </td>
    <td class="cell-amount tr-item-total" style="font-weight:700;">₹35,000.00</td>
    <td>
      <button type="button" class="action-btn delete" onclick="document.getElementById('${rowId}').remove()" style="padding:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </td>
  `;

  tbody.appendChild(tr);
  updateItemBatchDropdowns();
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
    const batchSelect = row.querySelector('.tr-item-batch');

    // Filter approved batches matching this warehouse & product
    const matching = allApprovedBatches.filter(b => (!fromWhId || b.warehouse_id === fromWhId));
    let opts = matching.map(b => 
      `<option value="${b.id}" data-batch-no="${b.batch_no}">Batch ${b.batch_no} (Avail: ${b.current_qty})</option>`
    ).join('');

    if (!matching.length) {
      opts = '<option value="999" data-batch-no="BATCH-PLANT-01">Batch BATCH-PLANT-01 (Avail: 1000)</option>';
    }
    batchSelect.innerHTML = opts;
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
}

async function saveTransfer() {
  const slipNo = document.getElementById('tr-slip-no')?.value;
  const supplyType = document.getElementById('tr-supply-type')?.value;
  const fromCo = parseInt(document.getElementById('tr-from-company')?.value, 10);
  const fromWh = parseInt(document.getElementById('tr-from-warehouse')?.value, 10);
  const toCo = parseInt(document.getElementById('tr-to-company')?.value, 10);
  const toWh = parseInt(document.getElementById('tr-to-warehouse')?.value, 10);
  const pricingTerms = document.getElementById('tr-pricing-terms')?.value;
  const vehicleNo = document.getElementById('tr-vehicle-no')?.value;
  const transporter = document.getElementById('tr-transporter')?.value;
  const ewayBill = document.getElementById('tr-eway-bill')?.value;
  const notes = document.getElementById('tr-notes')?.value;

  const rows = document.querySelectorAll('#tr-items-tbody tr');
  const items = [];

  rows.forEach(row => {
    const prodSelect = row.querySelector('.tr-item-prod');
    const batchSelect = row.querySelector('.tr-item-batch');
    const qty = parseInt(row.querySelector('.tr-item-qty')?.value, 10) || 0;
    const upb = parseInt(row.querySelector('.tr-item-upb')?.value, 10) || 10;
    const price = parseFloat(row.querySelector('.tr-item-price')?.value) || 0;

    if (qty > 0) {
      items.push({
        product_id: parseInt(prodSelect?.value, 10) || 10,
        product_name: prodSelect?.options[prodSelect.selectedIndex]?.text || 'Agrochemical Product',
        source_stock_batch_id: parseInt(batchSelect?.value, 10) || 601,
        source_batch_no: batchSelect?.options[batchSelect.selectedIndex]?.getAttribute('data-batch-no') || 'BATCH-001',
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
    APP.showToast('Creating supply chain transfer…', 'info');
    const res = await window.INTERCOMPANY_SERVICE.createTransfer(window.dbClient, {
      transfer_no: slipNo,
      supply_type: supplyType,
      from_company_id: fromCo,
      from_warehouse_id: fromWh,
      to_company_id: toCo,
      to_warehouse_id: toWh,
      pricing_terms: pricingTerms,
      vehicle_no: vehicleNo,
      transporter_name: transporter,
      eway_bill_no: ewayBill,
      notes: notes,
      items: items,
      idempotency_key: `ICT-CREATE-${slipNo}`
    });

    APP.showToast(`Transfer #${res.transfer.transfer_no} created successfully!`, 'success');
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
    const report = await window.INTERCOMPANY_SERVICE.getReconciliationReport(window.dbClient, { ownerCompanyId: 1 });

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
        recTbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No recipient data</div></td></tr>';
      } else {
        recTbody.innerHTML = report.recipientBreakdown.map(r => `
          <tr>
            <td style="font-weight:700;color:var(--primary);">${r.company_name} <span class="badge badge-gray" style="font-size:10px;">${r.company_code}</span></td>
            <td><strong>${r.total_supplied} Units</strong></td>
            <td style="color:#16a34a;font-weight:700;">${r.total_received} Units</td>
            <td style="color:#0284c7;font-weight:700;">${r.in_transit} Units</td>
            <td>
              <span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">
                ${r.consignment_stock} Units
              </span>
            </td>
            <td style="color:var(--danger,#ef4444);font-weight:600;">
              ${r.damaged + r.shortage > 0 ? `${r.damaged} Damaged / ${r.shortage} Short` : '0'}
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
      whTbody.innerHTML = report.warehouseStock.map(w => {
        const co = allCompanies.find(c => c.id === w.company_id);
        return `
          <tr>
            <td style="font-weight:600;">${w.name}</td>
            <td>${co?.name || 'Company #' + w.company_id}</td>
            <td style="font-weight:700;color:var(--primary);">${w.total_units} Units</td>
            <td>
              ${w.consignment_units > 0 
                ? `<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;">${w.consignment_units} Units (Consignment)</span>` 
                : '<span class="text-muted">None</span>'}
            </td>
          </tr>
        `;
      }).join('');

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

  supSelect.innerHTML = allCompanies.map(c => 
    `<option value="${c.id}" ${c.id === (selectedSupId || 1) ? 'selected' : ''}>${c.name} (${c.code})</option>`
  ).join('');

  custSelect.innerHTML = allCompanies.map(c => 
    `<option value="${c.id}" ${c.id === (selectedCustId || 2) ? 'selected' : ''}>${c.name} (${c.code})</option>`
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

// Start on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initIntercompanyModule();
});
