/**
 * assets/js/user-roles.js
 * User Roles & Permissions Management Logic
 */

let allAssignments = [];
let allCompanies = [];
let allBranches = [];
let allWarehouses = [];
let allApprovalRequests = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    loadRolesCatalog();
    updateStats();
    if (window.DB && window.DB.initDB) await window.DB.initDB();
    await loadInitialData();
  } catch (err) {
    console.error('[UserRoles] Initialization error:', err);
  }
});

const ROLES_STORAGE_KEY = 'erp_user_role_assignments';

const DEFAULT_ROLE_ASSIGNMENTS = [];

const CUSTOM_ROLES_STORAGE_KEY = 'erp_custom_roles';

const BASE_SYSTEM_ROLES = [
  { code: 'super_admin', name: 'Software Super Admin', domain: 'Global System Administration & Multi-Company Management', scope: 'Global / All Modules', accessLevel: 'Full System Access', icon: 'shield', color: '#0C3925', is_system: true },
  { code: 'company_owner', name: 'Company Owner / Director', domain: 'Corporate Governance, Executive Approval & Financial Oversight', scope: 'Company-Wide', accessLevel: 'Executive Access', icon: 'briefcase', color: '#0C3925', is_system: true },
  { code: 'production_manager', name: 'Production Manager', domain: 'Batch Formulations, Manufacturing Work Orders & BOM Scheduling', scope: 'Plant & Production', accessLevel: 'Operational & Approvals', icon: 'settings', color: '#0C3925', is_system: true },
  { code: 'factory_operator', name: 'Factory Operator', domain: 'Shop Floor Operations, Shift Logs & Batch Material Consumption', scope: 'Shop Floor & Shifts', accessLevel: 'Data Entry & Logs', icon: 'tool', color: '#0C3925', is_system: true },
  { code: 'godown_operator', name: 'Packaging / Godown Operator', domain: 'Finished Goods Packaging, SKU Boxing & Storage Movements', scope: 'Godown & Dispatch', accessLevel: 'Packaging & Warehouse', icon: 'package', color: '#0C3925', is_system: true },
  { code: 'qc_officer', name: 'QC Officer', domain: 'Quality Testing, Lab Inspection & Quarantine Batch Release', scope: 'Lab & QC Division', accessLevel: 'Inspections & Approvals', icon: 'check-circle', color: '#0C3925', is_system: true },
  { code: 'accountant', name: 'Accountant', domain: 'Accounts Ledger, Invoices, Vendor Purchases, Expenses & GST Reports', scope: 'Finance & Accounts', accessLevel: 'Financial Ledgers', icon: 'dollar-sign', color: '#0C3925', is_system: true },
  { code: 'store_manager', name: 'Inventory / Store Manager', domain: 'Raw Material Inward, Warehouse Storage Points & Minimum Stock Alerts', scope: 'Warehouses & Stores', accessLevel: 'Stock Management', icon: 'archive', color: '#0C3925', is_system: true },
  { code: 'sales_executive', name: 'Sales / Dispatch Executive', domain: 'Customer Sales Orders, Dispatch Gate Passes & Logistics Delivery', scope: 'Commercial & Sales', accessLevel: 'Orders & Dispatches', icon: 'truck', color: '#0C3925', is_system: true },
  { code: 'viewer_auditor', name: 'Viewer / Auditor', domain: 'Financial & Operational Compliance, Audit Logs & Business Reports', scope: 'Auditing & Compliance', accessLevel: 'Read-Only Access', icon: 'eye', color: '#0C3925', is_system: true }
];

const DELETED_ROLES_STORAGE_KEY = 'erp_deleted_roles';
const UPDATED_ROLES_STORAGE_KEY = 'erp_updated_roles';

let SYSTEM_ROLES_CATALOG = [...BASE_SYSTEM_ROLES];

function safeEscape(str) {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  if (typeof UTILS !== 'undefined' && UTILS.escapeHtml) return UTILS.escapeHtml(str);
  return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function loadRolesCatalog() {
  let deleted = [];
  try {
    const raw = localStorage.getItem(DELETED_ROLES_STORAGE_KEY);
    if (raw) deleted = JSON.parse(raw);
  } catch (e) {}

  // Protection & Auto-Heal: Root 'super_admin' can NEVER be deleted
  if (deleted.includes('super_admin')) {
    deleted = deleted.filter(c => c !== 'super_admin');
    try { localStorage.setItem(DELETED_ROLES_STORAGE_KEY, JSON.stringify(deleted)); } catch (e) {}
  }

  let custom = [];
  try {
    const raw = localStorage.getItem(CUSTOM_ROLES_STORAGE_KEY);
    if (raw) custom = JSON.parse(raw);
  } catch (e) {}

  let updated = {};
  try {
    const raw = localStorage.getItem(UPDATED_ROLES_STORAGE_KEY);
    if (raw) updated = JSON.parse(raw);
  } catch (e) {}

  SYSTEM_ROLES_CATALOG = BASE_SYSTEM_ROLES
    .filter(r => !deleted.includes(r.code))
    .map(r => updated[r.code] ? { ...r, ...updated[r.code] } : r);

  // If user accidentally deleted all roles or got locked out, auto-heal
  if (SYSTEM_ROLES_CATALOG.length === 0) {
    try { localStorage.removeItem(DELETED_ROLES_STORAGE_KEY); } catch (e) {}
    SYSTEM_ROLES_CATALOG = [...BASE_SYSTEM_ROLES];
  }

  if (Array.isArray(custom)) {
    custom.forEach(cr => {
      if (!deleted.includes(cr.code) && !SYSTEM_ROLES_CATALOG.some(r => r.code === cr.code)) {
        SYSTEM_ROLES_CATALOG.push({
          ...cr,
          ...(updated[cr.code] || {}),
          color: '#0C3925',
          is_system: false
        });
      }
    });
  }
}

window.restoreDefaultRoles = function() {
  try {
    localStorage.removeItem(DELETED_ROLES_STORAGE_KEY);
    localStorage.removeItem(CUSTOM_ROLES_STORAGE_KEY);
    localStorage.removeItem(UPDATED_ROLES_STORAGE_KEY);
    localStorage.setItem('erp_active_role', 'super_admin');
    localStorage.setItem('erp_active_role_override', 'super_admin');
  } catch (e) {}
  loadRolesCatalog();
  if (window.RBAC && window.RBAC.reloadRoles) {
    window.RBAC.reloadRoles();
  }
  updateStats();
  renderRolesTable();
  if (typeof APP !== 'undefined' && APP.showToast) {
    APP.showToast('All 10 standard system roles and administrator permissions have been successfully restored!', 'success');
  }
};

async function loadInitialData() {
  try {
    loadRolesCatalog();
    const [compRes, brRes, whRes, assignRes, reqRes, rolesRes] = await Promise.all([
      window.dbClient.from('companies').select('*').order('id'),
      window.dbClient.from('branches').select('*').order('id'),
      window.dbClient.from('warehouses').select('*').order('id'),
      window.dbClient.from('user_role_assignments').select('*, roles(*)').order('id', { ascending: false }),
      window.dbClient.from('approval_requests').select('*').order('id', { ascending: false }),
      window.dbClient ? window.dbClient.from('roles').select('*').order('id') : Promise.resolve({ data: [] })
    ]);

    allCompanies = compRes.data || [
      { id: 1, name: 'Afield Crop Care', code: 'ACC' },
      { id: 2, name: 'Company A (Agro Retail)', code: 'CO-A' },
      { id: 3, name: 'Company B (Crop Solutions)', code: 'CO-B' },
      { id: 4, name: 'Company C (Kisan Kendra)', code: 'CO-C' }
    ];

    allBranches = brRes.data || [
      { id: 1, company_id: 1, name: 'Main Plant / Head Office', code: 'ACC-HO' }
    ];

    allWarehouses = whRes.data || [
      { id: 1, company_id: 1, name: 'Main Plant Warehouse', code: 'WH-ACC-01' },
      { id: 2, company_id: 2, name: 'Company A Central Depot', code: 'WH-COA-01' },
      { id: 3, company_id: 3, name: 'Company B Junagadh Store', code: 'WH-COB-01' },
      { id: 4, company_id: 4, name: 'Company C Morbi Depot', code: 'WH-COC-01' }
    ];

    let deletedRoles = [];
    try {
      const raw = localStorage.getItem(DELETED_ROLES_STORAGE_KEY);
      if (raw) deletedRoles = JSON.parse(raw);
    } catch (e) {}

    if (rolesRes && rolesRes.data && rolesRes.data.length > 0) {
      rolesRes.data.forEach(dbRole => {
        if (!deletedRoles.includes(dbRole.code) && !SYSTEM_ROLES_CATALOG.some(r => r.code === dbRole.code)) {
          SYSTEM_ROLES_CATALOG.push({
            code: dbRole.code,
            name: dbRole.name,
            domain: dbRole.description || 'Custom Enterprise Role',
            scope: 'Company & Operations',
            accessLevel: 'Custom Access',
            icon: 'shield',
            color: '#0C3925',
            is_system: Boolean(dbRole.is_system)
          });
        }
      });
    }

    if (assignRes && assignRes.data && assignRes.data.length > 0) {
      allAssignments = assignRes.data;
      try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(allAssignments)); } catch(e){}
    } else {
      let stored = null;
      try { stored = localStorage.getItem(ROLES_STORAGE_KEY); } catch(e){}
      if (stored !== null) {
        try {
          allAssignments = JSON.parse(stored);
        } catch (e) {
          allAssignments = [];
          try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(allAssignments)); } catch(e){}
        }
      } else {
        allAssignments = [];
        try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(allAssignments)); } catch(e){}
      }
    }

    let localApprovals = [];
    try {
      const rawAppr = localStorage.getItem('erp_approval_requests');
      if (rawAppr) localApprovals = JSON.parse(rawAppr);
    } catch(e){}

    allApprovalRequests = (reqRes && reqRes.data && reqRes.data.length > 0)
      ? reqRes.data
      : (localApprovals && localApprovals.length > 0 ? localApprovals : []);

    updateStats();
    renderUsersTable(allAssignments);
    renderRolesTable();
    loadPermissionMatrix('super_admin');
    renderApprovalsTable(allApprovalRequests);
    updateRoleDropdowns();
  } catch (err) {
    console.warn('[UserRoles] Fallback initialization notice:', err);
    if (!allAssignments) {
      let stored = null;
      try { stored = localStorage.getItem(ROLES_STORAGE_KEY); } catch(e){}
      if (stored !== null) {
        try { allAssignments = JSON.parse(stored); } catch(e){ allAssignments = []; }
      } else {
        allAssignments = [];
      }
    }
    renderUsersTable(allAssignments);
    renderRolesTable();
    loadPermissionMatrix('super_admin');
    updateRoleDropdowns();
  }
}

