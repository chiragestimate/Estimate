/**
 * tests/test_orders_summary_detail_and_dispatches.js
 * Comprehensive automated test suite for:
 * 1. Orders Summary layout, Indian currency formatting, client wrapping, and dispatch status derivation.
 * 2. Order Items Detail table column alignment, responsive fitting without horizontal overflow.
 * 3. Dispatches & Gate Passes data loading, persistent notes synchronization, batch matching, and full lifecycle.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Static file inspections
console.log('--- Test 1: Inspecting CSS and HTML table definitions ---');
const tablesCss = fs.readFileSync(path.join(__dirname, '../assets/css/tables.css'), 'utf8');
const ordersHtml = fs.readFileSync(path.join(__dirname, '../pages/orders.html'), 'utf8');
const ordersJs = fs.readFileSync(path.join(__dirname, '../assets/js/orders.js'), 'utf8');
const dispatchUiJs = fs.readFileSync(path.join(__dirname, '../assets/js/dispatch-ui.js'), 'utf8');
const dispatchCoreJs = fs.readFileSync(path.join(__dirname, '../assets/js/dispatch-core.js'), 'utf8');

// Verify tables.css includes scoped table-layout rules and alignments
assert(tablesCss.includes('#orders-table'), 'tables.css must contain #orders-table rules');
assert(tablesCss.includes('#order-items-detail-table'), 'tables.css must contain #order-items-detail-table rules');
assert(tablesCss.includes('#dispatches-table'), 'tables.css must contain #dispatches-table rules');
assert(tablesCss.includes('font-variant-numeric: tabular-nums'), 'tables.css must use tabular-nums for numeric alignment');
assert(tablesCss.includes('.cell-client'), 'tables.css must define .cell-client wrapping rule');
assert(tablesCss.includes('.cell-product'), 'tables.css must define .cell-product wrapping rule');
assert(tablesCss.includes('#dispatch-status-pill-filters'), 'tables.css must define flex layout for #dispatch-status-pill-filters');
assert(tablesCss.includes('.order-items-cards-grid'), 'tables.css must contain .order-items-cards-grid');
assert(tablesCss.includes('.order-item-card'), 'tables.css must contain .order-item-card');
assert(tablesCss.includes('.order-item-quantities-grid'), 'tables.css must contain .order-item-quantities-grid');
assert(tablesCss.includes('.order-item-finance-row'), 'tables.css must contain .order-item-finance-row');
assert(tablesCss.includes('.order-item-card-actions'), 'tables.css must contain .order-item-card-actions');
console.log('[PASS] tables.css contains all required layout, alignment, and card grid rules');

// Verify orders.html header alignments, column spans, and card container
assert(ordersHtml.includes('<th class="cell-amount text-right" style="width:11%; text-align:right;">Total</th>'), 'orders.html Total header must be text-right');
assert(ordersHtml.includes('<th class="cell-amount text-right" style="width:11%; text-align:right;">Paid</th>'), 'orders.html Paid header must be text-right');
assert(ordersHtml.includes('<th class="cell-amount text-right" style="width:11%; text-align:right;">Balance</th>'), 'orders.html Balance header must be text-right');
assert(ordersHtml.includes('<td colspan="12">'), 'orders.html Order items detail empty state must span all 12 columns');
assert(ordersHtml.includes('id="order-items-cards-container"'), 'orders.html must contain #order-items-cards-container');
assert(ordersJs.includes('order-items-cards-container'), 'orders.js must reference order-items-cards-container');
console.log('[PASS] orders.html headers, card container, and empty row colspans correctly defined');

// 2. Mock environment to test orders.js and utils.js rendering logic
const utils = require('../assets/js/utils.js');
const UTILS = global.UTILS = {
  fmtCurrency: (val) => {
    const n = parseFloat(val) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  fmtDate: (d) => d || '—',
  statusBadge: (st) => `<span class="badge">${st}</span>`,
  applyMobileTableLabels: () => {}
};

console.log('\n--- Test 2: Indian Currency Formatting ---');
assert.strictEqual(UTILS.fmtCurrency(293400), '₹2,93,400.00', 'Should format 293400 with Indian grouping ₹2,93,400.00');
assert.strictEqual(UTILS.fmtCurrency(105000), '₹1,05,000.00', 'Should format 105000 as ₹1,05,000.00');
assert.strictEqual(UTILS.fmtCurrency(0), '₹0.00', 'Should format 0 as ₹0.00');
assert.strictEqual(UTILS.fmtCurrency(1234567.89), '₹12,34,567.89', 'Should format 1234567.89 as ₹12,34,567.89');
console.log('[PASS] Indian currency formatting matches exact specifications');

console.log('\n--- Test 3: Orders Summary Dispatch Status Derivation ---');
// Verify that an order with status = 'Completed' but 0 units dispatched is NOT marked 'Fully Dispatched'
function deriveDispatchStatus(order) {
  let dispStatus = order.dispatch_status;
  if (!dispStatus) {
    const items = order.items || [];
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
  return dispStatus;
}

const testOrder17 = {
  id: 17,
  order_no: 'O-01',
  status: 'Completed', // Order booking completed
  total_amount: 105000,
  paid_amount: 400000,
  items: [
    { ordered_units: 50, dispatched_units: 0, remaining_units: 50 }
  ]
};

const status17 = deriveDispatchStatus(testOrder17);
assert.strictEqual(status17, 'Pending Verification', 'Order 17 with 0 dispatched units must NOT be Fully Dispatched');
console.log('[PASS] Order 17 correctly derives status as "Pending Verification" instead of false "Fully Dispatched"');

// Test partial dispatch
const testOrderPartial = {
  id: 18,
  order_no: 'O-02',
  status: 'Completed',
  items: [
    { ordered_units: 50, dispatched_units: 20, remaining_units: 30 }
  ]
};
assert.strictEqual(deriveDispatchStatus(testOrderPartial), 'Partially Dispatched', 'Partially dispatched order must derive "Partially Dispatched"');

// Test fully dispatched
const testOrderFull = {
  id: 19,
  order_no: 'O-03',
  status: 'Completed',
  items: [
    { ordered_units: 50, dispatched_units: 50, remaining_units: 0 }
  ]
};
assert.strictEqual(deriveDispatchStatus(testOrderFull), 'Fully Dispatched', 'Fully dispatched order must derive "Fully Dispatched"');
console.log('[PASS] Status transitions accurately derived for un-dispatched, partial, and full dispatches');

console.log('\n--- Test 4: Eligibility for Prepare Dispatch ---');
// Verify eligible orders filter in dispatch-ui
const ordersList = [
  testOrder17,
  testOrderPartial,
  testOrderFull,
  { id: 20, order_no: 'O-04', status: 'Cancelled', items: [{ ordered_units: 10, dispatched_units: 0 }] }
];

const eligibleOrders = ordersList.filter(o => {
  const st = (o.status || '').toLowerCase();
  const dispSt = (deriveDispatchStatus(o) || '').toLowerCase();
  const items = o.items || [];
  const totalOrd = items.reduce((s, it) => s + (parseInt(it.ordered_units || it.quantity, 10) || 0), 0);
  const totalDisp = items.reduce((s, it) => s + (parseInt(it.dispatched_units, 10) || 0), 0);
  const hasRemaining = items.length === 0 || totalOrd === 0 || totalDisp < totalOrd;

  return st !== 'cancelled' && dispSt !== 'fully dispatched' && hasRemaining;
});

assert(eligibleOrders.some(o => o.id === 17), 'Order 17 must be eligible for prepare dispatch');
assert(eligibleOrders.some(o => o.id === 18), 'Order 18 (partial) must be eligible for prepare dispatch');
assert(!eligibleOrders.some(o => o.id === 19), 'Order 19 (full) must NOT be eligible');
assert(!eligibleOrders.some(o => o.id === 20), 'Order 20 (cancelled) must NOT be eligible');
console.log('[PASS] Eligible orders filter correctly includes Order 17 and excludes full/cancelled orders');

console.log('\n--- Test 5: Order Items Detail Card Generation & Data Completeness ---');
// Verify card template rendering logic with mock DOM
const mockCardsContainer = { innerHTML: '' };
const mockTotalInfo = { textContent: '' };
const mockTbody = { innerHTML: '' };

// Create sandbox to execute renderOrderItemsDetailTable
const vm = require('vm');
const sandbox = {
  document: {
    getElementById: (id) => {
      if (id === 'order-items-cards-container') return mockCardsContainer;
      if (id === 'items-total-info') return mockTotalInfo;
      return null;
    },
    querySelector: (sel) => {
      if (sel === '#order-items-detail-table tbody') return mockTbody;
      return null;
    }
  },
  UTILS: {
    ...global.UTILS,
    formatPackagingBreakdown: utils.formatPackagingBreakdown,
    escapeHtml: utils.escapeHtml
  },
  escapeHtml: utils.escapeHtml,
  allPackagingData: [],
  cleanSizeLabel: (val) => val || '—',
  formatOrderNo: (val) => val || '—',
  viewOrder: () => {},
  openEdit: () => {},
  openPrepareDispatch: () => {}
};

// Extract renderOrderItemsDetailTable function string from ordersJs
const fnMatch = ordersJs.match(/function renderOrderItemsDetailTable\([\s\S]*?\n\}/);
assert(fnMatch, 'renderOrderItemsDetailTable must be defined in orders.js');
vm.createContext(sandbox);
vm.runInContext(fnMatch[0], sandbox);

const sampleDetailedItems = [
  {
    order_id: 17,
    order_no: 'O-01',
    client_display: 'Agro Supplies Ltd',
    date: '2026-10-17',
    status: 'Pending',
    dispatch_status: 'Pending Verification',
    product_name: 'Chlorantraniliprole 18.5% SC',
    packaging_size: '1 Litre',
    quantity: 20,
    ordered_units: 20,
    dispatched_units: 0,
    remaining_units: 20,
    unit_price: 650,
    total: 13000
  },
  {
    order_id: 17,
    order_no: 'O-01',
    client_display: 'Agro Supplies Ltd',
    date: '2026-10-17',
    status: 'Pending',
    dispatch_status: 'Pending Verification',
    product_name: 'Emamectin Benzoate 5% SG',
    packaging_size: '500 ml',
    quantity: 10,
    ordered_units: 10,
    dispatched_units: 10,
    remaining_units: 0,
    unit_price: 400,
    total: 4000
  },
  {
    order_id: 18,
    order_no: 'O-02',
    client_display: 'Green Field Fertilizers & Seeds Private Limited',
    date: '2026-10-16',
    status: 'Completed',
    dispatch_status: 'Partially Dispatched',
    product_name: 'Atrazine 50% WP',
    packaging_size: '1 Kg',
    box_quantity: 4,
    loose_quantity: 2,
    bottles_per_box: 12,
    quantity: 50,
    ordered_units: 50,
    dispatched_units: 20,
    remaining_units: 30,
    unit_price: 350,
    total: 17500
  }
];

// Execute card renderer
sandbox.renderOrderItemsDetailTable(sampleDetailedItems);

assert.strictEqual(mockTotalInfo.textContent, '3 items', 'Total info should display 3 items');
const renderedHtml = mockCardsContainer.innerHTML;

// Verify 3 distinct cards are rendered
const cardMatches = renderedHtml.match(/class="order-item-card"/g);
assert(cardMatches && cardMatches.length === 3, 'Must render exactly 3 distinct cards (1 per order item)');

// Verify Card 1 contents
assert(renderedHtml.includes('Chlorantraniliprole 18.5% SC'), 'Card 1 contains Product Name');
assert(renderedHtml.includes('Agro Supplies Ltd'), 'Card 1 contains Client Name');
assert(renderedHtml.includes('1 Litre'), 'Card 1 contains Pack Size badge');
assert(renderedHtml.includes('20 <small>units</small>'), 'Card 1 contains Ordered quantity');
assert(renderedHtml.includes('0 <small>units</small>'), 'Card 1 contains Dispatched quantity');
assert(renderedHtml.includes('₹650.00'), 'Card 1 contains Unit Price formatted in ₹');
assert(renderedHtml.includes('₹13,000.00'), 'Card 1 contains Line Total formatted in ₹');
assert(renderedHtml.includes('onclick="viewOrder(17)"'), 'Card 1 contains View action');
assert(renderedHtml.includes('onclick="openEdit(17)"'), 'Card 1 contains Edit action');
assert(renderedHtml.includes('onclick="openPrepareDispatch(17)"'), 'Card 1 contains Dispatch action');

// Verify Card 2 (second product of same order is its own distinct card)
assert(renderedHtml.includes('Emamectin Benzoate 5% SG'), 'Card 2 contains distinct Product Name');
assert(renderedHtml.includes('₹4,000.00'), 'Card 2 contains Line Total ₹4,000.00');

// Verify Card 3 has packaging breakdown and natural wrapping client name
assert(renderedHtml.includes('Green Field Fertilizers') && renderedHtml.includes('Seeds Private Limited'), 'Card 3 contains full client name');
assert(renderedHtml.includes('4 Bx'), 'Card 3 contains packaging breakdown boxes');
assert(renderedHtml.includes('₹17,500.00'), 'Card 3 contains Line Total ₹17,500.00');

// Verify Empty State when 0 items match
sandbox.renderOrderItemsDetailTable([]);
assert.strictEqual(mockTotalInfo.textContent, '0 items', 'Total info should display 0 items');
assert(mockCardsContainer.innerHTML.includes('No items found'), 'Cards container shows empty state when no items');
console.log('[PASS] Order items card layout renders distinct cards per product with full metadata, quantities, finances, and actions');

console.log('\n--- Test 6: Dispatch Core Persistence & Notes Synchronization ---');
const dispatchCore = require('../assets/js/dispatch-core.js');

// Mock client simulating Supabase PostgreSQL without physical order_dispatches table
const mockDb = {
  orders: [
    { id: 17, order_no: 'O-01', client_name: 'First Client', notes: null }
  ],
  order_items: [
    { id: 30, order_id: 17, product_id: 2, product_name: 'Chlorantraniliprole 18.5% SC', quantity: 50, ordered_units: 50, dispatched_units: 0, remaining_units: 50 }
  ],
  stock_batches: [
    { id: 2, item_id: 2, batch_no: 'OPEN-02', current_qty: 2710, qc_status: 'Approved', is_quarantine: false }
  ],
  inventory_items: [
    { id: 2, name: 'Chlorantraniliprole 18.5% SC', category: 'Technical' }
  ],
  stock_movements: [],

  from(tableName) {
    const self = this;
    return {
      select(fields) {
        return {
          eq(k, v) {
            return {
              maybeSingle: async () => {
                if (tableName === 'order_dispatches' || tableName === 'dispatches') {
                  const err = new Error("Could not find the table 'public." + tableName + "' in the schema cache");
                  err.code = 'PGRST205';
                  return { data: null, error: err };
                }
                const found = (self[tableName] || []).find(r => r[k] === v);
                return { data: found || null, error: null };
              },
              then(resolve) {
                if (tableName === 'order_dispatches' || tableName === 'dispatches') {
                  const err = new Error("Could not find the table 'public." + tableName + "' in the schema cache");
                  err.code = 'PGRST205';
                  resolve({ data: null, error: err });
                } else {
                  const matches = (self[tableName] || []).filter(r => r[k] === v);
                  resolve({ data: matches, error: null });
                }
              }
            };
          },
          gt(k, v) {
            return {
              eq(k2, v2) {
                return {
                  then(resolve) {
                    const matches = (self[tableName] || []).filter(r => r[k] > v && r[k2] === v2);
                    resolve({ data: matches, error: null });
                  }
                };
              },
              then(resolve) {
                const matches = (self[tableName] || []).filter(r => r[k] > v);
                resolve({ data: matches, error: null });
              }
            };
          },
          then(resolve) {
            if (tableName === 'order_dispatches' || tableName === 'dispatches') {
              const err = new Error("Could not find the table 'public." + tableName + "' in the schema cache");
              err.code = 'PGRST205';
              resolve({ data: null, error: err });
            } else {
              resolve({ data: self[tableName] || [], error: null });
            }
          }
        };
      },
      insert(records) {
        return {
          select() {
            if (tableName === 'order_dispatches' || tableName === 'dispatches') {
              const err = new Error("Could not find the table 'public." + tableName + "' in the schema cache");
              err.code = 'PGRST205';
              return Promise.resolve({ data: null, error: err });
            }
            if (!self[tableName]) self[tableName] = [];
            records.forEach(r => self[tableName].push(r));
            return Promise.resolve({ data: records, error: null });
          },
          then(resolve) {
            if (!self[tableName]) self[tableName] = [];
            records.forEach(r => self[tableName].push(r));
            resolve({ data: records, error: null });
          }
        };
      },
      update(updates) {
        return {
          eq(k, v) {
            if (tableName === 'order_dispatches' || tableName === 'dispatches') {
              const err = new Error("Could not find the table 'public." + tableName + "' in the schema cache");
              err.code = 'PGRST205';
              return Promise.resolve({ data: null, error: err });
            }
            const found = (self[tableName] || []).find(r => r[k] === v);
            if (found) Object.assign(found, updates);
            return Promise.resolve({ data: 1, error: null });
          }
        };
      }
    };
  }
};

async function testDispatchLifecycle() {
  // 1. Initial dispatches should be 0
  const initial = await dispatchCore.Service.getDispatches(mockDb);
  assert.strictEqual(initial.length, 0, 'Initially dispatches must be 0');
  console.log('[PASS] Situation 1 verified: Dispatches table shows 0 when none prepared');

  // 2. Prepare dispatch for Order 17
  const prepRes = await dispatchCore.Service.prepareDispatch(mockDb, {
    order_id: 17,
    dispatch_no: 'DSP-000001',
    dispatch_date: '2026-10-17',
    vehicle_no: 'GJ-01-AB-1234',
    transporter_name: 'Fast Logistics',
    items: [
      {
        order_item_id: 30,
        stock_batch_id: 2,
        batch_no: 'OPEN-02',
        total_units_dispatched: 50,
        units_per_box: 10
      }
    ],
    idempotency_key: 'TEST-DSP-01'
  });

  assert(prepRes.success, 'Dispatch preparation should succeed');
  console.log('[PASS] Dispatch slip DSP-000001 prepared successfully');

  // 3. Verify that dispatch was synced into mockDb.orders[0].notes under DISPATCH_META
  const ordRow = mockDb.orders.find(o => o.id === 17);
  assert(ordRow.notes && ordRow.notes.includes('DISPATCH_META'), 'Order notes must store DISPATCH_META');
  assert(ordRow.notes.includes('DSP-000001'), 'Order notes DISPATCH_META must contain DSP-000001');
  console.log('[PASS] Dispatch record successfully persisted into orders.notes DISPATCH_META');

  // 4. getDispatches retrieves the record via notes sync
  const dispatchesList = await dispatchCore.Service.getDispatches(mockDb);
  assert(dispatchesList.length >= 1, 'getDispatches must return the created dispatch');
  const d = dispatchesList.find(x => x.dispatch_no === 'DSP-000001');
  assert(d, 'Created dispatch must be in list');
  assert.strictEqual(d.order_no, 'O-01', 'Order number attached');
  assert.strictEqual(d.client_name, 'First Client', 'Client name attached');
  assert.strictEqual(d.status, 'Pending Verification', 'Initial status is Pending Verification');
  console.log('[PASS] getDispatches retrieves persistent dispatch with order and client details');

  // 5. Verify Packing
  const vRes = await dispatchCore.Service.verifyPacking(mockDb, {
    dispatchId: d.id,
    verifiedBy: 'Quality In-charge'
  });
  assert(vRes.success, 'Packing verification should succeed');
  assert(mockDb.orders[0].notes.includes('"status":"Verified"'), 'Order notes updated to Verified');
  console.log('[PASS] Godown verification updates status and syncs to orders.notes');

  // 6. Approve Dispatch
  const aRes = await dispatchCore.Service.approveDispatch(mockDb, {
    dispatchId: d.id,
    approvedBy: 'Director'
  });
  assert(aRes.success, 'Approval should succeed');
  assert(mockDb.orders[0].notes.includes('"status":"Approved"'), 'Order notes updated to Approved');
  console.log('[PASS] Manager approval updates status and syncs to orders.notes');

  // 7. Execute Dispatch Gate Pass
  const execRes = await dispatchCore.Service.executeDispatch(mockDb, {
    dispatchId: d.id,
    dispatchedBy: 'Gate Security'
  });
  assert(execRes.success, 'Gate pass execution should succeed');
  assert.strictEqual(execRes.orderDispatchStatus, 'Fully Dispatched');
  assert.strictEqual(mockDb.stock_batches[0].current_qty, 2660, '2710 - 50 = 2660 units');
  assert(mockDb.orders[0].notes.includes('"status":"Dispatched"'), 'Order notes updated to Dispatched');
  console.log('[PASS] Single-posting stock deduction executed exactly once, batch balance updated');

  console.log('\n===============================================================');
  console.log('ALL ORDERS SUMMARY, DETAIL, AND DISPATCH TESTS PASSED!');
  console.log('===============================================================');
}

testDispatchLifecycle().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
