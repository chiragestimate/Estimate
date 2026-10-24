/**
 * assets/js/audit-logs.js
 * Comprehensive Enterprise Audit Trail Viewer
 *
 * Visualizes immutable historical logs for:
 * - STOCK_MOVEMENT (receipts, FIFO deductions, warehouse transfers)
 * - PRODUCTION_COMPLETION (planned vs actual yields, operators)
 * - QC_DECISION (quarantine approvals, rejections, on-hold)
 * - PACKING_APPROVAL (boxes, loose units, breakage absorption)
 * - DISPATCH_POSTING (gate exit, vehicle details, commercial order)
 * - INVOICE_POSTING (taxable values, GST split, grand totals)
 * - PERMISSION_CHANGE (scoped role assignments, revocations)
 * - FINANCIAL_ADJUSTMENT (reversals, credit/debit notes)
 */

let allAuditLogs = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (window.DB && window.DB.initDB) await window.DB.initDB();
    await loadAuditLogs();
  } catch (err) {
    console.error('[AuditLogs] Initialization error:', err);
  }
});

async function loadAuditLogs() {
  const tbody = document.getElementById('audit-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2.5rem;color:var(--text-muted);"><div class="spinner" style="margin-bottom:8px;"></div>Loading enterprise audit trail...</td></tr>';
  }

  let dbLogs = [];
  try {
    if (window.dbClient) {
      // 1. Fetch from comprehensive audit_logs
      const { data: fullLogs, error: fullErr } = await window.dbClient
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);

      if (!fullErr && Array.isArray(fullLogs) && fullLogs.length > 0) {
        dbLogs = fullLogs;
      } else {
        // Fallback to rbac_audit_logs
        const { data: rbacLogs } = await window.dbClient
          .from('rbac_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (Array.isArray(rbacLogs)) {
          dbLogs = rbacLogs.map(r => ({
            id: r.id,
            created_at: r.created_at,
            actor_email: r.actor_email,
            action_category: (r.action_type && r.action_type.includes('ROLE')) ? 'PERMISSION_CHANGE' : (r.action_type && r.action_type.includes('APPROVAL')) ? 'APPROVAL_DECISION' : 'SECURITY_EVENT',
            action_name: r.action_type,
            table_name: 'user_role_assignments',
            reference_no: r.target_user || (r.details?.reference_code) || '—',
            before_values: r.details?.before || null,
            after_values: r.details?.after || r.details || null,
            metadata: r.details || null
          }));
        }
      }
    }
  } catch (err) {
    console.warn('[AuditLogs] Database query notice:', err.message);
  }

  // 2. Fetch from window.AUDIT_LOGGER in-memory / local storage buffer
  let coreLogs = [];
  if (window.AUDIT_LOGGER && typeof window.AUDIT_LOGGER.getLogs === 'function') {
    coreLogs = window.AUDIT_LOGGER.getLogs();
  }
  if ((!coreLogs || coreLogs.length === 0) && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('erp_comprehensive_audit_logs');
      if (raw) coreLogs = JSON.parse(raw);
    } catch (_) {}
  }

  // 2b. Fetch local RBAC audit logs from rbac-context buffer
  let localRbacLogs = [];
  if (typeof localStorage !== 'undefined') {
    try {
      const rawRbac = localStorage.getItem('rbac_local_audit_logs');
      if (rawRbac) {
        const parsedRbac = JSON.parse(rawRbac);
        if (Array.isArray(parsedRbac)) {
          localRbacLogs = parsedRbac.map((r, idx) => ({
            id: r.id || ('rbac_local_' + (idx + 1)),
            created_at: r.created_at || new Date().toISOString(),
            actor_email: r.actor_email || 'admin@afield.local',
            action_category: (r.action_type && r.action_type.includes('ROLE')) ? 'PERMISSION_CHANGE' : (r.action_type && r.action_type.includes('APPROVAL')) ? 'APPROVAL_DECISION' : 'SECURITY_EVENT',
            action_name: r.action_type || 'RBAC_EVENT',
            table_name: 'user_role_assignments',
            reference_no: r.target_user || (r.details?.reference_code) || (r.details?.roleCode) || '—',
            before_values: r.details?.before || null,
            after_values: r.details?.after || r.details || null,
            metadata: r.details || null
          }));
        }
      }
    } catch (_) {}
  }

  // 3. Combine and deduplicate all log sources
  const combined = [...(coreLogs || []), ...(dbLogs || []), ...(localRbacLogs || [])];
  const uniqueMap = new Map();
  combined.forEach(item => {
    if (!item || !item.created_at) return;
    const cat = item.action_category || item.action_type || 'EVENT';
    const act = item.action_name || item.action_type || '';
    const ref = item.reference_no || item.record_id || '';
    const key = `${item.created_at}_${cat}_${act}_${ref}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });

  allAuditLogs = Array.from(uniqueMap.values());
  allAuditLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  allAuditLogs.forEach((log, index) => {
    log._idx = index;
  });
  window.allAuditLogs = allAuditLogs;

  renderAuditTable(allAuditLogs);
}

function getCategoryBadge(category, actionName) {
  let badgeColor = '#6B7280';
  let catLabel = category || 'AUDIT';

  switch (category) {
    case 'STOCK_MOVEMENT':
      badgeColor = '#059669';
      catLabel = 'Stock Movement';
      break;
    case 'PRODUCTION_COMPLETION':
      badgeColor = '#2563EB';
      catLabel = 'Production';
      break;
    case 'QC_DECISION':
      badgeColor = '#D97706';
      catLabel = 'Quality Control';
      break;
    case 'PACKING_APPROVAL':
      badgeColor = '#7C3AED';
      catLabel = 'Packaging';
      break;
    case 'DISPATCH_POSTING':
      badgeColor = '#0D9488';
      catLabel = 'Commercial Dispatch';
      break;
    case 'INVOICE_POSTING':
      badgeColor = '#10B981';
      catLabel = 'Tax Billing';
      break;
    case 'PERMISSION_CHANGE':
      badgeColor = '#4F46E5';
      catLabel = 'RBAC Security';
      break;
    case 'FINANCIAL_ADJUSTMENT':
      badgeColor = '#DC2626';
      catLabel = 'Financial Reversal';
      break;
    default:
      if (String(actionName).includes('BLOCKED')) {
        badgeColor = '#EF4444';
        catLabel = 'Security Guard';
      }
      break;
  }

  return `
    <div>
      <span class="badge" style="background:${badgeColor}; color:#fff; font-weight:700; font-size:10px; text-transform:uppercase;">${catLabel}</span>
      <div style="font-size:11px; font-weight:600; color:var(--text-primary); margin-top:2px;">${(actionName || '').replace(/_/g, ' ')}</div>
    </div>
  `;
}

let auditTableEnhancer = null;

function renderAuditSlice(logs) {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;

  tbody.innerHTML = logs.map(log => {
    const timeFormatted = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';
    const actor = log.actor_email || 'system@afield.local';
    const category = log.action_category || (log.action_type?.includes('ROLE') ? 'PERMISSION_CHANGE' : 'SECURITY_EVENT');
    const action = log.action_name || log.action_type || 'EVENT';
    const refCode = log.reference_no || (log.record_id ? `#${log.record_id}` : '—');
    const tbl = log.table_name || 'general';

    // Format Before -> After summary
    let diffSummary = '';
    const b = log.before_values || {};
    const a = log.after_values || log.details || {};
    const m = log.metadata || {};

    if (category === 'STOCK_MOVEMENT' && (b.stock !== undefined || a.stock !== undefined)) {
      diffSummary = `Stock: <strong>${b.stock !== undefined ? b.stock : '—'}</strong> → <strong>${a.stock !== undefined ? a.stock : '—'}</strong> (${a.change > 0 ? '+' : ''}${a.change || ''})`;
    } else if (category === 'QC_DECISION' && a.qc_status) {
      diffSummary = `QC Status: <span class="badge badge-warning">${b.qc_status || 'Pending'}</span> → <span class="badge badge-success">${a.qc_status}</span>`;
    } else if (category === 'PRODUCTION_COMPLETION' && a.actualOutput) {
      diffSummary = `Output: <strong>${a.actualOutput}</strong> units (Yield: <strong>${a.yieldPercentage}%</strong>, Loss: ${b.plannedQty - a.actualOutput})`;
    } else if (category === 'PACKING_APPROVAL' && a.boxesPacked !== undefined) {
      diffSummary = `Packed: <strong>${a.boxesPacked} Boxes</strong> + <strong>${a.looseUnits} Loose</strong> (Total: ${a.totalUnits}, Breakage: ${a.breakageCount || 0})`;
    } else if (category === 'DISPATCH_POSTING' && m.vehicleNo) {
      diffSummary = `Dispatched: <strong>${m.boxesDispatched || 0} bx + ${m.looseDispatched || 0} ls</strong> (Vehicle: <code>${m.vehicleNo}</code>)`;
    } else if (category === 'FINANCIAL_ADJUSTMENT' && m.amount) {
      diffSummary = `Reversal of <strong>${refCode}</strong> (Amount: ${UTILS.fmtCurrency(m.amount)}. Reason: ${m.reason || 'Correction'})`;
    } else if (action && action.includes('COMPANY')) {
      const coName = m.companyName || a.companyName || b.companyName || refCode;
      const coCode = m.companyCode || a.companyCode || b.companyCode || '';
      const codeBadge = coCode && coCode !== '—' && coCode !== coName ? ` <code>(${escapeHtml(coCode)})</code>` : '';

      if (action.includes('DELETED') || a.deleted) {
        diffSummary = `Company <strong>${escapeHtml(coName)}</strong>: Status set to <span class="badge badge-danger">Deleted</span>`;
      } else if (action.includes('ARCHIVED') || a.status === 'Archived') {
        diffSummary = `Company <strong>${escapeHtml(coName)}</strong>: Status set to <span class="badge badge-warning">Archived</span>`;
      } else if (action.includes('REACTIVATED')) {
        diffSummary = `Company <strong>${escapeHtml(coName)}</strong>: Status set to <span class="badge badge-success">Active</span>`;
      } else if (action.includes('CREATED')) {
        const st = a.status || 'Active';
        diffSummary = `Company <strong>${escapeHtml(coName)}</strong>: Status set to <span class="badge badge-success">${escapeHtml(st)}</span>${codeBadge}`;
      } else if (action.includes('UPDATED')) {
        diffSummary = `Company <strong>${escapeHtml(coName)}</strong>: Details <span class="badge badge-primary">Updated</span>${codeBadge}`;
      } else if (a.status) {
        const badgeCls = a.status === 'Active' ? 'badge-success' : (a.status === 'Archived' ? 'badge-warning' : 'badge-danger');
        diffSummary = `Company <strong>${escapeHtml(coName)}</strong>: Status set to <span class="badge ${badgeCls}">${escapeHtml(a.status)}</span>`;
      } else {
        const cleanAct = action.replace(/^COMPANY_/, '').replace(/_/g, ' ');
        diffSummary = `Company <strong>${escapeHtml(coName)}</strong>: <span class="badge badge-primary">${escapeHtml(cleanAct)}</span>${codeBadge}`;
      }
    } else if (action && action.includes('WAREHOUSE')) {
      const whName = m.warehouseName || a.warehouseName || b.warehouseName || refCode;
      const whCode = m.warehouseCode || a.warehouseCode || b.warehouseCode || '';
      const codeBadge = whCode && whCode !== '—' && whCode !== whName ? ` <code>(${escapeHtml(whCode)})</code>` : '';

      if (action.includes('DELETED') || a.deleted) {
        diffSummary = `Warehouse <strong>${escapeHtml(whName)}</strong>: Status set to <span class="badge badge-danger">Deleted</span>`;
      } else if (action.includes('ARCHIVED') || a.status === 'Archived') {
        diffSummary = `Warehouse <strong>${escapeHtml(whName)}</strong>: Status set to <span class="badge badge-warning">Archived</span>`;
      } else if (action.includes('REACTIVATED')) {
        diffSummary = `Warehouse <strong>${escapeHtml(whName)}</strong>: Status set to <span class="badge badge-success">Active</span>`;
      } else if (action.includes('CREATED')) {
        const st = a.status || 'Active';
        diffSummary = `Warehouse <strong>${escapeHtml(whName)}</strong>: Status set to <span class="badge badge-success">${escapeHtml(st)}</span>${codeBadge}`;
      } else if (action.includes('UPDATED')) {
        diffSummary = `Warehouse <strong>${escapeHtml(whName)}</strong>: Details <span class="badge badge-primary">Updated</span>${codeBadge}`;
      } else if (a.status) {
        const badgeCls = a.status === 'Active' ? 'badge-success' : (a.status === 'Archived' ? 'badge-warning' : 'badge-danger');
        diffSummary = `Warehouse <strong>${escapeHtml(whName)}</strong>: Status set to <span class="badge ${badgeCls}">${escapeHtml(a.status)}</span>`;
      } else {
        const cleanAct = action.replace(/^WAREHOUSE_/, '').replace(/_/g, ' ');
        diffSummary = `Warehouse <strong>${escapeHtml(whName)}</strong>: <span class="badge badge-primary">${escapeHtml(cleanAct)}</span>${codeBadge}`;
      }
    } else if (action && action.includes('BRANCH')) {
      const brName = m.branchName || a.branchName || b.branchName || refCode;
      const brCode = m.branchCode || a.branchCode || b.branchCode || '';
      const codeBadge = brCode && brCode !== '—' && brCode !== brName ? ` <code>(${escapeHtml(brCode)})</code>` : '';

      if (action.includes('DELETED') || a.deleted) {
        diffSummary = `Branch <strong>${escapeHtml(brName)}</strong>: Status set to <span class="badge badge-danger">Deleted</span>`;
      } else if (action.includes('CREATED')) {
        const st = a.status || 'Active';
        diffSummary = `Branch <strong>${escapeHtml(brName)}</strong>: Status set to <span class="badge badge-success">${escapeHtml(st)}</span>${codeBadge}`;
      } else if (action.includes('UPDATED')) {
        diffSummary = `Branch <strong>${escapeHtml(brName)}</strong>: Details <span class="badge badge-primary">Updated</span>${codeBadge}`;
      } else if (a.status) {
        const badgeCls = a.status === 'Active' ? 'badge-success' : (a.status === 'Archived' ? 'badge-warning' : 'badge-danger');
        diffSummary = `Branch <strong>${escapeHtml(brName)}</strong>: Status set to <span class="badge ${badgeCls}">${escapeHtml(a.status)}</span>`;
      } else {
        const cleanAct = action.replace(/^BRANCH_/, '').replace(/_/g, ' ');
        diffSummary = `Branch <strong>${escapeHtml(brName)}</strong>: <span class="badge badge-primary">${escapeHtml(cleanAct)}</span>${codeBadge}`;
      }
    } else if (category === 'PERMISSION_CHANGE') {
      diffSummary = `Role: <span class="badge badge-gray">${b.role || 'None'}</span> → <span class="badge badge-primary">${a.role || 'Revoked'}</span>`;
    } else {
      const summaryStr = JSON.stringify(a || b);
      diffSummary = summaryStr.length > 70 ? summaryStr.slice(0, 70) + '...' : summaryStr;
    }

    const payloadObj = { before: b, after: a, metadata: m };
    const safeDetailsAttr = encodeURIComponent(JSON.stringify(payloadObj, null, 2));

    return `
      <tr class="audit-desktop-row">
        <td>
          ${getCategoryBadge(category, action)}
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;display:flex;align-items:center;gap:4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;opacity:0.6;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${timeFormatted}
          </div>
        </td>
        <td>
          <code style="font-size:12px;font-weight:600;color:var(--text-primary);background:rgba(0,0,0,0.03);padding:2px 6px;border-radius:4px;">${escapeHtml(actor)}</code>
        </td>
        <td>
          <div style="font-weight:700;color:var(--text-primary);font-size:13px;">${escapeHtml(refCode)}</div>
          <div style="margin-top:3px;"><span class="badge badge-gray" style="font-size:9.5px;text-transform:uppercase;letter-spacing:0.03em;">${tbl}</span></div>
        </td>
        <td>
          <div style="font-size:12.5px;line-height:1.45;color:var(--text-primary);word-break:break-word;">
            ${diffSummary}
          </div>
        </td>
        <td style="text-align:right;">
          <button class="btn btn-sm btn-secondary" onclick="openAuditDiffModal(${log._idx})" style="white-space:nowrap;padding:4px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            View Diff
          </button>
        </td>
      </tr>
      <tr class="audit-mobile-row">
        <td class="audit-mobile-cell" colspan="5">
          <div class="audit-mobile-card">
            <div class="audit-mobile-top">
              ${getCategoryBadge(category, action)}
              <span class="audit-mobile-time">${timeFormatted}</span>
            </div>
            <div class="audit-mobile-meta">
              <div class="audit-meta-item">
                <span class="audit-meta-label">Actor</span>
                <span class="audit-actor-code" title="${escapeHtml(actor)}">${escapeHtml(actor)}</span>
              </div>
              <div class="audit-meta-item">
                <span class="audit-meta-label">Target / Record</span>
                <div class="audit-ref-row">
                  <span class="audit-ref-code">${escapeHtml(refCode)}</span>
                  <span class="audit-table-tag">${escapeHtml(tbl)}</span>
                </div>
              </div>
            </div>
            <div class="audit-mobile-diff">
              <div class="audit-meta-label" style="margin-bottom:4px;">Audit Trail & Changes</div>
              <div>${diffSummary}</div>
            </div>
            <div class="audit-mobile-footer">
              <button class="btn btn-sm btn-secondary audit-diff-btn" onclick="openAuditDiffModal(${log._idx})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                View Full Diff
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAuditTable(logs) {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;

  const totalInfo = document.getElementById('audit-total-info');
  if (totalInfo) {
    totalInfo.textContent = allAuditLogs.length === 0
      ? '0 audit events recorded'
      : `Showing ${logs.length} of ${allAuditLogs.length} audit event${logs.length !== 1 ? 's' : ''}`;
  }

  if (!logs || logs.length === 0) {
    const emptyMsg = allAuditLogs.length === 0
      ? 'No audit events recorded yet. Administrative, inventory, and transaction events will be logged here automatically.'
      : 'No audit events match the current filter criteria.';
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 2.5rem;">${emptyMsg}</td></tr>`;
    const pag = document.querySelector('#audit-table-wrap .pagination');
    if (pag) pag.style.display = 'none';
    return;
  }

  if (window.TableEnhancer) {
    if (!auditTableEnhancer) {
      auditTableEnhancer = new window.TableEnhancer({
        tableId: 'audit-table',
        pageSize: 25,
        defaultSortKey: 'id',
        defaultSortOrder: 'desc',
        onRender: (pageSlice) => renderAuditSlice(pageSlice)
      });
    }
    auditTableEnhancer.setData(logs);
    return;
  }

  renderAuditSlice(logs.slice(0, 50));
}