function updateStats() {
  const statRoles = document.getElementById('stat-total-roles');
  const statUsers = document.getElementById('stat-active-users');
  const statLocations = document.getElementById('stat-scoped-locations');
  const statApprovals = document.getElementById('stat-pending-approvals');
  const dirHeading = document.getElementById('roles-directory-heading');
  const tabRolesBtn = document.getElementById('tab-roles-btn');

  if (statRoles) statRoles.textContent = String(SYSTEM_ROLES_CATALOG.length);
  if (dirHeading) dirHeading.textContent = `Configured System Roles (${SYSTEM_ROLES_CATALOG.length})`;
  if (tabRolesBtn) tabRolesBtn.textContent = `System Roles (${SYSTEM_ROLES_CATALOG.length})`;
  if (statUsers) statUsers.textContent = allAssignments.filter(a => a.status === 'Active').length;
  if (statLocations) statLocations.textContent = allWarehouses.length;
  if (statApprovals) statApprovals.textContent = allApprovalRequests.filter(r => r.status === 'Pending').length;
}

function renderRolesTable() {
  const tbody = document.getElementById('roles-tbody');
  if (!tbody) return;

  if (SYSTEM_ROLES_CATALOG.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:48px 16px;color:var(--text-muted);">
          <div style="font-size:32px;margin-bottom:8px;">🛡️</div>
          <div style="font-weight:600;font-size:15px;color:var(--text-primary);margin-bottom:4px;">No System Roles Configured</div>
          <p style="font-size:13px;margin:0 0 16px;color:var(--text-muted);">All system roles have been removed for fresh testing. You can create custom roles anytime.</p>
          <button class="btn btn-primary btn-sm" onclick="openCustomRoleModal()" style="display:inline-flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Create Role
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = SYSTEM_ROLES_CATALOG.map(r => {
    const assignedUsers = allAssignments.filter(a => 
      (a.roles?.code === r.code || a.role_id === (SYSTEM_ROLES_CATALOG.findIndex(x => x.code === r.code) + 1) || a.roles?.name === r.name) && 
      a.status === 'Active'
    );
    const userEmails = assignedUsers.map(u => u.user_email).join(', ');
    const countBadge = assignedUsers.length > 0
      ? `<span class="badge badge-success" title="${safeEscape(userEmails)}" style="cursor:help;">${assignedUsers.length} Active User${assignedUsers.length !== 1 ? 's' : ''}</span>`
      : `<span class="badge" style="background:var(--bg-input,#f1f5f9);color:var(--text-muted);border:1px solid var(--border);">0 Users</span>`;

    const isSystem = Boolean(r.is_system);

    return `
      <tr>
        <td class="cell-role-persona">
          <div class="role-cell-flex">
            <div class="role-avatar-box">
              ${safeEscape((r.name || r.code || 'R').charAt(0).toUpperCase())}
            </div>
            <div class="role-text-stack">
              <div class="role-title-text" title="${safeEscape(r.name)}">${safeEscape(r.name)}</div>
              <div class="role-subtitle-text">${safeEscape(r.accessLevel || 'Role Persona')}</div>
            </div>
          </div>
        </td>
        <td class="cell-role-code">
          <span class="role-mobile-label">Code:</span>
          <code class="role-code-badge">${safeEscape(r.code)}</code>
        </td>
        <td class="cell-domain">
          <div class="domain-description-text">${safeEscape(r.domain || '')}</div>
        </td>
        <td class="cell-scope">
          <span class="role-mobile-label">Scope:</span>
          <span class="badge badge-brand scope-badge-pill" title="${safeEscape(r.scope)}">${safeEscape(r.scope)}</span>
        </td>
        <td class="cell-assigned">
          <span class="role-mobile-label">Users:</span>
          ${countBadge}
        </td>
        <td class="cell-actions" style="text-align:right;">
          <div class="row-actions">
            <button class="btn-role-action btn-assign" onclick="assignUserToRole('${r.code}')" title="Assign a user to ${safeEscape(r.name)}" aria-label="Assign" style="color:#ffffff !important;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" style="width:13px;height:13px;stroke:#ffffff;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span style="color:#ffffff !important;">Assign</span>
            </button>
            <button class="btn-role-action btn-edit-role" onclick="editRole('${r.code}')" title="Edit role ${safeEscape(r.name)}" aria-label="Edit Role">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span class="role-btn-text">Edit</span>
            </button>
            <button class="btn-role-action btn-delete-role" onclick="deleteRole('${r.code}')" title="Delete role ${safeEscape(r.name)}" aria-label="Delete Role">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span class="role-btn-text">Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openRoleMatrix(roleCode) {
  switchRbacTab('matrix');
  const selector = document.getElementById('matrix-role-selector');
  if (selector) {
    selector.value = roleCode;
    loadPermissionMatrix(roleCode);
  }
}

function assignUserToRole(roleCode) {
  openAssignUserModal();
  const roleSelect = document.getElementById('user-role');
  if (roleSelect) roleSelect.value = roleCode;
}

function seedAllTenRoles() {
  const tenRoleSeeds = [
    { id: 1, user_email: 'admin@afield.local', full_name: 'Afield Administrator', role_id: 1, roles: { code: 'super_admin', name: 'Software Super Admin' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 2, user_email: 'owner@afield.local', full_name: 'Afield Director', role_id: 2, roles: { code: 'company_owner', name: 'Company Owner / Director' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 3, user_email: 'production@afield.local', full_name: 'Mahesh Sharma (Plant)', role_id: 3, roles: { code: 'production_manager', name: 'Production Manager' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 4, user_email: 'factory@afield.local', full_name: 'Ketan Patel (Shift)', role_id: 4, roles: { code: 'factory_operator', name: 'Factory Operator' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 5, user_email: 'operator@afield.local', full_name: 'Dinesh Kumar (Godown)', role_id: 5, roles: { code: 'godown_operator', name: 'Packaging / Godown Operator' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 6, user_email: 'qc@afield.local', full_name: 'Ramesh Patel (QC Lab)', role_id: 6, roles: { code: 'qc_officer', name: 'QC Officer' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 7, user_email: 'accountant@afield.local', full_name: 'Suresh Shah (Finance)', role_id: 7, roles: { code: 'accountant', name: 'Accountant' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 8, user_email: 'store@afield.local', full_name: 'Pravin Vaghela (Stores)', role_id: 8, roles: { code: 'store_manager', name: 'Inventory / Store Manager' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 9, user_email: 'sales@afield.local', full_name: 'Vikram Desai (Dispatch)', role_id: 9, roles: { code: 'sales_executive', name: 'Sales / Dispatch Executive' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' },
    { id: 10, user_email: 'auditor@afield.local', full_name: 'Harish Dave (Auditor)', role_id: 10, roles: { code: 'viewer_auditor', name: 'Viewer / Auditor' }, company_id: 1, branch_id: 1, warehouse_id: 1, status: 'Active' }
  ];

  tenRoleSeeds.forEach(seed => {
    const existing = allAssignments.find(a => 
      a.user_email?.toLowerCase() === seed.user_email.toLowerCase() || 
      a.roles?.code === seed.roles.code
    );
    if (!existing) {
      allAssignments.push(seed);
    }
  });

  try {
    localStorage.removeItem(DELETED_ROLES_STORAGE_KEY);
  } catch (e) {}
  loadRolesCatalog();
  if (window.RBAC && window.RBAC.reloadRoles) {
    window.RBAC.reloadRoles();
  }

  try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(allAssignments)); } catch(e){}
  if (typeof APP !== 'undefined' && APP.showToast) {
    APP.showToast('All 10 active role accounts populated successfully! You can now test and edit each role.', 'success');
  }
  updateStats();
  renderUsersTable(allAssignments);
  renderRolesTable();
  updateRoleDropdowns();
}

function switchRbacTab(tabKey) {
  ['roles', 'users', 'matrix', 'approvals'].forEach(t => {
    const view = document.getElementById(`tab-${t}-view`);
    const btn = document.getElementById(`tab-${t}-btn`);
    if (view) view.style.display = (t === tabKey) ? '' : 'none';
    if (btn) btn.classList.toggle('active', t === tabKey);
  });
  if (tabKey === 'roles') {
    renderRolesTable();
  }
}

let usersTableEnhancer = null;

function renderUsersSlice(assignments) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  tbody.innerHTML = assignments.map(a => {
    const company = allCompanies.find(c => c.id === a.company_id) || { name: 'Afield Crop Care', code: 'ACC' };
    const branch = allBranches.find(b => b.id === a.branch_id);
    const warehouse = allWarehouses.find(w => w.id === a.warehouse_id);
    const roleCode = a.roles?.code || 'super_admin';
    const roleName = a.roles?.name || roleCode;
    const initial = (a.user_email || 'U')[0].toUpperCase();

    const statusBadge = (typeof UTILS !== 'undefined' && UTILS.statusBadge)
      ? UTILS.statusBadge(a.status || 'Active', true)
      : `<span class="badge ${a.status === 'Active' ? 'badge-approved' : 'badge-danger'}"><span class="badge-dot"></span>${a.status || 'Active'}</span>`;

    return `
      <tr>
        <td class="cell-user-info">
          <div class="user-cell-flex">
            <div class="user-avatar-circle">${initial}</div>
            <div class="user-text-stack">
              <div class="user-email-text" title="${a.user_email}">${a.user_email}</div>
              <div class="user-username-sub">${a.user_email.split('@')[0]}</div>
            </div>
          </div>
        </td>
        <td class="cell-role">
          <span class="badge badge-brand role-badge-pill" title="${roleName}">
            ${roleName}
          </span>
        </td>
        <td class="cell-company-scope">
          <div class="company-name-text">${company.name}</div>
          <span class="company-code-sub">(${company.code})</span>
        </td>
        <td class="cell-branch-scope">
          <span class="scope-text">${branch ? branch.name : '<span class="scope-all">All Branches</span>'}</span>
        </td>
        <td class="cell-warehouse-scope">
          <span class="scope-text">${warehouse ? warehouse.name : '<span class="scope-all">All Warehouses</span>'}</span>
        </td>
        <td class="cell-status">
          ${statusBadge}
        </td>
        <td class="cell-actions" style="text-align:right;">
          <div class="row-actions">
            <button class="action-btn edit" onclick="editUserAssignment('${a.id}')" title="Edit Assignment" aria-label="Edit Assignment">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${a.status === 'Active' ? `
              <button class="btn btn-sm btn-action-revoke" onclick="revokeUserAssignment('${a.id}')" title="Revoke Access" aria-label="Revoke Access">
                Revoke
              </button>
            ` : `
              <button class="btn btn-sm btn-action-reinstate" onclick="reinstateUserAssignment('${a.id}')" title="Reinstate Access" aria-label="Reinstate Access">
                Reinstate
              </button>
            `}
            <button class="action-btn delete" onclick="deleteUserAssignment('${a.id}')" title="Delete Assignment" aria-label="Delete Assignment">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (typeof UTILS !== 'undefined' && UTILS.applyMobileTableLabels) {
    UTILS.applyMobileTableLabels('users-table');
  }
}

function renderUsersTable(assignments) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  const totalInfo = document.getElementById('users-total-info');
  if (totalInfo) totalInfo.textContent = `${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`;

  if (assignments.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7"><div class="empty-state"><h3>No user role assignments found</h3><p>Assign a role to grant permissions to a user, or click "Seed All 10 Role Accounts" above to test.</p></div></td></tr>`;
    const pag = document.querySelector('#users-table-wrap .pagination');
    if (pag) pag.style.display = 'none';
    return;
  }

  if (window.TableEnhancer) {
    if (!usersTableEnhancer) {
      usersTableEnhancer = new window.TableEnhancer({
        tableId: 'users-table',
        pageSize: 25,
        defaultSortKey: 'user_email',
        defaultSortOrder: 'asc',
        onRender: (pageSlice) => renderUsersSlice(pageSlice)
      });
    }
    usersTableEnhancer.setData(assignments);
    return;
  }

  renderUsersSlice(assignments);
}

function filterUsersTable() {
  const search = (document.getElementById('search-users')?.value || '').toLowerCase().trim();
  const roleFilter = document.getElementById('filter-user-role')?.value || '';

  const filtered = allAssignments.filter(a => {
    const emailMatch = (a.user_email || '').toLowerCase().includes(search);
    const roleMatchText = (a.roles?.name || '').toLowerCase().includes(search);
    const matchSearch = !search || emailMatch || roleMatchText;
    const matchRole = !roleFilter || (a.roles?.code === roleFilter);
    return matchSearch && matchRole;
  });

  renderUsersTable(filtered);
}

const debouncedFilterUsersTable = (typeof UTILS !== 'undefined' && UTILS.debounce)
  ? UTILS.debounce(filterUsersTable, 250)
  : filterUsersTable;

// Attach toolbar event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search-users')?.addEventListener('input', debouncedFilterUsersTable);
  document.getElementById('filter-user-role')?.addEventListener('change', filterUsersTable);
});

