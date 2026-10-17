// ─── SUPABASE HELPER ──────────────────────────────────────────
function getSupabaseClient() {
  if (window.dbClient) return window.dbClient;
  if (typeof window.supabase !== 'undefined' && window.supabase?.createClient) {
    const supabaseUrl = 'https://jtbettizhwwqmuyofapm.supabase.co';
    const supabaseKey = 'sb_publishable_kSf8e6RD96lT40di2YqxxQ_gJ3WS6ve';
    try {
      window.dbClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: { storage: window.localStorage }
      });
      return window.dbClient;
    } catch (e) {
      console.warn('Supabase init in api.js error:', e);
    }
  }
  return null;
}

// ─── PRODUCT API ─────────────────────────────────────────
async function getProducts() {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const [prodRes, packRes] = await Promise.all([
        sb.from('products').select('*'),
        sb.from('product_packaging').select('*')
      ]);
      if (!prodRes.error && Array.isArray(prodRes.data)) {
        const prodData = prodRes.data;
        const packData = packRes.data || [];
        const pkgByProd = {};
        for (const pk of packData) {
          if (!pkgByProd[pk.product_id]) pkgByProd[pk.product_id] = [];
          pkgByProd[pk.product_id].push(pk);
        }

        const list = [];
        for (const p of prodData) {
          const pkgs = pkgByProd[p.id];
          if (pkgs && pkgs.length > 0) {
            for (const pk of pkgs) {
              list.push({
                ProductID: String(p.id),
                id: p.id,
                BrandName: p.brand || '',
                brand: p.brand || '',
                ProductName: p.name || '',
                product: p.name || '',
                name: p.name || '',
                sku: p.sku || '',
                PackagingSize: pk.packaging_size || p.unit || '',
                packaging: pk.packaging_size || p.unit || '',
                units_per_box: parseInt(pk.units_per_box, 10) || 0,
                volume_ml: parseFloat(pk.volume_ml) || 0,
                weight_gm: parseFloat(pk.weight_gm) || 0,
                unit: p.unit || 'Bottles',
                UnitPrice: pk.sell_price != null ? pk.sell_price : (p.sell_price || 0),
                price: pk.sell_price != null ? pk.sell_price : (p.sell_price || 0),
                hsn: p.gst || ''
              });
            }
          } else {
            list.push({
              ProductID: String(p.id),
              id: p.id,
              BrandName: p.brand || '',
              brand: p.brand || '',
              ProductName: p.name || '',
              product: p.name || '',
              name: p.name || '',
              sku: p.sku || '',
              PackagingSize: p.unit || '',
              packaging: p.unit || '',
              units_per_box: 0,
              volume_ml: 0,
              weight_gm: 0,
              unit: p.unit || 'Bottles',
              UnitPrice: p.sell_price || 0,
              price: p.sell_price || 0,
              hsn: p.gst || ''
            });
          }
        }
        return list;
      }
    } catch (e) {
      console.warn('getProducts Supabase error:', e);
    }
  }
  return [];
}

async function addProduct(product) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Database connection not available');
  const name = (product.ProductName || product.product || product.name || '').trim();
  const brand = (product.BrandName || product.brand || '').trim();
  const packaging = (product.PackagingSize || product.packaging || product.size || '').trim();
  const price = parseFloat(product.UnitPrice || product.price || 0) || 0;

  if (!name) throw new Error('Product name is required');

  let prodId = null;
  const { data: existing } = await sb.from('products').select('id').eq('name', name).limit(1);
  if (existing && existing.length > 0) {
    prodId = existing[0].id;
  } else {
    const prodPayload = {
      name: name,
      brand: brand,
      unit: packaging || 'Kg',
      sell_price: price,
      category: 'Finished Good',
      status: 'Active'
    };
    const { data: ins, error: pErr } = await sb.from('products').insert([prodPayload]).select();
    if (pErr) throw new Error(pErr.message || 'Failed to create product');
    prodId = ins[0].id;
  }

  if (packaging) {
    const { error: pkErr } = await sb.from('product_packaging').insert([{
      product_id: prodId,
      packaging_size: packaging,
      sell_price: price,
      purchase_price: 0
    }]);
    if (pkErr) console.warn('Packaging insert note:', pkErr.message);
  }

  return { success: true, id: prodId };
}

