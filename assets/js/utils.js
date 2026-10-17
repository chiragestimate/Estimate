/* ─── utils.js ────────────────────────────────────────── */
function fmtCurrency(val, symbol = '₹') {
  const n = parseFloat(val) || 0;
  return symbol + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateInput(str) {
  if (!str) return '';
  return str.split('T')[0];
}
function getTodayDateString(timeZone = 'Asia/Kolkata') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : '';
  } catch (err) {
    return new Date().toISOString().split('T')[0];
  }
}
function todayStr() {
  return getTodayDateString();
}
function setDefaultDateValue(input, fallbackDate = getTodayDateString()) {
  if (!input) return fallbackDate;
  if (input.value) return input.value;
  input.value = fallbackDate;
  return input.value;
}
function applyDefaultDateInputs(root = document, options = {}) {
  const targetRoot = root && typeof root.querySelectorAll === 'function' ? root : document;
  const skipFieldNames = new Set((options.skipFieldNames || []).map(name => String(name).toLowerCase()));
  const skipFieldIds = new Set((options.skipFieldIds || []).map(id => String(id).toLowerCase()));
  const today = getTodayDateString();
  targetRoot.querySelectorAll('input[type="date"]').forEach(input => {
    const name = String(input.name || '').toLowerCase();
    const id = String(input.id || '').toLowerCase();
    if (
      input.disabled || 
      input.readOnly || 
      input.dataset.noDefaultDate === 'true' || 
      skipFieldNames.has(name) || 
      skipFieldIds.has(id) ||
      id.includes('filter') ||
      name.includes('filter') ||
      id.includes('from') ||
      name.includes('from') ||
      id.includes('to') ||
      name.includes('to')
    ) return;
    if (!input.value) input.value = today;
  });
}
function fmtNumber(val, decimals = 2) {
  return (parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPercent(val) {
  return (parseFloat(val) || 0).toFixed(1) + '%';
}
function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}
function isPhoneFieldName(name = '') { return /contact|phone|mobile/i.test(String(name || '')); }
function isGstinFieldName(name = '') { return /gst|gstin/i.test(String(name || '')); }
function capitalizeWord(word) {
  const lower = String(word || '').toLowerCase();
  const firstLetterIndex = lower.search(/[a-z]/i);
  if (firstLetterIndex === -1) return lower;
  return `${lower.slice(0, firstLetterIndex)}${lower.charAt(firstLetterIndex).toUpperCase()}${lower.slice(firstLetterIndex + 1)}`;
}
function formatTitleCaseWithPercentRules(value) {
  const parts = String(value || '').split(/(\s+)/);
  let uppercaseUntilPlus = false;
  return parts.map(part => {
    if (!part || /^\s+$/.test(part)) return part;
    if (part === '+') { uppercaseUntilPlus = false; return part; }
    const normalized = uppercaseUntilPlus ? part.toUpperCase() : capitalizeWord(part);
    if (/^\d+(?:\.\d+)?%$/.test(part)) uppercaseUntilPlus = true;
    return normalized;
  }).join('');
}
function normalizeTextValue(value, fieldName = '') {
  if (isPhoneFieldName(fieldName)) return formatPhone(value);
  if (isGstinFieldName(fieldName)) return String(value || '').toUpperCase();
  return formatTitleCaseWithPercentRules(value);
}
function shouldNormalizeFormField(field) {
  if (!field) return false;
  const tagName = (field.tagName || '').toUpperCase();
  if (tagName === 'TEXTAREA') return true;
  if (tagName !== 'INPUT') return false;
  const type = String(field.type || '').toLowerCase();
  return !['number', 'date', 'email', 'search', 'checkbox', 'radio', 'hidden', 'file', 'password'].includes(type);
}
const STATUS_CLASSES = {
  // Completed / Delivered / Paid
  'Delivered': 'badge-completed',
  'Completed': 'badge-completed',
  'Paid': 'badge-completed',
  'Fully Dispatched': 'badge-completed',
  'Active': 'badge-approved',
  'In Stock': 'badge-approved',

  // Approved / Verified
  'Approved': 'badge-approved',
  'Verified': 'badge-approved',

  // Pending / In Review
  'Pending': 'badge-pending',
  'Pending Approval': 'badge-pending',
  'Pending Verification': 'badge-pending',
  'Processing': 'badge-partial',
  'Awaiting': 'badge-pending',

  // Quarantine / Holds
  'Quarantine': 'badge-quarantine',
  'Quarantined': 'badge-quarantine',
  'On Hold': 'badge-onhold',
  'Under Inspection': 'badge-quarantine',

  // Logistics & In-Transit
  'In-Transit': 'badge-intransit',
  'In Transit': 'badge-intransit',
  'Dispatched': 'badge-intransit',
  'Shipped': 'badge-intransit',

  // Partial Fulfillments
  'Partially Dispatched': 'badge-partial',
  'Partially Received': 'badge-partial',
  'Partial': 'badge-partial',
  'Partial Receipt': 'badge-partial',

  // Negative / Problem Statuses
  'Rejected': 'badge-rejected',
  'Overdue': 'badge-danger',
  'Cancelled': 'badge-rejected',
  'Void': 'badge-rejected',
  'Low Stock': 'badge-lowstock',

  // Neutral / Draft / Inactive
  'Out of Stock': 'badge-gray',
  'Draft': 'badge-draft',
  'Inactive': 'badge-inactive',
  'Closed': 'badge-gray',

  // Traceable Reversals
  'Reversed': 'badge-reversed'
};

function statusBadge(status, showDot = true) {
  if (!status) return '—';
  const raw = String(status).trim();
  const cls = STATUS_CLASSES[raw] || 'badge-gray';
  const dotHtml = showDot ? '<span class="badge-dot"></span>' : '';
  return `<span class="badge ${cls}">${dotHtml}${raw}</span>`;
}

function debounce(fn, wait = 250) {
  let timeout = null;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(context, args), wait);
  };
}

