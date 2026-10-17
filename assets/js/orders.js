/* orders.js */
let allOrders = [], orderItems = [], editingOrderId = null;
let activeOrderTab = 'Orders';
let activeStatusFilter = '';
let activeItemsStatusFilter = '';
let allPackagingData = [];
let allDetailedItems = [];

function formatOrderNo(orderNo) {
  if (!orderNo) return '—';
  return String(orderNo).replace(/^DSP-/i, 'O-');
}

function extractUserNotes(notes) {
  if (!notes) return '';
  return String(notes)
    .replace(/(?:^|\n\n?)(?:DISPATCH_META|Dispatch_meta):[\s\S]*$/i, '')
    .trim();
}

async function getNextOrderNo() {
  let maxNum = 0;
  try {
    const { data: dbOrders } = await window.dbClient.from('orders').select('order_no');
    const orderList = dbOrders || allOrders || [];
    for (let o of orderList) {
      if (o.order_no) {
        const m = String(o.order_no).match(/^(?:O|ORD|DSP)-(\d+)$/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num < 1000000 && num > maxNum) maxNum = num;
        } else {
          const num = UTILS.extractNumericPart(o.order_no);
          if (num < 1000000 && num > maxNum) maxNum = num;
        }
      }
    }
  } catch (_) {
    for (let o of allOrders) {
      if (o.order_no) {
        const num = UTILS.extractNumericPart(o.order_no);
        if (num < 1000000 && num > maxNum) maxNum = num;
      }
    }
  }
  return 'O-' + String(maxNum + 1).padStart(2, '0');
}

function updatePageDebug(text, color) {
  const el = document.getElementById('debug-page-status');
  if (el) {
    el.textContent = 'Page: ' + text;
    if (color) el.style.color = color;
  }
}

let cachedBottlesList = [];
let cachedBoxesList = [];

async function fetchPackagingData() {
  try {
    const [pkgRes, invRes, batchRes] = await Promise.all([
      window.dbClient.from('product_packaging').select('*'),
      window.dbClient.from('inventory_items').select('*'),
      window.dbClient.from('stock_batches').select('item_id, current_qty').eq('item_type', 'Inventory')
    ]);

    if (!pkgRes.error && pkgRes.data) {
      allPackagingData = pkgRes.data;
    }

    const stockMap = {};
    (batchRes.data || []).forEach(b => {
      const qty = parseFloat(b.current_qty) || 0;
      stockMap[b.item_id] = (stockMap[b.item_id] || 0) + qty;
    });

    if (!invRes.error && invRes.data) {
      cachedBottlesList = invRes.data.filter(it => it.category === 'Bottles').map(it => ({
        ...it,
        total_stock: stockMap[it.id] !== undefined ? stockMap[it.id] : (parseFloat(it.stock) || 0)
      }));
      cachedBoxesList = invRes.data.filter(it => it.category === 'Boxes' || (it.category && it.category.toLowerCase().includes('box')) || (it.name && it.name.toLowerCase().includes('box'))).map(it => ({
        ...it,
        total_stock: stockMap[it.id] !== undefined ? stockMap[it.id] : (parseFloat(it.stock) || 0)
      }));
    }
  } catch (e) {
    console.error('Failed to fetch packaging/inventory data:', e);
  }
}

async function loadOrders() {
  console.log('Loading orders...');
  updatePageDebug('Loading Orders...', '#0C3925');
  try {
    UTILS.renderTableSkeleton('orders-table');
    await DB.initDB();

    // High performance: fetch packaging, inventory, stock batches, orders, clients, and order_items all in parallel!
    const pkgQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('product_packaging').select('*')) : window.dbClient.from('product_packaging').select('*');
    const invQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('inventory_items').select('*')) : window.dbClient.from('inventory_items').select('*');
    const batchQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('stock_batches').select('item_id, current_qty').eq('item_type', 'Inventory')) : window.dbClient.from('stock_batches').select('item_id, current_qty').eq('item_type', 'Inventory');
    const ordersQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('orders').select('*').order('id', { ascending: false })) : window.dbClient.from('orders').select('*').order('id', { ascending: false });
    const clientsQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('clients').select('id, name')) : window.dbClient.from('clients').select('id, name');
    const orderItemsQuery = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('order_items').select('*')) : window.dbClient.from('order_items').select('*');

    const [pkgRes, invRes, batchRes, ordersRes, clientsRes, orderItemsRes] = await Promise.all([
      pkgQuery,
      invQuery,
      batchQuery,
      ordersQuery,
      clientsQuery,
      orderItemsQuery
    ]);

    if (ordersRes.error) {
      if (ordersRes.error.message && ordersRes.error.message.toLowerCase().includes('jwt issued at future')) {
        console.warn('Clock drift detected on orders load. Retrying in 1.2s...');
        await new Promise(r => setTimeout(r, 1200));
        const retry = await (window.TENANT_CONTEXT ? window.TENANT_CONTEXT.filter(window.dbClient.from('orders').select('*').order('id', { ascending: false })) : window.dbClient.from('orders').select('*').order('id', { ascending: false }));
        if (!retry.error) {
          ordersRes = retry;
        } else {
          throw ordersRes.error;
        }
      } else {
        throw ordersRes.error;
      }
    }

    // 1. Process packaging & bottle stock
    if (!pkgRes.error && pkgRes.data) {
      allPackagingData = pkgRes.data;
    }
    const stockMap = {};
    (batchRes.data || []).forEach(b => {
      const qty = parseFloat(b.current_qty) || 0;
      stockMap[b.item_id] = (stockMap[b.item_id] || 0) + qty;
    });
    if (!invRes.error && invRes.data) {
      cachedBottlesList = invRes.data.filter(it => it.category === 'Bottles').map(it => ({
        ...it,
        total_stock: stockMap[it.id] !== undefined ? stockMap[it.id] : (parseFloat(it.stock) || 0)
      }));
      cachedBoxesList = invRes.data.filter(it => it.category === 'Boxes' || (it.category && it.category.toLowerCase().includes('box')) || (it.name && it.name.toLowerCase().includes('box'))).map(it => ({
        ...it,
        total_stock: stockMap[it.id] !== undefined ? stockMap[it.id] : (parseFloat(it.stock) || 0)
      }));
    }

    // 2. Map clients in O(1) time
    const clientMap = new Map();
    (clientsRes.data || []).forEach(c => clientMap.set(c.id, c.name));

    allOrders = UTILS.sortLatestFirst(ordersRes.data || [], o => o.order_no || o.id);
    allOrders.forEach(o => {
      o.order_no = formatOrderNo(o.order_no);
      o.client_display = clientMap.get(o.client_id) || o.client_name || '—';
    });

    // 3. Group order items in O(1) time without N+1 sequential requests
    const itemsByOrderId = new Map();
    (orderItemsRes.data || []).forEach(it => {
      if (!itemsByOrderId.has(it.order_id)) itemsByOrderId.set(it.order_id, []);
      itemsByOrderId.get(it.order_id).push(it);
    });

    allDetailedItems = [];
    allOrders.forEach(o => {
      let dispatchMeta = null;
      if (o.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(o.notes)) {
        try {
          const jsonStr = o.notes.replace(/^[\s\S]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
          dispatchMeta = JSON.parse(jsonStr);
        } catch (_) {}
      }

      let totalOrdUnits = 0;
      let totalDispUnits = 0;
      o.items = itemsByOrderId.get(o.id) || [];
      o.items.forEach(it => {
        let metaMatch = null;
        if (dispatchMeta && Array.isArray(dispatchMeta.items_meta)) {
          metaMatch = dispatchMeta.items_meta.find(m => m.id == it.id || m.product_id == it.product_id || (m.product_name && String(m.product_name).toLowerCase().trim() === String(it.product_name).toLowerCase().trim()));
        }
        if (metaMatch) {
          if (!it.bottle_inventory_id && metaMatch.bottle_inventory_id) it.bottle_inventory_id = metaMatch.bottle_inventory_id;
          it.box_inventory_id = metaMatch.box_inventory_id || null;
          it.box_name = metaMatch.box_name || null;
          it.outer_boxes_consumed = metaMatch.outer_boxes_consumed || 0;
          it.box_quantity = metaMatch.box_quantity || metaMatch.boxes || 0;
          it.loose_quantity = metaMatch.loose_quantity || metaMatch.loose || 0;
          it.bottles_per_box = metaMatch.bottles_per_box || metaMatch.unitsPerBox || 0;
          it.total_volume = metaMatch.total_volume || null;
        }

        const ordUnits = parseInt(it.ordered_units || metaMatch?.ordered_units || it.total_units || it.quantity, 10) || 0;
        const dispUnits = parseInt(it.dispatched_units || metaMatch?.dispatched_units || 0, 10);
        const remUnits = it.remaining_units !== undefined ? parseInt(it.remaining_units, 10) : (metaMatch?.remaining_units !== undefined ? parseInt(metaMatch.remaining_units, 10) : Math.max(0, ordUnits - dispUnits));

        it.ordered_units = ordUnits;
        it.dispatched_units = dispUnits;
        it.remaining_units = remUnits;

        if (!it.bottles_per_box) {
          const pkg = allPackagingData.find(p => p.product_id == it.product_id);
          const upb = pkg ? (parseInt(pkg.units_per_box || pkg.bottles_per_box, 10) || 1) : 1;
          it.bottles_per_box = upb;
          if (it.box_quantity === undefined) {
            if (upb > 1) {
              it.box_quantity = Math.floor(ordUnits / upb);
              it.loose_quantity = ordUnits % upb;
            } else {
              it.box_quantity = 0;
              it.loose_quantity = ordUnits;
            }
          }
        }

        totalOrdUnits += ordUnits;
        totalDispUnits += dispUnits;

        allDetailedItems.push({
          id: it.id,
          order_id: o.id,
          order_no: o.order_no,
          client_display: o.client_display,
          date: o.date,
          status: o.status,
          dispatch_status: o.dispatch_status,
          product_name: it.product_name,
          product_id: it.product_id,
          packaging_size: it.packaging_size || it.packing_size || '',
          bottle_inventory_id: it.bottle_inventory_id,
          box_inventory_id: it.box_inventory_id,
          box_name: it.box_name,
          box_quantity: it.box_quantity || 0,
          loose_quantity: it.loose_quantity || 0,
          bottles_per_box: it.bottles_per_box || 1,
          total_volume: it.total_volume,
          quantity: it.quantity,
          ordered_units: ordUnits,
          dispatched_units: dispUnits,
          remaining_units: remUnits,
          unit_price: it.unit_price,
          total: it.total
        });
      });

      // Authoritative dispatch status derivation
      if (!o.dispatch_status) {
        if (dispatchMeta && dispatchMeta.dispatch_status) {
          o.dispatch_status = dispatchMeta.dispatch_status;
        } else if (dispatchMeta && Array.isArray(dispatchMeta.dispatches) && dispatchMeta.dispatches.length > 0) {
          o.dispatch_status = dispatchMeta.dispatches[0].status || 'Pending Verification';
        } else if (totalOrdUnits > 0 && totalDispUnits >= totalOrdUnits) {
          o.dispatch_status = 'Fully Dispatched';
        } else if (totalDispUnits > 0) {
          o.dispatch_status = 'Partially Dispatched';
        } else {
          o.dispatch_status = 'Pending Verification';
        }
      }
      // Keep detailed items in sync with parent order dispatch_status
      allDetailedItems.filter(it => it.order_id === o.id).forEach(it => {
        it.dispatch_status = o.dispatch_status;
      });
    });

    // Populate client filter dropdown if present
    const clientFilterEl = document.getElementById('order-client-filter');
    if (clientFilterEl && clientsRes.data) {
      const curVal = clientFilterEl.value;
      let opts = '<option value="">All Clients</option>';
      clientsRes.data.forEach(c => {
        opts += `<option value="${c.id}">${c.name}</option>`;
      });
      clientFilterEl.innerHTML = opts;
      if (curVal) clientFilterEl.value = curVal;
    }

    applyFiltersAndRender();
    updatePageDebug('Ready (' + allOrders.length + ')', '#0C3925');
    setTimeout(() => UTILS.initAllAutocompleteSelects(), 50);
  } catch (err) {
    console.error('loadOrders failed:', err);
    updatePageDebug('FAILED', '#EF4444');
    APP.showToast('Failed to load orders: ' + err.message, 'error');
  }
}