function filterAuditTableReal() {
  const searchTerm = (document.getElementById('search-audit')?.value || '').toLowerCase().trim();
  const filterCat = document.getElementById('filter-action-type')?.value || '';
  const filterDate = document.getElementById('filter-audit-date')?.value || '';

  const clearBtn = document.getElementById('btn-clear-audit-filters');
  if (clearBtn) {
    clearBtn.style.display = (searchTerm || filterCat || filterDate) ? 'inline-flex' : 'none';
  }

  let filtered = allAuditLogs;

  if (filterCat) {
    filtered = filtered.filter(log => {
      const cat = log.action_category || (log.action_type?.includes('ROLE') ? 'PERMISSION_CHANGE' : 'SECURITY_EVENT');
      const act = log.action_name || log.action_type || '';
      return cat === filterCat || act === filterCat || act.startsWith(filterCat);
    });
  }

  if (filterDate) {
    filtered = filtered.filter(log => {
      if (!log.created_at) return false;
      return log.created_at.startsWith(filterDate);
    });
  }

  if (searchTerm) {
    filtered = filtered.filter(log => {
      const str = `${log.actor_email || ''} ${log.action_category || ''} ${log.action_name || ''} ${log.action_type || ''} ${log.reference_no || ''} ${log.table_name || ''} ${JSON.stringify(log.before_values || {})} ${JSON.stringify(log.after_values || {})} ${JSON.stringify(log.metadata || {})}`.toLowerCase();
      return str.includes(searchTerm);
    });
  }

  renderAuditTable(filtered);
}