async function updateProduct(product) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Database connection not available');
  const rawId = product.id || product.ProductID;
  const numId = parseInt(String(rawId).replace(/\D/g, ''), 10);
  if (!numId) throw new Error('Valid Product ID is required for update');

  const name = (product.ProductName || product.product || product.name || '').trim();
  const brand = (product.BrandName || product.brand || '').trim();
  const packaging = (product.PackagingSize || product.packaging || product.size || '').trim();
  const price = parseFloat(product.UnitPrice || product.price || 0) || 0;

  const prodPayload = {
    name: name,
    brand: brand,
    sell_price: price
  };
  if (packaging) prodPayload.unit = packaging;

  const { error: pErr } = await sb.from('products').update(prodPayload).eq('id', numId);
  if (pErr) throw new Error(pErr.message || 'Failed to update product');

  if (packaging) {
    const { data: pkgs } = await sb.from('product_packaging').select('id, packaging_size').eq('product_id', numId);
    const existingPkg = (pkgs || []).find(pk => (pk.packaging_size || '').toLowerCase() === packaging.toLowerCase());
    if (existingPkg) {
      await sb.from('product_packaging').update({ sell_price: price }).eq('id', existingPkg.id);
    } else {
      await sb.from('product_packaging').insert([{
        product_id: numId,
        packaging_size: packaging,
        sell_price: price,
        purchase_price: 0
      }]);
    }
  }

  return { success: true };
}

async function deleteProduct(idOrObj) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Database connection not available');
  const rawId = typeof idOrObj === 'object' ? (idOrObj.ProductID || idOrObj.id || idOrObj.productName) : idOrObj;
  const numId = parseInt(String(rawId).replace(/\D/g, ''), 10);
  if (!numId) throw new Error('Valid Product ID is required for deletion');

  await sb.from('product_packaging').delete().eq('product_id', numId);
  const { error } = await sb.from('products').delete().eq('id', numId);
  if (error) throw new Error(error.message || 'Failed to delete product');
  return { success: true };
}

async function searchProduct(query) {
  const prods = await getProducts();
  const q = String(query || '').toLowerCase().trim();
  if (!q) return prods;
  return prods.filter(p => (p.ProductName || '').toLowerCase().includes(q) || (p.BrandName || '').toLowerCase().includes(q));
}

// ─── CLIENT API ──────────────────────────────────────────
async function getClients() {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('clients').select('*');
      if (!error && Array.isArray(data)) {
        return data.map(c => ({
          ClientID: String(c.id || ''),
          id: c.id,
          ClientName: c.name || '',
          name: c.name || '',
          Address: [c.address, c.city].filter(Boolean).join(', '),
          address: [c.address, c.city].filter(Boolean).join(', '),
          Phone: c.contact || '',
          phone: c.contact || '',
          GSTIN: (c.gst || '').toUpperCase(),
          gst: (c.gst || '').toUpperCase(),
          DueAmount: parseFloat(c.balance) || 0,
          due: parseFloat(c.balance) || 0
        }));
      }
    } catch (e) {
      console.warn('getClients Supabase error:', e);
    }
  }
  return [];
}

async function addClient(client) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Database connection not available');
  const cname = (client.ClientName || client.name || '').trim();
  if (!cname) throw new Error('Client Name is required');

  const payload = {
    name: cname,
    address: (client.Address || client.address || '').trim(),
    contact: (client.Phone || client.phone || '').trim(),
    gst: (client.GSTIN || client.gstin || '').trim().toUpperCase(),
    balance: parseFloat(client.DueAmount || client.due || 0) || 0,
    type: 'Retailer'
  };

  const { data, error } = await sb.from('clients').insert([payload]).select();
  if (error) throw new Error(error.message || 'Failed to save client');
  return { success: true, data: data ? data[0] : null };
}

async function updateClient(client) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Database connection not available');
  const rawId = client.id || client.ClientID;
  const numId = parseInt(String(rawId).replace(/\D/g, ''), 10);
  if (!numId) throw new Error('Valid Client ID is required for update');

  const payload = {
    name: (client.ClientName || client.name || '').trim(),
    address: (client.Address || client.address || '').trim(),
    contact: (client.Phone || client.phone || '').trim(),
    gst: (client.GSTIN || client.gstin || '').trim().toUpperCase(),
    balance: parseFloat(client.DueAmount || client.due || 0) || 0
  };

  const { error } = await sb.from('clients').update(payload).eq('id', numId);
  if (error) throw new Error(error.message || 'Failed to update client');
  return { success: true };
}