// Modal handling
function openAssignUserModal(assignment = null) {
  const modal = document.getElementById('user-role-modal');
  if (!modal) return;
  modal.style.display = '';

  const title = document.getElementById('user-modal-title');
  const idInput = document.getElementById('edit-assignment-id');
  const emailInput = document.getElementById('user-email');
  const nameInput = document.getElementById('user-full-name');
  const roleSelect = document.getElementById('user-role');
  const companySelect = document.getElementById('user-company');

  // Populate company dropdown (active companies, plus current assignment company if editing)
  let availableCompanies = allCompanies.filter(c => 
    (c.status || 'Active') === 'Active' || (assignment && String(assignment.company_id) === String(c.id))
  );
  if (availableCompanies.length === 0) {
    availableCompanies = [{ id: assignment?.company_id || 1, name: 'Afield Crop Care', code: 'ACC' }];
  }

  if (companySelect) {
    companySelect.innerHTML = availableCompanies.map(c => `
      <option value="${c.id}">${c.name} (${c.code})</option>
    `).join('');
  }

  updateRoleDropdowns();

  if (assignment) {
    if (title) title.textContent = 'Edit User Role & Scope';
    if (idInput) idInput.value = assignment.id;
    if (emailInput) {
      emailInput.value = assignment.user_email || '';
      emailInput.disabled = true;
    }
    if (nameInput) {
      nameInput.value = assignment.full_name || assignment.user_email?.split('@')[0] || '';
    }
    if (roleSelect) {
      roleSelect.value = assignment.roles?.code || 'super_admin';
    }
    const targetCompId = assignment.company_id || availableCompanies[0].id;
    if (companySelect) companySelect.value = targetCompId;
    populateBranchesAndWarehouses(targetCompId, assignment.branch_id, assignment.warehouse_id);
  } else {
    if (title) title.textContent = 'Assign User Role';
    if (idInput) idInput.value = '';
    if (emailInput) {
      emailInput.value = '';
      emailInput.disabled = false;
    }
    if (nameInput) nameInput.value = '';
    if (roleSelect) roleSelect.value = 'production_manager';
    const targetCompId = availableCompanies[0].id;
    if (companySelect) companySelect.value = targetCompId;
    populateBranchesAndWarehouses(targetCompId);
  }

  if (typeof APP !== 'undefined' && APP.openModal) {
    APP.openModal('user-role-modal');
  } else {
    modal.classList.add('open');
  }
}

