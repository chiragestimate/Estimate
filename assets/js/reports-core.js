/**
 * assets/js/reports-core.js
 * Authoritative Sales Analytics, Customer 360, Reporting & Export Engine
 *
 * Implements:
 * 1. Standard Date Range Calculations (Today, Week, Month, Quarter, Financial Year, Calendar Year, Custom).
 * 2. Multi-Product SKU Packaging Breakdown (Boxes, Loose Units, Total Volume/Weight).
 * 3. Stock Availability & Reservation Pre-Check.
 * 4. Partial Order Fulfillment & Remaining Units Tracking.
 * 5. Customer-Wise Annual Sales, Dispatch History, Outstanding Balances & Receivables.
 * 6. Product-Wise Sales, SKU Packaging Size Analysis & Monthly Trends.
 * 7. Company-Wise Supply & Multi-Entity Summaries.
 * 8. Returns, Cancellations, and Reversal Netting.
 * 9. Multi-Dimensional Filter Engine (Customer, Company, Product, SKU, Statuses, Dates).
 * 10. Reliable Excel & CSV Formatter with Exact Matching Display Totals.
 *
 * Universal Module: Node.js (module.exports) & Browser (window.REPORTS_CORE, window.REPORTS_SERVICE).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const inventoryCore = require('./inventory-core.js');
    module.exports = factory(inventoryCore);
  } else {
    root.REPORTS_CORE = factory(root.INVENTORY_CORE);
    root.REPORTS_SERVICE = root.REPORTS_CORE.Service;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (inventoryCore) {
  'use strict';

  // ============================================================================
  // 1. DATE RANGE & FISCAL CALENDAR HELPER
  // ============================================================================
  const DateRangeHelper = {
    /**
     * Format a Date object to YYYY-MM-DD
     */
    formatDate(date) {
      if (!date || isNaN(date.getTime())) return '';
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    /**
     * Parse string or timestamp into clean Date at start of day (00:00:00)
     */
    parseDate(val) {
      if (!val) return null;
      if (val instanceof Date) return new Date(val.getFullYear(), val.getMonth(), val.getDate());
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    },

    /**
     * Compute exact start and end dates for any preset
     * @param {'today'|'week'|'month'|'quarter'|'financial_year'|'calendar_year'|'last_12_months'|'custom'} preset
     * @param {Object} custom - { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
     * @param {Date} [referenceDate] - Defaults to current date
     */
    computeDateRange(preset, custom = {}, referenceDate = new Date()) {
      const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      const todayStr = this.formatDate(now);

      switch (String(preset || '').toLowerCase()) {
        case 'today':
          return { from: todayStr, to: todayStr, label: 'Today' };

        case 'week': {
          // Last 7 days including today
          const start = new Date(now);
          start.setDate(now.getDate() - 6);
          return { from: this.formatDate(start), to: todayStr, label: 'Last 7 Days' };
        }

        case 'month': {
          // 1st of current month to today
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          return { from: this.formatDate(start), to: todayStr, label: 'This Month' };
        }

        case 'quarter': {
          // Indian fiscal quarter: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
          const m = now.getMonth(); // 0-11
          let qStartMonth, qEndMonth, qYear = now.getFullYear();
          let qLabel = '';

          if (m >= 3 && m <= 5) {
            qStartMonth = 3; qEndMonth = 5; qLabel = 'Q1 (Apr - Jun)';
          } else if (m >= 6 && m <= 8) {
            qStartMonth = 6; qEndMonth = 8; qLabel = 'Q2 (Jul - Sep)';
          } else if (m >= 9 && m <= 11) {
            qStartMonth = 9; qEndMonth = 11; qLabel = 'Q3 (Oct - Dec)';
          } else {
            qStartMonth = 0; qEndMonth = 2; qLabel = 'Q4 (Jan - Mar)';
          }

          const qStart = new Date(qYear, qStartMonth, 1);
          const qEnd = new Date(qYear, qEndMonth + 1, 0); // last day of quarter
          const cappedEnd = qEnd > now ? now : qEnd;
          return { from: this.formatDate(qStart), to: this.formatDate(cappedEnd), label: qLabel };
        }

        case 'financial_year':
        case 'fy': {
          // Indian Financial Year: April 1 to March 31
          const curYear = now.getFullYear();
          const isBeforeApril = now.getMonth() < 3;
          const fyStartYear = isBeforeApril ? curYear - 1 : curYear;
          const fyEndYear = fyStartYear + 1;

          const start = new Date(fyStartYear, 3, 1); // Apr 1
          const end = new Date(fyEndYear, 2, 31);   // Mar 31
          const cappedEnd = end > now ? now : end;
          return {
            from: this.formatDate(start),
            to: this.formatDate(cappedEnd),
            label: `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`
          };
        }

        case 'calendar_year':
        case 'year':
        case 'cy': {
          const start = new Date(now.getFullYear(), 0, 1);
          return { from: this.formatDate(start), to: todayStr, label: `CY ${now.getFullYear()}` };
        }

        case 'last_12_months':
        case '12months': {
          const start = new Date(now);
          start.setFullYear(now.getFullYear() - 1);
          start.setDate(start.getDate() + 1);
          return { from: this.formatDate(start), to: todayStr, label: 'Last 12 Months' };
        }

        case 'custom':
        default: {
          const from = custom.from || '';
          const to = custom.to || todayStr;
          return { from, to, label: from && to ? `${from} to ${to}` : 'All Time' };
        }
      }
    },

    /**
     * Check if a record date falls within [from, to] inclusive
     */
    isWithinRange(recordDate, from, to) {
      if (!recordDate) return false;
      const rec = this.formatDate(this.parseDate(recordDate));
      if (!rec) return false;
      if (from && rec < from) return false;
      if (to && rec > to) return false;
      return true;
    }
  };

  // ============================================================================
  // 2. PACKAGING BREAKDOWN & EQUIVALENT QUANTITY CALCULATOR
  // ============================================================================
  const PackagingHelper = {
    /**
     * Calculate boxes, loose units, and volume for an item
     */
    breakdownQuantities(totalUnits, unitsPerBox = 0, packagingSize = '1 Litre') {
      const units = Math.max(0, parseInt(totalUnits, 10) || 0);
      const upb = Math.max(0, parseInt(unitsPerBox, 10) || 0);
      const boxes = upb > 0 ? Math.floor(units / upb) : 0;
      const loose = upb > 0 ? (units % upb) : units;

      let volumeLitres = 0;
      if (inventoryCore && inventoryCore.parsePackagingSize) {
        const parsed = inventoryCore.parsePackagingSize(packagingSize);
        volumeLitres = (parsed.volumeMl / 1000) * units;
      } else {
        const m = String(packagingSize).match(/([\d.]+)\s*(ml|l|litre|kg|gm)?/i);
        if (m) {
          const num = parseFloat(m[1]) || 1;
          const u = (m[2] || 'l').toLowerCase();
          const ml = u.startsWith('m') ? num : (u.startsWith('g') ? num : num * 1000);
          volumeLitres = (ml / 1000) * units;
        } else {
          volumeLitres = units;
        }
      }

      const displayBreakdown = boxes > 0 && loose > 0
        ? `${boxes} boxes + ${loose} loose (${units} units)`
        : (boxes > 0 ? `${boxes} boxes (${units} units)` : `${loose} loose units`);

      return {
        totalUnits: units,
        unitsPerBox: upb,
        boxes,
        loose,
        volumeLitres: parseFloat(volumeLitres.toFixed(3)),
        displayBreakdown
      };
    },

    formatPackagingBreakdown(boxes, loose, totalUnits) {
      if (boxes > 0 && loose > 0) return `${boxes} boxes + ${loose} loose (${totalUnits} units)`;
      if (boxes > 0) return `${boxes} boxes (${totalUnits} units)`;
      return `${loose} loose units`;
    }
  };

  // ============================================================================
  // 3. SALES ANALYTICS & REPORTING ENGINE
  // ============================================================================
  const SalesAnalyticsEngine = {
    /**
     * Generate Customer-Wise Sales and Dispatch Report
     * Answers:
     * - How much did this customer order during the period?
     * - How much was actually dispatched?
     * - How many boxes and loose units were supplied?
     * - Which SKUs and packaging sizes were purchased?
     * - How much quantity remains pending?
     * - What were the returns and cancellations?
     * - What is the customer's outstanding balance?
     */
    generateCustomerSalesReport({
      orders = [],
      orderItems = [],
      dispatches = [],
      dispatchItems = [],
      clients = [],
      invoices = [],
      reversals = [],
      filters = {}
    }) {
      const {
        clientId = null,
        companyId = null,
        productId = null,
        packagingSize = null,
        status = null,
        dispatchStatus = null,
        dateFrom = null,
        dateTo = null
      } = filters;

      // 1. Build fast lookup maps
      const clientMap = new Map();
      clients.forEach(c => clientMap.set(String(c.id), { ...c }));

      const itemsByOrderId = new Map();
      const effectiveItems = (orderItems && orderItems.length > 0)
        ? orderItems
        : orders.flatMap(o => (o.items || []).map(it => ({ ...it, order_id: it.order_id || o.id })));

      effectiveItems.forEach(it => {
        const oId = String(it.order_id);
        if (!itemsByOrderId.has(oId)) itemsByOrderId.set(oId, []);
        itemsByOrderId.get(oId).push(it);
      });

      const dispatchesByOrderId = new Map();
      dispatches.forEach(d => {
        const oId = String(d.order_id);
        if (!dispatchesByOrderId.has(oId)) dispatchesByOrderId.set(oId, []);
        dispatchesByOrderId.get(oId).push(d);
      });

      const reversalsByDispatchId = new Map();
      const reversalsByOrderId = new Map();
      reversals.forEach(r => {
        if (r.dispatch_id) {
          const dId = String(r.dispatch_id);
          if (!reversalsByDispatchId.has(dId)) reversalsByDispatchId.set(dId, []);
          reversalsByDispatchId.get(dId).push(r);
        }
        if (r.order_id) {
          const oId = String(r.order_id);
          if (!reversalsByOrderId.has(oId)) reversalsByOrderId.set(oId, []);
          reversalsByOrderId.get(oId).push(r);
        }
      });

      // 2. Discover & parse order notes metadata (DISPATCH_META) for authoritative dispatches and packaging
      const orderMetaMap = new Map();
      orders.forEach(o => {
        if (o.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(o.notes)) {
          try {
            const jsonStr = o.notes.replace(/^[sS]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
            const meta = JSON.parse(jsonStr);
            orderMetaMap.set(String(o.id), meta);
            if (!o.dispatch_status && meta.dispatch_status) {
              o.dispatch_status = meta.dispatch_status;
            }
            if (Array.isArray(meta.dispatches)) {
              const oId = String(o.id);
              if (!dispatchesByOrderId.has(oId)) dispatchesByOrderId.set(oId, []);
              meta.dispatches.forEach(d => {
                if (!dispatchesByOrderId.get(oId).some(x => String(x.id) === String(d.id) || x.dispatch_no === d.dispatch_no)) {
                  dispatchesByOrderId.get(oId).push({ ...d, order_id: o.id, order_no: o.order_no, client_name: o.client_name });
                }
              });
            }
          } catch (_) {}
        }
      });

      // 3. Filter orders
      const eligibleOrders = orders.filter(o => {
        // Multi-company scope
        if (companyId && String(o.company_id || 1) !== String(companyId)) return false;
        // Specific customer
        if (clientId && String(o.client_id) !== String(clientId)) return false;
        // Date range
        if (dateFrom || dateTo) {
          if (!DateRangeHelper.isWithinRange(o.date, dateFrom, dateTo)) return false;
        }
        // Order Status
        if (status) {
          const st = String(o.status || '').toLowerCase();
          if (st !== String(status).toLowerCase()) return false;
        }
        // Dispatch Status
        if (dispatchStatus) {
          const ds = String(o.dispatch_status || 'Pending Verification').toLowerCase();
          if (ds !== String(dispatchStatus).toLowerCase()) return false;
        }
        return true;
      });

      // 3. Aggregate per customer
      const customerStats = new Map();

      // Initialize all clients if not filtered by specific client
      if (!clientId) {
        clients.forEach(c => {
          if (companyId && c.company_id && String(c.company_id) !== String(companyId)) return;
          customerStats.set(String(c.id), {
            clientId: c.id,
            clientName: c.name,
            clientType: c.type || 'Retailer',
            city: c.city || '—',
            creditLimit: parseFloat(c.credit_limit) || 0,
            storedBalance: parseFloat(c.balance) || 0,
            totalOrdersCount: 0,
            totalBilledAmount: 0,
            totalPaidAmount: 0,
            outstandingBalance: 0,
            totalOrderedUnits: 0,
            totalDispatchedUnits: 0,
            totalBoxesDispatched: 0,
            totalLooseDispatched: 0,
            totalPendingUnits: 0,
            totalCancelledUnits: 0,
            totalReturnedUnits: 0,
            totalReturnedAmount: 0,
            netRevenue: 0,
            purchasedSkus: {},
            orderIds: []
          });
        });
      }

      eligibleOrders.forEach(o => {
        const cId = String(o.client_id);
        if (!customerStats.has(cId)) {
          const c = clientMap.get(cId) || { id: o.client_id, name: o.client_name, type: 'Retailer', credit_limit: 0, balance: 0 };
          customerStats.set(cId, {
            clientId: o.client_id,
            clientName: c.name || o.client_name || 'Guest Client',
            clientType: c.type || 'Retailer',
            city: c.city || '—',
            creditLimit: parseFloat(c.credit_limit) || 0,
            storedBalance: parseFloat(c.balance) || 0,
            totalOrdersCount: 0,
            totalBilledAmount: 0,
            totalPaidAmount: 0,
            outstandingBalance: 0,
            totalOrderedUnits: 0,
            totalDispatchedUnits: 0,
            totalBoxesDispatched: 0,
            totalLooseDispatched: 0,
            totalPendingUnits: 0,
            totalCancelledUnits: 0,
            totalReturnedUnits: 0,
            totalReturnedAmount: 0,
            netRevenue: 0,
            purchasedSkus: {},
            orderIds: []
          });
        }

        const stats = customerStats.get(cId);
        const isCancelled = String(o.status || '').toLowerCase() === 'cancelled';

        if (!isCancelled) {
          stats.totalOrdersCount++;
          stats.orderIds.push(o.id);
          stats.totalBilledAmount += parseFloat(o.total_amount) || 0;
          stats.totalPaidAmount += parseFloat(o.paid_amount) || 0;
        } else {
          stats.cancelledOrdersCount = (stats.cancelledOrdersCount || 0) + 1;
        }

        // Process line items (from orderItems table or embedded in order object)
        const items = itemsByOrderId.get(String(o.id)) || o.items || [];
        items.forEach(it => {
          // SKU filter check
          if (productId && String(it.product_id) !== String(productId)) return;
          if (packagingSize) {
            const pSize = String(it.packing_size || it.packaging_size || '').toLowerCase();
            if (!pSize.includes(String(packagingSize).toLowerCase())) return;
          }

          let ordUnits = parseInt(it.ordered_units || it.total_units || it.quantity, 10) || 0;
          let dispUnits = it.dispatched_units !== undefined ? parseInt(it.dispatched_units, 10) : NaN;
          let remUnits = it.remaining_units !== undefined ? parseInt(it.remaining_units, 10) : NaN;
          let upb = it.bottles_per_box;

          if (isNaN(dispUnits) || isNaN(remUnits) || !upb) {
            const ordMeta = orderMetaMap.get(String(o.id));
            if (ordMeta && Array.isArray(ordMeta.items_meta)) {
              const m = ordMeta.items_meta.find(im => 
                String(im.id || im.order_item_id) === String(it.id) ||
                (im.product_name === it.product_name && (im.packing_size === (it.packing_size || it.packaging_size)))
              );
              if (m) {
                if (isNaN(dispUnits) && m.dispatched_units !== undefined) dispUnits = parseInt(m.dispatched_units, 10);
                if (isNaN(remUnits) && m.remaining_units !== undefined) remUnits = parseInt(m.remaining_units, 10);
                if (!upb && m.bottles_per_box) upb = m.bottles_per_box;
              }
            }
          }

          if (isNaN(dispUnits)) dispUnits = 0;
          if (isNaN(remUnits)) remUnits = Math.max(0, ordUnits - dispUnits);
          if (!upb) upb = 10;

          if (isCancelled) {
            stats.totalCancelledUnits += ordUnits;
          } else {
            stats.totalOrderedUnits += ordUnits;
            stats.totalDispatchedUnits += dispUnits;
            stats.totalPendingUnits += remUnits;

            // Breakdown boxes and loose
            const upb = it.bottles_per_box || 10;
            const bCalc = PackagingHelper.breakdownQuantities(dispUnits, upb);
            stats.totalBoxesDispatched += bCalc.boxes;
            stats.totalLooseDispatched += bCalc.loose;

            // Track SKUs
            const skuKey = `${it.product_name || 'Item'} (${it.packing_size || it.packaging_size || 'Std'})`;
            if (!stats.purchasedSkus[skuKey]) {
              stats.purchasedSkus[skuKey] = {
                productName: it.product_name,
                packagingSize: it.packing_size || it.packaging_size,
                orderedUnits: 0,
                dispatchedUnits: 0,
                pendingUnits: 0,
                revenue: 0
              };
            }
            stats.purchasedSkus[skuKey].orderedUnits += ordUnits;
            stats.purchasedSkus[skuKey].dispatchedUnits += dispUnits;
            stats.purchasedSkus[skuKey].pendingUnits += remUnits;
            stats.purchasedSkus[skuKey].revenue += parseFloat(it.total) || 0;
          }
        });

        // Check dispatches & reversals for this order
        const orderDispatches = dispatchesByOrderId.get(String(o.id)) || [];
        const orderReversals = [...(reversalsByOrderId.get(String(o.id)) || [])];
        orderDispatches.forEach(d => {
          const revList = reversalsByDispatchId.get(String(d.id)) || [];
          orderReversals.push(...revList);
        });
        const seenRevIds = new Set();
        orderReversals.forEach(r => {
          if (r.id && seenRevIds.has(r.id)) return;
          if (r.id) seenRevIds.add(r.id);
          const revItems = Array.isArray(r.items_reversed) ? r.items_reversed : [];
          revItems.forEach(ri => {
            const rUnits = parseInt(ri.total_units || ri.units || ri.quantity, 10) || 0;
            stats.totalReturnedUnits += rUnits;
            stats.totalReturnedAmount += (parseFloat(ri.unit_price) || 0) * rUnits;
          });
        });
      });

      // Calculate net balances and net revenues
      const rows = Array.from(customerStats.values()).map(s => {
        s.netRevenue = Math.max(0, s.totalBilledAmount - s.totalReturnedAmount);
        s.outstandingBalance = Math.max(0, s.netRevenue - s.totalPaidAmount);
        // Interoperable aliases for developer ergonomics
        s.orderedUnits = s.totalOrderedUnits;
        s.dispatchedUnits = s.totalDispatchedUnits;
        s.boxesDispatched = s.totalBoxesDispatched;
        s.looseDispatched = s.totalLooseDispatched;
        s.pendingUnits = s.totalPendingUnits;
        s.returnedUnits = s.totalReturnedUnits;
        s.returnedAmount = s.totalReturnedAmount;
        s.ordersCount = s.totalOrdersCount;
        s.totalBilled = s.totalBilledAmount;
        s.totalPaid = s.totalPaidAmount;
        s.outstandingReceivable = s.outstandingBalance;
        return s;
      });

      // Filter out zero-activity clients if filtered by dates
      const activeRows = (dateFrom || dateTo || clientId || companyId)
        ? rows.filter(r => r.totalOrdersCount > 0 || r.totalDispatchedUnits > 0 || r.outstandingBalance > 0)
        : rows;

      // Compute consolidated summary totals
      const totals = {
        totalCustomers: activeRows.length,
        totalOrders: activeRows.reduce((sum, r) => sum + r.totalOrdersCount, 0),
        totalBilled: activeRows.reduce((sum, r) => sum + r.totalBilledAmount, 0),
        totalPaid: activeRows.reduce((sum, r) => sum + r.totalPaidAmount, 0),
        totalOutstanding: activeRows.reduce((sum, r) => sum + r.outstandingBalance, 0),
        totalOrderedUnits: activeRows.reduce((sum, r) => sum + r.totalOrderedUnits, 0),
        totalDispatchedUnits: activeRows.reduce((sum, r) => sum + r.totalDispatchedUnits, 0),
        totalBoxesDispatched: activeRows.reduce((sum, r) => sum + r.totalBoxesDispatched, 0),
        totalLooseDispatched: activeRows.reduce((sum, r) => sum + r.totalLooseDispatched, 0),
        totalPendingUnits: activeRows.reduce((sum, r) => sum + r.totalPendingUnits, 0),
        totalCancelledUnits: activeRows.reduce((sum, r) => sum + r.totalCancelledUnits, 0),
        totalReturnedUnits: activeRows.reduce((sum, r) => sum + r.totalReturnedUnits, 0),
        netRevenue: activeRows.reduce((sum, r) => sum + r.netRevenue, 0)
      };

      return { rows: activeRows, totals, filters };
    },

    /**
     * Generate Product and SKU-Wise Sales & Packaging Report
     * Answers:
     * - Which SKUs and packaging sizes were purchased?
     * - How many boxes and loose units were supplied per SKU?
     * - How much volume / chemical was dispatched?
     * - What is the pending quantity per SKU?
     */
    generateProductSalesReport({
      orders = [],
      orderItems = [],
      products = [],
      packaging = [],
      reversals = [],
      filters = {}
    }) {
      const {
        productId = null,
        packagingSize = null,
        companyId = null,
        dateFrom = null,
        dateTo = null
      } = filters;

      const orderMap = new Map();
      const orderMetaMap = new Map();
      orders.forEach(o => {
        orderMap.set(String(o.id), o);
        if (o.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(o.notes)) {
          try {
            const jsonStr = o.notes.replace(/^[sS]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
            orderMetaMap.set(String(o.id), JSON.parse(jsonStr));
          } catch (_) {}
        }
      });

      const skuMap = new Map();

      const effectiveItems = (orderItems && orderItems.length > 0)
        ? orderItems
        : orders.flatMap(o => (o.items || []).map(it => ({ ...it, order_id: it.order_id || o.id })));

      effectiveItems.forEach(it => {
        const order = orderMap.get(String(it.order_id));
        if (!order) return;

        // Multi-company filter
        if (companyId && String(order.company_id || 1) !== String(companyId)) return false;

        // Cancelled orders excluded from sales
        if (String(order.status || '').toLowerCase() === 'cancelled') return;

        // Date range filter
        if (dateFrom || dateTo) {
          if (!DateRangeHelper.isWithinRange(order.date, dateFrom, dateTo)) return;
        }

        // Product filter
        if (productId && String(it.product_id) !== String(productId)) return;

        const packSize = it.packing_size || it.packaging_size || 'Standard';
        if (packagingSize && !String(packSize).toLowerCase().includes(String(packagingSize).toLowerCase())) {
          return;
        }

        const pName = it.product_name || 'Standard Product';
        const key = `${it.product_id || pName}__${packSize}`;

        if (!skuMap.has(key)) {
          const upb = it.bottles_per_box || 10;
          skuMap.set(key, {
            productId: it.product_id,
            productName: pName,
            packagingSize: packSize,
            unitsPerBox: upb,
            ordersCount: 0,
            orderedUnits: 0,
            dispatchedUnits: 0,
            pendingUnits: 0,
            boxesDispatched: 0,
            looseDispatched: 0,
            totalVolumeLitres: 0,
            grossRevenue: 0,
            returnedUnits: 0,
            returnedAmount: 0,
            netRevenue: 0
          });
        }

        const sku = skuMap.get(key);
        let ordUnits = parseInt(it.ordered_units || it.total_units || it.quantity, 10) || 0;
        let dispUnits = it.dispatched_units !== undefined ? parseInt(it.dispatched_units, 10) : NaN;
        let remUnits = it.remaining_units !== undefined ? parseInt(it.remaining_units, 10) : NaN;

        if (isNaN(dispUnits) || isNaN(remUnits)) {
          const ordMeta = orderMetaMap.get(String(order.id));
          if (ordMeta && Array.isArray(ordMeta.items_meta)) {
            const m = ordMeta.items_meta.find(im => 
              String(im.id || im.order_item_id) === String(it.id) ||
              (im.product_name === it.product_name && (im.packing_size === (it.packing_size || it.packaging_size)))
            );
            if (m) {
              if (isNaN(dispUnits) && m.dispatched_units !== undefined) dispUnits = parseInt(m.dispatched_units, 10);
              if (isNaN(remUnits) && m.remaining_units !== undefined) remUnits = parseInt(m.remaining_units, 10);
              if (m.bottles_per_box && !sku.unitsPerBox) sku.unitsPerBox = m.bottles_per_box;
            }
          }
        }

        if (isNaN(dispUnits)) dispUnits = 0;
        if (isNaN(remUnits)) remUnits = Math.max(0, ordUnits - dispUnits);

        sku.ordersCount++;
        sku.orderedUnits += ordUnits;
        sku.dispatchedUnits += dispUnits;
        sku.pendingUnits += remUnits;
        sku.grossRevenue += parseFloat(it.total) || 0;

        const bCalc = PackagingHelper.breakdownQuantities(dispUnits, sku.unitsPerBox, packSize);
        sku.boxesDispatched += bCalc.boxes;
        sku.looseDispatched += bCalc.loose;
        sku.totalVolumeLitres += bCalc.volumeLitres;
      });

      // Factor in customer returns
      reversals.forEach(r => {
        const revItems = Array.isArray(r.items_reversed) ? r.items_reversed : [];
        revItems.forEach(ri => {
          const packSize = ri.packaging_size || 'Standard';
          const pName = ri.product_name || '';
          const key = `${ri.product_id || pName}__${packSize}`;
          if (skuMap.has(key)) {
            const sku = skuMap.get(key);
            const rUnits = parseInt(ri.total_units || ri.units || ri.quantity, 10) || 0;
            sku.returnedUnits += rUnits;
            sku.returnedAmount += (parseFloat(ri.unit_price) || 0) * rUnits;
          }
        });
      });

      const rows = Array.from(skuMap.values()).map(s => {
        s.netRevenue = Math.max(0, s.grossRevenue - s.returnedAmount);
        return s;
      });

      // Sort by net revenue descending
      rows.sort((a, b) => b.netRevenue - a.netRevenue);

      const totals = {
        totalSkus: rows.length,
        totalOrderedUnits: rows.reduce((s, r) => s + r.orderedUnits, 0),
        totalDispatchedUnits: rows.reduce((s, r) => s + r.dispatchedUnits, 0),
        totalBoxesDispatched: rows.reduce((s, r) => s + r.boxesDispatched, 0),
        totalLooseDispatched: rows.reduce((s, r) => s + r.looseDispatched, 0),
        totalPendingUnits: rows.reduce((s, r) => s + r.pendingUnits, 0),
        totalVolumeLitres: parseFloat(rows.reduce((s, r) => s + r.totalVolumeLitres, 0).toFixed(2)),
        grossRevenue: rows.reduce((s, r) => s + r.grossRevenue, 0),
        returnedAmount: rows.reduce((s, r) => s + r.returnedAmount, 0),
        netRevenue: rows.reduce((s, r) => s + r.netRevenue, 0)
      };

      return { rows, totals, filters };
    },

    /**
     * Generate Monthly and Quarterly Trend Report
     */
    generateMonthlyTrendReport({
      orders = [],
      dispatches = [],
      reversals = [],
      filters = {}
    }) {
      const { companyId = null, dateFrom = null, dateTo = null } = filters;
      const monthMap = new Map();

      orders.forEach(o => {
        if (companyId && String(o.company_id || 1) !== String(companyId)) return;
        if (String(o.status || '').toLowerCase() === 'cancelled') return;
        if (dateFrom || dateTo) {
          if (!DateRangeHelper.isWithinRange(o.date, dateFrom, dateTo)) return;
        }

        const dateStr = String(o.date || '');
        const monthKey = dateStr.slice(0, 7); // YYYY-MM
        if (!monthKey || monthKey.length < 7) return;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthKey,
            orderCount: 0,
            revenue: 0,
            paidAmount: 0,
            dispatchedUnits: 0,
            boxesDispatched: 0,
            returnsAmount: 0,
            netRevenue: 0
          });
        }

        const m = monthMap.get(monthKey);
        m.orderCount++;
        m.revenue += parseFloat(o.total_amount) || 0;
        m.paidAmount += parseFloat(o.paid_amount) || 0;
      });

      dispatches.forEach(d => {
        if (companyId && String(d.company_id || 1) !== String(companyId)) return;
        if (String(d.status || '').toLowerCase() === 'cancelled') return;
        const dateStr = String(d.dispatch_date || '');
        const monthKey = dateStr.slice(0, 7);
        if (!monthKey || monthKey.length < 7) return;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthKey,
            orderCount: 0,
            revenue: 0,
            paidAmount: 0,
            dispatchedUnits: 0,
            boxesDispatched: 0,
            returnsAmount: 0,
            netRevenue: 0
          });
        }
        const m = monthMap.get(monthKey);
        m.dispatchedUnits += parseInt(d.total_units_dispatched, 10) || 0;
        m.boxesDispatched += parseInt(d.total_boxes_dispatched, 10) || 0;
      });

      const sortedMonths = Array.from(monthMap.keys()).sort();
      const rows = sortedMonths.map(mo => {
        const row = monthMap.get(mo);
        row.netRevenue = Math.max(0, row.revenue - row.returnsAmount);
        return row;
      });

      const totals = {
        totalMonths: rows.length,
        totalOrders: rows.reduce((s, r) => s + r.orderCount, 0),
        grossRevenue: rows.reduce((s, r) => s + r.revenue, 0),
        paidAmount: rows.reduce((s, r) => s + r.paidAmount, 0),
        dispatchedUnits: rows.reduce((s, r) => s + r.dispatchedUnits, 0),
        boxesDispatched: rows.reduce((s, r) => s + r.boxesDispatched, 0),
        netRevenue: rows.reduce((s, r) => s + r.netRevenue, 0)
      };

      return { rows, totals, filters };
    },

    /**
     * Generate Multi-Company Summary Report
     */
    generateCompanySummaryReport({
      orders = [],
      dispatches = [],
      companies = [],
      filters = {}
    }) {
      const companyMap = new Map();
      companies.forEach(c => {
        companyMap.set(String(c.id), {
          companyId: c.id,
          companyName: c.name,
          companyCode: c.code || 'CO',
          isManufacturer: c.is_manufacturer || false,
          ordersCount: 0,
          grossRevenue: 0,
          paidAmount: 0,
          outstandingReceivables: 0,
          dispatchedUnits: 0,
          dispatchedBoxes: 0
        });
      });

      orders.forEach(o => {
        if (String(o.status || '').toLowerCase() === 'cancelled') return;
        const cId = String(o.company_id || 1);
        if (!companyMap.has(cId)) {
          companyMap.set(cId, {
            companyId: parseInt(cId, 10),
            companyName: `Company #${cId}`,
            companyCode: `CO-${cId}`,
            isManufacturer: false,
            ordersCount: 0,
            grossRevenue: 0,
            paidAmount: 0,
            outstandingReceivables: 0,
            dispatchedUnits: 0,
            dispatchedBoxes: 0
          });
        }
        const c = companyMap.get(cId);
        c.ordersCount++;
        c.grossRevenue += parseFloat(o.total_amount) || 0;
        c.paidAmount += parseFloat(o.paid_amount) || 0;
        c.outstandingReceivables += Math.max(0, (parseFloat(o.total_amount) || 0) - (parseFloat(o.paid_amount) || 0));
      });

      dispatches.forEach(d => {
        if (String(d.status || '').toLowerCase() === 'cancelled') return;
        const cId = String(d.company_id || 1);
        if (companyMap.has(cId)) {
          const c = companyMap.get(cId);
          c.dispatchedUnits += parseInt(d.total_units_dispatched, 10) || 0;
          c.dispatchedBoxes += parseInt(d.total_boxes_dispatched, 10) || 0;
        }
      });

      const rows = Array.from(companyMap.values());
      const totals = {
        totalCompanies: rows.length,
        totalOrders: rows.reduce((s, r) => s + r.ordersCount, 0),
        grossRevenue: rows.reduce((s, r) => s + r.grossRevenue, 0),
        paidAmount: rows.reduce((s, r) => s + r.paidAmount, 0),
        outstandingReceivables: rows.reduce((s, r) => s + r.outstandingReceivables, 0),
        dispatchedUnits: rows.reduce((s, r) => s + r.dispatchedUnits, 0),
        dispatchedBoxes: rows.reduce((s, r) => s + r.dispatchedBoxes, 0)
      };

      return { rows, totals, filters };
    }
  };

  // ============================================================================
  // 4. EXPORT DATA FORMATTER (EXCEL & CSV WITH EXACT MATCHING TOTALS)
  // ============================================================================
  const ExportFormatter = {
    /**
     * Escape and quote CSV cell
     */
    escapeCsv(val) {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    },

    /**
     * Format Customer Sales Report into Export Array with Summary Total Row
     * Supports both formatCustomerSalesForExport(reportResult) and formatCustomerSalesForExport(rows, totals)
     */
    formatCustomerSalesForExport(reportResult, optionalTotals = null) {
      let rows = [];
      let totals = {};
      if (Array.isArray(reportResult)) {
        rows = reportResult;
        totals = optionalTotals || {};
      } else if (reportResult && typeof reportResult === 'object') {
        rows = reportResult.rows || [];
        totals = reportResult.totals || {};
      }

      const data = rows.map((r, i) => ({
        '#': i + 1,
        'Customer Name': r.clientName || r.name || '—',
        'Client Type': r.clientType || '—',
        'City': r.city || '—',
        'Orders Count': r.totalOrdersCount || r.ordersCount || 0,
        'Ordered Units': r.totalOrderedUnits || r.orderedUnits || 0,
        'Dispatched Units': r.totalDispatchedUnits || r.dispatchedUnits || 0,
        'Boxes Dispatched': r.totalBoxesDispatched || r.boxesDispatched || 0,
        'Loose Dispatched': r.totalLooseDispatched || r.looseDispatched || 0,
        'Pending Units': r.totalPendingUnits || r.pendingUnits || 0,
        'Cancelled / Returned': (r.totalCancelledUnits || 0) + (r.totalReturnedUnits || r.returnedUnits || 0),
        'Total Billed (₹)': parseFloat(r.totalBilledAmount || r.totalBilled || 0),
        'Total Paid (₹)': parseFloat(r.totalPaidAmount || r.totalPaid || 0),
        'Outstanding Balance (₹)': parseFloat(r.outstandingBalance || r.outstandingReceivable || 0),
        'Net Revenue (₹)': parseFloat(r.netRevenue || 0),
        'Credit Limit (₹)': parseFloat(r.creditLimit || 0)
      }));

      // Append Total / Summary row
      data.push({
        '#': 'TOTAL',
        'Customer Name': 'TOTALS',
        'Client Type': '—',
        'City': '—',
        'Orders Count': totals.totalOrders || 0,
        'Ordered Units': totals.totalOrderedUnits || 0,
        'Dispatched Units': totals.totalDispatchedUnits || 0,
        'Boxes Dispatched': totals.totalBoxesDispatched || 0,
        'Loose Dispatched': totals.totalLooseDispatched || 0,
        'Pending Units': totals.totalPendingUnits || 0,
        'Cancelled / Returned': (totals.totalCancelledUnits || 0) + (totals.totalReturnedUnits || 0),
        'Total Billed (₹)': parseFloat(totals.totalBilled || totals.totalBilledAmount || 0),
        'Total Paid (₹)': parseFloat(totals.totalPaid || totals.totalPaidAmount || 0),
        'Outstanding Balance (₹)': parseFloat(totals.totalOutstanding || totals.totalReceivable || 0),
        'Net Revenue (₹)': parseFloat(totals.netRevenue || 0),
        'Credit Limit (₹)': '—'
      });

      return data;
    },

    /**
     * Format Customer-Wise Product Details into Export Array with Summary Total Row
     * Detailed worksheet containing every product item associated with sales orders.
     */
    formatCustomerProductDetailsForExport({
      orders = [],
      orderItems = [],
      dispatches = [],
      dispatchItems = [],
      clients = [],
      reversals = [],
      filters = {}
    } = {}) {
      const {
        clientId = null,
        companyId = null,
        productId = null,
        packagingSize = null,
        status = null,
        dispatchStatus = null,
        dateFrom = null,
        dateTo = null
      } = filters || {};

      const clientMap = new Map();
      (clients || []).forEach(c => clientMap.set(String(c.id), c));

      const ordersMap = new Map();
      (orders || []).forEach(o => ordersMap.set(String(o.id), o));

      // Extract & merge dispatches from orders.notes (DISPATCH_META) if not provided
      const dispatchesByOrderId = new Map();
      (dispatches || []).forEach(d => {
        const oId = String(d.order_id);
        if (!dispatchesByOrderId.has(oId)) dispatchesByOrderId.set(oId, []);
        dispatchesByOrderId.get(oId).push(d);
      });

      const orderMetaMap = new Map();
      (orders || []).forEach(o => {
        if (o.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(o.notes)) {
          try {
            const jsonStr = o.notes.replace(/^[sS]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
            const meta = JSON.parse(jsonStr);
            orderMetaMap.set(String(o.id), meta);
            if (!o.dispatch_status && meta.dispatch_status) {
              o.dispatch_status = meta.dispatch_status;
            }
            if (Array.isArray(meta.dispatches)) {
              meta.dispatches.forEach(d => {
                const oId = String(d.order_id || o.id);
                if (!dispatchesByOrderId.has(oId)) dispatchesByOrderId.set(oId, []);
                if (!dispatchesByOrderId.get(oId).some(x => String(x.id) === String(d.id) || x.dispatch_no === d.dispatch_no)) {
                  dispatchesByOrderId.get(oId).push({ ...d, order_id: o.id, order_no: o.order_no, client_name: o.client_name });
                }
              });
            }
          } catch (_) {}
        }
      });

      // Reversals mapped by order and dispatch ID
      const reversalsByOrderId = new Map();
      (reversals || []).forEach(r => {
        if (r.order_id) {
          const oId = String(r.order_id);
          if (!reversalsByOrderId.has(oId)) reversalsByOrderId.set(oId, []);
          reversalsByOrderId.get(oId).push(r);
        }
      });

      // Filter eligible orders
      const eligibleOrders = (orders || []).filter(o => {
        if (companyId && String(o.company_id || 1) !== String(companyId)) return false;
        if (clientId && String(o.client_id) !== String(clientId)) return false;
        if (dateFrom || dateTo) {
          if (!DateRangeHelper.isWithinRange(o.date, dateFrom, dateTo)) return false;
        }
        if (status) {
          const st = String(o.status || '').toLowerCase();
          if (st !== String(status).toLowerCase()) return false;
        }
        if (dispatchStatus) {
          const ds = String(o.dispatch_status || 'Pending Verification').toLowerCase();
          if (ds !== String(dispatchStatus).toLowerCase()) return false;
        }
        return true;
      });

      const eligibleOrderIds = new Set(eligibleOrders.map(o => String(o.id)));

      // Effective order items
      const effectiveItems = (orderItems && orderItems.length > 0)
        ? orderItems
        : (orders || []).flatMap(o => (o.items || []).map(it => ({ ...it, order_id: it.order_id || o.id })));

      const rows = [];
      const totals = {
        boxesOrdered: 0,
        looseOrdered: 0,
        totalOrderedQuantity: 0,
        dispatchedBoxes: 0,
        dispatchedLooseUnits: 0,
        totalDispatchedQuantity: 0,
        pendingQuantity: 0,
        discount: 0,
        taxableAmount: 0,
        gstAmount: 0,
        lineTotal: 0,
        returnQuantity: 0,
        cancelledQuantity: 0
      };

      effectiveItems.forEach(oi => {
        const oId = String(oi.order_id);
        if (!eligibleOrderIds.has(oId)) return;
        const o = ordersMap.get(oId) || {};
        const c = clientMap.get(String(o.client_id)) || { name: o.client_name, type: 'Retailer', city: '—' };

        // SKU filter check
        if (productId && String(oi.product_id) !== String(productId)) return;
        if (packagingSize) {
          const pSize = String(oi.packing_size || oi.packaging_size || '').toLowerCase();
          if (!pSize.includes(String(packagingSize).toLowerCase())) return;
        }

        const isCancelled = String(o.status || '').toLowerCase() === 'cancelled';
        let orderedQty = parseInt(oi.ordered_units || oi.total_units || oi.quantity, 10) || 0;
        let dispQty = oi.dispatched_units !== undefined ? parseInt(oi.dispatched_units, 10) : NaN;
        let pendingQty = oi.remaining_units !== undefined ? parseInt(oi.remaining_units, 10) : NaN;
        let upb = oi.bottles_per_box;
        let boxesOrd = oi.box_quantity !== undefined ? parseInt(oi.box_quantity, 10) : NaN;
        let looseOrd = oi.loose_quantity !== undefined ? parseInt(oi.loose_quantity, 10) : NaN;

        const ordMeta = orderMetaMap.get(oId);
        const m = (ordMeta && Array.isArray(ordMeta.items_meta)) ? ordMeta.items_meta.find(im => 
          String(im.id || im.order_item_id) === String(oi.id) ||
          (im.product_name === oi.product_name && (im.packing_size === (oi.packing_size || oi.packaging_size)))
        ) : null;

        if (isNaN(dispQty) || dispQty === 0) {
          if (m && m.dispatched_units !== undefined) dispQty = parseInt(m.dispatched_units, 10);
        }
        if (isNaN(dispQty)) dispQty = 0;

        if (!upb || upb <= 0) {
          if (m && m.bottles_per_box) upb = parseInt(m.bottles_per_box, 10);
        }
        if (!upb || upb <= 0) upb = 10;

        if (isNaN(boxesOrd) || (boxesOrd === 0 && orderedQty >= upb)) {
          if (m && m.box_quantity !== undefined && m.box_quantity > 0) {
            boxesOrd = parseInt(m.box_quantity, 10);
          } else {
            boxesOrd = Math.floor(orderedQty / upb);
          }
        }

        if (isNaN(looseOrd) || (looseOrd === 0 && orderedQty % upb !== 0)) {
          if (m && m.loose_quantity !== undefined) {
            looseOrd = parseInt(m.loose_quantity, 10);
          } else {
            looseOrd = orderedQty % upb;
          }
        }

        if (isNaN(pendingQty)) {
          if (m && m.remaining_units !== undefined) {
            pendingQty = parseInt(m.remaining_units, 10);
          } else {
            pendingQty = Math.max(0, orderedQty - dispQty);
          }
        }

        // Dispatches matching this order & item
        const orderDispatches = dispatchesByOrderId.get(oId) || [];
        const matchingDispatches = orderDispatches.filter(d => {
          if (!Array.isArray(d.items)) return true;
          return d.items.some(dit => 
            String(dit.order_item_id) === String(oi.id) || 
            (dit.product_name === oi.product_name && (dit.packaging_size === (oi.packing_size || oi.packaging_size)))
          );
        });

        // Compute dispatched boxes and loose
        let boxesDisp = 0;
        let looseDisp = 0;
        if (matchingDispatches.length > 0) {
          matchingDispatches.forEach(d => {
            if (Array.isArray(d.items)) {
              d.items.forEach(dit => {
                if (String(dit.order_item_id) === String(oi.id) || (dit.product_name === oi.product_name && (dit.packaging_size === (oi.packing_size || oi.packaging_size)))) {
                  boxesDisp += parseInt(dit.boxes_dispatched || 0, 10);
                  looseDisp += parseInt(dit.loose_dispatched || 0, 10);
                }
              });
            }
          });
        }
        if (boxesDisp === 0 && looseDisp === 0 && dispQty > 0) {
          boxesDisp = Math.floor(dispQty / upb);
          looseDisp = dispQty % upb;
        }

        const dispatchRefs = [...new Set(matchingDispatches.map(d => d.dispatch_no).filter(Boolean))].join(', ') || (dispQty > 0 ? 'DSP-Fulfilled' : '—');
        const invoiceRefs = [...new Set(matchingDispatches.map(d => d.invoice_no).filter(Boolean))].join(', ') || (o.invoice_no || '—');

        // Financials
        const unitRate = parseFloat(oi.unit_price) || 0;
        const discount = parseFloat(oi.discount) || 0;
        const taxableAmount = parseFloat(Math.max(0, (unitRate * orderedQty) - discount).toFixed(2));
        
        let gstRate = 0;
        let gstAmount = 0;
        if (o.tax && parseFloat(o.tax) > 0) {
          const totAmt = parseFloat(o.total_amount) || 0;
          const preTax = totAmt - parseFloat(o.tax);
          if (preTax > 0) {
            gstRate = Math.round((parseFloat(o.tax) / preTax) * 100);
            gstAmount = parseFloat(((taxableAmount * gstRate) / 100).toFixed(2));
          }
        }
        const lineTotal = parseFloat((taxableAmount + gstAmount).toFixed(2));

        // Returns and reversals
        let returnQty = 0;
        const orderReversals = reversalsByOrderId.get(oId) || [];
        orderReversals.forEach(r => {
          const revItems = Array.isArray(r.items_reversed) ? r.items_reversed : [];
          revItems.forEach(ri => {
            if (String(ri.order_item_id) === String(oi.id) || ri.product_name === oi.product_name) {
              returnQty += parseInt(ri.total_units || ri.units || ri.quantity, 10) || 0;
            }
          });
        });

        const cancelledQty = isCancelled ? orderedQty : 0;

        // Line status
        let lineStatus = 'Pending';
        if (isCancelled) {
          lineStatus = 'Cancelled';
        } else if (returnQty >= orderedQty && orderedQty > 0) {
          lineStatus = 'Returned';
        } else if (dispQty >= orderedQty && orderedQty > 0) {
          lineStatus = 'Dispatched';
        } else if (dispQty > 0) {
          lineStatus = 'Partially Dispatched';
        }

        // Determine packaging type and UOM
        const packSize = oi.packing_size || oi.packaging_size || '—';
        let packagingType = 'Bottle';
        let uom = 'Nos';
        const pSizeLower = packSize.toLowerCase();
        if (pSizeLower.includes('litre') || pSizeLower.includes('ltr') || pSizeLower.includes('ml')) {
          packagingType = 'Bottle';
          uom = pSizeLower.includes('ml') ? 'ml' : 'Litre';
        } else if (pSizeLower.includes('kg') || pSizeLower.includes('gram') || pSizeLower.includes('gm') || pSizeLower.includes('bag')) {
          packagingType = 'Bag';
          uom = pSizeLower.includes('kg') ? 'Kg' : 'Gram';
        } else if (oi.box_name) {
          packagingType = 'Box';
          uom = 'Box';
        }

        const row = {
          'Customer Name': c.name || o.client_name || 'Guest Client',
          'Client Type': c.type || 'Retailer',
          'City': c.city || '—',
          'Order Number': o.order_no || ('O-' + o.id),
          'Order Date': o.date || '',
          'Invoice Number': invoiceRefs,
          'Dispatch Reference': dispatchRefs,
          'Product Name': oi.product_name || 'Standard Item',
          'Packaging Size': packSize,
          'Packaging Type': packagingType,
          'Boxes Ordered': boxesOrd,
          'Units Per Box': upb,
          'Loose Units Ordered': looseOrd,
          'Total Ordered Quantity': orderedQty,
          'Dispatched Boxes': boxesDisp,
          'Dispatched Loose Units': looseDisp,
          'Total Dispatched Quantity': dispQty,
          'Pending Quantity': pendingQty,
          'Unit of Measurement': uom,
          'Unit Rate (₹)': unitRate,
          'Discount (₹)': discount,
          'Taxable Amount (₹)': taxableAmount,
          'GST Rate (%)': gstRate,
          'GST Amount (₹)': gstAmount,
          'Line Total (₹)': lineTotal,
          'Return Quantity': returnQty,
          'Cancelled Quantity': cancelledQty,
          'Line Status': lineStatus
        };

        rows.push(row);

        // Accumulate totals
        totals.boxesOrdered += boxesOrd;
        totals.looseOrdered += looseOrd;
        totals.totalOrderedQuantity += orderedQty;
        totals.dispatchedBoxes += boxesDisp;
        totals.dispatchedLooseUnits += looseDisp;
        totals.totalDispatchedQuantity += dispQty;
        totals.pendingQuantity += pendingQty;
        totals.discount += discount;
        totals.taxableAmount += taxableAmount;
        totals.gstAmount += gstAmount;
        totals.lineTotal += lineTotal;
        totals.returnQuantity += returnQty;
        totals.cancelledQuantity += cancelledQty;
      });

      // Append Total Summary Row
      rows.push({
        'Customer Name': 'TOTALS',
        'Client Type': '—',
        'City': '—',
        'Order Number': `Total Items: ${rows.length}`,
        'Order Date': '—',
        'Invoice Number': '—',
        'Dispatch Reference': '—',
        'Product Name': '—',
        'Packaging Size': '—',
        'Packaging Type': '—',
        'Boxes Ordered': totals.boxesOrdered,
        'Units Per Box': '—',
        'Loose Units Ordered': totals.looseOrdered,
        'Total Ordered Quantity': totals.totalOrderedQuantity,
        'Dispatched Boxes': totals.dispatchedBoxes,
        'Dispatched Loose Units': totals.dispatchedLooseUnits,
        'Total Dispatched Quantity': totals.totalDispatchedQuantity,
        'Pending Quantity': totals.pendingQuantity,
        'Unit of Measurement': '—',
        'Unit Rate (₹)': '—',
        'Discount (₹)': parseFloat(totals.discount.toFixed(2)),
        'Taxable Amount (₹)': parseFloat(totals.taxableAmount.toFixed(2)),
        'GST Rate (%)': '—',
        'GST Amount (₹)': parseFloat(totals.gstAmount.toFixed(2)),
        'Line Total (₹)': parseFloat(totals.lineTotal.toFixed(2)),
        'Return Quantity': totals.returnQuantity,
        'Cancelled Quantity': totals.cancelledQuantity,
        'Line Status': '—'
      });

      return rows;
    },

    /**
     * Format Chronological Sales Transactions for Export
     * Provides an audit ledger of orders placed, dispatches fulfilled, and reversals.
     */
    formatSalesTransactionsForExport({
      orders = [],
      orderItems = [],
      dispatches = [],
      dispatchItems = [],
      clients = [],
      reversals = [],
      filters = {}
    } = {}) {
      const {
        clientId = null,
        companyId = null,
        productId = null,
        packagingSize = null,
        status = null,
        dispatchStatus = null,
        dateFrom = null,
        dateTo = null
      } = filters || {};

      const clientMap = new Map();
      (clients || []).forEach(c => clientMap.set(String(c.id), c));

      const ordersMap = new Map();
      (orders || []).forEach(o => ordersMap.set(String(o.id), o));

      const effectiveItems = (orderItems && orderItems.length > 0)
        ? orderItems
        : (orders || []).flatMap(o => (o.items || []).map(it => ({ ...it, order_id: it.order_id || o.id })));

      const itemsByOrderId = new Map();
      effectiveItems.forEach(it => {
        const oId = String(it.order_id);
        if (!itemsByOrderId.has(oId)) itemsByOrderId.set(oId, []);
        itemsByOrderId.get(oId).push(it);
      });

      const transactions = [];

      (orders || []).forEach(o => {
        if (companyId && String(o.company_id || 1) !== String(companyId)) return;
        if (clientId && String(o.client_id) !== String(clientId)) return;
        if (status && String(o.status || '').toLowerCase() !== String(status).toLowerCase()) return;
        if (dispatchStatus && String(o.dispatch_status || 'Pending Verification').toLowerCase() !== String(dispatchStatus).toLowerCase()) return;

        const c = clientMap.get(String(o.client_id)) || { name: o.client_name, type: 'Retailer' };
        const items = itemsByOrderId.get(String(o.id)) || [];

        const isPaid = (parseFloat(o.paid_amount) || 0) >= (parseFloat(o.total_amount) || 0) && (parseFloat(o.total_amount) || 0) > 0;
        const isPartPaid = (parseFloat(o.paid_amount) || 0) > 0 && !isPaid;
        const paymentStatus = isPaid ? 'Paid' : (isPartPaid ? 'Partially Paid' : 'Unpaid');

        // 1. Order Placed / Booked event
        if (!dateFrom && !dateTo || DateRangeHelper.isWithinRange(o.date, dateFrom, dateTo)) {
          items.forEach(it => {
            if (productId && String(it.product_id) !== String(productId)) return;
            if (packagingSize) {
              const pSize = String(it.packing_size || it.packaging_size || '').toLowerCase();
              if (!pSize.includes(String(packagingSize).toLowerCase())) return;
            }

            const ordUnits = parseInt(it.ordered_units || it.total_units || it.quantity, 10) || 0;
            const unitRate = parseFloat(it.unit_price) || 0;
            const lineAmt = parseFloat(it.total) || (unitRate * ordUnits);

            transactions.push({
              'Transaction Date': o.date || '',
              'Customer Name': c.name || o.client_name || 'Guest Client',
              'Order Number': o.order_no || `O-${o.id}`,
              'Invoice Number': o.invoice_no || '—',
              'Dispatch Reference': '—',
              'Product Name': it.product_name || 'Item',
              'Packaging Size': it.packing_size || it.packaging_size || '—',
              'Ordered Quantity': ordUnits,
              'Dispatched Quantity': 0,
              'Transaction Type': 'Order Booked',
              'Quantity Change': `+${ordUnits}`,
              'Unit Rate (₹)': unitRate,
              'Amount (₹)': lineAmt,
              'Payment Status': paymentStatus,
              'Dispatch Status': o.dispatch_status || 'Pending'
            });
          });
        }
      });

      // 2. Discover dispatches from orders.notes if not supplied
      const allDispatches = [...(dispatches || [])];
      (orders || []).forEach(o => {
        if (o.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(o.notes)) {
          try {
            const jsonStr = o.notes.replace(/^[sS]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
            const meta = JSON.parse(jsonStr);
            if (Array.isArray(meta.dispatches)) {
              meta.dispatches.forEach(d => {
                if (!allDispatches.some(x => String(x.id) === String(d.id) || x.dispatch_no === d.dispatch_no)) {
                  allDispatches.push({ ...d, order_id: o.id, order_no: o.order_no, client_name: o.client_name });
                }
              });
            }
          } catch (_) {}
        }
      });

      // 3. Dispatch events
      allDispatches.forEach(d => {
        const o = ordersMap.get(String(d.order_id)) || {};
        if (companyId && String(o.company_id || d.company_id || 1) !== String(companyId)) return;
        if (clientId && String(d.client_id || o.client_id) !== String(clientId)) return;
        if (dateFrom || dateTo) {
          if (!DateRangeHelper.isWithinRange(d.dispatch_date || o.date, dateFrom, dateTo)) return;
        }

        const c = clientMap.get(String(d.client_id || o.client_id)) || { name: d.client_name || o.client_name, type: 'Retailer' };
        const dItems = Array.isArray(d.items) ? d.items : [];

        dItems.forEach(dit => {
          if (productId && String(dit.product_id) !== String(productId)) return;
          if (packagingSize) {
            const pSize = String(dit.packaging_size || dit.packing_size || '').toLowerCase();
            if (!pSize.includes(String(packagingSize).toLowerCase())) return;
          }

          const dispUnits = parseInt(dit.total_units_dispatched || dit.quantity || dit.units, 10) || 0;
          const unitRate = parseFloat(dit.unit_price) || 0;
          const lineAmt = parseFloat(dit.total_amount) || (unitRate * dispUnits);

          transactions.push({
            'Transaction Date': d.dispatch_date || o.date || '',
            'Customer Name': c.name || d.client_name || o.client_name || 'Guest Client',
            'Order Number': d.order_no || o.order_no || `O-${d.order_id}`,
            'Invoice Number': d.invoice_no || o.invoice_no || '—',
            'Dispatch Reference': d.dispatch_no || '—',
            'Product Name': dit.product_name || 'Item',
            'Packaging Size': dit.packaging_size || dit.packing_size || '—',
            'Ordered Quantity': 0,
            'Dispatched Quantity': dispUnits,
            'Transaction Type': 'Dispatch Fulfillment',
            'Quantity Change': `-${dispUnits}`,
            'Unit Rate (₹)': unitRate,
            'Amount (₹)': lineAmt,
            'Payment Status': (parseFloat(o.paid_amount) || 0) >= (parseFloat(o.total_amount) || 0) && (parseFloat(o.total_amount) || 0) > 0 ? 'Paid' : 'Unpaid',
            'Dispatch Status': d.status || 'Dispatched'
          });
        });
      });

      // Sort transactions chronologically
      transactions.sort((a, b) => (a['Transaction Date'] || '').localeCompare(b['Transaction Date'] || ''));

      // Totals
      const totalOrdered = transactions.reduce((sum, t) => sum + (t['Ordered Quantity'] || 0), 0);
      const totalDispatched = transactions.reduce((sum, t) => sum + (t['Dispatched Quantity'] || 0), 0);
      const totalAmount = transactions.reduce((sum, t) => sum + (t['Amount (₹)'] || 0), 0);

      transactions.push({
        'Transaction Date': 'TOTALS',
        'Customer Name': '—',
        'Order Number': `Total Transactions: ${transactions.length}`,
        'Invoice Number': '—',
        'Dispatch Reference': '—',
        'Product Name': '—',
        'Packaging Size': '—',
        'Ordered Quantity': totalOrdered,
        'Dispatched Quantity': totalDispatched,
        'Transaction Type': '—',
        'Quantity Change': '—',
        'Unit Rate (₹)': '—',
        'Amount (₹)': parseFloat(totalAmount.toFixed(2)),
        'Payment Status': '—',
        'Dispatch Status': '—'
      });

      return transactions;
    },

    /**
     * Apply professional formatting to a SheetJS worksheet:
     * - Auto-calculate column widths
     * - Enable autofilters (excluding bottom total row)
     * - Freeze the top header row
     */
    applySheetFormatting(ws, data, XLSXLib = null) {
      if (!ws || !data || !data.length) return ws;
      const X = XLSXLib || (typeof window !== 'undefined' ? window.XLSX : null) || (typeof require === 'function' ? require('xlsx') : null);
      if (!X) return ws;

      const headers = Object.keys(data[0]);

      // 1. Column widths
      ws['!cols'] = headers.map(h => {
        let maxLen = h.length;
        data.forEach(row => {
          const val = row[h];
          const strLen = val !== null && val !== undefined ? String(val).length : 0;
          if (strLen > maxLen) maxLen = strLen;
        });
        return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
      });

      // 2. Freeze pane (freeze top header row)
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];

      // 3. Autofilter (exclude summary total row if present)
      try {
        const range = X.utils.decode_range(ws['!ref']);
        const lastRow = data[data.length - 1];
        const hasTotalRow = lastRow && (lastRow['#'] === 'TOTAL' || lastRow['Customer Name'] === 'TOTALS' || lastRow['Transaction Date'] === 'TOTALS' || lastRow['Product Name'] === 'TOTALS');
        const endRow = hasTotalRow && range.e.r > 1 ? range.e.r - 1 : range.e.r;
        ws['!autofilter'] = {
          ref: X.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: endRow, c: range.e.c }
          })
        };
      } catch (_) {}

      return ws;
    },

    /**
     * Format Product & SKU Sales Report into Export Array with Summary Total Row
     * Supports both formatProductSalesForExport(reportResult) and formatProductSalesForExport(rows, totals)
     */
    formatProductSalesForExport(reportResult, optionalTotals = null) {
      let rows = [];
      let totals = {};
      if (Array.isArray(reportResult)) {
        rows = reportResult;
        totals = optionalTotals || {};
      } else if (reportResult && typeof reportResult === 'object') {
        rows = reportResult.rows || [];
        totals = reportResult.totals || {};
      }

      const data = rows.map((r, i) => ({
        '#': i + 1,
        'Product Name': r.productName,
        'Packaging Size (SKU)': r.packagingSize,
        'Units Per Box': r.unitsPerBox,
        'Orders Count': r.ordersCount,
        'Ordered Units': r.orderedUnits,
        'Dispatched Units': r.dispatchedUnits,
        'Boxes Dispatched': r.boxesDispatched,
        'Loose Dispatched': r.looseDispatched,
        'Pending Units': r.pendingUnits,
        'Volume Dispatched (L/Kg)': parseFloat(parseFloat(r.totalVolumeLitres || 0).toFixed(2)),
        'Gross Revenue (₹)': parseFloat(r.grossRevenue || 0),
        'Returns (₹)': parseFloat(r.returnedAmount || 0),
        'Net Revenue (₹)': parseFloat(r.netRevenue || 0)
      }));

      // Append Summary Total Row
      data.push({
        '#': 'TOTAL',
        'Product Name': 'TOTALS',
        'Packaging Size (SKU)': '—',
        'Units Per Box': '—',
        'Orders Count': totals.totalSkus || rows.length,
        'Ordered Units': totals.totalOrderedUnits || 0,
        'Dispatched Units': totals.totalDispatchedUnits || 0,
        'Boxes Dispatched': totals.totalBoxesDispatched || 0,
        'Loose Dispatched': totals.totalLooseDispatched || 0,
        'Pending Units': totals.totalPendingUnits || 0,
        'Volume Dispatched (L/Kg)': parseFloat(parseFloat(totals.totalVolumeLitres || 0).toFixed(2)),
        'Gross Revenue (₹)': parseFloat(totals.grossRevenue || 0),
        'Returns (₹)': parseFloat(totals.returnedAmount || 0),
        'Net Revenue (₹)': parseFloat(totals.netRevenue || 0)
      });

      return data;
    },

    /**
     * Format Monthly Trends for Export
     */
    formatMonthlyTrendsForExport(reportResult) {
      const { rows = [], totals = {} } = reportResult;

      const data = rows.map((r, i) => ({
        '#': i + 1,
        'Month (YYYY-MM)': r.month,
        'Orders Booked': r.orderCount,
        'Units Dispatched': r.dispatchedUnits,
        'Boxes Dispatched': r.boxesDispatched,
        'Billed Revenue (₹)': r.revenue.toFixed(2),
        'Collections / Paid (₹)': r.paidAmount.toFixed(2),
        'Net Revenue (₹)': r.netRevenue.toFixed(2)
      }));

      data.push({
        '#': 'TOTAL',
        'Month (YYYY-MM)': `Total Months: ${totals.totalMonths || rows.length}`,
        'Orders Booked': totals.totalOrders || 0,
        'Units Dispatched': totals.dispatchedUnits || 0,
        'Boxes Dispatched': totals.boxesDispatched || 0,
        'Billed Revenue (₹)': (totals.grossRevenue || 0).toFixed(2),
        'Collections / Paid (₹)': (totals.paidAmount || 0).toFixed(2),
        'Net Revenue (₹)': (totals.netRevenue || 0).toFixed(2)
      });

      return data;
    },

    /**
     * Convert an array of objects to UTF-8 CSV string with BOM
     */
    generateCsvString(exportData, title = 'Consolidated Report') {
      if (!Array.isArray(exportData) || exportData.length === 0) {
        return '\uFEFF"No data available"\r\n';
      }

      const headers = Object.keys(exportData[0]);
      let csv = '\uFEFF';
      csv += `${this.escapeCsv(title)}\r\n`;
      csv += `Generated: ${new Date().toISOString()}\r\n\r\n`;

      csv += headers.map(h => this.escapeCsv(h)).join(',') + '\r\n';

      exportData.forEach(row => {
        const line = headers.map(h => this.escapeCsv(row[h] !== undefined ? row[h] : '')).join(',');
        csv += line + '\r\n';
      });

      return csv;
    }
  };

  // ============================================================================
  // 5. PUBLIC SERVICE FACADE
  // ============================================================================
  const Service = {
    DateRangeHelper,
    PackagingHelper,
    SalesAnalyticsEngine,
    ExportFormatter,

    computeDateRange: (...args) => DateRangeHelper.computeDateRange(...args),
    breakdownQuantities: (...args) => PackagingHelper.breakdownQuantities(...args),
    getCustomerSalesReport: (...args) => SalesAnalyticsEngine.generateCustomerSalesReport(...args),
    getProductSalesReport: (...args) => SalesAnalyticsEngine.generateProductSalesReport(...args),
    getMonthlyTrendReport: (...args) => SalesAnalyticsEngine.generateMonthlyTrendReport(...args),
    getCompanySummaryReport: (...args) => SalesAnalyticsEngine.generateCompanySummaryReport(...args),
    formatCustomerSalesForExport: (...args) => ExportFormatter.formatCustomerSalesForExport(...args),
    formatCustomerProductDetailsForExport: (...args) => ExportFormatter.formatCustomerProductDetailsForExport(...args),
    formatSalesTransactionsForExport: (...args) => ExportFormatter.formatSalesTransactionsForExport(...args),
    formatProductSalesForExport: (...args) => ExportFormatter.formatProductSalesForExport(...args),
    applySheetFormatting: (...args) => ExportFormatter.applySheetFormatting(...args),
    generateCsvString: (...args) => ExportFormatter.generateCsvString(...args)
  };

  return {
    DateRangeHelper,
    PackagingHelper,
    SalesAnalyticsEngine,
    ExportFormatter,
    Service
  };
});