async function buildDetailedOrderItems() {
  return;
}

function applyFiltersAndRender() {
  const selectedClientId = document.getElementById('order-client-filter')?.value || '';
  if (activeOrderTab === 'Orders') {
    const q = (document.getElementById('search-input')?.value || '').toLowerCase();
    let data = allOrders;
    if (selectedClientId) {
      data = data.filter(o => String(o.client_id) === String(selectedClientId));
    }
    if (activeStatusFilter) {
      data = data.filter(o => {
        let st = (o.status || 'Pending').toLowerCase();
        if (st === 'delivered') st = 'completed';
        return st === activeStatusFilter.toLowerCase();
      });
    }
    if (q) {
      data = data.filter(o => `${o.order_no} ${o.client_display} ${o.date}`.toLowerCase().includes(q));
    }
    data = UTILS.sortLatestFirst(data, o => o.order_no || o.id);
    renderTable(data);
  } else {
    const q = (document.getElementById('items-search-input')?.value || '').toLowerCase();
    let data = allDetailedItems;
    if (selectedClientId) {
      data = data.filter(it => {
        const parentOrder = allOrders.find(o => o.id === it.order_id);
        return parentOrder && String(parentOrder.client_id) === String(selectedClientId);
      });
    }
    if (activeItemsStatusFilter) {
      data = data.filter(it => {
        let st = (it.status || 'Pending').toLowerCase();
        if (st === 'delivered') st = 'completed';
        return st === activeItemsStatusFilter.toLowerCase();
      });
    }
    if (q) {
      data = data.filter(it => `${it.order_no} ${it.client_display} ${it.product_name} ${it.date}`.toLowerCase().includes(q));
    }
    data = UTILS.sortLatestFirst(data, it => it.order_no || it.order_id || it.id);
    renderOrderItemsDetailTable(data);
  }
}

let ordersTableEnhancer = null;