const filterAuditTable = (typeof UTILS !== 'undefined' && UTILS.debounce)
  ? UTILS.debounce(filterAuditTableReal, 250)
  : filterAuditTableReal;

function clearAuditFilters() {
  const searchInput = document.getElementById('search-audit');
  const catSelect = document.getElementById('filter-action-type');
  const dateInput = document.getElementById('filter-audit-date');
  if (searchInput) searchInput.value = '';
  if (catSelect) catSelect.value = '';
  if (dateInput) dateInput.value = '';
  filterAuditTableReal();
}

let isRefreshingLogs = false;
async function refreshAuditLogs() {
  if (isRefreshingLogs) return;
  isRefreshingLogs = true;

  const btn = document.getElementById('btn-refresh-logs');
  const icon = document.getElementById('refresh-logs-icon');
  const text = document.getElementById('refresh-logs-text');

  if (btn) btn.disabled = true;
  if (text) text.textContent = 'Refreshing...';
  if (icon) icon.style.transform = 'rotate(360deg)';

  try {
    await loadAuditLogs();
    filterAuditTableReal();
    if (window.APP && window.APP.showToast) {
      window.APP.showToast('Audit trail refreshed successfully', 'success', 1800);
    }
  } catch (err) {
    console.error('Refresh logs error:', err);
    if (window.APP && window.APP.showToast) {
      window.APP.showToast('Failed to refresh logs: ' + err.message, 'error');
    }
  } finally {
    setTimeout(() => {
      if (btn) btn.disabled = false;
      if (text) text.textContent = 'Refresh Logs';
      if (icon) icon.style.transform = 'none';
      isRefreshingLogs = false;
    }, 400);
  }
}