function formatPackagingBreakdown({
  boxes = 0,
  unitsPerBox = 1,
  looseUnits = 0,
  totalUnits = 0,
  unit = 'Bottles',
  volumeOrWeight = null,
  compact = false
} = {}) {
  const b = parseInt(boxes, 10) || 0;
  const upb = parseInt(unitsPerBox, 10) || 1;
  const l = parseInt(looseUnits, 10) || 0;
  const tot = parseInt(totalUnits, 10) || ((b * upb) + l);

  if (compact) {
    let text = `${tot} ${unit}`;
    if (b > 0 && l > 0) text = `${b} Bx + ${l} ls (${tot} ${unit})`;
    else if (b > 0) text = `${b} Bx (${tot} ${unit})`;
    return `<span class="pkg-breakdown-tag pkg-compact">${text}</span>`;
  }

  let html = '<div class="pkg-breakdown-tag">';
  if (b > 0) {
    html += `<span class="pkg-pill box" title="Cartons / Boxes">📦 ${b} Bx ${upb > 1 ? `(${upb}/bx)` : ''}</span>`;
  }
  if (l > 0 || b === 0) {
    html += `<span class="pkg-pill loose" title="Loose Units">+ ${l} Loose</span>`;
  }
  html += `<span class="pkg-pill total" title="Total Equivalent Units">= ${tot} ${unit}</span>`;
  if (volumeOrWeight) {
    html += `<span class="pkg-pill vol" title="Net Volume or Mass">(${volumeOrWeight})</span>`;
  }
  html += '</div>';
  return html;
}
function applyMobileTableLabels(tableOrId) {
  const table = typeof tableOrId === 'string' ? document.getElementById(tableOrId) : tableOrId;
  if (!table) return;
  const wrap = table.closest('.table-wrap');
  if (wrap) wrap.classList.add('data-table-wrap-mobile');
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
  table.querySelectorAll('tbody tr').forEach(tr => {
    Array.from(tr.querySelectorAll('td')).forEach((td, i) => {
      const label = headers[i] || '';
      td.setAttribute('data-label', label);
      if (isPhoneFieldName(label)) {
        const rawText = td.textContent.trim();
        if (rawText && rawText !== '—' && rawText !== 'â€"') td.textContent = formatPhone(rawText);
      }
      if (label && !td.querySelector('.mobile-label') && label !== 'Actions' && label !== 'Select') {
        const lbl = document.createElement('div');
        lbl.className = 'mobile-label'; lbl.textContent = label; td.prepend(lbl);
      }
    });
  });
}