async function deleteClient(idOrObj) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Database connection not available');
  const rawId = typeof idOrObj === 'object' ? (idOrObj.ClientID || idOrObj.id || idOrObj.phone) : idOrObj;
  const numId = parseInt(String(rawId).replace(/\D/g, ''), 10);
  if (!numId) throw new Error('Valid Client ID is required for deletion');

  const { error } = await sb.from('clients').delete().eq('id', numId);
  if (error) throw new Error(error.message || 'Failed to delete client');
  return { success: true };
}

async function searchClient(query) {
  const list = await getClients();
  const q = String(query || '').toLowerCase().trim();
  if (!q) return list;
  return list.filter(c => (c.ClientName || '').toLowerCase().includes(q) || (c.Phone || '').includes(q));
}

// Export API
const api = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  searchProduct,
  getClients,
  addClient,
  updateClient,
  deleteClient,
  searchClient,
  apiGetInvoices,
  apiGetInvoice,
  apiSaveInvoice,
  apiUpdateInvoice,
  apiDeleteInvoice,
  apiGetNextInvoiceNumber,
};
window.api = api;
/* ==========================================================================
   api.js  —  Google Apps Script backend communication layer
   Invoice System
   All API calls go through this single file.
   To change backend: only update APPS_SCRIPT_URL below.
   ========================================================================== */

'use strict';

// Safe localStorage wrapper to prevent crashes in private windows / disabled cookies
window.safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage.getItem failed for key: ' + key, e);
      return window['__fs_' + key] || null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage.setItem failed for key: ' + key, e);
      window['__fs_' + key] = String(value);
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage.removeItem failed for key: ' + key, e);
      delete window['__fs_' + key];
    }
  }
};

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = window.location.origin.includes(':7890') ? 'http://localhost:8000/api' : window.location.origin + '/api';
const API_SECRET = 'sk_agro_secure_key_2026'; // Added Security Token

// Request timeout in milliseconds
const API_TIMEOUT_MS = 25000;

// ─── CORE FETCH WRAPPER ───────────────────────────────────────────────────────
/**
 * Internal helper: fetch with timeout + JSON parse + error normalization.
 * GET requests: pass params as URLSearchParams.
 * POST requests: pass body as plain JS object (will be JSON-stringified).
 */
async function _apiFetch(params = {}, body = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const url = new URL(APPS_SCRIPT_URL);
    // Attach the security token to every request alongside other params
    url.searchParams.set('apiKey', API_SECRET);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const options = { signal: controller.signal };

    if (body !== null) {
      // POST — Apps Script doesn't support real PUT/DELETE easily,
      // so we tunnel the HTTP method via ?action param.
      options.method = 'POST';
      // To bypass CORS preflight OPTIONS, we use text/plain
      options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      options.body = JSON.stringify(body);
    } else {
      options.method = 'GET';
    }

    const res = await fetch(url.toString(), options);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const json = await res.json();

    if (json.error) throw new Error(json.error);
    return json;

  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Check your internet connection.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}


// ─── PUBLIC API FUNCTIONS ─────────────────────────────────────────────────────

/**
 * GET /invoices — Load invoice list (summary only, no full JSON for performance).
 * @param {object} filters  Optional: { customer, dateFrom, dateTo, status, limit }
 * @returns {Promise<Array>} Array of invoice summary objects.
 */
async function apiGetInvoices(filters = {}) {
  try {
    const raw = safeStorage.getItem('invoice_history_cache');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list.map(inv => {
          const invNumStr = String(inv.InvoiceNumber || inv.invoiceNumber || inv.inv_num || inv.Number || inv['Invoice #'] || '—').trim();
          const rawDate = String(inv.date || inv.Date || '');
          const cleanDate = rawDate.match(/^\d{4}-\d{2}-\d{2}/) ? rawDate.substring(0, 10) : rawDate;
          const rawDue = String(inv.dueDate || inv.DueDate || '');
          const cleanDue = rawDue.match(/^\d{4}-\d{2}-\d{2}/) ? rawDue.substring(0, 10) : rawDue;

          return {
            ...inv,
            invoiceNumber: invNumStr,
            uniqueId: String(inv.uniqueId || invNumStr),
            customerName: String(inv.customerName || inv.ClientName || 'Unknown'),
            date: cleanDate || '—',
            dueDate: cleanDue || '',
            totalAmount: parseFloat(inv.totalAmount || inv.GrandTotal || 0),
            mobile: String(inv.mobile || inv.Phone || inv.ClientPhone || '')
          };
        }).sort((a, b) => {
          const numA = parseInt(String(a.invoiceNumber || a.uniqueId || '').replace(/\D/g, ''), 10) || 0;
          const numB = parseInt(String(b.invoiceNumber || b.uniqueId || '').replace(/\D/g, ''), 10) || 0;
          if (numA !== numB) return numB - numA;
          return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
        });
      }
    }
  } catch (e) {}
  return [];
}