function closeUserRoleModal() {
  const modal = document.getElementById('user-role-modal');
  if (typeof APP !== 'undefined' && APP.closeModal) {
    APP.closeModal('user-role-modal');
  } else if (modal) {
    modal.classList.remove('open');
  }
  if (modal) modal.style.display = '';
}

function populateBranchesAndWarehouses(companyId, selectedBranchId = null, selectedWhId = null) {
  const cId = parseInt(companyId, 10);
  const branchSelect = document.getElementById('user-branch');
  const whSelect = document.getElementById('user-warehouse');

  if (branchSelect) {
    const branches = allBranches.filter(b => 
      (b.company_id === cId || String(b.company_id) === String(companyId)) && 
      ((b.status || 'Active') === 'Active' || String(b.id) === String(selectedBranchId))
    );
    branchSelect.innerHTML = `<option value="">All Branches</option>` + branches.map(b => `
      <option value="${b.id}" ${String(b.id) === String(selectedBranchId) ? 'selected' : ''}>${b.name} (${b.code})</option>
    `).join('');
  }

  if (whSelect) {
    const warehouses = allWarehouses.filter(w => 
      (w.company_id === cId || String(w.company_id) === String(companyId)) && 
      ((w.status || 'Active') === 'Active' || String(w.id) === String(selectedWhId))
    );
    whSelect.innerHTML = `<option value="">All Warehouses</option>` + warehouses.map(w => `
      <option value="${w.id}" ${String(w.id) === String(selectedWhId) ? 'selected' : ''}>${w.name} (${w.code})</option>
    `).join('');
  }
}

async function saveUserRoleAssignment(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('save-user-btn') || e.target.querySelector('button[type="submit"]');

  const executeSave = async () => {
    const id = document.getElementById('edit-assignment-id').value;
    const email = document.getElementById('user-email').value.trim();
    const roleCode = document.getElementById('user-role').value;
    const companyId = parseInt(document.getElementById('user-company').value, 10);
    const branchId = document.getElementById('user-branch').value ? parseInt(document.getElementById('user-branch').value, 10) : null;
    const warehouseId = document.getElementById('user-warehouse').value ? parseInt(document.getElementById('user-warehouse').value, 10) : null;

    // Safety guard: if demoting an existing active super_admin, verify another active super_admin remains
    if (id) {
      const orig = allAssignments.find(a => a.id === parseInt(id, 10));
      const origIsSuper = orig && (orig.roles?.code === 'super_admin' || orig.role_id === 1) && orig.status === 'Active';
      if (origIsSuper && roleCode !== 'super_admin') {
        const activeSuperAdmins = allAssignments.filter(a =>
          (a.roles?.code === 'super_admin' || a.role_id === 1) &&
          a.status === 'Active'
        );
        if (activeSuperAdmins.length <= 1) {
          APP.showToast('Security Rule: Cannot change role of the sole remaining Super Admin. Promote another administrator first.', 'error');
          return;
        }
      }
    }

    const roleMap = {
      super_admin: 1, company_owner: 2, production_manager: 3, factory_operator: 4,
      godown_operator: 5, qc_officer: 6, accountant: 7, store_manager: 8,
      sales_executive: 9, viewer_auditor: 10
    };

    const roleNames = {
      super_admin: 'Software Super Admin',
      company_owner: 'Company Owner / Director',
      production_manager: 'Production & Plant Manager',
      factory_operator: 'Factory Operator (Shift)',
      godown_operator: 'Packaging / Godown Operator',
      qc_officer: 'QC Officer',
      accountant: 'Accountant',
      store_manager: 'Warehouse & Store Manager',
      sales_executive: 'Sales Executive',
      viewer_auditor: 'Auditor & Viewer'
    };

    const roleObj = SYSTEM_ROLES_CATALOG.find(r => r.code === roleCode);
    const assignedRoleId = roleMap[roleCode] || (SYSTEM_ROLES_CATALOG.findIndex(r => r.code === roleCode) + 1);
    const assignedRoleName = roleObj ? roleObj.name : (roleNames[roleCode] || roleCode);

    const payload = {
      user_email: email,
      role_id: assignedRoleId,
      company_id: companyId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      status: 'Active'
    };

    try {
      if (id) {
        const numId = parseInt(id, 10);
        const match = allAssignments.find(a => a.id === numId);
        if (match) {
          match.user_email = email;
          match.role_id = assignedRoleId;
          match.roles = { code: roleCode, name: assignedRoleName };
          match.company_id = companyId;
          match.branch_id = branchId;
          match.warehouse_id = warehouseId;
        }
      } else {
        const nextId = allAssignments.length > 0 ? Math.max(...allAssignments.map(a => a.id || 0)) + 1 : 1;
        allAssignments.unshift({
          id: nextId,
          user_email: email,
          role_id: assignedRoleId,
          roles: { code: roleCode, name: assignedRoleName },
          company_id: companyId,
          branch_id: branchId,
          warehouse_id: warehouseId,
          status: 'Active'
        });
      }
      try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(allAssignments)); } catch(e){}

      if (window.dbClient) {
        try {
          if (id) {
            await window.dbClient.from('user_role_assignments').update(payload).eq('id', id);
          } else {
            await window.dbClient.from('user_role_assignments').insert([payload]);
          }
        } catch (dbErr) {
          console.warn('[UserRoles] Remote save notice:', dbErr);
        }
      }

      if (window.RBAC) {
        await window.RBAC.logAudit(id ? 'ROLE_ASSIGNMENT_UPDATED' : 'ROLE_ASSIGNMENT_CREATED', payload, email);
      }

      APP.showToast('User role assignment saved successfully!', 'success');
      closeUserRoleModal();
      updateStats();
      renderUsersTable(allAssignments);
    } catch (err) {
      console.error('saveUserRoleAssignment failed:', err);
      APP.showToast('Failed to save role assignment: ' + err.message, 'error');
    }
  };

  if (typeof APP !== 'undefined' && APP.guardSubmit) {
    await APP.guardSubmit(saveBtn, executeSave);
  } else {
    await executeSave();
  }
}