function renderTableSkeleton(tableOrId, rows = 6, force = false) {
  const table = typeof tableOrId === 'string' ? document.getElementById(tableOrId) : tableOrId;
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const headCount = table.querySelectorAll('thead th').length || 1;
  if (!tbody) return;
  if (!force && tbody.children.length > 0 && !tbody.querySelector('.skeleton-table-row')) return;
  tbody.innerHTML = Array.from({ length: rows }).map(() => `<tr class="skeleton-table-row">${Array.from({ length: headCount }).map(() => `<td><div class="skeleton-line ${Math.random() > 0.5 ? 'w-80' : 'w-60'}"></div></td>`).join('')}</tr>`).join('');
}
function setSkeletonText(elOrId, widthClass = 'w-60', large = false, force = false) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;
  if (!force && el.textContent.trim() !== '' && !el.querySelector('.skeleton-line')) return;
  el.innerHTML = `<div class="skeleton-line ${large ? 'lg ' : ''}${widthClass}"></div>`;
}
function renderListSkeleton(containerOrId, count = 5) {
  const container = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
  if (!container) return;
  container.innerHTML = Array.from({ length: count }).map(() => `<div class="skeleton-list-item"><div class="skeleton-dot"></div><div class="skeleton-stack" style="flex:1"><div class="skeleton-line w-50"></div><div class="skeleton-line sm w-80"></div></div><div class="skeleton-badge"></div></div>`).join('');
}
function getFormData(formId) {
  const form = document.getElementById(formId);
  if (!form) return {};
  const data = {};
  new FormData(form).forEach((val, key) => {
    let field = form.elements[key];
    if (field && field.length && !field.type) field = field[0];
    let finalVal = shouldNormalizeFormField(field) ? normalizeTextValue(val, key) : val;
    
    if (finalVal === '') {
      finalVal = null; // Convert empty strings to null to satisfy Postgres strict types
    } else if (field && field.type === 'number') {
      finalVal = parseFloat(finalVal);
    }
    
    data[key] = finalVal;
  });
  return data;
}
function populateForm(formId, data) {
  const form = document.getElementById(formId);
  if (!form) return;
  Object.entries(data).forEach(([k, v]) => {
    const el = form.elements[k];
    if (el) {
      el.value = shouldNormalizeFormField(el) ? normalizeTextValue(v ?? '', k) : (v ?? '');
      if (el.tagName && el.tagName.toUpperCase() === 'SELECT') {
        el.dispatchEvent(new Event('change'));
      }
    }
  });
}
function destroyChart(chartRef) { if (chartRef && typeof chartRef.destroy === 'function') chartRef.destroy(); }
function initAllAutocompleteSelects() { if (window.UniversalSearchSelect) UniversalSearchSelect.initAll(); }

function normalizeUnit(unitStr) {
  if (typeof window !== 'undefined' && window.INVENTORY_CORE && window.INVENTORY_CORE.normalizeUnit) {
    return window.INVENTORY_CORE.normalizeUnit(unitStr);
  }
  if (!unitStr) return 'Nos';
  const u = String(unitStr).trim().toLowerCase();
  if (['kg', 'kilogram', 'kilograms', 'kilo'].includes(u)) return 'Kg';
  if (['gram', 'grams', 'g', 'gm'].includes(u)) return 'Gram';
  if (['litre', 'litres', 'ltr', 'ltr.', 'l'].includes(u)) return 'Litre';
  if (['ml', 'milliliter', 'milliliters'].includes(u)) return 'Ml';
  if (['nos', 'pcs', 'box', 'bag', 'drum', 'piece', 'pieces', 'no'].includes(u)) return 'Nos';
  return 'Nos';
}