function openAuditDiffModal(idx) {
  const log = allAuditLogs.find(l => l._idx === idx) || allAuditLogs[idx];
  if (!log) {
    console.warn('Audit log not found at index:', idx);
    return;
  }

  const payload = {
    before: log.before_values || {},
    after: log.after_values || log.details || {},
    metadata: log.metadata || {}
  };
  const title = (log.action_name || log.action_type || 'Event').replace(/_/g, ' ');

  showAuditModal(payload, title, log);
}

function formatAuditKey(key) {
  if (!key) return '';
  const knownKeys = {
    status: 'Record Status',
    reversal_entry_no: 'Reversal Entry #',
    qc_status: 'QC Status',
    is_quarantine: 'Quarantine Status',
    actualOutput: 'Actual Production Output',
    plannedQty: 'Planned Quantity',
    yieldPercentage: 'Yield Rate',
    boxesPacked: 'Boxes Packed',
    looseUnits: 'Loose Units',
    totalUnits: 'Total Packed Units',
    breakageCount: 'Breakage / Rejects',
    warehouse: 'Warehouse / Godown',
    warehouse_id: 'Warehouse ID',
    stock: 'Stock Balance',
    change: 'Stock Adjustment',
    role: 'Assigned Role',
    scope: 'Permission Scope',
    company_id: 'Company ID',
    vehicleNo: 'Vehicle Number',
    boxesDispatched: 'Boxes Dispatched',
    looseDispatched: 'Loose Units Dispatched',
    orderNo: 'Order Reference',
    productName: 'Product Name',
    operator: 'Machine Operator',
    inspector: 'QC Inspector',
    testNotes: 'QC Lab Test Notes',
    itemName: 'Item Description',
    notes: 'Operational Notes',
    targetUser: 'Target User',
    amount: 'Transaction Amount',
    reason: 'Justification / Reason',
    sku: 'SKU Code',
    approver: 'Approving Authority',
    batch_no: 'Batch Number',
    lot_no: 'Lot Number',
    expiry_date: 'Expiry Date',
    mfg_date: 'Manufacturing Date',
    mrp: 'Maximum Retail Price (MRP)',
    rate: 'Billing Rate',
    tax_amount: 'Tax Amount',
    total_amount: 'Total Amount',
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    lr_no: 'Lorry Receipt (LR) #',
    transporter: 'Transporter Name',
    remarks: 'Audit Remarks'
  };

  if (knownKeys[key]) return knownKeys[key];

  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '')
    .join(' ')
    .trim();
}