async function revokeUserAssignment(id) {
  const match = allAssignments.find(a => String(a.id) === String(id));
  if (!match) return;
  const email = match.user_email || 'this user';

  // Safety guard: check if revoking the sole remaining active super_admin
  const isSuperAdmin = (match.roles?.code === 'super_admin' || match.role_id === 1);
  const isSoleSuperAdmin = isSuperAdmin && match.status === 'Active' &&
    allAssignments.filter(a =>
      (a.roles?.code === 'super_admin' || a.role_id === 1) &&
      a.status === 'Active'
    ).length <= 1;

  const confirmRevoke = async () => {
    try {
      match.status = 'Revoked';
      try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(allAssignments)); } catch(e){}

      if (window.dbClient) {
        try {
          await window.dbClient.from('user_role_assignments').update({ status: 'Revoked' }).eq('id', id);
        } catch (dbErr) {
          console.warn('[UserRoles] Remote revoke notice:', dbErr);
        }
      }
      if (window.RBAC) {
        await window.RBAC.logAudit('ROLE_REVOKED', { assignmentId: id }, match?.user_email);
      }
      APP.showToast('User role access revoked.', 'info');
      updateStats();
      renderUsersTable(allAssignments);
    } catch (err) {
      APP.showToast('Failed to revoke role: ' + err.message, 'error');
    }
  };

  const confirmMsg = isSoleSuperAdmin
    ? `Warning: ${email} is the last active Super Admin assignment. Revoking access will leave 0 active Super Admins until reinstated. Are you sure you want to proceed and revoke access?`
    : `Are you sure you want to revoke role and access for ${email}?`;

  if (typeof APP !== 'undefined' && APP.showConfirm) {
    APP.showConfirm(confirmMsg, confirmRevoke, {
      isDanger: true,
      confirmText: 'Revoke Access',
      title: isSoleSuperAdmin ? 'Revoke Last Super Admin' : 'Revoke User Access'
    });
  } else if (confirm(confirmMsg)) {
    await confirmRevoke();
  }
}

async function deleteUserAssignment(id) {
  const match = allAssignments.find(a => String(a.id) === String(id));
  if (!match) return;
  const email = match.user_email || 'this user';

  // Safety guard: check if deleting the sole remaining active super_admin
  const isSuperAdmin = (match.roles?.code === 'super_admin' || match.role_id === 1);
  const isSoleSuperAdmin = isSuperAdmin && match.status === 'Active' &&
    allAssignments.filter(a =>
      (a.roles?.code === 'super_admin' || a.role_id === 1) &&
      a.status === 'Active'
    ).length <= 1;

  const confirmDelete = async () => {
    try {
      allAssignments = allAssignments.filter(a => String(a.id) !== String(id));
      try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(allAssignments)); } catch(e){}

      if (window.dbClient) {
        try {
          await window.dbClient.from('user_role_assignments').delete().eq('id', id);
        } catch (dbErr) {
          console.warn('[UserRoles] Remote delete notice:', dbErr);
        }
      }
      if (window.RBAC) {
        await window.RBAC.logAudit('ROLE_ASSIGNMENT_DELETED', { assignmentId: id }, email);
      }
      APP.showToast('User role assignment permanently deleted.', 'success');
      updateStats();
      renderUsersTable(allAssignments);
    } catch (err) {
      APP.showToast('Failed to delete assignment: ' + err.message, 'error');
    }
  };

  const confirmMsg = isSoleSuperAdmin
    ? `Warning: ${email} is the last active Super Admin assignment. Deleting it will leave 0 active user assignments for testing purposes. Are you sure you want to proceed and permanently delete this assignment?`
    : `Are you sure you want to permanently delete role assignment for ${email}?`;

  if (typeof APP !== 'undefined' && APP.showConfirm) {
    APP.showConfirm(confirmMsg, confirmDelete, {
      isDanger: true,
      confirmText: 'Delete Assignment',
      title: isSoleSuperAdmin ? 'Delete Last Super Admin' : 'Delete User Assignment'
    });
  } else if (confirm(confirmMsg)) {
    await confirmDelete();
  }
}

async function reinstateUserAssignment(id) {
  try {
    const match = allAssignments.find(a => String(a.id) === String(id));
    if (match) {
      match.status = 'Active';
      try { localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(allAssignments)); } catch(e){}
    }
    if (window.dbClient) {
      try {
        await window.dbClient.from('user_role_assignments').update({ status: 'Active' }).eq('id', id);
      } catch (dbErr) {
        console.warn('[UserRoles] Remote reinstate notice:', dbErr);
      }
    }
    APP.showToast('User role reinstated.', 'success');
    updateStats();
    renderUsersTable(allAssignments);
  } catch (err) {
    APP.showToast('Failed to reinstate: ' + err.message, 'error');
  }
}

function editUserAssignment(id) {
  const match = allAssignments.find(a => String(a.id) === String(id));
  if (match) {
    openAssignUserModal(match);
  } else {
    console.warn('[UserRoles] No assignment found with id:', id);
  }
}

// ----------------------------------------------------------------------------
// Permission Matrix Loader
// ----------------------------------------------------------------------------
const MODULE_DISPLAY_LIST = [
  { code: 'dashboard', name: 'Dashboard' },
  { code: 'inventory', name: 'Inventory & Stock' },
  { code: 'products', name: 'Products Catalog' },
  { code: 'clients', name: 'Clients (Farmers)' },
  { code: 'suppliers', name: 'Suppliers' },
  { code: 'orders', name: 'Sales Orders' },
  { code: 'purchases', name: 'Purchase Inward' },
  { code: 'production', name: 'Production Runs' },
  { code: 'formulations', name: 'Formulations / Recipes' },
  { code: 'daily_transactions', name: 'Daily Stock Usage' },
  { code: 'companies', name: 'Companies & Branches' },
  { code: 'warehouses', name: 'Warehouses' },
  { code: 'intercompany', name: 'Intercompany Trading' },
  { code: 'transactions', name: 'Cash & Bank Ledger' },
  { code: 'expenses', name: 'Expenses' },
  { code: 'reports', name: 'Business Reports' },
  { code: 'exports', name: 'Data Exports' }
];