async function apiGetInvoice(uniqueId) {
  if (!uniqueId) throw new Error('Invoice ID is required.');
  try {
    const raw = safeStorage.getItem('inv_doc_' + uniqueId);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const history = await apiGetInvoices();
  const tid = String(uniqueId).trim();
  const match = history.find(i =>
    String(i.uniqueId).trim() === tid ||
    String(i.invoiceNumber).trim() === tid ||
    String(i.InvoiceNumber).trim() === tid
  );
  if (match) return match;
  throw new Error('Invoice not found: ' + uniqueId);
}

async function apiSaveInvoice(invoiceData) {
  _validateInvoicePayload(invoiceData);
  const uniqueId = invoiceData.meta?.uniqueId || ('INV-' + Date.now().toString(36).toUpperCase());
  invoiceData.meta = invoiceData.meta || {};
  invoiceData.meta.uniqueId = uniqueId;

  // Persist the full document payload in safeStorage
  safeStorage.setItem('inv_doc_' + uniqueId, JSON.stringify(invoiceData));

  // Update history cache list
  let history = [];
  try {
    history = JSON.parse(safeStorage.getItem('invoice_history_cache') || '[]');
  } catch (e) { history = []; }

  const summary = {
    uniqueId: uniqueId,
    invoiceNumber: invoiceData.InvoiceNumber || invoiceData.meta?.invoiceNumber || uniqueId,
    date: invoiceData.meta?.date || new Date().toISOString().substring(0, 10),
    dueDate: invoiceData.meta?.dueDate || '',
    customerName: invoiceData.customer?.name || invoiceData.ClientName || 'Unnamed Client',
    mobile: invoiceData.customer?.phone || invoiceData.Phone || '',
    totalAmount: parseFloat(invoiceData.calculations?.grandTotal || invoiceData.GrandTotal || 0) || 0,
    totalBoxes: (invoiceData.rows || []).reduce((sum, r) => sum + (parseFloat(r.boxes) || 0), 0),
    totalUnits: (invoiceData.rows || []).reduce((sum, r) => sum + (parseFloat(r.totalUnits || r.qty) || 0), 0),
    is_stock_deducted: invoiceData.is_stock_deducted !== undefined ? invoiceData.is_stock_deducted : false
  };

  const existingIdx = history.findIndex(h => h.uniqueId === uniqueId);
  if (existingIdx >= 0) {
    history[existingIdx] = { ...history[existingIdx], ...summary };
  } else {
    history.unshift(summary);
  }
  safeStorage.setItem('invoice_history_cache', JSON.stringify(history));

  return { success: true, uniqueId, invoiceNumber: summary.invoiceNumber, row: 1 };
}

async function apiUpdateInvoice(invoiceData) {
  return await apiSaveInvoice(invoiceData);
}

async function apiDeleteInvoice(uniqueId) {
  if (!uniqueId) throw new Error('Invoice ID is required for deletion.');
  safeStorage.removeItem('inv_doc_' + uniqueId);
  try {
    let history = JSON.parse(safeStorage.getItem('invoice_history_cache') || '[]');
    history = history.filter(i => i.uniqueId !== uniqueId);
    safeStorage.setItem('invoice_history_cache', JSON.stringify(history));
  } catch(e) {}
  return { success: true };
}

async function apiUpdateClientDue(clientName, dueAmount) {
  if (!clientName) return;
  const sb = getSupabaseClient();
  if (sb) {
    try {
      await sb.from('clients').update({ balance: parseFloat(dueAmount) || 0 }).ilike('name', clientName.trim());
    } catch(e) {
      console.warn('apiUpdateClientDue note:', e.message);
    }
  }
}

async function apiGetNextInvoiceNumber() {
  const cached = safeStorage.getItem('invoice_history_cache');
  if (cached) {
    try {
      const list = JSON.parse(cached);
      const nums = list.map(i => parseInt(String(i.invoiceNumber || 0).replace(/[^0-9]/g, ''), 10) || 0);
      const max = Math.max(99, ...nums);
      return String(max + 1).padStart(3, '0');
    } catch (e) {}
  }
  return '100';
}

// ─── PRIVATE VALIDATION ───────────────────────────────────────────────────────
function _validateInvoicePayload(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid invoice payload.');
  if (!data.meta) throw new Error('Invoice is missing meta block.');
  if (!data.customer) throw new Error('Invoice is missing customer block.');
  if (!Array.isArray(data.rows) || data.rows.length === 0) throw new Error('Invoice must have at least one product row.');
}

// ─── SHARED UI HELPERS (Theme & Profile) ──────────────────────────────────────
function applyTheme(theme = 'light') {
  const current = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', current);
  safeStorage.setItem('theme', current);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  safeStorage.setItem('theme', next);
  localStorage.setItem('theme', next);
}

function showProfileSymbol() {
  const auth = safeStorage.getItem('inv_auth');
  if (!auth) return;
  const tr = document.getElementById('toolbar-right');
  if (!tr || document.getElementById('profile-symbol')) return;

  const p = document.createElement('div');
  p.id = 'profile-symbol';
  p.className = 'profile-circle';
  p.textContent = auth.charAt(0).toUpperCase();
  const mobile = safeStorage.getItem('inv_user_mobile');
  if (mobile) p.title = `Logged in • ${mobile}`;
  tr.appendChild(p);
}

// Global initialization for all pages
window.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem('theme') || 'light');
  showProfileSymbol();

  // ─── GLOBAL TEXT FORMATTING ───────────────────────────────────────────────
  // Apply special formatting to all text-like inputs site-wide
  const handleFormatting = (e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const skipTypes = ['password', 'date', 'checkbox', 'radio', 'file', 'email'];
      if (skipTypes.includes(el.type)) return;

      // Check if it's a phone field
      const isPhone = el.id.toLowerCase().includes('phone') || (el.placeholder && el.placeholder.toLowerCase().includes('phone'));

      if (el.value) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const originalVal = el.value;

        let formatted = originalVal;

        if (isPhone) {
          formatted = formatPhone(originalVal);
          // Prevent cursor jump on phone replace
          if (originalVal !== formatted) {
            el.value = formatted;
            return; // Let user type naturally, phone formatting handles ends
          }
        } else {
          if (el.type !== 'number' && el.type !== 'tel') {
            formatted = formatText(originalVal);
          }
        }

        if (originalVal !== formatted && !isPhone) {
          el.value = formatted;
          // Restore cursor position for 'input' event to prevent jumping
          if (e.type === 'input') {
            try { el.setSelectionRange(start, end); } catch (ex) { }
          }
        }
      }
    }
  };

  document.addEventListener('input', handleFormatting, true);
  document.addEventListener('blur', handleFormatting, true);
  document.addEventListener('change', handleFormatting, true);
});

