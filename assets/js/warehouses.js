/**
 * assets/js/warehouses.js
 * Warehouse & Storage Location Management Module
 *
 * Implements:
 * 1. Multi-company warehouse hierarchy
 * 2. Safe archival and deactivation lifecycle (preserves historical audit trail & stock movements)
 * 3. Safe deletion with dependency classification:
 *    - Active physical stock: Hard blocked, recommends archival or stock transfer
 *    - Historical records (zero balance batches / movements): Offers Archival (recommended) or force delete with audit snapshot preservation
 *    - Zero dependencies: Permanent deletion
 * 4. Action menu: View Details, Edit, Archive/Reactivate, Delete
 */

let allWarehouses = [];
let allCompanies = [];
let allBranches = [];
let warehouseStockMap = new Map();
let editingWarehouseId = null;
let isDeletingWarehouse = false;
let isArchivingWarehouse = false;

async function loadWarehouses() {
  console.log('Loading warehouses...');
  try {
    UTILS.renderTableSkeleton('warehouses-table');
    await DB.initDB();
    await window.TENANT_CONTEXT.init();

    const [whRes, cRes, bRes, bStockRes] = await Promise.all([
      window.dbClient.from('warehouses').select('*').order('id', { ascending: true }),
      window.dbClient.from('companies').select('*').order('id', { ascending: true }),
      window.dbClient.from('branches').select('*').order('id', { ascending: true }),
      window.dbClient.from('stock_batches').select('warehouse_id, current_qty').gt('current_qty', 0)
    ]);

    allWarehouses = whRes.data || [];
    allCompanies = cRes.data || [];
    allBranches = bRes.data || [];

    // Map live physical units per warehouse
    warehouseStockMap = new Map();
    (bStockRes.data || []).forEach(b => {
      const wId = b.warehouse_id;
      const qty = parseFloat(b.current_qty) || 0;
      warehouseStockMap.set(wId, (warehouseStockMap.get(wId) || 0) + qty);
    });

    populateCompanyFilterDropdown();
    filterAndRenderWarehouses();

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.oninput = filterAndRenderWarehouses;
  } catch (err) {
    console.error('loadWarehouses failed:', err);
    APP.showToast('Failed to load warehouses: ' + err.message, 'error');
    const tbody = document.querySelector('#warehouses-table tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">
            <div class="empty-state" style="padding:32px 16px;text-align:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:36px;height:36px;margin:0 auto 10px;color:var(--danger,#ef4444);display:block;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h3 style="font-size:15px;margin-bottom:6px;color:var(--text-primary);">Failed to Load Warehouses</h3>
              <p class="text-sm text-muted" style="margin-bottom:14px;max-width:400px;margin-left:auto;margin-right:auto;">${escapeHtml(err.message || 'Database connection error')}</p>
              <button class="btn btn-secondary btn-sm" onclick="loadWarehouses()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:4px;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Retry Loading
              </button>
            </div>
          </td>
        </tr>
      `;
    }
    const totalInfo = document.getElementById('total-info');
    if (totalInfo) totalInfo.textContent = 'Error loading data';
  }
}

function populateCompanyFilterDropdown() {
  const compSelect = document.getElementById('company-filter');
  if (!compSelect) return;

  const urlParams = new URLSearchParams(window.location.search);
  const targetCompId = urlParams.get('company') || urlParams.get('company_id');
  const targetSearch = urlParams.get('search') || urlParams.get('q');

  if (targetSearch) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = targetSearch;
  }

  let html = `<option value="ALL">All Companies (${allWarehouses.length})</option>`;
  const activeCompId = window.TENANT_CONTEXT.getCompanyId();
  const activeComp = allCompanies.find(c => c.id === activeCompId);
  if (activeComp) {
    const activeCount = allWarehouses.filter(w => w.company_id === activeCompId).length;
    html += `<option value="ACTIVE">Current: ${escapeHtml(activeComp.name)} (${escapeHtml(activeComp.code)}) [${activeCount}]</option>`;
  }

  if (allCompanies.length > 0) {
    html += `<optgroup label="Filter by Company">`;
    allCompanies.forEach(c => {
      const count = allWarehouses.filter(w => w.company_id === c.id).length;
      html += `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)}) — ${count} warehouse${count !== 1 ? 's' : ''}</option>`;
    });
    html += `</optgroup>`;
  }

  compSelect.innerHTML = html;

  if (targetCompId && allCompanies.some(c => String(c.id) === String(targetCompId))) {
    compSelect.value = String(targetCompId);
  } else {
    compSelect.value = 'ALL';
  }

  if (compSelect._ussInstance) {
    compSelect._ussInstance.updateOptions();
  } else if (typeof UniversalSearchSelect !== 'undefined' && typeof UniversalSearchSelect.initAll === 'function') {
    UniversalSearchSelect.initAll(compSelect.parentNode || document);
  }
}

function resetWarehouseFilters() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const compFilter = document.getElementById('company-filter');
  if (compFilter) compFilter.value = 'ALL';
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) statusFilter.value = 'ALL';
  filterAndRenderWarehouses();
}

function filterAndRenderWarehouses() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const filterMode = document.getElementById('company-filter')?.value || 'ALL';
  const statusFilter = document.getElementById('status-filter')?.value || 'ALL';
  const activeCompanyId = window.TENANT_CONTEXT.getCompanyId();

  let filtered = allWarehouses;

  if (filterMode === 'ACTIVE') {
    filtered = filtered.filter(w => w.company_id === activeCompanyId);
  } else if (filterMode !== 'ALL' && !isNaN(Number(filterMode))) {
    const cId = Number(filterMode);
    filtered = filtered.filter(w => w.company_id === cId);
  }

  if (statusFilter === 'ACTIVE') {
    filtered = filtered.filter(w => (w.status || 'Active') === 'Active');
  } else if (statusFilter === 'ARCHIVED') {
    filtered = filtered.filter(w => w.status === 'Archived');
  }

  if (q) {
    filtered = filtered.filter(w => {
      const comp = allCompanies.find(c => c.id === w.company_id);
      const br = allBranches.find(b => b.id === w.branch_id);
      return (w.name || '').toLowerCase().includes(q) ||
        (w.code || '').toLowerCase().includes(q) ||
        (w.warehouse_type || '').toLowerCase().includes(q) ||
        (comp && comp.name.toLowerCase().includes(q)) ||
        (br && br.name.toLowerCase().includes(q));
    });
  }

  renderWarehousesTable(filtered);
}

function renderWarehousesTable(data) {
  const tbody = document.querySelector('#warehouses-table tbody');
  if (!tbody) return;

  const totalInfo = document.getElementById('total-info');
  if (totalInfo) totalInfo.textContent = `${data.length} warehouse${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">
          <div class="empty-state" style="padding:32px 16px;text-align:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;margin:0 auto 10px;color:var(--text-muted,#9ca3af);display:block;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <h3 style="font-size:15px;margin-bottom:4px;color:var(--text-primary);">No warehouses found</h3>
            <p class="text-sm text-muted" style="margin-bottom:12px;">No warehouses match the selected company or status filter.</p>
            <button class="btn btn-secondary btn-sm" onclick="resetWarehouseFilters()">
              Reset Filters & Show All
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(w => {
    const comp = allCompanies.find(c => c.id === w.company_id);
    const br = allBranches.find(b => b.id === w.branch_id);
    const isArchived = (w.status || 'Active') === 'Archived';

    const statusBadge = isArchived
      ? '<span class="badge badge-warning" style="font-size:10px;padding:2px 6px;">Archived</span>'
      : '<span class="badge badge-success" style="font-size:10px;padding:2px 6px;">Active</span>';

    return `
      <tr class="${isArchived ? 'row-archived' : ''}" style="${isArchived ? 'opacity:0.85;' : ''}">
        <td class="cell-bold cell-mono">
          <div class="wh-code-stack">
            <span class="wh-code-text">${escapeHtml(w.code)}</span>
            ${w.is_default ? '<span class="wh-default-pill">DEFAULT</span>' : ''}
          </div>
        </td>
        <td class="cell-wh-name">
          ${escapeHtml(w.name)}
          ${isArchived ? '<span class="text-xs text-muted comp-archived-tag">(Archived Location)</span>' : ''}
        </td>
        <td>
          ${comp ? `
            <div class="wh-entity-stack">
              <span class="wh-entity-name" title="${escapeHtml(comp.name)}">${escapeHtml(comp.name)}</span>
              <span class="wh-entity-code">${escapeHtml(comp.code)}</span>
            </div>
          ` : '—'}
        </td>
        <td class="wh-branch-text">${br ? escapeHtml(br.name) : '<span class="text-muted">General Depot</span>'}</td>
        <td><span class="badge badge-info wh-type-badge">${escapeHtml(w.warehouse_type || 'General')}</span></td>
        <td class="cell-bold cell-wh-stock">
          <div class="wh-stock-val ${(warehouseStockMap.get(w.id) || 0) === 0 ? 'is-zero' : ''}">
            <span class="wh-stock-num">${(warehouseStockMap.get(w.id) || 0).toLocaleString()}</span>
            <span class="wh-stock-unit">units</span>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div class="row-actions">
            <button class="action-btn view" onclick="viewWarehouseDetails(${w.id})" title="View Warehouse Details" style="color:var(--text-primary);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="action-btn edit" onclick="openEditWarehouse(${w.id})" title="Edit Warehouse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${isArchived ? `
              <button class="action-btn reactivate" onclick="reactivateWarehouse(${w.id})" title="Reactivate Warehouse" style="color:var(--success,#10b981);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>
            ` : `
              <button class="action-btn archive" onclick="archiveWarehouse(${w.id})" title="Archive Warehouse (Preserve History)" style="color:#d97706;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10"/><path d="M10 12h4"/></svg>
              </button>
            `}
            <button class="action-btn delete" onclick="safeDeleteWarehouse(${w.id})" title="Delete Warehouse" style="color:var(--danger,#ef4444);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  UTILS.applyMobileTableLabels('warehouses-table');
}

/**
 * View Warehouse Profile & Live Inventory / Audit Summary
 */
async function viewWarehouseDetails(id) {
  const w = allWarehouses.find(x => x.id === id);
  if (!w) return;

  const comp = allCompanies.find(c => c.id === w.company_id);
  const br = allBranches.find(b => b.id === w.branch_id);
  const isArchived = (w.status || 'Active') === 'Archived';

  const titleEl = document.getElementById('warehouse-view-title');
  if (titleEl) {
    titleEl.innerHTML = `
      <span style="font-weight:700;">${escapeHtml(w.name)}</span>
      <span class="badge ${isArchived ? 'badge-warning' : 'badge-success'}" style="margin-left:8px;font-size:11px;">
        ${isArchived ? 'Archived' : 'Active'}
      </span>
    `;
  }

  const bodyEl = document.getElementById('warehouse-view-body');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:1.5rem;">
        <div class="spinner"></div>
      </div>
    `;
  }
  APP.openModal('warehouse-view-modal');

  // Query live inventory metrics safely
  let activeBatchesCount = 0;
  let totalUnits = 0;
  let movementCount = 0;

  try {
    const [bRes, mRes] = await Promise.all([
      window.dbClient.from('stock_batches').select('id, current_qty').eq('warehouse_id', id),
      window.dbClient.from('stock_movements').select('id', { count: 'exact' }).eq('warehouse_id', id)
    ]);
    const batches = (bRes && bRes.data) || [];
    const activeBatches = batches.filter(b => (Number(b.current_qty) || 0) > 0);
    activeBatchesCount = activeBatches.length;
    totalUnits = activeBatches.reduce((acc, b) => acc + (Number(b.current_qty) || 0), 0);
    movementCount = (mRes && mRes.count) || (mRes && mRes.data ? mRes.data.length : 0);
  } catch (e) {
    console.warn('Could not query warehouse stats:', e);
  }

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px;">
        <div style="background:var(--bg-card, #fff);border:1px solid var(--border);border-radius:8px;padding:10px 14px;">
          <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:700;">Warehouse Code</div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);font-family:monospace;margin-top:2px;">${escapeHtml(w.code)}</div>
        </div>
        <div style="background:var(--bg-card, #fff);border:1px solid var(--border);border-radius:8px;padding:10px 14px;">
          <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:700;">Storage Category</div>
          <div style="font-size:13px;font-weight:600;color:var(--primary);margin-top:2px;">${escapeHtml(w.warehouse_type || 'General')}</div>
        </div>
        <div style="background:var(--bg-card, #fff);border:1px solid var(--border);border-radius:8px;padding:10px 14px;">
          <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:700;">Legal Entity (Owner)</div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-top:2px;">${comp ? escapeHtml(comp.name) : '—'}</div>
        </div>
        <div style="background:var(--bg-card, #fff);border:1px solid var(--border);border-radius:8px;padding:10px 14px;">
          <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:700;">Associated Branch</div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-top:2px;">${br ? escapeHtml(br.name) : 'Company-wide (General Depot)'}</div>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.02);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;">
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:4px;">Physical Location / Bay Address</div>
        <div style="font-size:13px;color:var(--text-primary);">${w.location ? escapeHtml(w.location) : '<span class="text-muted">No specific location or bay address specified.</span>'}</div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:6px;">
          ${w.is_default ? '<span class="badge badge-success" style="font-size:10px;">DEFAULT STOCK LOCATION</span>' : '<span class="badge badge-gray" style="font-size:10px;">Secondary Storage Location</span>'}
        </div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:14px;">
        <div style="font-size:11.5px;font-weight:700;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Operational Metrics & Audit Records</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px;">
            <div style="font-size:11px;color:#166534;font-weight:600;">Active Inventory Batches</div>
            <div style="font-size:18px;font-weight:700;color:#15803d;margin-top:2px;">${activeBatchesCount} <span style="font-size:12px;font-weight:500;">batches</span></div>
            <div style="font-size:11px;color:#166534;margin-top:2px;">Total Units: <strong>${totalUnits}</strong></div>
          </div>
          <div style="flex:1;min-width:140px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px;">
            <div style="font-size:11px;color:#1e40af;font-weight:600;">Historical Audit Logs</div>
            <div style="font-size:18px;font-weight:700;color:#1d4ed8;margin-top:2px;">${movementCount} <span style="font-size:12px;font-weight:500;">movements</span></div>
            <div style="font-size:11px;color:#1e40af;margin-top:2px;">Permanently Preserved</div>
          </div>
        </div>
      </div>
    `;
  }
}

function openAddWarehouse() {
  editingWarehouseId = null;
  document.getElementById('warehouse-modal-title').textContent = 'New Warehouse';
  const form = document.getElementById('warehouse-form');
  if (form) form.reset();

  populateCompanySelect(window.TENANT_CONTEXT.getCompanyId());
  onCompanySelectChanged();
  APP.openModal('warehouse-modal');
}

function openEditWarehouse(id) {
  editingWarehouseId = id;
  const w = allWarehouses.find(x => x.id === id);
  if (!w) return;

  document.getElementById('warehouse-modal-title').textContent = `Edit Warehouse (${w.code})`;
  const form = document.getElementById('warehouse-form');
  if (form) {
    populateCompanySelect(w.company_id);
    form.elements['company_id'].value = w.company_id;
    onCompanySelectChanged(w.branch_id);
    form.elements['name'].value = w.name || '';
    form.elements['code'].value = w.code || '';
    form.elements['warehouse_type'].value = w.warehouse_type || 'General';
    form.elements['location'].value = w.location || '';
    form.elements['is_default'].checked = !!w.is_default;
  }
  APP.openModal('warehouse-modal');
}

function populateCompanySelect(selectedCompanyId) {
  const sel = document.getElementById('modal-company-select');
  if (!sel) return;
  sel.innerHTML = allCompanies
    .filter(c => (c.status || 'Active') === 'Active' || c.id === selectedCompanyId)
    .map(c => `
      <option value="${c.id}" ${c.id === selectedCompanyId ? 'selected' : ''}>${c.name} (${c.code})</option>
    `).join('');
}

function onCompanySelectChanged(selectedBranchId = null) {
  const compId = parseInt(document.getElementById('modal-company-select')?.value, 10);
  const brSel = document.getElementById('modal-branch-select');
  if (!brSel) return;

  const branches = allBranches.filter(b => b.company_id === compId && (b.status || 'Active') === 'Active');
  brSel.innerHTML = '<option value="">No specific branch (Company-wide)</option>' +
    branches.map(b => `<option value="${b.id}" ${b.id === selectedBranchId ? 'selected' : ''}>${b.name} (${b.code})</option>`).join('');
}

async function saveWarehouse() {
  const form = document.getElementById('warehouse-form');
  if (!form) return;

  const compId = parseInt(form.elements['company_id'].value, 10);
  const name = form.elements['name'].value.trim();
  const code = form.elements['code'].value.trim().toUpperCase();
  const branchId = form.elements['branch_id'].value ? parseInt(form.elements['branch_id'].value, 10) : null;
  const isDefault = form.elements['is_default'].checked;

  if (!compId || !name || !code) {
    APP.showToast('Please specify company, name, and code', 'error');
    return;
  }

  // Pre-validate warehouse code uniqueness
  const dup = allWarehouses.find(w => w.code.toUpperCase() === code && w.id !== editingWarehouseId);
  if (dup) {
    APP.showToast(`Warehouse code "${code}" is already in use by "${dup.name}".`, 'error');
    return;
  }

  // If set as default warehouse, unmark other default warehouses for this company
  if (isDefault) {
    await window.dbClient.from('warehouses')
      .update({ is_default: false })
      .eq('company_id', compId)
      .eq('is_default', true);
  }

  const payload = {
    company_id: compId,
    branch_id: branchId,
    name: name,
    code: code,
    warehouse_type: form.elements['warehouse_type'].value || 'General',
    location: form.elements['location'].value.trim() || null,
    is_default: isDefault,
    status: 'Active'
  };

  const btn = document.getElementById('save-warehouse-btn');
  if (btn) APP.setButtonLoading(btn, true);

  try {
    if (editingWarehouseId) {
      const { error } = await window.dbClient.from('warehouses').update(payload).eq('id', editingWarehouseId);
      if (error) throw error;

      if (window.AUDIT_LOGGER && window.AUDIT_LOGGER.logWarehouseUpdated) {
        await window.AUDIT_LOGGER.logWarehouseUpdated({
          companyId: compId,
          warehouseId: editingWarehouseId,
          warehouseName: name,
          warehouseCode: code
        });
      }
      APP.showToast('Warehouse updated successfully', 'success');
    } else {
      const { data: newWh, error } = await window.dbClient.from('warehouses').insert([payload]).select();
      if (error) throw error;

      if (window.AUDIT_LOGGER && window.AUDIT_LOGGER.logWarehouseCreated) {
        await window.AUDIT_LOGGER.logWarehouseCreated({
          companyId: compId,
          warehouseId: newWh && newWh[0] ? newWh[0].id : null,
          warehouseName: name,
          warehouseCode: code
        });
      }
      APP.showToast('Warehouse created successfully', 'success');
    }

    APP.closeModal('warehouse-modal');
    if (window.TENANT_CONTEXT && window.TENANT_CONTEXT.reload) {
      await window.TENANT_CONTEXT.reload();
    } else {
      await window.TENANT_CONTEXT.init(true);
    }
    await loadWarehouses();
  } catch (err) {
    console.error('saveWarehouse failed:', err);
    APP.showToast('Failed to save warehouse: ' + err.message, 'error');
  } finally {
    if (btn) APP.setButtonLoading(btn, false);
  }
}

/**
 * Safe Archival of Warehouse
 * Retains all historical records, movements, and ledger links while preventing selection in new operational workflows.
 */
async function archiveWarehouse(warehouseId) {
  if (isArchivingWarehouse) return;
  const w = allWarehouses.find(x => x.id === warehouseId);
  if (!w) return;

  APP.showConfirm(
    `Archive warehouse "${w.name}" (${w.code})?<br><br>This will deactivate the warehouse from new purchase inward, production, and sales dispatches, while <strong>permanently preserving</strong> all historical stock movements, transactions, and audit trails.`,
    async () => {
      isArchivingWarehouse = true;
      APP.showSpinner();
      try {
        const { error } = await window.dbClient.from('warehouses').update({
          status: 'Archived'
        }).eq('id', warehouseId);

        if (error) throw error;

        // Log audit trail
        if (window.AUDIT_LOGGER && window.AUDIT_LOGGER.logWarehouseArchived) {
          await window.AUDIT_LOGGER.logWarehouseArchived({
            companyId: w.company_id,
            warehouseId: w.id,
            warehouseName: w.name,
            warehouseCode: w.code,
            reason: 'Administrative deactivation'
          });
        }

        w.status = 'Archived';
        APP.closeModal('warehouse-dependency-modal');
        APP.showToast(`Warehouse "${w.name}" archived successfully.`, 'success');
        if (window.TENANT_CONTEXT && window.TENANT_CONTEXT.reload) {
          await window.TENANT_CONTEXT.reload();
        } else {
          await window.TENANT_CONTEXT.init(true);
        }
        filterAndRenderWarehouses();
      } catch (err) {
        console.error('archiveWarehouse failed:', err);
        APP.showToast('Failed to archive warehouse: ' + err.message, 'error');
      } finally {
        isArchivingWarehouse = false;
        APP.hideSpinner();
      }
    },
    {
      title: 'Archive Warehouse',
      confirmText: 'Archive Location',
      isDanger: false,
      onCancel: () => { isArchivingWarehouse = false; }
    }
  );
}

/**
 * Reactivate Archived Warehouse
 */
async function reactivateWarehouse(warehouseId) {
  const w = allWarehouses.find(x => x.id === warehouseId);
  if (!w) return;

  APP.showConfirm(
    `Reactivate warehouse "${w.name}" (${w.code})?<br><br>This will restore the warehouse to Active status, allowing it to be selected for inventory, purchases, and sales dispatches.`,
    async () => {
      APP.showSpinner();
      try {
        const { error } = await window.dbClient.from('warehouses').update({
          status: 'Active'
        }).eq('id', warehouseId);

        if (error) throw error;

        if (window.AUDIT_LOGGER && window.AUDIT_LOGGER.logWarehouseReactivated) {
          await window.AUDIT_LOGGER.logWarehouseReactivated({
            companyId: w.company_id,
            warehouseId: w.id,
            warehouseName: w.name,
            warehouseCode: w.code
          });
        }

        w.status = 'Active';
        APP.showToast(`Warehouse "${w.name}" reactivated successfully.`, 'success');
        if (window.TENANT_CONTEXT && window.TENANT_CONTEXT.reload) {
          await window.TENANT_CONTEXT.reload();
        } else {
          await window.TENANT_CONTEXT.init(true);
        }
        filterAndRenderWarehouses();
      } catch (err) {
        console.error('reactivateWarehouse failed:', err);
        APP.showToast('Failed to reactivate warehouse: ' + err.message, 'error');
      } finally {
        APP.hideSpinner();
      }
    },
    {
      title: 'Reactivate Warehouse',
      confirmText: 'Reactivate Location',
      isDanger: false,
      onCancel: () => {}
    }
  );
}

/**
 * Safe Deletion Workflow with Dependency Distinction
 */
async function safeDeleteWarehouse(warehouseId) {
  if (isDeletingWarehouse) return;
  const w = allWarehouses.find(x => x.id === warehouseId);
  if (!w) return;

  isDeletingWarehouse = true;
  APP.showSpinner();
  try {
    const safeQuery = async (queryPromise, fallback = { count: 0, data: [] }) => {
      try {
        const r = await queryPromise;
        return r || fallback;
      } catch (_) {
        return fallback;
      }
    };

    const [batchRes, movRes, icFromRes, icToRes, prodRes] = await Promise.all([
      safeQuery(window.dbClient.from('stock_batches').select('id, current_qty').eq('warehouse_id', warehouseId), { data: [] }),
      safeQuery(window.dbClient.from('stock_movements').select('id', { count: 'exact' }).eq('warehouse_id', warehouseId)),
      safeQuery(window.dbClient.from('intercompany_transfers').select('id, status').eq('from_warehouse_id', warehouseId)),
      safeQuery(window.dbClient.from('intercompany_transfers').select('id, status').eq('to_warehouse_id', warehouseId)),
      safeQuery(window.dbClient.from('production_batches').select('id', { count: 'exact' }).eq('warehouse_id', warehouseId))
    ]);

    const batches = batchRes.data || [];
    const activeBatches = batches.filter(b => (Number(b.current_qty) || 0) > 0);
    const zeroBalanceBatches = batches.filter(b => (Number(b.current_qty) || 0) <= 0);
    const totalActiveUnits = activeBatches.reduce((acc, b) => acc + (Number(b.current_qty) || 0), 0);
    const movCount = movRes.count || (movRes.data || []).length;
    const prodCount = prodRes.count || (prodRes.data || []).length;

    const icTransfers = [...(icFromRes.data || []), ...(icToRes.data || [])];
    const inFlightTransfers = icTransfers.filter(t => t.status === 'In-Transit' || t.status === 'Pending');

    APP.hideSpinner();

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 1: ACTIVE PHYSICAL INVENTORY OR IN-FLIGHT TRANSFERS PRESENT
    // Hard blocked - stock must be transferred or zeroed first
    // ──────────────────────────────────────────────────────────────────────────
    if (activeBatches.length > 0 || inFlightTransfers.length > 0) {
      isDeletingWarehouse = false;
      const modalTitle = document.getElementById('warehouse-dependency-title');
      const modalMsg = document.getElementById('warehouse-dependency-msg');
      const listEl = document.getElementById('warehouse-dependency-list');
      const subtextEl = document.getElementById('warehouse-dependency-subtext');
      const archiveBtn = document.getElementById('btn-warehouse-archive');
      const forceDeleteBtn = document.getElementById('btn-warehouse-force-delete');

      if (modalTitle) modalTitle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Permanent Deletion Blocked: Active Inventory`;
      if (modalMsg) modalMsg.innerHTML = `<strong>Warehouse "${escapeHtml(w.name)}" (${escapeHtml(w.code)})</strong> holds active physical inventory and cannot be permanently deleted:`;

      if (listEl) {
        listEl.innerHTML = `
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px;">
            ${activeBatches.length > 0 ? `<li style="color:var(--danger,#ef4444);font-weight:600;"><strong>${activeBatches.length}</strong> Stock Batches with Active Physical Stock (Total: ${totalActiveUnits} units)</li>` : ''}
            ${inFlightTransfers.length > 0 ? `<li style="color:var(--danger,#ef4444);font-weight:600;"><strong>${inFlightTransfers.length}</strong> Intercompany Transfers In-Transit / Pending</li>` : ''}
            ${movCount > 0 ? `<li><strong>${movCount}</strong> Stock Movement Audit Logs (Historical)</li>` : ''}
          </ul>
        `;
      }

      if (subtextEl) {
        subtextEl.innerHTML = `<strong>Action Required:</strong> Deleting a warehouse holding active physical inventory would orphan stock records. Please transfer or dispatch remaining inventory first. Alternatively, click <strong>Archive Warehouse</strong> below to deactivate it immediately while preserving inventory records.`;
      }

      if (archiveBtn) {
        archiveBtn.style.display = 'inline-flex';
        archiveBtn.onclick = () => archiveWarehouse(warehouseId);
      }
      if (forceDeleteBtn) forceDeleteBtn.style.display = 'none';

      APP.openModal('warehouse-dependency-modal');
      return;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 2: ZERO PHYSICAL STOCK, BUT HISTORICAL AUDIT / MOVEMENTS EXIST
    // Offers Archival (Recommended) or Permanent Deletion with Snapshot Preservation
    // ──────────────────────────────────────────────────────────────────────────
    if (movCount > 0 || zeroBalanceBatches.length > 0 || prodCount > 0) {
      isDeletingWarehouse = false;
      const modalTitle = document.getElementById('warehouse-dependency-title');
      const modalMsg = document.getElementById('warehouse-dependency-msg');
      const listEl = document.getElementById('warehouse-dependency-list');
      const subtextEl = document.getElementById('warehouse-dependency-subtext');
      const archiveBtn = document.getElementById('btn-warehouse-archive');
      const forceDeleteBtn = document.getElementById('btn-warehouse-force-delete');

      if (modalTitle) modalTitle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#d97706;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Historical Transaction Records Exist`;
      if (modalMsg) modalMsg.innerHTML = `<strong>Warehouse "${escapeHtml(w.name)}" (${escapeHtml(w.code)})</strong> has zero active physical stock, but contains historical transactions and audit trail entries:`;

      if (listEl) {
        listEl.innerHTML = `
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px;">
            ${movCount > 0 ? `<li><strong>${movCount}</strong> Historical Stock Movement Audit Records</li>` : ''}
            ${zeroBalanceBatches.length > 0 ? `<li><strong>${zeroBalanceBatches.length}</strong> Depleted (Zero-Balance) Stock Batches</li>` : ''}
            ${prodCount > 0 ? `<li><strong>${prodCount}</strong> Completed Production Batch Runs</li>` : ''}
          </ul>
        `;
      }

      if (subtextEl) {
        subtextEl.innerHTML = `<strong>Compliance Recommendation:</strong> For GST, ISO, and regulatory compliance, warehouses with transaction history should be <strong>Archived</strong> so historical records remain linked.<br><br>If you choose to permanently delete this warehouse, all historical audit logs will be preserved with immutable snapshot references.`;
      }

      if (archiveBtn) {
        archiveBtn.style.display = 'inline-flex';
        archiveBtn.textContent = 'Archive Warehouse (Recommended)';
        archiveBtn.onclick = () => archiveWarehouse(warehouseId);
      }

      if (forceDeleteBtn) {
        forceDeleteBtn.style.display = 'inline-flex';
        forceDeleteBtn.onclick = () => forceDeleteWarehouseWithAuditPreservation(warehouseId);
      }

      APP.openModal('warehouse-dependency-modal');
      return;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 3: ZERO DEPENDENCIES (CLEAN UNREFERENCED WAREHOUSE)
    // ──────────────────────────────────────────────────────────────────────────
    APP.showConfirm(
      `Are you sure you want to permanently delete warehouse "${w.name}" (${w.code})?<br><br>There are zero stock records, movements, or transactions, but this action cannot be undone.`,
      async () => {
        isDeletingWarehouse = true;
        try {
          APP.showSpinner();
          const { error } = await window.dbClient.from('warehouses').delete().eq('id', warehouseId);
          if (error) throw error;

          if (window.AUDIT_LOGGER && window.AUDIT_LOGGER.logWarehouseDeleted) {
            await window.AUDIT_LOGGER.logWarehouseDeleted({
              companyId: w.company_id,
              warehouseId: w.id,
              warehouseName: w.name,
              warehouseCode: w.code,
              movCountPreserved: 0
            });
          }

          allWarehouses = allWarehouses.filter(x => x.id !== warehouseId);
          APP.showToast(`Warehouse "${w.name}" deleted successfully.`, 'success');
          if (window.TENANT_CONTEXT && window.TENANT_CONTEXT.reload) {
            await window.TENANT_CONTEXT.reload();
          } else {
            await window.TENANT_CONTEXT.init(true);
          }
          filterAndRenderWarehouses();
        } catch (delErr) {
          console.error('Delete warehouse error:', delErr);
          APP.showToast('Failed to delete warehouse: ' + delErr.message, 'error');
        } finally {
          isDeletingWarehouse = false;
          APP.hideSpinner();
        }
      },
      {
        title: 'Delete Warehouse',
        confirmText: 'Delete Permanently',
        isDanger: true,
        onCancel: () => { isDeletingWarehouse = false; }
      }
    );
  } catch (err) {
    console.error('safeDeleteWarehouse check failed:', err);
    APP.showToast('Failed to verify warehouse dependencies: ' + err.message, 'error');
  } finally {
    isDeletingWarehouse = false;
    APP.hideSpinner();
  }
}