function formatAuditValue(key, val) {
  if (val === undefined || val === null) {
    return `<span style="color:var(--text-muted);font-style:italic;">None</span>`;
  }
  if (typeof val === 'boolean') {
    return val 
      ? `<span class="badge badge-success" style="font-size:11px;font-weight:700;">YES</span>` 
      : `<span class="badge badge-secondary" style="font-size:11px;font-weight:700;">NO</span>`;
  }
  if (typeof val === 'number') {
    const k = String(key).toLowerCase();
    if (k.includes('amount') || k.includes('price') || k.includes('rate') || k.includes('tax') || k.includes('cgst') || k.includes('sgst') || k.includes('igst') || k === 'mrp') {
      return `<strong>₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>`;
    }
    if (k.includes('percent') || k.includes('yield')) {
      return `<strong>${val}%</strong>`;
    }
    if (k === 'change') {
      const isPos = val > 0;
      return `<span style="font-weight:700;color:${isPos ? '#059669' : '#DC2626'};">${isPos ? '+' : ''}${val.toLocaleString('en-IN')}</span>`;
    }
    return `<strong>${val.toLocaleString('en-IN')}</strong>`;
  }
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      if (val.length === 0) return `<span style="color:var(--text-muted);font-style:italic;">Empty</span>`;
      return `<div style="display:flex;flex-wrap:wrap;gap:4px;">${val.map(item => `<span class="badge badge-gray">${escapeHtml(typeof item === 'object' ? JSON.stringify(item) : String(item))}</span>`).join('')}</div>`;
    }
    const entries = Object.entries(val);
    if (entries.length === 0) return `<span style="color:var(--text-muted);font-style:italic;">Empty</span>`;
    return `<div style="display:flex;flex-wrap:wrap;gap:4px;">${entries.map(([k, v]) => `<span class="badge badge-gray"><strong>${escapeHtml(formatAuditKey(k))}:</strong>&nbsp;${escapeHtml(String(v))}</span>`).join('')}</div>`;
  }

  const str = String(val).trim();
  const lower = str.toLowerCase();

  // Status badges
  if (lower === 'posted' || lower === 'approved' || lower === 'completed' || lower === 'active' || lower === 'packing approved') {
    return `<span class="badge badge-success" style="font-size:11.5px;padding:3px 8px;font-weight:700;">${escapeHtml(str)}</span>`;
  }
  if (lower === 'reversed' || lower === 'cancelled' || lower === 'rejected' || lower === 'inactive' || lower === 'blocked' || lower === 'deleted') {
    return `<span class="badge badge-danger" style="font-size:11.5px;padding:3px 8px;font-weight:700;">${escapeHtml(str)}</span>`;
  }
  if (lower === 'pending' || lower === 'in production' || lower === 'packing in progress' || lower === 'draft' || lower === 'archived') {
    return `<span class="badge badge-warning" style="font-size:11.5px;padding:3px 8px;font-weight:700;">${escapeHtml(str)}</span>`;
  }
  if (lower.includes('quarantine')) {
    return `<span class="badge badge-warning" style="font-size:11.5px;padding:3px 8px;font-weight:700;">${escapeHtml(str)}</span>`;
  }

  // Ref codes
  if (/^[A-Z0-9\-_]{4,}$/i.test(str) && (key.toLowerCase().includes('no') || key.toLowerCase().includes('id') || key.toLowerCase().includes('code') || key.toLowerCase().includes('sku') || key.toLowerCase().includes('entry') || key.toLowerCase().includes('ref'))) {
    return `<code class="audit-code-pill" style="font-size:11.5px;font-weight:700;padding:2px 6px;background:rgba(0,0,0,0.04);border-radius:4px;color:var(--text-primary);border:1px solid var(--border);display:inline-block;white-space:nowrap;">${escapeHtml(str)}</code>`;
  }

  return escapeHtml(str);
}