function loadPermissionMatrix(roleCode) {
  const tbody = document.getElementById('matrix-tbody');
  const mobileCardsWrap = document.getElementById('matrix-mobile-cards');
  if (!window.RBAC) return;

  const role = roleCode || 'super_admin';
  const isSuper = (role === 'super_admin');
  const isOwner = (role === 'company_owner');

  const matrixData = MODULE_DISPLAY_LIST.map(m => {
    // Determine permissions for this module from RBAC defaults
    const view = isSuper || isOwner ? true : window.RBAC.hasPermission(m.code, 'view');
    const create = isSuper || isOwner ? true : window.RBAC.hasPermission(m.code, 'create');
    const edit = isSuper || isOwner ? true : window.RBAC.hasPermission(m.code, 'edit');
    const del = isSuper || isOwner ? true : window.RBAC.hasPermission(m.code, 'delete');
    const approve = isSuper || isOwner ? true : window.RBAC.hasPermission(m.code, 'approve');
    const reject = isSuper || isOwner ? true : window.RBAC.hasPermission(m.code, 'reject');
    const cancel = isSuper || isOwner ? true : window.RBAC.hasPermission(m.code, 'cancel');
    const exp = isSuper || isOwner ? true : window.RBAC.hasPermission(m.code, 'export');

    return {
      module: m,
      perms: { view, create, edit, del, approve, reject, cancel, exp }
    };
  });

  const checkIcon = (val) => val
    ? `<span style="color:#16a34a;font-weight:bold;font-size:16px;" title="Granted">✔</span>`
    : `<span style="color:#ef4444;opacity:0.3;font-size:14px;" title="Restricted">✖</span>`;

  if (tbody) {
    tbody.innerHTML = matrixData.map(({ module: m, perms: p }) => `
      <tr>
        <td style="font-weight:600;color:var(--text-primary);">${m.name}</td>
        <td style="text-align:center">${checkIcon(p.view)}</td>
        <td style="text-align:center">${checkIcon(p.create)}</td>
        <td style="text-align:center">${checkIcon(p.edit)}</td>
        <td style="text-align:center">${checkIcon(p.del)}</td>
        <td style="text-align:center">${checkIcon(p.approve)}</td>
        <td style="text-align:center">${checkIcon(p.reject)}</td>
        <td style="text-align:center">${checkIcon(p.cancel)}</td>
        <td style="text-align:center">${checkIcon(p.exp)}</td>
      </tr>
    `).join('');
  }

  if (mobileCardsWrap) {
    mobileCardsWrap.innerHTML = matrixData.map(({ module: m, perms: p }) => `
      <div class="matrix-module-card">
        <div class="matrix-module-card-header">
          <div class="matrix-module-name">${m.name}</div>
        </div>
        <div class="matrix-module-permissions-grid">
          <div class="matrix-perm-badge ${p.view ? 'perm-allowed' : 'perm-denied'}">
            <span class="matrix-perm-icon">${p.view ? '✔' : '✖'}</span>
            <span class="matrix-perm-label">View</span>
          </div>
          <div class="matrix-perm-badge ${p.create ? 'perm-allowed' : 'perm-denied'}">
            <span class="matrix-perm-icon">${p.create ? '✔' : '✖'}</span>
            <span class="matrix-perm-label">Create</span>
          </div>
          <div class="matrix-perm-badge ${p.edit ? 'perm-allowed' : 'perm-denied'}">
            <span class="matrix-perm-icon">${p.edit ? '✔' : '✖'}</span>
            <span class="matrix-perm-label">Edit</span>
          </div>
          <div class="matrix-perm-badge ${p.del ? 'perm-allowed' : 'perm-denied'}">
            <span class="matrix-perm-icon">${p.del ? '✔' : '✖'}</span>
            <span class="matrix-perm-label">Delete</span>
          </div>
          <div class="matrix-perm-badge ${p.approve ? 'perm-allowed' : 'perm-denied'}">
            <span class="matrix-perm-icon">${p.approve ? '✔' : '✖'}</span>
            <span class="matrix-perm-label">Approve</span>
          </div>
          <div class="matrix-perm-badge ${p.reject ? 'perm-allowed' : 'perm-denied'}">
            <span class="matrix-perm-icon">${p.reject ? '✔' : '✖'}</span>
            <span class="matrix-perm-label">Reject</span>
          </div>
          <div class="matrix-perm-badge ${p.cancel ? 'perm-allowed' : 'perm-denied'}">
            <span class="matrix-perm-icon">${p.cancel ? '✔' : '✖'}</span>
            <span class="matrix-perm-label">Cancel</span>
          </div>
          <div class="matrix-perm-badge ${p.exp ? 'perm-allowed' : 'perm-denied'}">
            <span class="matrix-perm-icon">${p.exp ? '✔' : '✖'}</span>
            <span class="matrix-perm-label">Export</span>
          </div>
        </div>
      </div>
    `).join('');
  }
}

// ----------------------------------------------------------------------------
// Approval Requests Table
// ----------------------------------------------------------------------------
function renderApprovalsTable(requests) {
  const tbody = document.getElementById('approvals-tbody');
  const mobileCardsWrap = document.getElementById('approvals-mobile-cards');
  if (!tbody) return;

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">No approval requests found</td></tr>`;
    if (mobileCardsWrap) {
      mobileCardsWrap.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">No approval requests found</div>`;
    }
    return;
  }

  tbody.innerHTML = requests.map(r => `
    <tr>
      <td><strong>${safeEscape(r.request_type)}</strong></td>
      <td><code>${safeEscape(r.reference_code || '#' + r.reference_id)}</code></td>
      <td>${safeEscape(r.requested_by)}</td>
      <td><span class="badge badge-secondary">${r.required_role_id === 6 ? 'QC Officer' : 'Owner / Manager'}</span></td>
      <td>
        <span class="badge ${r.status === 'Approved' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">
          ${safeEscape(r.status)}
        </span>
      </td>
      <td>${safeEscape(r.decision_notes) || '<span style="color:var(--text-muted)">-</span>'}</td>
      <td style="text-align:right">
        ${r.status === 'Pending' ? `
          <button class="btn btn-sm btn-primary" onclick="decideApproval(${r.id}, 'Approved')" style="padding:4px 8px;font-size:11px;">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="decideApproval(${r.id}, 'Rejected')" style="padding:4px 8px;font-size:11px;margin-left:4px;">Reject</button>
        ` : `
          <span style="font-size:11px;color:var(--text-muted);">Decided</span>
        `}
      </td>
    </tr>
  `).join('');

  if (mobileCardsWrap) {
    mobileCardsWrap.innerHTML = requests.map(r => `
      <div class="approval-mobile-card">
        <div class="approval-mobile-top">
          <div class="approval-mobile-title">
            <strong style="color:#0f172a;font-size:14px;">${safeEscape(r.request_type)}</strong>
            <code style="font-size:11px;background:#f1f5f9;border:1px solid #cbd5e1;padding:2px 6px;border-radius:4px;">${safeEscape(r.reference_code || '#' + r.reference_id)}</code>
          </div>
          <span class="badge ${r.status === 'Approved' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">
            ${safeEscape(r.status)}
          </span>
        </div>
        <div class="approval-mobile-meta">
          <div class="approval-meta-row">
            <span class="approval-meta-label">Requested By:</span>
            <span class="approval-meta-val">${safeEscape(r.requested_by)}</span>
          </div>
          <div class="approval-meta-row">
            <span class="approval-meta-label">Required Role:</span>
            <span class="badge badge-secondary" style="font-size:11px;">${r.required_role_id === 6 ? 'QC Officer' : 'Owner / Manager'}</span>
          </div>
          ${r.decision_notes ? `
          <div class="approval-meta-row">
            <span class="approval-meta-label">Notes:</span>
            <span class="approval-meta-val" style="font-style:italic;">${safeEscape(r.decision_notes)}</span>
          </div>` : ''}
        </div>
        <div class="approval-mobile-actions">
          ${r.status === 'Pending' ? `
            <button class="btn btn-primary" onclick="decideApproval(${r.id}, 'Approved')" style="flex:1;min-height:38px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"/></svg>
              Approve
            </button>
            <button class="btn btn-secondary" onclick="decideApproval(${r.id}, 'Rejected')" style="flex:1;min-height:38px;font-size:13px;font-weight:600;color:var(--danger,#ef4444);border-color:rgba(239,68,68,0.4);display:inline-flex;align-items:center;justify-content:center;gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Reject
            </button>
          ` : `
            <span style="font-size:12px;color:var(--text-muted);font-weight:600;padding:4px 0;">Decision recorded</span>
          `}
        </div>
      </div>
    `).join('');
  }
}