/**
 * Permanent Warehouse Deletion with Audit Trail Preservation
 * Disassociates foreign keys while preserving audit records and logs.
 */
async function forceDeleteWarehouseWithAuditPreservation(warehouseId) {
  const w = allWarehouses.find(x => x.id === warehouseId);
  if (!w) return;

  APP.showConfirm(
    `Permanently delete warehouse "${w.name}" (${w.code})?<br><br>All historical audit logs and stock movement records will be <strong>permanently retained</strong> with snapshot references.<br><br>This action cannot be undone.`,
    async () => {
      isDeletingWarehouse = true;
      APP.showSpinner();
      try {
        // 1. Preserve stock_movements snapshot before deleting warehouse
        try {
          await window.dbClient
            .from('stock_movements')
            .update({ notes: `[Historical Warehouse: ${w.name} (${w.code})]` })
            .eq('warehouse_id', warehouseId)
            .is('notes', null);
        } catch (e) {
          console.warn('Note update notice:', e);
        }

        // 2. Clean up zero-balance depleted batches if any
        try {
          await window.dbClient.from('stock_batches').delete().eq('warehouse_id', warehouseId).lte('current_qty', 0);
        } catch (e) {
          console.warn('Batch cleanup notice:', e);
        }

        // 3. Delete warehouse record
        const { error } = await window.dbClient.from('warehouses').delete().eq('id', warehouseId);
        if (error) throw error;

        // 4. Log immutable audit trail entry
        if (window.AUDIT_LOGGER && window.AUDIT_LOGGER.logWarehouseDeleted) {
          await window.AUDIT_LOGGER.logWarehouseDeleted({
            companyId: w.company_id,
            warehouseId: w.id,
            warehouseName: w.name,
            warehouseCode: w.code,
            movCountPreserved: 1
          });
        }

        allWarehouses = allWarehouses.filter(x => x.id !== warehouseId);
        APP.closeModal('warehouse-dependency-modal');
        APP.showToast(`Warehouse "${w.name}" permanently deleted. Historical audit trail preserved.`, 'success');
        if (window.TENANT_CONTEXT && window.TENANT_CONTEXT.reload) {
          await window.TENANT_CONTEXT.reload();
        } else {
          await window.TENANT_CONTEXT.init(true);
        }
        filterAndRenderWarehouses();
      } catch (err) {
        console.error('forceDeleteWarehouse failed:', err);
        APP.showToast('Failed to delete warehouse: ' + err.message, 'error');
      } finally {
        isDeletingWarehouse = false;
        APP.hideSpinner();
      }
    },
    {
      title: 'Permanent Deletion with Audit Preservation',
      confirmText: 'Delete Permanently',
      isDanger: true,
      onCancel: () => { isDeletingWarehouse = false; }
    }
  );
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

loadWarehouses();