/**
 * Custom text formatter:
 * 1. Title Case everything BEFORE the '%' character.
 * 2. Force uppercase for specific units (LTR, ML, KG, GM).
 * 3. UPPERCASE everything AFTER the '%' character.
 * Example: "1 ltr water%batch123" -> "1 LTR Water%BATCH123"
 */
function formatText(str) {
  if (!str && str !== 0) return '';
  str = String(str);

  const parts = str.split('%');

  // Step 1: Processing the first part
  let firstPart = parts[0].toLowerCase().split(' ').map(word => {
    if (!word) return '';

    // Default Title Case
    let res = word.charAt(0).toUpperCase() + word.slice(1);

    // If the word IS exactly one of our units (case-insensitive)
    const specialUnits = ['LTR', 'ML', 'KG', 'GM'];
    if (specialUnits.includes(word.toUpperCase())) {
      return word.toUpperCase();
    }

    // Also catch units attached to numbers (e.g., "500ml" or "1ltr")
    // This regex looks for digits followed by one of our units
    const unitRegex = new RegExp('(\\d+)(ltr|ml|kg|gm)', 'i');
    res = res.replace(unitRegex, (match, num, unit) => {
      return num + unit.toUpperCase();
    });

    return res;
  }).join(' ');

  // Step 2: Processing the part after the '%' if it exists
  if (parts.length > 1) {
    const rest = parts.slice(1).join('%').toUpperCase();
    return firstPart + '%' + rest;
  }
  return firstPart;
}

/**
 * Formats a phone number as "99999 99999" taking only the first 10 digits.
 */
function formatPhone(str) {
  if (!str) return '';
  let digits = String(str).replace(/\D/g, '').slice(0, 10);
  if (digits.length > 5) {
    return digits.slice(0, 5) + ' ' + digits.slice(5);
  }
  return digits;
}

window.formatText = formatText;
window.formatPhone = formatPhone;