async function decideApproval(id, decision) {
  const notes = prompt(`Enter notes for ${decision}:`) || '';
  try {
    if (window.dbClient) {
      await window.dbClient.from('approval_requests').update({
        status: decision,
        decision_by: localStorage.getItem('admin_user') || 'admin@afield.local',
        decision_notes: notes,
        decision_at: new Date().toISOString()
      }).eq('id', id);
    }
    if (window.RBAC) {
      await window.RBAC.logAudit(decision === 'Approved' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED', { id, notes });
    }
    APP.showToast(`Request marked as ${decision}`, 'success');
    await loadInitialData();
  } catch (err) {
    APP.showToast('Failed to update request: ' + err.message, 'error');
  }
}

function loadApprovalRequests() {
  const filterStatus = document.getElementById('filter-approval-status')?.value || '';
  let filtered = allApprovalRequests;
  if (filterStatus) {
    filtered = filtered.filter(r => r.status === filterStatus);
  }
  renderApprovalsTable(filtered);
}

async function deleteRole(roleCode) {
  const role = SYSTEM_ROLES_CATALOG.find(r => r.code === roleCode);
  if (!role) {
    if (typeof APP !== 'undefined' && APP.showToast) {
      APP.showToast('Role not found.', 'error');
    }
    return;
  }

  // 1. Guard against active user assignments
  const activeAssignments = allAssignments.filter(a =>
    (a.roles?.code === roleCode || a.role_id === role.id || a.roles?.name === role.name) &&
    a.status === 'Active'
  );

  if (activeAssignments.length > 0) {
    if (typeof APP !== 'undefined' && APP.showToast) {
      APP.showToast(`Cannot delete role "${role.name}": ${activeAssignments.length} active user assignment(s) exist. Please reassign or revoke active users first.`, 'warning');
    } else {
      alert(`Cannot delete role "${role.name}" because active users are assigned to it.`);
    }
    return;
  }

  const activeRole = (window.RBAC && window.RBAC.getActiveRole) ? window.RBAC.getActiveRole() : 'super_admin';
  if (roleCode === 'super_admin' || roleCode === activeRole) {
    if (typeof APP !== 'undefined' && APP.showToast) {
      APP.showToast(`Security Guard: You cannot delete your active administrator role (${role.name}). To prevent system lockout, this role is protected.`, 'error');
    } else {
      alert(`Security Guard: You cannot delete your active administrator role (${role.name}).`);
    }
    return;
  }

  const isSuperAdmin = (roleCode === 'super_admin');
  const isLastRole = SYSTEM_ROLES_CATALOG.length <= 1;

  // 2. Confirmation Dialog (with explicit testing-from-scratch warning for root super_admin)
  const executeDelete = async () => {
    try {
      // Remove from memory catalog
      SYSTEM_ROLES_CATALOG = SYSTEM_ROLES_CATALOG.filter(r => r.code !== roleCode);
      
      // Store in deleted roles storage so deletion persists across page reloads
      try {
        const rawDel = localStorage.getItem(DELETED_ROLES_STORAGE_KEY);
        let deleted = rawDel ? JSON.parse(rawDel) : [];
        if (!deleted.includes(roleCode)) {
          deleted.push(roleCode);
          localStorage.setItem(DELETED_ROLES_STORAGE_KEY, JSON.stringify(deleted));
        }
      } catch (e) {}

      // Update custom roles storage
      try {
        const raw = localStorage.getItem(CUSTOM_ROLES_STORAGE_KEY);
        let custom = raw ? JSON.parse(raw) : [];
        custom = custom.filter(r => r.code !== roleCode);
        localStorage.setItem(CUSTOM_ROLES_STORAGE_KEY, JSON.stringify(custom));
      } catch (e) {}

      // Delete from database if dbClient is available
      if (window.dbClient) {
        try {
          await window.dbClient.from('roles').delete().eq('code', roleCode);
        } catch (dbErr) {
          console.warn('[UserRoles] Remote role delete notice:', dbErr);
        }
      }

      // Log RBAC audit event
      if (window.RBAC && window.RBAC.logAudit) {
        await window.RBAC.logAudit('ROLE_DELETED', { roleCode, roleName: role.name });
      }

      if (typeof APP !== 'undefined' && APP.showToast) {
        APP.showToast(`Role "${role.name}" has been permanently deleted.`, 'success');
      }
      if (window.RBAC && window.RBAC.reloadRoles) {
        window.RBAC.reloadRoles();
      }
      updateStats();
      renderRolesTable();
      updateRoleDropdowns();
    } catch (err) {
      console.error('deleteRole error:', err);
      if (typeof APP !== 'undefined' && APP.showToast) {
        APP.showToast('Failed to delete role: ' + err.message, 'error');
      }
    }
  };

  const confirmMsg = isSuperAdmin || isLastRole
    ? `Warning: Software Super Admin is the root governance role. Deleting it will leave 0 configured roles for testing from scratch. Are you sure you want to proceed and permanently delete this role?`
    : `Are you sure you want to permanently delete role "${role.name}" (${role.code})? This action cannot be undone.`;

  if (typeof APP !== 'undefined' && APP.showConfirm) {
    APP.showConfirm(confirmMsg, executeDelete, {
      isDanger: true,
      confirmText: 'Delete Role',
      title: isSuperAdmin ? 'Delete Root System Role' : 'Delete Role'
    });
  } else if (confirm(confirmMsg)) {
    await executeDelete();
  }
}

function editRole(roleCode) {
  const role = SYSTEM_ROLES_CATALOG.find(r => r.code === roleCode);
  if (!role) {
    if (typeof APP !== 'undefined' && APP.showToast) {
      APP.showToast('Role not found.', 'error');
    }
    return;
  }

  const title = document.getElementById('role-modal-title');
  const isEditingInput = document.getElementById('edit-role-is-editing');
  const nameInput = document.getElementById('custom-role-name');
  const codeInput = document.getElementById('custom-role-code');
  const domainInput = document.getElementById('custom-role-domain');
  const scopeInput = document.getElementById('custom-role-scope');
  const accessInput = document.getElementById('custom-role-access');
  const saveBtn = document.getElementById('save-custom-role-btn');

  if (title) title.textContent = 'Edit Role: ' + role.name;
  if (isEditingInput) isEditingInput.value = role.code;
  if (nameInput) nameInput.value = role.name;
  if (codeInput) {
    codeInput.value = role.code;
    codeInput.disabled = true;
  }
  if (domainInput) domainInput.value = role.domain || '';
  if (scopeInput) scopeInput.value = role.scope || '';
  if (accessInput) accessInput.value = role.accessLevel || '';
  if (saveBtn) saveBtn.textContent = 'Update Role';

  const modal = document.getElementById('custom-role-modal');
  if (typeof APP !== 'undefined' && APP.openModal) {
    APP.openModal('custom-role-modal');
  } else if (modal) {
    modal.classList.add('open');
  }
}

function openCustomRoleModal() {
  const form = document.getElementById('custom-role-form');
  if (form) form.reset();
  const title = document.getElementById('role-modal-title');
  const isEditingInput = document.getElementById('edit-role-is-editing');
  const codeInput = document.getElementById('custom-role-code');
  const saveBtn = document.getElementById('save-custom-role-btn');
  if (title) title.textContent = 'Create Custom Role';
  if (isEditingInput) isEditingInput.value = '';
  if (codeInput) codeInput.disabled = false;
  if (saveBtn) saveBtn.textContent = 'Create Role';

  const modal = document.getElementById('custom-role-modal');
  if (typeof APP !== 'undefined' && APP.openModal) {
    APP.openModal('custom-role-modal');
  } else if (modal) {
    modal.classList.add('open');
  }
}

function closeCustomRoleModal() {
  const modal = document.getElementById('custom-role-modal');
  if (typeof APP !== 'undefined' && APP.closeModal) {
    APP.closeModal('custom-role-modal');
  } else if (modal) {
    modal.classList.remove('open');
  }
}

function autoFillRoleCode(val) {
  const codeInput = document.getElementById('custom-role-code');
  if (codeInput && !codeInput.dataset.userEdited) {
    codeInput.value = val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
}

async function saveCustomRole(e) {
  if (e && e.preventDefault) e.preventDefault();
  const isEditing = document.getElementById('edit-role-is-editing')?.value;
  const name = document.getElementById('custom-role-name')?.value.trim();
  const code = (isEditing || document.getElementById('custom-role-code')?.value || '').trim().toLowerCase();
  const domain = document.getElementById('custom-role-domain')?.value.trim();
  const scope = document.getElementById('custom-role-scope')?.value.trim() || 'Module Scope';
  const accessLevel = document.getElementById('custom-role-access')?.value.trim() || 'Operational Access';

  if (!name || !code) {
    if (typeof APP !== 'undefined' && APP.showToast) {
      APP.showToast('Please provide both role name and unique role code.', 'error');
    }
    return;
  }

  if (isEditing) {
    const role = SYSTEM_ROLES_CATALOG.find(r => r.code === isEditing);
    if (role) {
      role.name = name;
      role.domain = domain;
      role.scope = scope;
      role.accessLevel = accessLevel;

      // Update storage for edited roles
      try {
        const raw = localStorage.getItem(UPDATED_ROLES_STORAGE_KEY);
        let updated = raw ? JSON.parse(raw) : {};
        updated[code] = { name, domain, scope, accessLevel };
        localStorage.setItem(UPDATED_ROLES_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {}

      // If custom role, also update custom storage
      try {
        const raw = localStorage.getItem(CUSTOM_ROLES_STORAGE_KEY);
        let custom = raw ? JSON.parse(raw) : [];
        const match = custom.find(c => c.code === code);
        if (match) {
          match.name = name;
          match.domain = domain;
          match.scope = scope;
          match.accessLevel = accessLevel;
          localStorage.setItem(CUSTOM_ROLES_STORAGE_KEY, JSON.stringify(custom));
        }
      } catch (err) {}

      if (window.dbClient) {
        try {
          await window.dbClient.from('roles').update({
            name,
            description: domain
          }).eq('code', code);
        } catch (dbErr) {
          console.warn('[UserRoles] Remote role update notice:', dbErr);
        }
      }

      if (window.RBAC && window.RBAC.logAudit) {
        await window.RBAC.logAudit('ROLE_UPDATED', { roleCode: code, roleName: name });
      }

      if (typeof APP !== 'undefined' && APP.showToast) {
        APP.showToast(`Role "${name}" updated successfully!`, 'success');
      }
    }
  } else {
    if (SYSTEM_ROLES_CATALOG.some(r => r.code === code)) {
      if (typeof APP !== 'undefined' && APP.showToast) {
        APP.showToast(`Role code "${code}" is already in use. Please choose a different code.`, 'error');
      }
      return;
    }

    const newRole = {
      code,
      name,
      domain,
      scope,
      accessLevel,
      icon: 'shield',
      color: '#0C3925',
      is_system: false
    };

    SYSTEM_ROLES_CATALOG.push(newRole);

    try {
      const rawDel = localStorage.getItem(DELETED_ROLES_STORAGE_KEY);
      let deletedList = rawDel ? JSON.parse(rawDel) : [];
      if (deletedList.includes(code)) {
        deletedList = deletedList.filter(c => c !== code);
        localStorage.setItem(DELETED_ROLES_STORAGE_KEY, JSON.stringify(deletedList));
      }
    } catch (err) {}

    try {
      const raw = localStorage.getItem(CUSTOM_ROLES_STORAGE_KEY);
      let custom = raw ? JSON.parse(raw) : [];
      // Remove any existing copy with this code
      custom = custom.filter(c => c.code !== code);
      custom.push(newRole);
      localStorage.setItem(CUSTOM_ROLES_STORAGE_KEY, JSON.stringify(custom));
    } catch (err) {}

    if (window.dbClient) {
      try {
        await window.dbClient.from('roles').upsert([{
          code,
          name,
          description: domain,
          is_system: false
        }], { onConflict: 'code' });
      } catch (dbErr) {
        console.warn('[UserRoles] Remote role insert notice:', dbErr);
      }
    }

    if (window.RBAC && window.RBAC.logAudit) {
      await window.RBAC.logAudit('ROLE_CREATED', { roleCode: code, roleName: name });
    }

    if (typeof APP !== 'undefined' && APP.showToast) {
      APP.showToast(`Custom role "${name}" created successfully!`, 'success');
    }
  }

  closeCustomRoleModal();
  updateStats();
  renderRolesTable();
  updateRoleDropdowns();
  if (window.RBAC && window.RBAC.reloadRoles) {
    window.RBAC.reloadRoles();
  }
}

function updateRoleDropdowns() {
  // 1. User Assignment Modal dropdown
  const roleSelect = document.getElementById('user-role');
  if (roleSelect) {
    const currentVal = roleSelect.value;
    if (SYSTEM_ROLES_CATALOG.length === 0) {
      roleSelect.innerHTML = `<option value="" disabled selected>No roles configured</option>`;
    } else {
      roleSelect.innerHTML = SYSTEM_ROLES_CATALOG.map(r => `
        <option value="${r.code}">${r.name} ${r.is_system ? '' : '(Custom)'}</option>
      `).join('');
      if (currentVal && SYSTEM_ROLES_CATALOG.some(r => r.code === currentVal)) {
        roleSelect.value = currentVal;
      } else {
        roleSelect.value = SYSTEM_ROLES_CATALOG[0].code;
      }
    }
  }

  // 2. Toolbar filter dropdown on User Assignments tab
  const filterSelect = document.getElementById('filter-user-role');
  if (filterSelect) {
    const currentFilter = filterSelect.value;
    const allRolesLabel = SYSTEM_ROLES_CATALOG.length === 0 ? 'All Roles (0)' : 'All Roles';
    filterSelect.innerHTML = `<option value="">${allRolesLabel}</option>` + SYSTEM_ROLES_CATALOG.map(r => `
      <option value="${r.code}">${r.name}</option>
    `).join('');
    if (currentFilter && SYSTEM_ROLES_CATALOG.some(r => r.code === currentFilter)) {
      filterSelect.value = currentFilter;
    } else {
      filterSelect.value = '';
    }
  }

  // 3. Permission Matrix role selector
  const matrixSelect = document.getElementById('matrix-role-selector');
  if (matrixSelect) {
    const currentMatrix = matrixSelect.value;
    if (SYSTEM_ROLES_CATALOG.length === 0) {
      matrixSelect.innerHTML = `<option value="" disabled selected>No roles configured</option>`;
      const matrixTbody = document.getElementById('matrix-tbody');
      if (matrixTbody) {
        matrixTbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">No system or custom roles configured to display permissions.</td></tr>`;
      }
    } else {
      matrixSelect.innerHTML = SYSTEM_ROLES_CATALOG.map(r => `
        <option value="${r.code}">${r.name}</option>
      `).join('');
      if (currentMatrix && SYSTEM_ROLES_CATALOG.some(r => r.code === currentMatrix)) {
        matrixSelect.value = currentMatrix;
      } else {
        matrixSelect.value = SYSTEM_ROLES_CATALOG[0].code;
      }
    }
  }

  // 4. Topbar Active Role (Test / Preview) select (#rbac-role-select)
  const topbarRoleSelect = document.getElementById('rbac-role-select');
  if (topbarRoleSelect) {
    const available = (window.RBAC && typeof window.RBAC.getAvailableRoles === 'function')
      ? window.RBAC.getAvailableRoles()
      : SYSTEM_ROLES_CATALOG;
    const currentRole = window.RBAC ? window.RBAC.getRoleCode() : topbarRoleSelect.value;
    if (available.length === 0) {
      topbarRoleSelect.innerHTML = `<option value="" disabled selected>(No roles configured)</option>`;
    } else {
      topbarRoleSelect.innerHTML = available.map(r => `
        <option value="${r.code}">${r.name}</option>
      `).join('');
      if (currentRole && available.some(r => r.code === currentRole)) {
        topbarRoleSelect.value = currentRole;
      } else {
        topbarRoleSelect.value = available[0].code;
        if (window.RBAC && window.RBAC.switchRole) {
          window.RBAC.switchRole(available[0].code);
        }
      }
    }
  }
}

// Global window registrations for HTML inline event handlers
if (typeof window !== 'undefined') {
  window.openAssignUserModal = openAssignUserModal;
  window.closeUserRoleModal = closeUserRoleModal;
  window.editUserAssignment = editUserAssignment;
  window.revokeUserAssignment = revokeUserAssignment;
  window.reinstateUserAssignment = reinstateUserAssignment;
  window.deleteUserAssignment = deleteUserAssignment;
  window.saveUserRoleAssignment = saveUserRoleAssignment;
  window.populateBranchesAndWarehouses = populateBranchesAndWarehouses;
  window.loadPermissionMatrix = loadPermissionMatrix;
  window.switchRbacTab = switchRbacTab;
  window.filterUsersTable = filterUsersTable;
  window.loadApprovalRequests = loadApprovalRequests;
  window.decideApproval = decideApproval;
  window.renderRolesTable = renderRolesTable;
  window.openRoleMatrix = openRoleMatrix;
  window.assignUserToRole = assignUserToRole;
  window.seedAllTenRoles = seedAllTenRoles;
  window.SYSTEM_ROLES_CATALOG = SYSTEM_ROLES_CATALOG;
  window.editRole = editRole;
  window.deleteRole = deleteRole;
  window.openCustomRoleModal = openCustomRoleModal;
  window.closeCustomRoleModal = closeCustomRoleModal;
  window.saveCustomRole = saveCustomRole;
  window.autoFillRoleCode = autoFillRoleCode;
  window.updateRoleDropdowns = updateRoleDropdowns;
}