function formatCategoryLabel(str) {
  if (!str) return '';
  const s = String(str).trim();
  if (!s) return '';
  const words = s.replace(/[-_]/g, ' ').split(/\s+/);
  return words.map(w => {
    const lower = w.toLowerCase();
    if (['pgr', 'ec', 'sc', 'wp', 'sl', 'gr', 'sg', 'fs', 'wg'].includes(lower)) {
      return lower.toUpperCase();
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

function convertUnit(qty, fromUnit, toUnit, density = 1.0) {
  if (typeof window !== 'undefined' && window.INVENTORY_CORE && window.INVENTORY_CORE.convertUnit) {
    try {
      return window.INVENTORY_CORE.convertUnit(qty, fromUnit, toUnit, density);
    } catch (_) {}
  }
  const q = parseFloat(qty) || 0;
  if (!fromUnit || !toUnit) return q;
  const f = normalizeUnit(fromUnit);
  const t = normalizeUnit(toUnit);
  if (f === t) return q;
  
  if ((f === 'Litre' || f === 'Kg') && (t === 'Ml' || t === 'Gram')) return q * 1000;
  if ((f === 'Ml' || f === 'Gram') && (t === 'Litre' || t === 'Kg')) return q / 1000;
  if ((f === 'Litre' && t === 'Kg') || (f === 'Kg' && t === 'Litre')) return q;
  
  return q;
}

function exportToCSV(data, label) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Headers row
  csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
  
  // Data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const val = row[header];
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });
  
  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${label.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToExcel(data, label) {
  if (!data || !data.length) return;
  if (window.XLSX) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31)); // sheet names limited to 31 chars
    XLSX.writeFile(wb, `${label.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  } else {
    // Fallback to CSV if SheetJS isn't available
    exportToCSV(data, label);
  }
}

function parsePackSizeInMl(str) {
  if (!str) return 0;
  const s = String(str).toLowerCase().trim();
  const match = s.match(/([\d.]+)\s*([a-zA-Z.]+)?/);
  if (!match) return 0;
  const val = parseFloat(match[1]) || 0;
  const unit = normalizeUnit(match[2] || '');
  if (unit === 'Litre' || unit === 'Kg') {
    return val * 1000;
  }
  return val;
}

function sortPackSizesDescending(items, sizeGetter = (x => x.packaging_size || x.size || x)) {
  return [...items].sort((a, b) => {
    const sizeA = parsePackSizeInMl(sizeGetter(a));
    const sizeB = parsePackSizeInMl(sizeGetter(b));
    return sizeB - sizeA;
  });
}

function extractNumericPart(val) {
  if (val === null || val === undefined) return -1;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  // Find last contiguous digits in string, e.g. "O-10" -> 10, "DTXN-1001" -> 1001, "EXP-05" -> 5
  const match = str.match(/(\d+)(?!.*\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? -1 : num;
  }
  return -1;
}

function parseTimestamp(val) {
  if (!val) return null;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number' && val > 100000) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const t = Date.parse(trimmed);
    return isNaN(t) ? null : t;
  }
  return null;
}

function sortLatestFirst(items, getter = null) {
  if (!Array.isArray(items) || items.length <= 1) {
    return Array.isArray(items) ? [...items] : [];
  }

  // Preserve initial relative arrival index to reliably reverse natural addition order (A, B, C -> C, B, A)
  // even if items lack IDs, timestamps, or sequence codes.
  const indexed = items.map((item, originalIndex) => ({ item, originalIndex }));

  indexed.sort((aObj, bObj) => {
    const a = aObj.item;
    const b = bObj.item;
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    // 1. If explicit getter provided, evaluate it first
    if (typeof getter === 'function') {
      const valA = getter(a);
      const valB = getter(b);
      const numA = extractNumericPart(valA);
      const numB = extractNumericPart(valB);
      if (numA !== -1 && numB !== -1 && numA !== numB) {
        return numB - numA;
      }
      const tA = parseTimestamp(valA);
      const tB = parseTimestamp(valB);
      if (tA !== null && tB !== null && tA !== tB) {
        return tB - tA;
      }
      if (valA && valB && typeof valA === 'string' && typeof valB === 'string' && valA !== valB) {
        const cmp = valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }
    }

    // 2. Direct sequence / reference code comparison (order_no, purchase_no, txn_no, batch_no, ref_no, invoice_no)
    const refA = a.order_no || a.purchase_no || a.txn_no || a.batch_no || a.ref_no || a.invoice_no;
    const refB = b.order_no || b.purchase_no || b.txn_no || b.batch_no || b.ref_no || b.invoice_no;
    if (refA || refB) {
      const numRefA = extractNumericPart(refA);
      const numRefB = extractNumericPart(refB);
      if (numRefA !== -1 && numRefB !== -1 && numRefA !== numRefB) {
        return numRefB - numRefA;
      }
    }

    // 3. Numeric ID comparison (id, _id, item_id) -> 10 -> 9 -> 8
    const idA = extractNumericPart(a.id ?? a._id ?? a.item_id);
    const idB = extractNumericPart(b.id ?? b._id ?? b.item_id);
    if (idA !== -1 && idB !== -1 && idA !== idB) {
      return idB - idA;
    }

    // 4. Exact created_at / timestamp comparison
    const timeA = parseTimestamp(a.created_at || a.createdAt || a.timestamp);
    const timeB = parseTimestamp(b.created_at || b.createdAt || b.timestamp);
    if (timeA !== null && timeB !== null && timeA !== timeB) {
      return timeB - timeA;
    }

    // 5. Business date comparison (date, purchase_date, order_date, txn_date)
    const dateA = parseTimestamp(a.date || a.purchase_date || a.order_date || a.txn_date);
    const dateB = parseTimestamp(b.date || b.purchase_date || b.order_date || b.txn_date);
    if (dateA !== null && dateB !== null && dateA !== dateB) {
      return dateB - dateA;
    }

    // 6. Natural addition sequence fallback:
    // If records A, B, C were added in that order, originalIndex is 0, 1, 2.
    // Higher originalIndex means added later -> C (2) -> B (1) -> A (0).
    return bObj.originalIndex - aObj.originalIndex;
  });

  return indexed.map(obj => obj.item);
}

function sortByNumericIdDesc(items, getter = null) {
  return sortLatestFirst(items, getter);
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

const utilsObj = { fmtCurrency, fmtDate, fmtDateInput, todayStr, getTodayDateString, setDefaultDateValue, applyDefaultDateInputs, fmtNumber, fmtPercent, formatPhone, isPhoneFieldName, isGstinFieldName, normalizeTextValue, formatTitleCaseWithPercentRules, formatCategoryLabel, statusBadge, debounce, formatPackagingBreakdown, applyMobileTableLabels, renderTableSkeleton, setSkeletonText, renderListSkeleton, getFormData, populateForm, destroyChart, initAllAutocompleteSelects, normalizeUnit, convertUnit, parsePackSizeInMl, sortPackSizesDescending, extractNumericPart, sortByNumericIdDesc, sortLatestFirst, exportToCSV, exportToExcel, escapeHtml };

if (typeof window !== 'undefined') {
  window.UTILS = utilsObj;
  window.escapeHtml = escapeHtml;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = utilsObj;
}

if (typeof navigator !== 'undefined' && "serviceWorker" in navigator && typeof window !== 'undefined') {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("../sw.js").then(reg => console.log("SW registered")).catch(err => console.log("SW failed", err));
  });
} 