function renderOrdersSlice(slice) {
  const tbody = document.querySelector('#orders-table tbody');
  if (!tbody) return;
  tbody.innerHTML = slice.map(o => {
    const totalAmount = parseFloat(o.total_amount) || 0;
    const paidAmount = parseFloat(o.paid_amount) || 0;
    const balance = totalAmount - paidAmount;
    const rowBg = balance <= 0 ? 'rgba(12, 57, 37, 0.05)' : 'rgba(239, 68, 68, 0.05)';
    
    // Status Badge
    let statusVal = o.status || 'Pending';
    if (statusVal === 'Delivered') {
      statusVal = 'Completed';
    }
    const statusBadge = UTILS.statusBadge(statusVal);

    let dispStatus = o.dispatch_status;
    if (!dispStatus) {
      const items = o.items || [];
      const totalOrd = items.reduce((s, it) => s + (parseInt(it.ordered_units || it.quantity, 10) || 0), 0);
      const totalDisp = items.reduce((s, it) => s + (parseInt(it.dispatched_units, 10) || 0), 0);
      if (totalOrd > 0 && totalDisp >= totalOrd) {
        dispStatus = 'Fully Dispatched';
      } else if (totalDisp > 0) {
        dispStatus = 'Partially Dispatched';
      } else {
        dispStatus = 'Pending Verification';
      }
    }
    const dispatchBadge = UTILS.statusBadge(dispStatus);

    let balanceClass = 'text-muted';
    if (balance > 0.005) {
      balanceClass = 'text-danger font-bold';
    } else if (balance < -0.005) {
      balanceClass = 'text-info font-bold';
    } else {
      balanceClass = 'text-success font-semibold';
    }

    return `<tr style="background: ${rowBg}">
      <td class="cell-bold">${o.order_no}</td>
      <td class="cell-client">${o.client_display || '—'}</td>
      <td>${UTILS.fmtDate(o.date)}</td>
      <td class="cell-amount text-right">${UTILS.fmtCurrency(totalAmount)}</td>
      <td class="cell-amount text-right text-success font-semibold">${UTILS.fmtCurrency(paidAmount)}</td>
      <td class="cell-amount text-right ${balanceClass}">${UTILS.fmtCurrency(balance)}</td>
      <td class="text-center">${dispatchBadge}</td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-center"><div class="row-actions" style="justify-content:center;">
        <button class="action-btn view" onclick="viewOrder(${o.id})" title="View Details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="action-btn edit" onclick="openEdit(${o.id})" title="Edit Order"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        ${dispStatus !== 'Fully Dispatched' && (o.status || '').toLowerCase() !== 'cancelled' ? `
          <button class="action-btn" onclick="openPrepareDispatch(${o.id})" title="Prepare Dispatch Slip" style="color:var(--primary);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19"/><path d="M12 12v6"/><path d="m9 15 3 3 3-3"/></svg></button>
        ` : ''}
        <button class="action-btn delete" onclick="deleteOrder(${o.id})" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
  UTILS.applyMobileTableLabels('orders-table');
}

function renderTable(data) {
  const tbody = document.querySelector('#orders-table tbody');
  if (!tbody) return;
  const countEl = document.getElementById('total-info');
  if (countEl) countEl.textContent = `${data.length} order${data.length !== 1 ? 's' : ''}`;
  
  if (!data.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9"><div class="empty-state"><h3>No orders found</h3><p>Create your first order or adjust search filters.</p></div></td></tr>`;
    const pag = document.querySelector('#orders-table-wrap .pagination');
    if (pag) pag.style.display = 'none';
    return;
  }

  if (window.TableEnhancer) {
    if (!ordersTableEnhancer) {
      ordersTableEnhancer = new window.TableEnhancer({
        tableId: 'orders-table',
        pageSize: 25,
        defaultSortKey: 'id',
        defaultSortOrder: 'desc',
        onRender: (pageSlice) => renderOrdersSlice(pageSlice)
      });
    }
    ordersTableEnhancer.setData(data);
    return;
  }

  renderOrdersSlice(data.slice(0, 50));
}

function renderOrderItemsDetailTable(data) {
  const cardsContainer = document.getElementById('order-items-cards-container');
  const tbody = document.querySelector('#order-items-detail-table tbody');
  const totalInfo = document.getElementById('items-total-info');
  if (totalInfo) totalInfo.textContent = `${data.length} item${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div class="empty-state order-items-empty-state" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 48px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;color:#94a3b8;opacity:0.6;margin-bottom:14px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h3>No items found</h3>
          <p>No order items match the selected criteria.</p>
        </div>
      `;
    }
    if (tbody) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="12"><div class="empty-state"><h3>No items found</h3><p>No order items match the selected criteria.</p></div></td></tr>`;
    }
    return;
  }

  const safeEscape = (str) => {
    if (typeof escapeHtml === 'function') return escapeHtml(str);
    if (typeof window !== 'undefined' && window.UTILS && typeof window.UTILS.escapeHtml === 'function') return window.UTILS.escapeHtml(str);
    return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  };

  const getPackSizeStr = (it) => {
    let packSizeStr = it.packaging_size || it.packing_size;
    if (!packSizeStr) {
      const packMatch = allPackagingData.find(p => p.product_id == it.product_id);
      packSizeStr = packMatch ? cleanSizeLabel(packMatch.packaging_size, packMatch.product_unit) : '—';
    } else {
      packSizeStr = cleanSizeLabel(packSizeStr, '');
    }
    return packSizeStr;
  };

  // 1. Render Card Layout
  if (cardsContainer) {
    cardsContainer.innerHTML = data.map(it => {
      let statusVal = it.status || 'Pending';
      if (statusVal === 'Delivered') statusVal = 'Completed';
      const isCompleted = statusVal.toLowerCase() === 'completed';
      const statusBadge = `<span class="badge ${isCompleted ? 'badge-success' : 'badge-warning'}">${statusVal}</span>`;

      const packSizeStr = getPackSizeStr(it);
      const ordUnits = parseInt(it.ordered_units || it.quantity, 10) || 0;
      const dispUnits = parseInt(it.dispatched_units || 0, 10);
      const remUnits = it.remaining_units !== undefined ? parseInt(it.remaining_units, 10) : Math.max(0, ordUnits - dispUnits);

      let pkgBreakdownHtml = '';
      if (it.box_quantity > 0 || it.loose_quantity > 0) {
        pkgBreakdownHtml = UTILS.formatPackagingBreakdown({
          boxes: it.box_quantity,
          unitsPerBox: it.bottles_per_box,
          looseUnits: it.loose_quantity,
          totalUnits: ordUnits,
          unit: 'units',
          volumeOrWeight: it.total_volume ? `${it.total_volume} L` : null
        });
      }

      const isOrderFullyDispatched = it.dispatch_status === 'Fully Dispatched';
      const isCancelled = (it.status || '').toLowerCase() === 'cancelled';
      const canDispatch = !isOrderFullyDispatched && !isCancelled;

      return `
        <div class="order-item-card" data-order-id="${it.order_id}" data-item-id="${it.id || ''}">
          <!-- A. Order Information -->
          <div class="order-item-card-header">
            <div class="order-item-header-meta">
              <span class="order-item-order-no">${formatOrderNo(it.order_no)}</span>
              <span class="order-item-date">${UTILS.fmtDate(it.date)}</span>
            </div>
            <div class="order-item-header-status">${statusBadge}</div>
          </div>

          <!-- Client Details -->
          <div class="order-item-client-row">
            <span class="order-item-client-label">Client</span>
            <span class="order-item-client-name" title="${safeEscape(it.client_display || '—')}">${safeEscape(it.client_display || '—')}</span>
          </div>

          <div class="order-item-card-divider"></div>

          <!-- B. Product Information -->
          <div class="order-item-product-section">
            <div class="order-item-product-title-row">
              <h4 class="order-item-product-name">${safeEscape(it.product_name || '—')}</h4>
              <span class="badge badge-neutral order-item-pack-badge">${packSizeStr}</span>
            </div>
            ${pkgBreakdownHtml ? `<div class="order-item-packaging-detail">${pkgBreakdownHtml}</div>` : ''}
          </div>

          <!-- C. Quantity and Fulfilment (3 distinct metric blocks) -->
          <div class="order-item-quantities-grid">
            <div class="order-item-qty-box qty-ordered">
              <span class="qty-label">Ordered</span>
              <span class="qty-val">${ordUnits} <small>units</small></span>
            </div>
            <div class="order-item-qty-box qty-dispatched">
              <span class="qty-label">Dispatched</span>
              <span class="qty-val ${dispUnits > 0 ? 'text-info' : 'text-muted'}">${dispUnits} <small>units</small></span>
            </div>
            <div class="order-item-qty-box qty-remaining ${remUnits > 0 ? 'is-pending' : 'is-fulfilled'}">
              <span class="qty-label">Remaining</span>
              <span class="qty-val ${remUnits > 0 ? 'text-primary' : 'text-success'}">${remUnits} <small>units</small></span>
            </div>
          </div>

          <!-- D. Financial Information -->
          <div class="order-item-finance-row">
            <div class="order-item-finance-col">
              <span class="finance-label">Unit Price</span>
              <span class="finance-val">${UTILS.fmtCurrency(it.unit_price)}</span>
            </div>
            <div class="order-item-finance-col text-right">
              <span class="finance-label">Line Total</span>
              <span class="finance-total">${UTILS.fmtCurrency(it.total)}</span>
            </div>
          </div>

          <!-- E. Actions -->
          <div class="order-item-card-actions">
            <button type="button" class="order-card-btn view" onclick="viewOrder(${it.order_id})" title="View Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>View Details</span>
            </button>
            <button type="button" class="order-card-btn edit" onclick="openEdit(${it.order_id})" title="Edit Order">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>Edit</span>
            </button>
            ${canDispatch ? `
              <button type="button" class="order-card-btn dispatch" onclick="openPrepareDispatch(${it.order_id})" title="Prepare Dispatch">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19"/><path d="M12 12v6"/><path d="m9 15 3 3 3-3"/></svg>
                <span>Dispatch</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Also populate table fallback if tbody exists
  if (tbody) {
    const groupedMap = new Map();
    data.forEach(it => {
      const key = it.order_id || it.order_no;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, []);
      }
      groupedMap.get(key).push(it);
    });

    let rowsHtml = '';
    let groupIdx = 0;
    groupedMap.forEach((items, orderId) => {
      const first = items[0];
      let statusVal = first.status || 'Pending';
      if (statusVal === 'Delivered') statusVal = 'Completed';
      const isCompleted = statusVal.toLowerCase() === 'completed';
      const statusBadge = `<span class="badge ${isCompleted ? 'badge-success' : 'badge-warning'}">${statusVal}</span>`;

      const blockBg = (groupIdx % 2 === 0) 
        ? 'background-color: rgba(255, 255, 255, 0.035);' 
        : 'background-color: rgba(12, 57, 37, 0.07);';

      items.forEach((it, idx) => {
        const isFirstRow = idx === 0;
        const isLastRow = idx === items.length - 1;
        const rowSpanAttr = isFirstRow ? ` rowspan="${items.length}"` : '';
        
        const borderStyle = isLastRow 
          ? 'border-bottom: 2px solid rgba(12, 57, 37, 0.35);' 
          : 'border-bottom: 1px dashed rgba(255, 255, 255, 0.08);';

        const packSizeStr = getPackSizeStr(it);
        const ordUnits = parseInt(it.ordered_units || it.quantity, 10) || 0;
        const dispUnits = parseInt(it.dispatched_units || 0, 10);
        const remUnits = it.remaining_units !== undefined ? parseInt(it.remaining_units, 10) : Math.max(0, ordUnits - dispUnits);

        const pkgBreakdownHtml = (it.box_quantity > 0 || it.loose_quantity > 0)
          ? UTILS.formatPackagingBreakdown({
              boxes: it.box_quantity,
              unitsPerBox: it.bottles_per_box,
              looseUnits: it.loose_quantity,
              totalUnits: ordUnits,
              unit: 'units',
              volumeOrWeight: it.total_volume ? `${it.total_volume} L` : null
            })
          : `<span style="font-weight:600;">${ordUnits} units</span>`;

        rowsHtml += `<tr style="${blockBg} ${borderStyle}">`;
        if (isFirstRow) {
          rowsHtml += `
            <td class="cell-bold"${rowSpanAttr} style="vertical-align:middle; padding: 7px 8px; font-weight:700; font-size:12px; white-space:nowrap;">${first.order_no}</td>
            <td class="cell-client"${rowSpanAttr} style="vertical-align:middle; padding: 7px 8px; font-size:12px; line-height:1.35;">${first.client_display || '—'}</td>
            <td${rowSpanAttr} style="vertical-align:middle; padding: 7px 8px; font-size:11.5px; white-space:nowrap;">${UTILS.fmtDate(first.date)}</td>
          `;
        }
        rowsHtml += `
          <td class="cell-product" style="font-weight:600; color:var(--primary); padding: 7px 8px; font-size:12px; line-height:1.35;">${it.product_name || '—'}</td>
          <td style="padding: 7px 8px; font-size:11.5px; white-space:nowrap;"><span class="badge badge-neutral" style="padding: 2px 7px; font-size:11px;">${packSizeStr}</span></td>
          <td style="padding: 7px 8px; font-size:11.5px; text-align:right;">${pkgBreakdownHtml}</td>
          <td class="text-center" style="padding: 7px 8px; font-size:12px; text-align:center;"><span class="badge ${dispUnits > 0 ? 'badge-info' : 'badge-neutral'}">${dispUnits}</span></td>
          <td class="text-center" style="padding: 7px 8px; font-size:12px; font-weight:700; color:${remUnits === 0 ? 'var(--text-muted)' : 'var(--primary)'}; text-align:center;">${remUnits}</td>
          <td class="cell-amount text-right" style="padding: 7px 8px; font-size:12px; text-align:right;">${UTILS.fmtCurrency(it.unit_price)}</td>
          <td class="cell-amount text-right" style="font-weight:700; padding: 7px 8px; font-size:12px; text-align:right;">${UTILS.fmtCurrency(it.total)}</td>
        `;
        if (isFirstRow) {
          rowsHtml += `
            <td class="text-center"${rowSpanAttr} style="vertical-align:middle; padding: 7px 8px; text-align:center;">${statusBadge}</td>
            <td class="text-center"${rowSpanAttr} style="vertical-align:middle; padding: 7px 8px; text-align:center;"><div class="row-actions" style="gap:5px; justify-content:center;">
              <button class="action-btn view" onclick="viewOrder(${first.order_id})" title="View Order" style="min-width:30px; width:30px; height:30px; padding:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
              <button class="action-btn edit" onclick="openEdit(${first.order_id})" title="Edit Order" style="min-width:30px; width:30px; height:30px; padding:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            </div></td>
          `;
        }
        rowsHtml += `</tr>`;
      });
      groupIdx++;
    });

    tbody.innerHTML = rowsHtml;
    UTILS.applyMobileTableLabels('order-items-detail-table');
  }
}

async function viewOrder(id) {
  try {
    const { data: o, error: oErr } = await window.dbClient.from('orders').select('*').eq('id', id).single();
    if (oErr) throw oErr;
    const { data: itemsData } = await window.dbClient.from('order_items').select('*').eq('order_id', id);
    o.items = itemsData || [];

    const balance = parseFloat(o.total_amount) - parseFloat(o.paid_amount || 0);
    let statusVal = o.status || 'Pending';
    if (statusVal === 'Delivered') statusVal = 'Completed';
    const isCompleted = statusVal.toLowerCase() === 'completed';
    const statusBadge = `<span class="badge ${isCompleted ? 'badge-success' : 'badge-warning'}">${statusVal}</span>`;

    let dispatchMeta = null;
    const rawNotes = o.notes || '';
    if (/(?:DISPATCH_META|Dispatch_meta):/i.test(rawNotes)) {
      try {
        const jsonStr = rawNotes.replace(/^[\s\S]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
        dispatchMeta = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse dispatch metadata from notes:', e);
      }
    }

    let itemsHtml = (o.items || []).map(it => {
      const pSize = cleanSizeLabel(it.packing_size || it.packaging_size || '', '');
      let btlName = null;
      let boxName = null;
      if (it.bottle_inventory_id) {
        const b = cachedBottlesList.find(x => x.id == it.bottle_inventory_id);
        if (b) btlName = b.name;
      }
      if (dispatchMeta && Array.isArray(dispatchMeta.items_meta)) {
        const metaMatch = dispatchMeta.items_meta.find(m => m.id == it.id || m.product_id == it.product_id || (m.product_name && String(m.product_name).toLowerCase().trim() === String(it.product_name).toLowerCase().trim()));
        if (metaMatch) {
          if (!btlName && metaMatch.bottle_inventory_id) {
            const b = cachedBottlesList.find(x => x.id == metaMatch.bottle_inventory_id);
            if (b) btlName = b.name;
          }
          boxName = metaMatch.box_name || (cachedBoxesList.find(bx => bx.id == metaMatch.box_inventory_id)?.name);
        }
      }

      return `
        <div style="padding: 10px 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
            <span style="font-weight: 700; color: var(--text-primary); font-size: 13.5px; word-break: break-word;">${it.product_name}</span>
            <span style="font-weight: 800; color: var(--accent); font-size: 13.5px; white-space: nowrap;">${UTILS.fmtCurrency(it.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 12px; color: var(--text-muted);">
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <div>Pack: <span class="badge badge-neutral" style="font-size:11px; padding:2px 6px;">${pSize || '—'}</span></div>
              ${btlName ? `<div>Bottle: <span class="badge badge-neutral" style="font-size:11px; padding:2px 6px;">${btlName}</span></div>` : ''}
              ${boxName ? `<div>Box: <span class="badge badge-neutral" style="font-size:11px; padding:2px 6px;">${boxName}</span></div>` : ''}
            </div>
            <div>Qty: <strong style="color:var(--text-primary)">${it.quantity}</strong> × ${UTILS.fmtCurrency(it.unit_price)}</div>
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div style="display: flex; flex-direction: column; gap: 14px; width: 100%;">
        <!-- Header Info -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text);">${formatOrderNo(o.order_no)}</h3>
            <p style="margin: 3px 0 0; font-size: 12px; color: var(--text-muted);">Booked: ${UTILS.fmtDate(o.date)} ${o.due_date ? `| Due: ${UTILS.fmtDate(o.due_date)}` : ''}</p>
          </div>
          <div>${statusBadge}</div>
        </div>

        <!-- Details Card -->
        <div style="display: flex; flex-direction: column; gap: 10px; background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 700;">Client Details</span>
            <span style="font-weight: 700; font-size: 14px; color: var(--text-primary); text-align: right; word-break: break-word;">${o.client_name || '—'}</span>
          </div>
          <div style="height: 1px; background: var(--border); width: 100%;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 700;">Payment Summary</span>
            <div style="text-align: right; font-size: 12.5px; line-height: 1.4;">
              Total: <strong>${UTILS.fmtCurrency(o.total_amount)}</strong> | Paid: <span class="text-success" style="font-weight: 600;">${UTILS.fmtCurrency(o.paid_amount)}</span>
              <br>Balance: <span class="${balance > 0 ? 'text-danger' : 'text-success'}" style="font-weight: 700;">${UTILS.fmtCurrency(balance)}</span>
            </div>
          </div>
        </div>

        <!-- Ordered Items Section -->
        <div>
          <h4 style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Ordered Items (${(o.items || []).length})</h4>
          <div>
            ${itemsHtml || '<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:13px;">No items</div>'}
          </div>
        </div>

        ${extractUserNotes(o.notes) ? `
          <div style="background: var(--bg); padding: 10px 12px; border-radius: 6px; font-size: 12px; color: var(--text-muted); border: 1px solid var(--border);">
            <strong style="color:var(--text-secondary)">Notes:</strong> ${extractUserNotes(o.notes)}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px;">
          <button class="btn btn-secondary" onclick="APP.closeModal('view-modal')">Close</button>
          <button class="btn btn-primary" onclick="APP.closeModal('view-modal'); openEdit(${o.id});">Edit Order</button>
        </div>
      </div>
    `;

    document.getElementById('view-content').innerHTML = html;
    APP.openModal('view-modal');
  } catch (err) {
    console.error(err);
    APP.showToast('Failed to view order: ' + err.message, 'error');
  }
}

async function populateClientSelect() {
  const sel = document.getElementById('client-select');
  if (!sel) return;
  try {
    const { data: clientsData, error } = await window.dbClient.from('clients').select('*');
    if (error) throw error;
    const clients = clientsData || [];
    sel.innerHTML = '<option value="">Select Client</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (sel._ussInstance) {
      sel._ussInstance.updateOptions();
    } else if (window.UniversalSearchSelect) {
      new UniversalSearchSelect(sel);
      sel.dataset.ussInitialized = 'true';
    }
  } catch (err) {
    console.error('populateClientSelect failed:', err);
  }
}

async function openAdd() {
  editingOrderId = null;
  document.getElementById('modal-title').textContent = 'New Sales Order';
  const orderForm = document.getElementById('order-form');
  orderForm.reset();
  const nextOrderNo = await getNextOrderNo();
  const orderNoField = document.getElementById('order-no-field');
  if (orderNoField) orderNoField.value = nextOrderNo;
  const toggle = document.getElementById('auto-discount-toggle');
  if (toggle) toggle.checked = false;
  const gstSel = document.getElementById('gst-type-select');
  if (gstSel) { gstSel.value = ''; onGstTypeChange(''); }
  handleAutoDiscount();
  orderItems = [{ id: Date.now(), product_id: '', product_name: '', packaging_size: '', bottle_inventory_id: null, box_inventory_id: null, quantity: 1, unit_price: 0, total: 0 }];
  await populateClientSelect();
  await renderOrderItems();
  UTILS.applyDefaultDateInputs(orderForm, { skipFieldNames: ['due_date'] });
  APP.openModal('order-modal');
  setTimeout(() => UTILS.initAllAutocompleteSelects(), 10);
}

async function openEdit(id) {
  editingOrderId = id;
  try {
    await populateClientSelect();
    
    const { data: o, error: oErr } = await window.dbClient.from('orders').select('*').eq('id', id).single();
    if (oErr) throw oErr;
    const { data: itemsData } = await window.dbClient.from('order_items').select('*').eq('order_id', id);
    o.items = itemsData || [];

    document.getElementById('modal-title').textContent = 'Edit Order';
    if (o.status === 'Delivered') {
      o.status = 'Completed';
    }

    // Parse dispatch metadata if present in notes to recover items metadata if needed
    let dispatchMeta = null;
    const rawNotes = o.notes || '';
    if (/(?:DISPATCH_META|Dispatch_meta):/i.test(rawNotes)) {
      try {
        const jsonStr = rawNotes.replace(/^[\s\S]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
        dispatchMeta = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse dispatch metadata from notes:', e);
      }
    }

    // Clean user notes for form display
    o.notes = extractUserNotes(o.notes);

    // Normalize order number from DSP- to O-
    if (o.order_no) {
      o.order_no = formatOrderNo(o.order_no);
    }

    UTILS.populateForm('order-form', o);
    const notesInp = document.querySelector('#order-form [name="notes"]');
    if (notesInp) notesInp.value = o.notes || '';

    const orderNoField = document.getElementById('order-no-field');
    if (orderNoField && o.order_no) orderNoField.value = o.order_no;

    UTILS.applyDefaultDateInputs(document.getElementById('order-form'), { skipFieldNames: ['due_date'] });
    const toggle = document.getElementById('auto-discount-toggle');
    if (toggle) toggle.checked = false;
    handleAutoDiscount();

    orderItems = (o.items || []).map(item => {
      let q = parseFloat(item.quantity) || 0;
      let btlId = item.bottle_inventory_id ? parseInt(item.bottle_inventory_id, 10) : null;
      let boxInvId = null;
      let boxName = null;
      if (dispatchMeta && Array.isArray(dispatchMeta.items_meta)) {
        const metaMatch = dispatchMeta.items_meta.find(m => m.id == item.id || m.product_id == item.product_id || (m.product_name && String(m.product_name).toLowerCase().trim() === String(item.product_name).toLowerCase().trim()));
        if (metaMatch) {
          if (q <= 0) {
            q = parseFloat(metaMatch.QUANTITY || metaMatch.quantity || metaMatch.TOTAL_UNITS || metaMatch.total_units || 0);
          }
          if (!btlId && metaMatch.bottle_inventory_id) {
            btlId = parseInt(metaMatch.bottle_inventory_id, 10);
          }
          boxInvId = metaMatch.box_inventory_id ? parseInt(metaMatch.box_inventory_id, 10) : null;
          boxName = metaMatch.box_name || null;
        }
      }
      return {
        ...item,
        quantity: q > 0 ? q : 1,
        packaging_size: item.packaging_size || item.packing_size || '',
        bottle_inventory_id: btlId,
        box_inventory_id: boxInvId,
        box_name: boxName,
        total: (q > 0 ? q : 1) * (parseFloat(item.unit_price) || 0)
      };
    });

    // Restore GST type selector from stored tax %
    const taxVal = parseFloat(o.tax) || 0;
    const gstSel = document.getElementById('gst-type-select');
    if (gstSel) {
      const reverseMap = { 5: 'GST5', 12: 'GST12', 18: 'GST18' };
      gstSel.value = reverseMap[taxVal] || '';
      onGstTypeChange(gstSel.value);
    }

    // Ensure products list is loaded
    const { data: prodData, error: prodErr } = await window.dbClient.from('products').select('*');
    cachedProductsList = prodErr ? [] : (prodData || []);

    // Ensure item packaging options are populated when editing
    for (const item of orderItems) {
      if (item.product_id) {
        const pMatch = cachedProductsList.find(p => p.id == item.product_id);
        if (pMatch && (!pMatch.packaging_options || pMatch.packaging_options.length === 0)) {
          try {
            const { data: pkgs, error: pkgErr } = await window.dbClient.from('product_packaging').select('*').eq('product_id', item.product_id);
            if (!pkgErr && pkgs) {
              pMatch.packaging_options = pkgs;
            }
          } catch (e) {
            console.warn('Failed to pre-fetch packaging for editing item:', item.product_id, e);
          }
        }
      }
    }

    await renderOrderItems();
    APP.openModal('order-modal');
    setTimeout(() => UTILS.initAllAutocompleteSelects(), 10);
  } catch (err) {
    console.error(err);
    APP.showToast('Failed to load order: ' + err.message, 'error');
  }
}

async function addOrderItem() {
  orderItems.push({ id: Date.now(), product_id: '', product_name: '', packaging_size: '', bottle_inventory_id: null, box_inventory_id: null, quantity: 1, unit_price: 0, total: 0 });
  await renderOrderItems();
}

function cleanSizeLabel(size, unit) {
  if (!size) return unit || '';
  const s = String(size).trim();
  const u = String(unit || '').trim();
  if (!u) return s;
  // If size already ends with unit (case-insensitive), or already contains a unit abbreviation, return size as is
  if (s.toLowerCase().includes(u.toLowerCase()) || /\b(ltr|ml|kg|gm|nos|pcs|box|bag|drum)\b/i.test(s)) {
    return s;
  }
  return `${s} ${u}`;
}

let cachedProductsList = [];

async function renderOrderItems() {
  const tbody = document.getElementById('order-items-tbody');
  if (!tbody) return;
  
  try {
    await fetchPackagingData();
    const { data: prodData, error: prodErr } = await window.dbClient.from('products').select('*');
    cachedProductsList = prodErr ? [] : (prodData || []);

    // Ensure item packaging options are populated for all items
    for (const item of orderItems) {
      let pMatch = cachedProductsList.find(p => p.id == item.product_id);
      if (!pMatch && item.product_name) {
        pMatch = cachedProductsList.find(p => String(p.name).toLowerCase().trim() === String(item.product_name).toLowerCase().trim());
        if (pMatch) item.product_id = pMatch.id;
      }
      if (pMatch && (!pMatch.packaging_options || pMatch.packaging_options.length === 0)) {
        try {
          const { data: pkgs, error: pkgErr } = await window.dbClient.from('product_packaging').select('*').eq('product_id', pMatch.id);
          if (!pkgErr && pkgs) {
            pMatch.packaging_options = pkgs;
          }
        } catch (e) {
          console.warn('Failed to pre-fetch packaging in renderOrderItems for product:', pMatch.id, e);
        }
      }
    }
    
    tbody.innerHTML = orderItems.map((item, idx) => {
      let pMatch = cachedProductsList.find(p => p.id == item.product_id);
      if (!pMatch && item.product_name) {
        pMatch = cachedProductsList.find(p => String(p.name).toLowerCase().trim() === String(item.product_name).toLowerCase().trim());
      }
      let pkgOptions = pMatch?.packaging_options || [];
      if (pkgOptions.length > 0) {
        pkgOptions = UTILS.sortPackSizesDescending(pkgOptions, opt => opt.packaging_size || opt.size);
      }
      const unitStr = pMatch?.unit || '';
      
      let pkgSelectHtml = '';
      if (pkgOptions.length > 0) {
        const itemNormPack = item.packaging_size ? String(item.packaging_size).toLowerCase().replace(/\s+/g, '') : '';
        
        // First check if any option matches item.packaging_size
        let matchedIndex = -1;
        if (itemNormPack) {
          matchedIndex = pkgOptions.findIndex(opt => {
            const rawSize = opt.packaging_size || opt.size || '';
            const sizeLabel = cleanSizeLabel(rawSize, unitStr);
            const optNorm = String(sizeLabel).toLowerCase().replace(/\s+/g, '');
            const rawNorm = String(rawSize).toLowerCase().replace(/\s+/g, '');
            return optNorm === itemNormPack || rawNorm === itemNormPack;
          });
        }

        const optionsStr = pkgOptions.map((opt, oIdx) => {
          const rawSize = opt.packaging_size || opt.size || '';
          const sizeLabel = cleanSizeLabel(rawSize, unitStr);
          const priceVal = parseFloat(opt.sell_price || opt.selling_price) || 0;
          
          let isSel = false;
          if (matchedIndex !== -1) {
            isSel = (oIdx === matchedIndex);
          } else if (!itemNormPack) {
            isSel = (opt.is_base || oIdx === 0);
          }

          return `<option value="${sizeLabel}" data-price="${priceVal}" ${isSel ? 'selected' : ''}>${sizeLabel}</option>`;
        }).join('');

        // Ensure item.packaging_size is set if not already set
        if (!item.packaging_size && pkgOptions.length > 0) {
          const selOpt = pkgOptions.find(opt => opt.is_base) || pkgOptions[0];
          item.packaging_size = cleanSizeLabel(selOpt.packaging_size || selOpt.size || '', unitStr);
          if (!item.unit_price) item.unit_price = parseFloat(selOpt.sell_price || selOpt.selling_price) || 0;
        }

        pkgSelectHtml = `<select class="form-select order-pack-select" data-idx="${idx}" data-allow-custom="true" onchange="onPackSizeChange(${idx}, this.value)">
          ${optionsStr}
        </select>`;
      } else {
        const fallbackSize = item.packaging_size || unitStr || '';
        item.packaging_size = fallbackSize;
        pkgSelectHtml = `<input type="text" class="form-input order-pack-input" data-idx="${idx}" value="${fallbackSize}" placeholder="Pack size" onchange="onPackSizeChange(${idx}, this.value)">`;
      }

      return `
        <tr data-row-idx="${idx}">
          <td style="min-width:160px">
            <span class="mobile-label">Product</span>
            <select class="form-select order-product-select" data-idx="${idx}" onchange="onProductSelectChange(${idx}, this.value)">
              <option value="">Select Product</option>
              ${cachedProductsList.map(p => `<option value="${p.id}" ${p.id == item.product_id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </td>
          <td style="min-width:120px" class="pack-size-cell">
            <span class="mobile-label">Pack Size</span>
            ${pkgSelectHtml}
          </td>
          <td style="min-width:160px">
            <span class="mobile-label">Bottle</span>
            <select class="form-select order-bottle-select" data-idx="${idx}" onchange="onBottleChange(${idx}, this.value)">
              <option value="">Select Bottle</option>
              ${cachedBottlesList.map(b => `<option value="${b.id}" ${b.id == item.bottle_inventory_id ? 'selected' : ''}>${b.name} (${parseFloat(b.total_stock || b.stock || 0).toFixed(0)} avail)</option>`).join('')}
            </select>
          </td>
          <td style="min-width:160px">
            <span class="mobile-label">Box</span>
            <select class="form-select order-box-select" data-idx="${idx}" onchange="onBoxChange(${idx}, this.value)">
              <option value="">Select Box</option>
              ${cachedBoxesList.map(bx => `<option value="${bx.id}" ${bx.id == item.box_inventory_id ? 'selected' : ''}>${bx.name} (${parseFloat(bx.total_stock || bx.stock || 0).toFixed(0)} avail)</option>`).join('')}
            </select>
          </td>
          <td>
            <span class="mobile-label">Quantity</span>
            <input type="number" class="form-input item-qty-input" value="${item.quantity}" min="0" step="any" oninput="onQtyChange(${idx}, this.value)" onchange="onQtyChange(${idx}, this.value)">
          </td>
          <td>
            <span class="mobile-label">Unit Price (₹)</span>
            <input type="number" class="form-input item-price-input" value="${item.unit_price}" min="0" step="any" oninput="onUnitPriceChange(${idx}, this.value)" onchange="onUnitPriceChange(${idx}, this.value)">
          </td>
          <td class="cell-amount item-total-display">
            <span class="mobile-label">Total</span>
            ${UTILS.fmtCurrency(item.total)}
          </td>
          <td>
            <span class="mobile-label">Remove</span>
            <button class="action-btn delete" onclick="removeItem(${idx})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
          </td>
        </tr>
      `;
    }).join('');
    calculateTotal();
    setTimeout(() => {
      if (window.UTILS?.initAllAutocompleteSelects) {
        UTILS.initAllAutocompleteSelects();
      }
    }, 10);
  } catch (err) {
    console.error(err);
  }
}

async function onProductSelectChange(idx, valOrEvt) {
  let val = valOrEvt;
  if (valOrEvt && typeof valOrEvt === 'object' && valOrEvt.target) {
    val = valOrEvt.target.value;
  }
  console.log(`[OrderRow ${idx}] Product selected (ID):`, val);
  const it = orderItems[idx];
  if (!it) return;
  it.product_id = val;
  if (!val) {
    console.log(`[OrderRow ${idx}] Cleared product selection.`);
    it.product_name = '';
    it.packaging_size = '';
    it.unit_price = 0;
    it.total = 0;
    await renderOrderItems();
    return;
  }

  const p = cachedProductsList.find(x => x.id == val);
  console.log(`[OrderRow ${idx}] Fetched product object from Product Master:`, p);
  
  it.product_name = p?.name || '';
  if (window.INVENTORY_SERVICE && window.INVENTORY_SERVICE.resolveTechnicalItem) {
    const techItem = await window.INVENTORY_SERVICE.resolveTechnicalItem(val, p?.name);
    it.inventory_item_id = techItem?.id || null;
  } else {
    it.inventory_item_id = p?.inventory_item_id || null;
  }
  let pkgOptions = p?.packaging_options || [];
  if (!pkgOptions.length && val) {
    pkgOptions = allPackagingData.filter(pk => pk.product_id == val);
    if (!pkgOptions.length) {
      try {
        const { data: pkgs, error: pkgErr } = await window.dbClient.from('product_packaging').select('*').eq('product_id', val);
        if (!pkgErr && pkgs) pkgOptions = pkgs;
      } catch (e) {
        console.warn('Failed to fetch packaging directly for product:', val, e);
      }
    }
  }
  console.log(`[OrderRow ${idx}] Raw packaging_options array:`, pkgOptions);

  if (pkgOptions.length > 0) {
    pkgOptions = UTILS.sortPackSizesDescending(pkgOptions, opt => opt.packaging_size || opt.size);
    const selectedOpt = pkgOptions.find(opt => opt.is_base) || pkgOptions[0];
    const rawSize = selectedOpt.packaging_size || selectedOpt.size || '';
    it.packaging_size = cleanSizeLabel(rawSize, p?.unit);
    it.unit_price = parseFloat(selectedOpt.sell_price || selectedOpt.selling_price) || parseFloat(p?.sell_price) || 0;
  } else {
    it.packaging_size = p?.unit || '';
    it.unit_price = parseFloat(p?.sell_price) || 0;
  }

  if (!it.bottle_inventory_id && it.packaging_size && cachedBottlesList.length > 0) {
    const normSize = String(it.packaging_size).toLowerCase().replace(/\s+/g, '');
    const btlMatch = cachedBottlesList.find(b => {
      const bSize = String(b.item_size || b.name || '').toLowerCase().replace(/\s+/g, '');
      return bSize.includes(normSize) || normSize.includes(bSize);
    });
    if (btlMatch) it.bottle_inventory_id = btlMatch.id;
  }
  if (!it.box_inventory_id && cachedBoxesList.length === 1) {
    it.box_inventory_id = cachedBoxesList[0].id;
    it.box_name = cachedBoxesList[0].name;
  }

  it.total = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
  await renderOrderItems();
}

async function onPackSizeChange(idx, val) {
  let valStr = (val && typeof val === 'object' && val.target) ? val.target.value : val;
  console.log(`[OrderRow ${idx}] Pack size changed to:`, valStr);
  const it = orderItems[idx];
  if (!it) return;
  it.packaging_size = valStr;
  const p = cachedProductsList.find(x => x.id == it.product_id);
  let pkgOptions = p?.packaging_options || [];
  if (!pkgOptions.length && it.product_id) {
    pkgOptions = allPackagingData.filter(pk => pk.product_id == it.product_id);
    if (!pkgOptions.length) {
      try {
        const { data: pkgs, error: pkgErr } = await window.dbClient.from('product_packaging').select('*').eq('product_id', it.product_id);
        if (!pkgErr && pkgs) pkgOptions = pkgs;
      } catch (e) {
        console.warn('Failed to fetch packaging on pack size change:', e);
      }
    }
  }

  const normVal = String(valStr).toLowerCase().replace(/\s+/g, '');
  const matchOpt = pkgOptions.find(opt => {
    const rawSize = opt.packaging_size || opt.size || '';
    const cleaned = cleanSizeLabel(rawSize, p?.unit);
    const normCleaned = String(cleaned).toLowerCase().replace(/\s+/g, '');
    const normRaw = String(rawSize).toLowerCase().replace(/\s+/g, '');
    return normCleaned === normVal || normRaw === normVal;
  });

  console.log(`[OrderRow ${idx}] Matched packaging option from Product Master:`, matchOpt);

  if (matchOpt) {
    const pr = parseFloat(matchOpt.sell_price || matchOpt.selling_price);
    if (!isNaN(pr) && pr >= 0) {
      it.unit_price = pr;
    }
  }

  if (!it.bottle_inventory_id && it.packaging_size && cachedBottlesList.length > 0) {
    const normSize = String(it.packaging_size).toLowerCase().replace(/\s+/g, '');
    const btlMatch = cachedBottlesList.find(b => {
      const bSize = String(b.item_size || b.name || '').toLowerCase().replace(/\s+/g, '');
      return bSize.includes(normSize) || normSize.includes(bSize);
    });
    if (btlMatch) it.bottle_inventory_id = btlMatch.id;
  }
  if (!it.box_inventory_id && cachedBoxesList.length === 1) {
    it.box_inventory_id = cachedBoxesList[0].id;
    it.box_name = cachedBoxesList[0].name;
  }

  it.total = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
  await renderOrderItems();
}

function onQtyChange(idx, val) {
  const it = orderItems[idx];
  it.quantity = parseFloat(val) || 0;
  it.total = it.quantity * (parseFloat(it.unit_price) || 0);
  const row = document.querySelector(`tr[data-row-idx="${idx}"]`);
  if (row) {
    const totalDisp = row.querySelector('.item-total-display');
    if (totalDisp) totalDisp.textContent = UTILS.fmtCurrency(it.total);
  }
  calculateTotal();
}

function onBottleChange(idx, val) {
  let valStr = (val && typeof val === 'object' && val.target) ? val.target.value : val;
  const it = orderItems[idx];
  if (!it) return;
  it.bottle_inventory_id = valStr ? parseInt(valStr, 10) : null;
}

function onBoxChange(idx, val) {
  let valStr = (val && typeof val === 'object' && val.target) ? val.target.value : val;
  const it = orderItems[idx];
  if (!it) return;
  it.box_inventory_id = valStr ? parseInt(valStr, 10) : null;
  const bObj = cachedBoxesList.find(b => b.id == it.box_inventory_id);
  it.box_name = bObj ? bObj.name : null;
}

function onUnitPriceChange(idx, val) {
  const it = orderItems[idx];
  it.unit_price = parseFloat(val) || 0;
  it.total = (parseFloat(it.quantity) || 0) * it.unit_price;
  const row = document.querySelector(`tr[data-row-idx="${idx}"]`);
  if (row) {
    const totalDisp = row.querySelector('.item-total-display');
    if (totalDisp) totalDisp.textContent = UTILS.fmtCurrency(it.total);
  }
  calculateTotal();
}

function removeItem(idx) {
  orderItems.splice(idx, 1);
  renderOrderItems();
}

function handleAutoDiscount() {
  const toggle = document.getElementById('auto-discount-toggle');
  const discountField = document.getElementById('discount-field');
  const paidField = document.querySelector('#order-form input[name="paid_amount"]');
  
  if (!toggle || !discountField || !paidField) return;

  const isAuto = toggle.checked;
  
  if (isAuto) {
    discountField.readOnly = true;
    discountField.style.background = 'var(--bg)';
    
    const subtotal = orderItems.reduce((s, it) => s + it.total, 0);
    const paidAmount = parseFloat(paidField.value) || 0;
    
    if (subtotal > 0 && paidAmount < subtotal) {
      const diff = subtotal - paidAmount;
      const pct = (diff / subtotal) * 100;
      discountField.value = pct.toFixed(2);
    } else {
      discountField.value = "0";
    }
  } else {
    discountField.readOnly = false;
    discountField.style.background = '';
  }
}

function onGstTypeChange(gstCode) {
  const rateMap = { '': 0, 'GST5': 5, 'GST12': 12, 'GST18': 18, 'IGST5': 5, 'IGST12': 12, 'IGST18': 18 };
  const rate = rateMap[gstCode] || 0;
  const taxField = document.getElementById('tax-field');
  if (taxField) taxField.value = rate;
  updateGstBreakdown();
}

function updateGstBreakdown() {
  const subtotal = orderItems.reduce((s, it) => s + it.total, 0);
  const gstCode = document.getElementById('gst-type-select')?.value || '';
  const rateMap = { '': 0, 'GST5': 5, 'GST12': 12, 'GST18': 18, 'IGST5': 5, 'IGST12': 12, 'IGST18': 18 };
  const rate = rateMap[gstCode] || 0;

  const cgstRow = document.getElementById('cgst-row');
  const sgstRow = document.getElementById('sgst-row');
  const igstRow = document.getElementById('igst-row');
  const grandRow = document.getElementById('grand-total-row');

  if (!gstCode || rate === 0) {
    if (cgstRow) cgstRow.style.display = 'none';
    if (sgstRow) sgstRow.style.display = 'none';
    if (igstRow) igstRow.style.display = 'none';
    if (grandRow) grandRow.style.display = 'none';
    return;
  }

  if (gstCode.startsWith('IGST')) {
    const igstAmt = subtotal * rate / 100;
    if (cgstRow) cgstRow.style.display = 'none';
    if (sgstRow) sgstRow.style.display = 'none';
    if (igstRow) { igstRow.style.display = ''; document.getElementById('igst-label').textContent = `IGST (${rate}%):`; document.getElementById('igst-display').textContent = UTILS.fmtCurrency(igstAmt); }
    if (grandRow) { grandRow.style.display = ''; document.getElementById('grand-total-display').textContent = UTILS.fmtCurrency(subtotal + igstAmt); }
  } else {
    const half = rate / 2;
    const cgstAmt = subtotal * half / 100;
    const sgstAmt = subtotal * half / 100;
    if (igstRow) igstRow.style.display = 'none';
    if (cgstRow) { cgstRow.style.display = ''; document.getElementById('cgst-label').textContent = `CGST (${half}%):`; document.getElementById('cgst-display').textContent = UTILS.fmtCurrency(cgstAmt); }
    if (sgstRow) { sgstRow.style.display = ''; document.getElementById('sgst-label').textContent = `SGST (${half}%):`; document.getElementById('sgst-display').textContent = UTILS.fmtCurrency(sgstAmt); }
    if (grandRow) { grandRow.style.display = ''; document.getElementById('grand-total-display').textContent = UTILS.fmtCurrency(subtotal + cgstAmt + sgstAmt); }
  }
}

function calculateTotal() {
  const total = orderItems.reduce((s, it) => s + it.total, 0);
  const el = document.getElementById('order-total-display');
  if (el) el.textContent = UTILS.fmtCurrency(total);
  updateGstBreakdown();
  handleAutoDiscount();

  // Dynamically update Remaining Balance field
  const paidInput = document.getElementById('paid-amount-input');
  const remField = document.getElementById('remaining-balance-field');
  if (paidInput && remField) {
    const paid = parseFloat(paidInput.value) || 0;
    const rem = Math.max(0, total - paid);
    remField.value = UTILS.fmtCurrency(rem);
  }
}

async function saveOrder() {
  const d = UTILS.getFormData('order-form');
  if (!d.client_id) { APP.showToast('Please select a client', 'error'); return; }
  if (orderItems.length === 0) { APP.showToast('Please add at least one item', 'error'); return; }

  let finalOrderNo = d.order_no ? formatOrderNo(d.order_no) : '';
  if (!finalOrderNo) {
    finalOrderNo = await getNextOrderNo();
  }

  const saveBtn = document.querySelector('#order-modal button.btn-primary');
  if (saveBtn && (saveBtn.dataset.submitting === 'true' || saveBtn.disabled)) return;
  if (saveBtn) {
    saveBtn.dataset.submitting = 'true';
    if (typeof APP !== 'undefined' && APP.setButtonLoading) {
      APP.setButtonLoading(saveBtn, true, 'Saving...');
    } else {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }
  }

  const clientSelect = document.getElementById('client-select');
  const clientName = clientSelect ? clientSelect.options[clientSelect.selectedIndex].text : '';
  const paidAmount = parseFloat(d.paid_amount) || 0.00;

  try {
    const autoToggle = document.getElementById('auto-discount-toggle');
    const isAuto = autoToggle && autoToggle.checked;

    const subtotal = orderItems.reduce((s, it) => s + it.total, 0);
    const taxPct = parseFloat(d.tax) || 0.00;
    const taxAmount = subtotal * taxPct / 100;
    const discountPct = parseFloat(d.discount) || 0.00;
    const discountAmount = subtotal * discountPct / 100;
    const finalTotal = isAuto ? paidAmount : (subtotal + taxAmount - discountAmount);
    
    const boToggle = document.getElementById('allow-backorder-toggle');
    const isBackorderMode = boToggle && boToggle.checked;

    // Sync latest live DOM values from form table to orderItems array
    document.querySelectorAll('#order-items-tbody tr').forEach((row, idx) => {
      if (orderItems[idx]) {
        const prodSel = row.querySelector('.order-product-select');
        if (prodSel && prodSel.value) {
          orderItems[idx].product_id = prodSel.value;
          const pObj = cachedProductsList.find(p => p.id == prodSel.value);
          if (pObj) orderItems[idx].product_name = pObj.name;
        }
        const packSel = row.querySelector('.order-pack-select');
        const packInput = row.querySelector('.order-pack-input');
        if (packSel && packSel.value) {
          orderItems[idx].packaging_size = packSel.value;
        } else if (packInput && packInput.value) {
          orderItems[idx].packaging_size = packInput.value;
        }
        const bottleSel = row.querySelector('.order-bottle-select');
        if (bottleSel && bottleSel.value) {
          orderItems[idx].bottle_inventory_id = parseInt(bottleSel.value, 10);
        } else {
          orderItems[idx].bottle_inventory_id = null;
        }
        const boxSel = row.querySelector('.order-box-select');
        if (boxSel && boxSel.value) {
          orderItems[idx].box_inventory_id = parseInt(boxSel.value, 10);
          const bMatch = cachedBoxesList.find(bx => bx.id == orderItems[idx].box_inventory_id);
          orderItems[idx].box_name = bMatch ? bMatch.name : null;
        } else {
          orderItems[idx].box_inventory_id = null;
          orderItems[idx].box_name = null;
        }
        const qtyInp = row.querySelector('.item-qty-input');
        if (qtyInp) orderItems[idx].quantity = parseFloat(qtyInp.value) || 0;
        const priceInp = row.querySelector('.item-price-input');
        if (priceInp) orderItems[idx].unit_price = parseFloat(priceInp.value) || 0;
        orderItems[idx].total = (parseFloat(orderItems[idx].quantity) || 0) * (parseFloat(orderItems[idx].unit_price) || 0);
      }
    });

    // Validate item quantities and products
    for (let i = 0; i < orderItems.length; i++) {
      const it = orderItems[i];
      if (!it.product_id) {
        APP.showToast(`Please select a product for item #${i + 1}`, 'error');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Order'; }
        return;
      }
      const q = parseFloat(it.quantity) || 0;
      if (q <= 0) {
        APP.showToast(`Please enter a quantity greater than 0 for ${it.product_name || 'item #' + (i + 1)}`, 'error');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Order'; }
        return;
      }
    }

    const executeSave = async (allowBackorder = false) => {

      // Fetch latest inventory items for auto-matching fallback
      for (const item of orderItems) {
        const product = cachedProductsList.find(p => p.id == item.product_id);
        const pName = item.product_name || product?.name || '';
        if (window.INVENTORY_SERVICE && window.INVENTORY_SERVICE.resolveTechnicalItem) {
          const techItem = await window.INVENTORY_SERVICE.resolveTechnicalItem(item.product_id, pName);
          if (techItem) {
            item.inventory_item_id = techItem.id;
            if (product) product.inventory_item_id = techItem.id;
          }
        }
      }

      console.groupCollapsed(`[Sales Order ${finalOrderNo || 'new'}] inventory resolution`);
      orderItems.forEach(item => {
        const product = cachedProductsList.find(p => p.id == item.product_id);
        console.log('ORDER PRODUCT', {
          name: item.product_name,
          productId: item.product_id,
          inventoryId: product?.inventory_item_id || null,
          quantity: item.quantity,
          unit: product?.unit || null,
          packSize: item.packaging_size
        });
      });
      console.groupEnd();

      if (editingOrderId) {
        // 1. Revert previous stock before applying new order edits
        await revertOrderStock(editingOrderId);

        // 2. Update order row
        const updateData = {
          order_no: finalOrderNo || null,
          client_id: parseInt(d.client_id, 10),
          client_name: clientName,
          date: d.date || UTILS.todayStr(),
          due_date: d.due_date || null,
          status: d.status || 'Pending',
          total_amount: finalTotal,
          paid_amount: paidAmount,
          discount: discountPct,
          tax: taxPct,
          notes: d.notes ? d.notes.trim() : null
        };
        const { error: updErr } = await window.dbClient.from('orders').update(updateData).eq('id', editingOrderId);
        if (updErr) throw updErr;

        // 3. Delete existing items
        await window.dbClient.from('order_items').delete().eq('order_id', editingOrderId);

        // 4. Insert new items and deduct stock
        await insertOrderItemsAndSyncStock(editingOrderId, orderItems, finalOrderNo || String(editingOrderId), allowBackorder);
      } else {
        // 1. Insert new order
        const insertData = {
          order_no: finalOrderNo || null,
          client_id: parseInt(d.client_id, 10),
          client_name: clientName,
          date: d.date || UTILS.todayStr(),
          due_date: d.due_date || null,
          status: d.status || 'Pending',
          total_amount: finalTotal,
          paid_amount: paidAmount,
          discount: discountPct,
          tax: taxPct,
          notes: d.notes ? d.notes.trim() : null
        };
        const stampedOrder = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.stamp(insertData) : insertData;
        const { data: newOrderData, error: insErr } = await window.dbClient.from('orders').insert([stampedOrder]).select();
        if (insErr) throw insErr;
        const newOrderId = newOrderData[0].id;

        // 2. Insert items and deduct stock
        await insertOrderItemsAndSyncStock(newOrderId, orderItems, finalOrderNo || String(newOrderId), allowBackorder);
      }

      APP.closeModal('order-modal');
      APP.showToast('Order saved successfully!', 'success');
      await loadOrders();
    };

    try {
      await executeSave(false);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('insufficient stock')) {
        APP.showConfirm(`${err.message}\n\nWould you like to place this order on BACKORDER (allow negative stock / reservation)?`, async () => {
          try {
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving Backorder...'; }
            await executeSave(true);
          } catch (bErr) {
            APP.showToast('Backorder failed: ' + bErr.message, 'error');
          } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Order'; }
          }
        });
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('saveOrder failed:', err);
    APP.showToast('Failed to save order: ' + err.message, 'error');
  } finally {
    if (saveBtn) {
      delete saveBtn.dataset.submitting;
      if (typeof APP !== 'undefined' && APP.setButtonLoading) {
        APP.setButtonLoading(saveBtn, false);
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Order';
      }
    }
  }
}

async function revertOrderStock(orderId) {
  try {
    let reversedViaMovements = false;
    if (window.INVENTORY_CORE && window.INVENTORY_CORE.Service) {
      const db = window.INVENTORY_CORE.Service.getDb();
      if (db) {
        const { data: movs } = await db.from('stock_movements').select('id').eq('txn_id', orderId).lt('qty', 0);
        if (movs && movs.length > 0) {
          await window.INVENTORY_CORE.Service.reverseReferenceStock({
            referenceId: orderId,
            referenceNo: `O-${orderId}`,
            movementType: 'DISPATCH_REVERSAL'
          });
          reversedViaMovements = true;
        }
      }
    }

    if (!reversedViaMovements) {
      // Fetch metadata from orders.notes
      const { data: ordRow } = await window.dbClient.from('orders').select('notes').eq('id', orderId).maybeSingle();
      let dispatchMeta = null;
      if (ordRow && ordRow.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(ordRow.notes)) {
        try {
          const jsonStr = ordRow.notes.replace(/^[\s\S]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
          dispatchMeta = JSON.parse(jsonStr);
        } catch (_) {}
      }

      const { data: items, error: itErr } = await window.dbClient.from('order_items').select('*').eq('order_id', orderId);
      if (!itErr && items && items.length) {
        for (const it of items) {
          const qty = parseFloat(it.quantity) || 0;
          const packMl = (window.INVENTORY_CORE && window.INVENTORY_CORE.parsePackagingSize)
            ? window.INVENTORY_CORE.parsePackagingSize(it.packing_size || it.packaging_size).volumeMl
            : (UTILS.parsePackSizeInMl(it.packing_size || it.packaging_size) || 1000);
          const volumeLiters = (packMl / 1000) * qty;

          // 1. Restore bottle stock if bottle used
          if (it.bottle_inventory_id && qty > 0) {
            const bottleId = parseInt(it.bottle_inventory_id, 10);
            await window.INVENTORY_SERVICE.restoreStock(bottleId, qty);
          }

          // 2. Restore box stock if box used
          let boxId = null;
          let boxesConsumed = 0;
          if (dispatchMeta && Array.isArray(dispatchMeta.items_meta)) {
            const metaIt = dispatchMeta.items_meta.find(m => m.id == it.id || m.product_id == it.product_id);
            if (metaIt && metaIt.box_inventory_id && metaIt.outer_boxes_consumed > 0) {
              boxId = parseInt(metaIt.box_inventory_id, 10);
              boxesConsumed = metaIt.outer_boxes_consumed;
            }
          }
          if (boxId && boxesConsumed > 0) {
            await window.INVENTORY_SERVICE.restoreStock(boxId, boxesConsumed);
          }

          // 3. Restore technical stock
          let techItem = null;
          if (window.INVENTORY_SERVICE && window.INVENTORY_SERVICE.resolveTechnicalItem) {
            techItem = await window.INVENTORY_SERVICE.resolveTechnicalItem(it.product_id, it.product_name);
          }
          if (!techItem && it.inventory_item_id) {
            const { data: invRow } = await window.dbClient.from('inventory_items').select('id, unit').eq('id', it.inventory_item_id).maybeSingle();
            techItem = invRow;
          }

          if (techItem) {
            let restoreQty = volumeLiters;
            if (techItem.unit) {
              restoreQty = UTILS.convertUnit(volumeLiters, 'Litre', techItem.unit);
            }
            if (restoreQty > 0) {
              await window.INVENTORY_SERVICE.restoreStock(techItem.id, restoreQty);
            }
          }
        }
      }
    }

    // Clean old movements
    try {
      await window.dbClient.from('stock_movements').delete().eq('txn_id', orderId);
    } catch (_) {}
  } catch (err) {
    console.warn('revertOrderStock notice:', err);
  }
}

async function insertOrderItemsAndSyncStock(orderId, items, orderNo, allowBackorder = false) {
  // Pre-calculate SKU packaging breakdowns
  const processedItems = items.map(it => {
    const qty = parseFloat(it.quantity) || 0;
    const packStr = it.packaging_size || it.packing_size || '';
    
    // Look up packaging configuration
    const pMatch = cachedProductsList.find(p => p.id == it.product_id);
    const pkgOptions = pMatch?.packaging_options || [];
    const matchedPkg = pkgOptions.find(opt => {
      const raw = opt.packaging_size || opt.size || '';
      return cleanSizeLabel(raw, pMatch?.unit) === packStr || raw === packStr;
    });

    const unitsPerBox = parseInt(matchedPkg?.units_per_box || it.bottles_per_box || it.units_per_box || 12, 10) || 12;
    const boxInventoryId = it.box_inventory_id ? parseInt(it.box_inventory_id, 10) : (matchedPkg?.box_inventory_id ? parseInt(matchedPkg.box_inventory_id, 10) : null);
    const boxName = it.box_name || (cachedBoxesList.find(b => b.id == boxInventoryId)?.name || null);

    let packCalc = { boxes: 0, loose: qty, unitsPerBox: unitsPerBox, totalUnits: qty, totalVolumeLitres: 0, outerBoxesConsumed: 0 };
    if (window.INVENTORY_CORE && window.INVENTORY_CORE.calculatePackagingQuantities) {
      packCalc = window.INVENTORY_CORE.calculatePackagingQuantities({
        packagingSize: packStr,
        unitsPerBox: unitsPerBox,
        boxes: it.box_quantity,
        loose: it.loose_quantity,
        totalUnits: qty
      });
    }

    const outerBoxes = (boxInventoryId && qty > 0) ? (packCalc.outerBoxesConsumed || Math.ceil(qty / unitsPerBox)) : 0;

    return {
      ...it,
      box_quantity: packCalc.boxes,
      loose_quantity: packCalc.loose,
      bottles_per_box: unitsPerBox,
      total_units: packCalc.totalUnits,
      total_volume: packCalc.totalVolumeLitres,
      box_inventory_id: boxInventoryId,
      box_name: boxName,
      outer_boxes_consumed: outerBoxes
    };
  });

  // Batch insert all order items into physical order_items table using strictly existent database columns
  const itemRows = processedItems.map(it => {
    const qty = parseFloat(it.total_units || it.quantity) || 0;
    return {
      order_id: orderId,
      product_id: it.product_id ? parseInt(it.product_id, 10) : null,
      inventory_item_id: it.inventory_item_id ? parseInt(it.inventory_item_id, 10) : null,
      product_name: it.product_name || null,
      packing_size: it.packaging_size || it.packing_size || null,
      bottle_inventory_id: it.bottle_inventory_id ? parseInt(it.bottle_inventory_id, 10) : null,
      quantity: qty,
      unit_price: parseFloat(it.unit_price) || 0,
      discount: parseFloat(it.discount) || 0,
      total: parseFloat(it.total) || 0
    };
  });

  if (itemRows.length > 0) {
    const stampedRows = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.stamp(itemRows) : itemRows;
    const { error: insErr } = await window.dbClient.from('order_items').insert(stampedRows);
    if (insErr) throw insErr;
  }

  // Persist dispatch & packaging metadata into orders.notes as DISPATCH_META
  try {
    const { data: currentOrder } = await window.dbClient.from('orders').select('notes').eq('id', orderId).maybeSingle();
    const cleanNotes = extractUserNotes(currentOrder?.notes || '');
    const packagingMeta = {
      items_meta: processedItems.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        packing_size: it.packaging_size || it.packing_size,
        quantity: it.quantity,
        total_units: it.total_units || it.quantity,
        bottle_inventory_id: it.bottle_inventory_id,
        box_inventory_id: it.box_inventory_id,
        box_name: it.box_name,
        bottles_per_box: it.bottles_per_box,
        box_quantity: it.box_quantity,
        loose_quantity: it.loose_quantity,
        outer_boxes_consumed: it.outer_boxes_consumed,
        ordered_units: it.total_units || it.quantity,
        dispatched_units: 0,
        remaining_units: it.total_units || it.quantity
      }))
    };
    const finalNotes = cleanNotes
      ? `${cleanNotes}\n\nDISPATCH_META: ${JSON.stringify(packagingMeta)}`
      : `DISPATCH_META: ${JSON.stringify(packagingMeta)}`;
    await window.dbClient.from('orders').update({ notes: finalNotes }).eq('id', orderId);
  } catch (mErr) {
    console.warn('Failed to update order DISPATCH_META:', mErr);
  }

  // Deduct stock using authoritative FIFO engine
  for (const it of processedItems) {
    const qty = parseFloat(it.total_units || it.quantity) || 0;
    const packMl = (window.INVENTORY_CORE && window.INVENTORY_CORE.parsePackagingSize)
      ? window.INVENTORY_CORE.parsePackagingSize(it.packaging_size || it.packing_size).volumeMl
      : (UTILS.parsePackSizeInMl(it.packaging_size || it.packing_size) || 1000);
    const volumeLiters = (packMl / 1000) * qty;

    // 1. Deduct bottle stock if selected
    if (it.bottle_inventory_id && qty > 0) {
      const bottleId = parseInt(it.bottle_inventory_id, 10);
      if (window.INVENTORY_SERVICE && window.INVENTORY_SERVICE.deductStockFIFO) {
        await window.INVENTORY_SERVICE.deductStockFIFO({
          itemId: bottleId,
          quantity: qty,
          movementType: 'DISPATCH_BOTTLES',
          referenceType: 'orders',
          referenceId: orderId,
          referenceNo: orderNo,
          idempotencyKey: `ord-${orderId}-btl-${bottleId}`,
          allowNegative: allowBackorder
        });
      } else {
        await window.INVENTORY_SERVICE.deductStock(bottleId, qty);
      }
    }

    // 2. Deduct outer box stock if configured
    if (it.box_inventory_id && it.outer_boxes_consumed > 0) {
      const boxId = parseInt(it.box_inventory_id, 10);
      if (window.INVENTORY_SERVICE && window.INVENTORY_SERVICE.deductStockFIFO) {
        await window.INVENTORY_SERVICE.deductStockFIFO({
          itemId: boxId,
          quantity: it.outer_boxes_consumed,
          movementType: 'DISPATCH_BOXES',
          referenceType: 'orders',
          referenceId: orderId,
          referenceNo: orderNo,
          idempotencyKey: `ord-${orderId}-box-${boxId}`,
          allowNegative: allowBackorder
        });
      } else {
        await window.INVENTORY_SERVICE.deductStock(boxId, it.outer_boxes_consumed);
      }
    }

    // 3. Deduct Technical bulk stock
    let techItem = null;
    if (window.INVENTORY_SERVICE && window.INVENTORY_SERVICE.resolveTechnicalItem) {
      techItem = await window.INVENTORY_SERVICE.resolveTechnicalItem(it.product_id, it.product_name);
    }
    if (!techItem && it.inventory_item_id) {
      const { data: invRow } = await window.dbClient.from('inventory_items').select('id, unit').eq('id', it.inventory_item_id).maybeSingle();
      techItem = invRow;
    }

    if (techItem) {
      let deductQty = volumeLiters;
      if (techItem.unit) {
        deductQty = UTILS.convertUnit(volumeLiters, 'Litre', techItem.unit);
      }
      if (deductQty > 0) {
        if (window.INVENTORY_SERVICE && window.INVENTORY_SERVICE.deductStockFIFO) {
          await window.INVENTORY_SERVICE.deductStockFIFO({
            itemId: techItem.id,
            quantity: deductQty,
            movementType: 'DISPATCH',
            referenceType: 'orders',
            referenceId: orderId,
            referenceNo: orderNo,
            idempotencyKey: `ord-${orderId}-tech-${techItem.id}`,
            allowNegative: allowBackorder
          });
        } else {
          await window.INVENTORY_SERVICE.deductStock(techItem.id, deductQty);
        }
      }
    }
  }
}

async function deleteOrder(id) {
  APP.showConfirm('Delete this order and its items?', async () => {
    try {
      // 1. Revert stock
      await revertOrderStock(id);

      // 2. Delete order items & order
      await window.dbClient.from('order_items').delete().eq('order_id', id);
      const { error } = await window.dbClient.from('orders').delete().eq('id', id);
      if (error) throw error;
      
      APP.showToast('Order deleted and stock restored!', 'success');
      setTimeout(() => loadOrders(), 100);
    } catch (err) {
      console.error(err);
      APP.showToast('Failed to delete order: ' + err.message, 'error');
    }
  });
}

// Tab Switching Listener
document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeOrderTab = e.target.getAttribute('data-tab');

    const ordersWrap = document.getElementById('orders-table-wrap');
    const itemsWrap = document.getElementById('order-items-table-wrap');

    const dispWrap = document.getElementById('dispatches-table-wrap');

    if (activeOrderTab === 'Orders') {
      if (ordersWrap) ordersWrap.style.display = '';
      if (itemsWrap) itemsWrap.style.display = 'none';
      if (dispWrap) dispWrap.style.display = 'none';
      applyFiltersAndRender();
    } else if (activeOrderTab === 'OrderItems') {
      if (ordersWrap) ordersWrap.style.display = 'none';
      if (itemsWrap) itemsWrap.style.display = '';
      if (dispWrap) dispWrap.style.display = 'none';
      applyFiltersAndRender();
    } else if (activeOrderTab === 'Dispatches') {
      if (ordersWrap) ordersWrap.style.display = 'none';
      if (itemsWrap) itemsWrap.style.display = 'none';
      if (dispWrap) dispWrap.style.display = '';
      if (window.DISPATCH_UI) window.DISPATCH_UI.loadDispatches();
    }
  });
});

// Status Pill Filters for Orders
document.querySelectorAll('#status-pill-filters .cat-pill').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('#status-pill-filters .cat-pill').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeStatusFilter = e.target.getAttribute('data-status') || '';
    applyFiltersAndRender();
  });
});

// Status Pill Filters for Items
document.querySelectorAll('#items-status-pill-filters .cat-pill').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('#items-status-pill-filters .cat-pill').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeItemsStatusFilter = e.target.getAttribute('data-status') || '';
    applyFiltersAndRender();
  });
});

const debouncedApplyOrderFilters = (typeof UTILS !== 'undefined' && UTILS.debounce) 
  ? UTILS.debounce(() => applyFiltersAndRender(), 250) 
  : () => applyFiltersAndRender();
document.getElementById('search-input')?.addEventListener('input', debouncedApplyOrderFilters);
document.getElementById('items-search-input')?.addEventListener('input', debouncedApplyOrderFilters);

// Event listeners for auto discount calculations
document.getElementById('auto-discount-toggle')?.addEventListener('change', handleAutoDiscount);
document.querySelector('#order-form input[name="paid_amount"]')?.addEventListener('input', handleAutoDiscount);

loadOrders();