function showAuditModal(parsed, title, log = null) {
  try {
    parsed = parsed || {};
    const before = parsed.before || {};
    const after = parsed.after || {};
    const metadata = parsed.metadata || {};

    const hasBefore = Object.keys(before).length > 0;
    const hasAfter = Object.keys(after).length > 0;
    const hasMeta = Object.keys(metadata).length > 0;

    // Extract context details from log if present
    const actor = log?.actor_email || 'system@afield.local';
    const refCode = log?.reference_no || (log?.record_id ? `#${log.record_id}` : '—');
    const tbl = log?.table_name || 'general';
    const category = log?.action_category || (log?.action_type?.includes('ROLE') ? 'PERMISSION_CHANGE' : 'SECURITY_EVENT');
    const actionName = (log?.action_name || log?.action_type || title || 'Event').replace(/_/g, ' ');
    const timeFormatted = log?.created_at ? new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Logged Record';

    const titleEl = document.getElementById('audit-modal-title');
    if (titleEl) {
      titleEl.textContent = `Audit Record: ${actionName}`;
    }

    const contentEl = document.getElementById('audit-modal-content');
    if (contentEl) {
      let catBadgeColor = '#6B7280';
      let catLabel = category;
      switch (category) {
        case 'STOCK_MOVEMENT': catBadgeColor = '#059669'; catLabel = 'Stock Movement'; break;
        case 'PRODUCTION_COMPLETION': catBadgeColor = '#2563EB'; catLabel = 'Production'; break;
        case 'QC_DECISION': catBadgeColor = '#D97706'; catLabel = 'Quality Control'; break;
        case 'PACKING_APPROVAL': catBadgeColor = '#7C3AED'; catLabel = 'Packaging'; break;
        case 'DISPATCH_POSTING': catBadgeColor = '#0D9488'; catLabel = 'Commercial Dispatch'; break;
        case 'INVOICE_POSTING': catBadgeColor = '#10B981'; catLabel = 'Tax Billing'; break;
        case 'PERMISSION_CHANGE': catBadgeColor = '#4F46E5'; catLabel = 'RBAC Security'; break;
        case 'FINANCIAL_ADJUSTMENT': catBadgeColor = '#DC2626'; catLabel = 'Financial Reversal'; break;
        default:
          if (String(actionName).includes('BLOCKED')) {
            catBadgeColor = '#EF4444';
            catLabel = 'Security Guard';
          }
          break;
      }

      // Collect all keys to build Field-by-Field changes
      const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
      let changesContentHtml = '';

      if (allKeys.length === 0) {
        changesContentHtml = `
          <div style="padding:14px;background:rgba(0,0,0,0.02);border:1px dashed var(--border);border-radius:8px;text-align:center;color:var(--text-muted);font-size:12px;margin-bottom:14px;">
            Action event logged with operational parameters. No direct database field-level mutations recorded.
          </div>
        `;
      } else {
        const desktopRows = allKeys.map(k => {
          const inB = k in before;
          const inA = k in after;
          const bVal = before[k];
          const aVal = after[k];
          const isIdentical = inB && inA && JSON.stringify(bVal) === JSON.stringify(aVal);

          let badgeHtml = '';
          if (!inB && inA) {
            badgeHtml = '<span class="audit-change-badge add">Added</span>';
          } else if (inB && !inA) {
            badgeHtml = '<span class="audit-change-badge del">Removed</span>';
          } else if (isIdentical) {
            badgeHtml = '<span class="audit-change-badge same">Unchanged</span>';
          } else {
            badgeHtml = '<span class="audit-change-badge mod">Modified</span>';
          }

          return `
            <tr>
              <td>
                <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(formatAuditKey(k))}</div>
                <code style="font-size:10.5px;color:var(--text-muted);opacity:0.8;">${escapeHtml(k)}</code>
              </td>
              <td>
                ${inB ? formatAuditValue(k, bVal) : '<span style="color:var(--text-muted);font-style:italic;">(None / Not Set)</span>'}
              </td>
              <td style="text-align:center;color:var(--text-muted);font-weight:700;font-size:14px;">→</td>
              <td>
                ${inA ? formatAuditValue(k, aVal) : '<span style="color:var(--text-muted);font-style:italic;">(Removed)</span>'}
              </td>
              <td style="text-align:right;">
                ${badgeHtml}
              </td>
            </tr>
          `;
        }).join('');

        const mobileCards = allKeys.map(k => {
          const inB = k in before;
          const inA = k in after;
          const bVal = before[k];
          const aVal = after[k];
          const isIdentical = inB && inA && JSON.stringify(bVal) === JSON.stringify(aVal);

          let badgeHtml = '';
          if (!inB && inA) {
            badgeHtml = '<span class="audit-change-badge add">Added</span>';
          } else if (inB && !inA) {
            badgeHtml = '<span class="audit-change-badge del">Removed</span>';
          } else if (isIdentical) {
            badgeHtml = '<span class="audit-change-badge same">Unchanged</span>';
          } else {
            badgeHtml = '<span class="audit-change-badge mod">Modified</span>';
          }

          return `
            <div class="audit-mobile-change-card">
              <div class="audit-mobile-change-header">
                <div>
                  <div class="audit-mobile-field-name">${escapeHtml(formatAuditKey(k))}</div>
                  <code class="audit-mobile-field-slug">${escapeHtml(k)}</code>
                </div>
                <div>${badgeHtml}</div>
              </div>
              <div class="audit-mobile-change-body">
                <div class="audit-mobile-val-box before">
                  <span class="audit-mobile-val-label">Previous State (Before)</span>
                  <div class="audit-mobile-val-content">
                    ${inB ? formatAuditValue(k, bVal) : '<span style="color:var(--text-muted);font-style:italic;">(None / Not Set)</span>'}
                  </div>
                </div>
                <div class="audit-mobile-val-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
                <div class="audit-mobile-val-box after">
                  <span class="audit-mobile-val-label">Applied State (After)</span>
                  <div class="audit-mobile-val-content">
                    ${inA ? formatAuditValue(k, aVal) : '<span style="color:var(--text-muted);font-style:italic;">(Removed)</span>'}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        changesContentHtml = `
          <!-- Desktop/Laptop 5-Column Table -->
          <div class="audit-desktop-table-wrap">
            <table class="audit-changes-table">
              <thead>
                <tr>
                  <th style="width:26%;">Field / Attribute</th>
                  <th style="width:31%;">Previous State (Before)</th>
                  <th style="width:4%;text-align:center;">&nbsp;</th>
                  <th style="width:31%;">Applied State (After)</th>
                  <th style="width:8%;text-align:right;">Change</th>
                </tr>
              </thead>
              <tbody>
                ${desktopRows}
              </tbody>
            </table>
          </div>

          <!-- Mobile Non-Cutting Adaptive Change Cards -->
          <div class="audit-mobile-cards-wrap">
            ${mobileCards}
          </div>
        `;
      }

      // Build Side-by-side key-val lists
      const beforeListHtml = hasBefore ? `
        <div class="audit-keyval-list">
          ${Object.entries(before).map(([k, v]) => `
            <div class="audit-keyval-item">
              <span class="audit-keyval-key">${escapeHtml(formatAuditKey(k))}</span>
              <span class="audit-keyval-val">${formatAuditValue(k, v)}</span>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="padding:16px 12px;text-align:center;color:var(--text-muted);font-size:12px;font-style:italic;">
          Initial Creation • No prior state recorded
        </div>
      `;

      const afterListHtml = hasAfter ? `
        <div class="audit-keyval-list">
          ${Object.entries(after).map(([k, v]) => `
            <div class="audit-keyval-item">
              <span class="audit-keyval-key">${escapeHtml(formatAuditKey(k))}</span>
              <span class="audit-keyval-val">${formatAuditValue(k, v)}</span>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="padding:16px 12px;text-align:center;color:var(--text-muted);font-size:12px;font-style:italic;">
          Record Deleted / State Cleared
        </div>
      `;

      // Build Operational Metadata section
      let metaSectionHtml = '';
      if (hasMeta) {
        metaSectionHtml = `
          <div style="background:rgba(0,0,0,0.02);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-top:14px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Operational Metadata & Business Context
            </div>
            <div class="audit-meta-cards-grid">
              ${Object.entries(metadata).map(([k, v]) => `
                <div class="audit-meta-card">
                  <div class="audit-meta-card-label">${escapeHtml(formatAuditKey(k))}</div>
                  <div class="audit-meta-card-val">${formatAuditValue(k, v)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      contentEl.innerHTML = `
        <!-- Top Audit Record Meta Header -->
        <div class="audit-meta-header-card">
          <div>
            <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px;">Audit Category & Event</span>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span class="badge" style="background:${catBadgeColor};color:#fff;font-weight:700;font-size:10.5px;text-transform:uppercase;">${catLabel}</span>
              <span style="font-weight:700;font-size:12px;color:var(--text-primary);">${escapeHtml(actionName)}</span>
            </div>
          </div>
          <div>
            <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px;">Affected Record / Table</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <code style="font-size:12.5px;font-weight:700;color:var(--text-primary);">${escapeHtml(refCode)}</code>
              <span class="badge badge-gray" style="font-size:9.5px;text-transform:uppercase;">${escapeHtml(tbl)}</span>
            </div>
          </div>
          <div>
            <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px;">Actor Account</span>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:5px;word-break:break-all;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--text-muted);flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <code>${escapeHtml(actor)}</code>
            </div>
          </div>
          <div>
            <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px;">Timestamp (Logged)</span>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:5px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--text-muted);flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${timeFormatted}
            </div>
          </div>
        </div>

        <!-- VISUAL FIELD MUTATIONS -->
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Field-by-Field Value Mutations
          </div>
          ${changesContentHtml}
        </div>

        <!-- Side-by-Side Detailed State Breakdown -->
        <div class="audit-diff-grid">
          <div class="audit-diff-box before">
            <div class="audit-diff-header">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#DC2626;"></span>
              Previous State (Before)
            </div>
            ${beforeListHtml}
          </div>
          <div class="audit-diff-box after">
            <div class="audit-diff-header">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#059669;"></span>
              Applied State (After)
            </div>
            ${afterListHtml}
          </div>
        </div>

        <!-- Operational Metadata -->
        ${metaSectionHtml}
      `;
    }

    // Open modal via APP or fallback
    if (window.APP && typeof window.APP.openModal === 'function') {
      window.APP.openModal('audit-detail-modal');
    } else {
      const modal = document.getElementById('audit-detail-modal');
      if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    }
  } catch (err) {
    console.error('showAuditModal error:', err);
  }
}

function viewAuditDetails(encodedOrIdx, title) {
  if (typeof encodedOrIdx === 'number' || (typeof encodedOrIdx === 'string' && !isNaN(Number(encodedOrIdx)) && encodedOrIdx.trim() !== '')) {
    return openAuditDiffModal(Number(encodedOrIdx));
  }
  try {
    const raw = typeof encodedOrIdx === 'string' ? decodeURIComponent(encodedOrIdx) : encodedOrIdx;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    showAuditModal(parsed, title);
  } catch (err) {
    console.error('viewAuditDetails error:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function clearAuditTrail() {
  APP.showConfirm(
    'Are you sure you want to clear the audit trail?<br><br>All locally recorded audit events will be wiped to give you a clean slate for testing.',
    () => {
      if (window.AUDIT_LOGGER && window.AUDIT_LOGGER.clearMemoryBuffer) {
        window.AUDIT_LOGGER.clearMemoryBuffer();
      }
      try {
        localStorage.removeItem('erp_comprehensive_audit_logs');
        localStorage.removeItem('rbac_local_audit_logs');
      } catch (_) {}
      allAuditLogs = [];
      renderAuditTable([]);
      APP.showToast('Audit trail cleared successfully.', 'success');
    },
    {
      title: 'Clear Audit Trail',
      confirmText: 'Clear Logs',
      isDanger: true
    }
  );
}

window.clearAuditTrail = clearAuditTrail;
window.clearAuditFilters = clearAuditFilters;
window.loadAuditLogs = loadAuditLogs;
window.filterAuditTable = filterAuditTable;
window.viewAuditDetails = viewAuditDetails;
window.openAuditDiffModal = openAuditDiffModal;
window.showAuditModal = showAuditModal;
window.formatAuditKey = formatAuditKey;
window.formatAuditValue = formatAuditValue;
