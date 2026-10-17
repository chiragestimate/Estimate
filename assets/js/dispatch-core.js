/**
 * assets/js/dispatch-core.js
 * Authoritative Commercial Godown Verification & Multi-Batch Dispatch Workflow Engine
 *
 * Implements:
 * 1. Packing completion verification & godown physical check.
 * 2. Multi-batch dispatch item allocation (selecting specific verified/approved batches).
 * 3. Prevention of dispatching quarantined or unapproved stock.
 * 4. Dispatch approval workflows (Pending Verification -> Verified -> Approved -> Dispatched).
 * 5. Partial dispatches against one order with real-time remaining balance recalculation.
 * 6. Single-posting physical stock deduction: stock is deducted EXACTLY ONCE at dispatch execution.
 * 7. Zero double-deduction during Invoice generation.
 * 8. Safe cancellations, customer returns, and inventory reversals.
 * 9. Idempotency guard and duplicate submission blocking.
 * 10. Complete audit history and traceability.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const inventoryCore = require('./inventory-core.js');
    module.exports = factory(inventoryCore);
  } else {
    root.DISPATCH_CORE = factory(root.INVENTORY_CORE);
    root.DISPATCH_SERVICE = root.DISPATCH_CORE.Service;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (inventoryCore) {
  'use strict';

  // ============================================================================
  // RESILIENT STORAGE ADAPTER (SUPABASE + LOCAL REPOSITORY FALLBACK)
  // ============================================================================
  const _memoryStore = {
    order_dispatches: [],
    dispatch_items: [],
    dispatch_reversals: [],
    invoices: []
  };

  function isTableMissingError(err) {
    if (!err || !err.message) return false;
    const msg = String(err.message).toLowerCase();
    return msg.includes('could not find the table') || 
           msg.includes('schema cache') || 
           (msg.includes('relation') && msg.includes('does not exist'));
  }

  function getLocalTable(tableName) {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('erp_' + tableName);
        return raw ? JSON.parse(raw) : [];
      } catch (_) {
        return _memoryStore[tableName] || [];
      }
    }
    return _memoryStore[tableName] || [];
  }

  function saveLocalTable(tableName, items) {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('erp_' + tableName, JSON.stringify(items));
      } catch (_) {}
    }
    _memoryStore[tableName] = items;
  }

  // ============================================================================
  // 1. DISPATCH CALCULATOR & QUANTITY BREAKDOWN
  // ============================================================================
  const DispatchCalculator = {
    /**
     * Compute box and loose breakdown for any quantity.
     * E.g. 205 bottles at 10 units/box = 20 boxes and 5 loose.
     */
    breakdownBoxesAndLoose(totalUnits, unitsPerBox = 10) {
      const units = Math.max(0, parseInt(totalUnits, 10) || 0);
      const upb = Math.max(1, parseInt(unitsPerBox, 10) || 10);
      const boxes = Math.floor(units / upb);
      const loose = units % upb;
      return { totalUnits: units, unitsPerBox: upb, boxes, loose };
    },

    /**
     * Calculate remaining units, boxes, and loose bottles after dispatch.
     */
    calculateRemainingQuantities(orderedUnits, dispatchedSoFar, newDispatchQty, unitsPerBox = 10) {
      const ord = Math.max(0, parseInt(orderedUnits, 10) || 0);
      const prev = Math.max(0, parseInt(dispatchedSoFar, 10) || 0);
      const curr = Math.max(0, parseInt(newDispatchQty, 10) || 0);
      const upb = Math.max(1, parseInt(unitsPerBox, 10) || 10);

      const remainingBefore = Math.max(0, ord - prev);

      if (curr > remainingBefore) {
        throw new Error(`DISPATCH_EXCEEDS_ORDERED_QUANTITY: Cannot dispatch ${curr} units. Only ${remainingBefore} units remain on order.`);
      }

      const totalDispatched = prev + curr;
      const remainingUnits = ord - totalDispatched;

      const orderedBreakdown = this.breakdownBoxesAndLoose(ord, upb);
      const dispatchedBreakdown = this.breakdownBoxesAndLoose(totalDispatched, upb);
      const currentDispatchBreakdown = this.breakdownBoxesAndLoose(curr, upb);
      const remainingBreakdown = this.breakdownBoxesAndLoose(remainingUnits, upb);

      return {
        orderedUnits: ord,
        previouslyDispatched: prev,
        newDispatchUnits: curr,
        totalDispatchedUnits: totalDispatched,
        remainingUnits: remainingUnits,
        isFullyDispatched: remainingUnits === 0,
        isPartiallyDispatched: remainingUnits > 0 && totalDispatched > 0,
        unitsPerBox: upb,
        currentDispatch: currentDispatchBreakdown,
        remainingBreakdown: remainingBreakdown
      };
    }
  };

  // ============================================================================
  // 2. STOCK AVAILABILITY & QUARANTINE GUARD
  // ============================================================================
  const StockGuard = {
    /**
     * Validate that selected stock batch exists, is APPROVED, NOT in quarantine,
     * and has sufficient quantity for dispatch.
     */
    async validateBatchForDispatch(client, { batchId, batchNo, requestedUnits }) {
      if (!batchId && !batchNo) {
        throw new Error('INVALID_BATCH_SELECTION: A specific manufacturing/packing batch must be selected.');
      }

      let q = client.from('stock_batches').select('*');
      if (batchId) q = q.eq('id', batchId);
      else if (batchNo) q = q.eq('batch_no', batchNo);

      const { data: bData } = await (q.maybeSingle ? q.maybeSingle() : q);
      const batch = Array.isArray(bData) ? bData[0] : bData;

      if (!batch) {
        throw new Error(`BATCH_NOT_FOUND: Stock batch "${batchNo || batchId}" was not found in warehouse inventory.`);
      }

      // CRITICAL QUARANTINE REQUIREMENT:
      // Block unapproved or quarantined stock from being dispatched!
      if (batch.is_quarantine === true || (batch.qc_status && batch.qc_status !== 'Approved')) {
        throw new Error(`UNAPPROVED_STOCK_CANNOT_BE_DISPATCHED: Batch "${batch.batch_no}" is in Quarantine (QC Status: ${batch.qc_status || 'Pending'}). Only QC-Approved batches can be dispatched.`);
      }

      const available = parseFloat(batch.current_qty) || 0;
      const req = parseFloat(requestedUnits) || 0;

      if (available < req) {
        throw new Error(`INSUFFICIENT_STOCK_FOR_DISPATCH: Batch "${batch.batch_no}" only has ${available} units available, but dispatch requires ${req} units.`);
      }

      return {
        valid: true,
        batch,
        availableUnits: available,
        requestedUnits: req
      };
    }
  };

  // ============================================================================
  // 3. DISPATCH WORKFLOW TRANSACTION SERVICE
  // ============================================================================
  const Service = {
    /**
     * Helper to insert into a table with fallback if schema cache lacks table
     */
    async _safeInsert(client, tableName, records) {
      try {
        const query = client.from(tableName).insert(records);
        const { data, error } = query && query.select ? await query.select() : await query;
        if (error) {
          if (isTableMissingError(error)) {
            const table = getLocalTable(tableName);
            const inserted = records.map(r => {
              const item = { id: Date.now() + Math.floor(Math.random() * 1000), created_at: new Date().toISOString(), ...r };
              table.unshift(item);
              return item;
            });
            saveLocalTable(tableName, table);
            return inserted;
          }
          throw error;
        }
        return data;
      } catch (err) {
        if (isTableMissingError(err)) {
          const table = getLocalTable(tableName);
          const inserted = records.map(r => {
            const item = { id: Date.now() + Math.floor(Math.random() * 1000), created_at: new Date().toISOString(), ...r };
            table.unshift(item);
            return item;
          });
          saveLocalTable(tableName, table);
          return inserted;
        }
        throw err;
      }
    },

    /**
     * Helper to update a table with fallback
     */
    async _safeUpdate(client, tableName, updates, filterKey, filterVal) {
      try {
        const { data, error } = await client.from(tableName).update(updates).eq(filterKey, filterVal);
        if (error && isTableMissingError(error)) {
          const table = getLocalTable(tableName);
          table.forEach(r => {
            if (r[filterKey] === filterVal) Object.assign(r, updates);
          });
          saveLocalTable(tableName, table);
          return { data: 1, error: null };
        }
        return { data, error };
      } catch (err) {
        if (isTableMissingError(err)) {
          const table = getLocalTable(tableName);
          table.forEach(r => {
            if (r[filterKey] === filterVal) Object.assign(r, updates);
          });
          saveLocalTable(tableName, table);
          return { data: 1, error: null };
        }
        throw err;
      }
    },

    /**
     * Helper to select a single record with fallback
     */
    async _safeSelectOne(client, tableName, filterKey, filterVal) {
      try {
        const q = client.from(tableName).select('*').eq(filterKey, filterVal);
        const { data, error } = await (q.maybeSingle ? q.maybeSingle() : q);
        if (error && isTableMissingError(error)) {
          const table = getLocalTable(tableName);
          const found = table.find(r => r[filterKey] === filterVal);
          return found || null;
        }
        const record = Array.isArray(data) ? data[0] : data;
        return record || null;
      } catch (err) {
        if (isTableMissingError(err)) {
          const table = getLocalTable(tableName);
          const found = table.find(r => r[filterKey] === filterVal);
          return found || null;
        }
        throw err;
      }
    },

    /**
     * Helper to select multiple records with fallback
     */
    async _safeSelectMany(client, tableName, filterKey, filterVal) {
      try {
        let q = client.from(tableName).select('*');
        if (filterKey && filterVal !== undefined) {
          q = q.eq(filterKey, filterVal);
        }
        const { data, error } = await (q.then ? q : q.select('*'));
        if (error && isTableMissingError(error)) {
          const table = getLocalTable(tableName);
          if (filterKey && filterVal !== undefined) {
            return table.filter(r => r[filterKey] === filterVal);
          }
          return table;
        }
        return Array.isArray(data) ? data : [];
      } catch (err) {
        if (isTableMissingError(err)) {
          const table = getLocalTable(tableName);
          if (filterKey && filterVal !== undefined) {
            return table.filter(r => r[filterKey] === filterVal);
          }
          return table;
        }
        throw err;
      }
    },

    /**
     * Helper to synchronize dispatch state into orders.notes under DISPATCH_META
     * Ensures 100% persistence in Supabase PostgreSQL across all devices/sessions
     */
    async _syncDispatchToOrderNotes(client, orderId, dispatch, items = []) {
      if (!client || !client.from || !orderId) return;
      try {
        const q = client.from('orders').select('notes, order_no, client_name').eq('id', orderId);
        const { data: ordRow } = await (q.maybeSingle ? q.maybeSingle() : q);
        const order = Array.isArray(ordRow) ? ordRow[0] : ordRow;
        if (!order) return;

        let cleanNotes = order.notes ? order.notes.replace(/(?:^|\n\n?)(?:DISPATCH_META|Dispatch_meta):[\s\S]*$/i, '').trim() : '';
        let meta = {};
        if (order.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(order.notes)) {
          try {
            const jsonStr = order.notes.replace(/^[\s\S]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
            meta = JSON.parse(jsonStr);
          } catch (_) {}
        }
        if (!Array.isArray(meta.dispatches)) meta.dispatches = [];

        const dispatchEntry = {
          ...dispatch,
          order_no: order.order_no,
          client_name: order.client_name,
          items: items && items.length ? items : (dispatch.items || [])
        };

        const existingIdx = meta.dispatches.findIndex(d => String(d.id) === String(dispatch.id) || d.dispatch_no === dispatch.dispatch_no);
        if (existingIdx >= 0) {
          meta.dispatches[existingIdx] = { ...meta.dispatches[existingIdx], ...dispatchEntry };
        } else {
          meta.dispatches.unshift(dispatchEntry);
        }

        if (dispatch.status) {
          meta.dispatch_status = dispatch.status;
        }

        const finalNotes = cleanNotes
          ? `${cleanNotes}\n\nDISPATCH_META: ${JSON.stringify(meta)}`
          : `DISPATCH_META: ${JSON.stringify(meta)}`;

        await client.from('orders').update({ notes: finalNotes }).eq('id', orderId);
      } catch (err) {
        console.warn('Failed to sync dispatch to order notes:', err);
      }
    },

    /**
     * Step 1: Prepare a Commercial Dispatch Slip (Order Dispatches).
     * Supports Partial Dispatches with multi-batch line allocation.
     */
    async prepareDispatch(client, dispatchData) {
      const orderId = dispatchData.order_id;
      const dispatchNo = dispatchData.dispatch_no || `DSP-${Date.now().toString().slice(-6)}`;
      const items = dispatchData.items || [];

      if (!orderId) throw new Error('MISSING_ORDER_ID: order_id is required.');
      if (!items || items.length === 0) throw new Error('NO_DISPATCH_ITEMS: At least one item must be included.');

      // Check idempotency
      if (dispatchData.idempotency_key) {
        const existing = await this._safeSelectOne(client, 'order_dispatches', 'idempotency_key', dispatchData.idempotency_key);
        if (existing) {
          return { success: true, dispatch: existing, duplicate: true };
        }
      }

      // Fetch sales order
      let order = null;
      try {
        const { data: oData } = await client.from('orders').select('*').eq('id', orderId).maybeSingle();
        order = Array.isArray(oData) ? oData[0] : oData;
      } catch (_) {}
      if (!order) {
        // Check in localStorage if available
        const localOrders = getLocalTable('orders');
        order = localOrders.find(o => o.id === orderId);
      }
      if (!order) throw new Error(`ORDER_NOT_FOUND: Sales order #${orderId} does not exist.`);

      // Fetch order items to validate remaining balances
      let orderItems = [];
      try {
        const { data: oiData } = await client.from('order_items').select('*').eq('order_id', orderId);
        orderItems = oiData || [];
      } catch (_) {}
      if (!orderItems.length) {
        const localItems = getLocalTable('order_items');
        orderItems = localItems.filter(it => it.order_id === orderId);
      }

      let totalBoxes = 0;
      let totalLoose = 0;
      let totalUnits = 0;
      const validatedItems = [];

      for (const item of items) {
        const orderItem = (orderItems || []).find(oi => oi.id === item.order_item_id);
        if (!orderItem) throw new Error(`ORDER_ITEM_NOT_FOUND: Line item #${item.order_item_id} not in order.`);

        const requestedUnits = parseInt(item.total_units_dispatched || item.quantity, 10) || 0;
        const upb = parseInt(item.units_per_box || orderItem.bottles_per_box || 10, 10) || 10;

        // Calculate and validate remaining quantities
        const dispatchedSoFar = parseInt(orderItem.dispatched_units || 0, 10);
        const orderedUnits = parseInt(orderItem.ordered_units || orderItem.total_units || orderItem.quantity, 10);
        DispatchCalculator.calculateRemainingQuantities(orderedUnits, dispatchedSoFar, requestedUnits, upb);

        // Validate physical stock batch (Must NOT be quarantined!)
        await StockGuard.validateBatchForDispatch(client, {
          batchId: item.stock_batch_id,
          batchNo: item.batch_no,
          requestedUnits
        });

        const breakdown = DispatchCalculator.breakdownBoxesAndLoose(requestedUnits, upb);
        totalBoxes += breakdown.boxes;
        totalLoose += breakdown.loose;
        totalUnits += requestedUnits;

        validatedItems.push({
          order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          product_name: orderItem.product_name,
          packaging_size: orderItem.packing_size || item.packaging_size || '1 Litre',
          units_per_box: upb,
          stock_batch_id: item.stock_batch_id || null,
          batch_no: item.batch_no,
          boxes_dispatched: breakdown.boxes,
          loose_dispatched: breakdown.loose,
          total_units_dispatched: requestedUnits,
          unit_price: parseFloat(orderItem.unit_price) || 0,
          total_amount: requestedUnits * (parseFloat(orderItem.unit_price) || 0)
        });
      }

      // Insert Dispatch Slip
      const dispatchPayload = {
        dispatch_no: dispatchNo,
        order_id: orderId,
        order_no: order.order_no || `O-${orderId}`,
        company_id: order.company_id || 1,
        warehouse_id: dispatchData.warehouse_id || order.warehouse_id || 1,
        client_id: order.client_id,
        client_name: order.client_name || order.client_display || 'Customer',
        dispatch_date: dispatchData.dispatch_date || new Date().toISOString().split('T')[0],
        status: 'Pending Verification',
        total_boxes_dispatched: totalBoxes,
        total_loose_dispatched: totalLoose,
        total_units_dispatched: totalUnits,
        stock_deducted: false, // Critical flag: not deducted yet!
        vehicle_no: dispatchData.vehicle_no || null,
        transporter_name: dispatchData.transporter_name || null,
        driver_contact: dispatchData.driver_contact || null,
        eway_bill_no: dispatchData.eway_bill_no || null,
        notes: dispatchData.notes || null,
        idempotency_key: dispatchData.idempotency_key || null
      };

      const createdDispatches = await this._safeInsert(client, 'order_dispatches', [dispatchPayload]);
      const dispatch = Array.isArray(createdDispatches) ? createdDispatches[0] : createdDispatches;

      // Insert Dispatch Line Items
      for (const vi of validatedItems) {
        await this._safeInsert(client, 'dispatch_items', [{
          dispatch_id: dispatch.id,
          ...vi
        }]);
      }

      // Update Order Dispatch Status to Pending Verification
      try {
        await client.from('orders').update({
          dispatch_status: 'Pending Verification'
        }).eq('id', orderId);
      } catch (_) {}

      // Synchronize dispatch into order notes DISPATCH_META
      await this._syncDispatchToOrderNotes(client, orderId, dispatch, validatedItems);

      return {
        success: true,
        dispatch,
        items: validatedItems,
        totalBoxes,
        totalLoose,
        totalUnits
      };
    },

    /**
     * Step 2: Packing Completion Verification.
     * Godown Operator / Packaging Supervisor verifies physical batches, packaging, and seals.
     */
    async verifyPacking(client, { dispatchId, verifiedBy, verificationNotes }) {
      const dispatch = await this._safeSelectOne(client, 'order_dispatches', 'id', dispatchId);
      if (!dispatch) throw new Error(`DISPATCH_NOT_FOUND: Dispatch #${dispatchId} does not exist.`);

      if (dispatch.status !== 'Pending Verification') {
        throw new Error(`INVALID_STATE: Cannot verify dispatch in "${dispatch.status}" state.`);
      }

      await this._safeUpdate(client, 'order_dispatches', {
        status: 'Verified',
        verified_by: verifiedBy || 'Godown Operator',
        verified_at: new Date().toISOString(),
        verification_notes: verificationNotes || 'Physical packages, batch seals, and quantities verified.'
      }, 'id', dispatchId);

      await this._syncDispatchToOrderNotes(client, dispatch.order_id, {
        ...dispatch,
        status: 'Verified',
        verified_by: verifiedBy || 'Godown Operator',
        verified_at: new Date().toISOString()
      });

      return {
        success: true,
        dispatchId,
        status: 'Verified',
        verifiedBy: verifiedBy || 'Godown Operator'
      };
    },

    /**
     * Step 3: Dispatch Approval.
     * Authorized Manager (Director / Sales Executive) approves the verified dispatch note.
     */
    async approveDispatch(client, { dispatchId, approvedBy, approvalNotes }) {
      const dispatch = await this._safeSelectOne(client, 'order_dispatches', 'id', dispatchId);
      if (!dispatch) throw new Error(`DISPATCH_NOT_FOUND: Dispatch #${dispatchId} does not exist.`);

      if (dispatch.status !== 'Verified') {
        throw new Error(`DISPATCH_NOT_VERIFIED: Dispatch must be verified by godown operator before manager approval.`);
      }

      await this._safeUpdate(client, 'order_dispatches', {
        status: 'Approved',
        approved_by: approvedBy || 'Dispatch Manager',
        approved_at: new Date().toISOString(),
        approval_notes: approvalNotes || 'Approved for commercial gate exit.'
      }, 'id', dispatchId);

      await this._syncDispatchToOrderNotes(client, dispatch.order_id, {
        ...dispatch,
        status: 'Approved',
        approved_by: approvedBy || 'Dispatch Manager',
        approved_at: new Date().toISOString()
      });

      return {
        success: true,
        dispatchId,
        status: 'Approved',
        approvedBy: approvedBy || 'Dispatch Manager'
      };
    },

    /**
     * Step 4: Physical Dispatch Posting.
     * DEDUCTS STOCK EXACTLY ONCE at gate exit.
     * Enforces single-posting; blocks duplicate deductions.
     * Recalculates remaining order quantities and determines partial vs full dispatch.
     */
    async executeDispatch(client, { dispatchId, dispatchedBy, vehicleNo, transporterName, ewayBillNo }) {
      const dispatch = await this._safeSelectOne(client, 'order_dispatches', 'id', dispatchId);
      if (!dispatch) throw new Error(`DISPATCH_NOT_FOUND: Dispatch #${dispatchId} does not exist.`);

      // ANTI DOUBLE-DEDUCTION GUARD:
      if (dispatch.stock_deducted === true || dispatch.status === 'Dispatched') {
        throw new Error('ALREADY_DEDUCTED_DUPLICATE_PREVENTED: Physical stock for this dispatch has already been deducted.');
      }

      if (dispatch.status !== 'Approved') {
        throw new Error(`DISPATCH_UNAPPROVED: Cannot execute dispatch in "${dispatch.status}" status. Manager approval required.`);
      }

      // Fetch dispatch items
      const items = await this._safeSelectMany(client, 'dispatch_items', 'dispatch_id', dispatchId);
      if (!items || items.length === 0) {
        throw new Error('NO_DISPATCH_ITEMS: Dispatch slip has no line items.');
      }

      const orderId = dispatch.order_id;

      // 1. Deduct Stock from selected batches in stock_batches
      for (const item of items) {
        const unitsToDeduct = item.total_units_dispatched;

        if (item.stock_batch_id) {
          const qBatch = client.from('stock_batches').select('*').eq('id', item.stock_batch_id);
          const { data: bData } = await (qBatch && qBatch.maybeSingle ? qBatch.maybeSingle() : qBatch);
          const batch = Array.isArray(bData) ? bData[0] : bData;
          if (!batch) throw new Error(`BATCH_NOT_FOUND: Batch ID ${item.stock_batch_id} not found.`);

          const curQty = parseFloat(batch.current_qty) || 0;
          if (curQty < unitsToDeduct) {
            throw new Error(`INSUFFICIENT_STOCK: Batch ${batch.batch_no} only has ${curQty} units, required ${unitsToDeduct}.`);
          }

          const newQty = curQty - unitsToDeduct;
          const upb = item.units_per_box || batch.units_per_box || 10;
          const newBoxes = Math.floor(newQty / upb);
          const newLoose = newQty % upb;

          await client.from('stock_batches').update({
            current_qty: newQty,
            boxes_count: newBoxes,
            loose_count: newLoose
          }).eq('id', item.stock_batch_id);

          // Log movement into stock_movements
          try {
            await client.from('stock_movements').insert([{
              company_id: dispatch.company_id || 1,
              batch_id: item.stock_batch_id,
              movement_type: 'DISPATCH',
              quantity: -unitsToDeduct,
              reference_type: 'DISPATCH_SLIP',
              reference_id: String(dispatch.id),
              notes: `Dispatched ${item.boxes_dispatched} Boxes + ${item.loose_dispatched} Loose (${unitsToDeduct} units) via ${dispatch.dispatch_no}`
            }]);
          } catch (_) {}
        }

        // 2. Update order_items: increment dispatched, decrement remaining
        const qOi = client.from('order_items').select('*').eq('id', item.order_item_id);
        const { data: oiData } = await (qOi && qOi.maybeSingle ? qOi.maybeSingle() : qOi);
        const orderItem = Array.isArray(oiData) ? oiData[0] : oiData;
        if (orderItem) {
          const ordUnits = parseInt(orderItem.ordered_units || orderItem.total_units || orderItem.quantity, 10);
          const prevDisp = parseInt(orderItem.dispatched_units || 0, 10);
          const newDisp = prevDisp + unitsToDeduct;
          const newRem = Math.max(0, ordUnits - newDisp);

          const upb = item.units_per_box || 10;
          const newDispBoxes = Math.floor(newDisp / upb);
          const newDispLoose = newDisp % upb;
          const newRemBoxes = Math.floor(newRem / upb);
          const newRemLoose = newRem % upb;

          await client.from('order_items').update({
            dispatched_units: newDisp,
            remaining_units: newRem,
            dispatched_boxes: newDispBoxes,
            dispatched_loose: newDispLoose,
            remaining_boxes: newRemBoxes,
            remaining_loose: newRemLoose
          }).eq('id', item.order_item_id);
        }
      }

      // 3. Recalculate Sales Order Status (Partial vs Full Dispatch)
      const { data: allOrderItems } = await client.from('order_items').select('*').eq('order_id', orderId);
      const totalRemaining = (allOrderItems || []).reduce((sum, oi) => sum + (parseInt(oi.remaining_units, 10) || 0), 0);
      const totalDispatched = (allOrderItems || []).reduce((sum, oi) => sum + (parseInt(oi.dispatched_units, 10) || 0), 0);

      const isFullyDispatched = totalRemaining === 0;
      const orderDispatchStatus = isFullyDispatched ? 'Fully Dispatched' : 'Partially Dispatched';
      const orderStatus = isFullyDispatched ? 'Completed' : 'Partially Dispatched';

      await client.from('orders').update({
        dispatch_status: orderDispatchStatus,
        status: orderStatus,
        total_dispatched_units: totalDispatched,
        total_remaining_units: totalRemaining
      }).eq('id', orderId);

      // 4. Mark Dispatch as executed and stock deducted
      await this._safeUpdate(client, 'order_dispatches', {
        status: 'Dispatched',
        stock_deducted: true, // POSTED EXACTLY ONCE
        dispatched_by: dispatchedBy || 'Godown Gatekeeper',
        dispatched_at: new Date().toISOString(),
        vehicle_no: vehicleNo || dispatch.vehicle_no,
        transporter_name: transporterName || dispatch.transporter_name,
        eway_bill_no: ewayBillNo || dispatch.eway_bill_no
      }, 'id', dispatchId);

      await this._syncDispatchToOrderNotes(client, dispatch.order_id, {
        ...dispatch,
        status: 'Dispatched',
        stock_deducted: true,
        dispatched_by: dispatchedBy || 'Godown Gatekeeper',
        dispatched_at: new Date().toISOString(),
        vehicle_no: vehicleNo || dispatch.vehicle_no,
        transporter_name: transporterName || dispatch.transporter_name,
        eway_bill_no: ewayBillNo || dispatch.eway_bill_no
      });

      return {
        success: true,
        dispatchId,
        dispatchNo: dispatch.dispatch_no,
        orderDispatchStatus,
        orderStatus,
        totalDispatchedUnits: totalDispatched,
        totalRemainingUnits: totalRemaining,
        stockDeducted: true
      };
    },

    /**
     * Step 5: Commercial Invoice Generation.
     * ZERO DOUBLE-DEDUCTION:
     * Generates commercial invoice linked to the executed dispatch.
     * Leaves physical stock untouched because dispatch already deducted it.
     */
    async generateInvoiceForDispatch(client, { dispatchId, invoiceNo, createdBy }) {
      const dispatch = await this._safeSelectOne(client, 'order_dispatches', 'id', dispatchId);
      if (!dispatch) throw new Error(`DISPATCH_NOT_FOUND: Dispatch #${dispatchId} does not exist.`);

      if (dispatch.status !== 'Dispatched') {
        throw new Error('DISPATCH_NOT_EXECUTED: Invoices can only be created for completed dispatches.');
      }

      if (dispatch.invoice_id) {
        throw new Error(`INVOICE_ALREADY_GENERATED: Invoice #${dispatch.invoice_no} already exists for this dispatch.`);
      }

      const items = await this._safeSelectMany(client, 'dispatch_items', 'dispatch_id', dispatchId);
      const subtotal = (items || []).reduce((sum, it) => sum + (parseFloat(it.total_amount) || 0), 0);
      const taxAmount = subtotal * 0.12; // Standard 12% GST
      const grandTotal = subtotal + taxAmount;

      const invNo = invoiceNo || `INV-${Date.now().toString().slice(-6)}`;

      // Insert invoice with is_stock_deducted: false (Strict Zero Double-Deduction Guarantee)
      const invoicePayload = {
        invoice_no: invNo,
        order_id: dispatch.order_id,
        dispatch_id: dispatchId,
        client_id: dispatch.client_id,
        client_name: dispatch.client_name,
        invoice_date: new Date().toISOString().split('T')[0],
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        paid_amount: 0,
        payment_status: 'Pending',
        is_stock_deducted: false, // ZERO DOUBLE-DEDUCTION GUARANTEE
        created_by: createdBy || 'Accountant',
        company_id: dispatch.company_id || 1
      };

      const createdInvs = await this._safeInsert(client, 'invoices', [invoicePayload]);
      const inv = Array.isArray(createdInvs) ? createdInvs[0] : createdInvs;

      // Link invoice ID back to dispatch slip
      await this._safeUpdate(client, 'order_dispatches', {
        invoice_id: inv.id,
        invoice_no: invNo
      }, 'id', dispatchId);

      return {
        success: true,
        invoice: inv,
        isStockDeducted: false
      };
    },

    /**
     * Step 6: Safe Cancellation, Customer Returns & Inventory Reversal.
     * Restores physically deducted stock back into historical batches.
     * Restores order item remaining balances.
     */
    async cancelOrReverseDispatch(client, { dispatchId, reversalType = 'CANCELLATION', reason, reversedBy }) {
      const dispatch = await this._safeSelectOne(client, 'order_dispatches', 'id', dispatchId);
      if (!dispatch) throw new Error(`DISPATCH_NOT_FOUND: Dispatch #${dispatchId} does not exist.`);

      if (dispatch.status === 'Cancelled') {
        throw new Error('DISPATCH_ALREADY_CANCELLED: This dispatch has already been cancelled.');
      }

      const items = await this._safeSelectMany(client, 'dispatch_items', 'dispatch_id', dispatchId);
      const itemsReversed = [];

      // 1. If stock was deducted, restore exact quantities back to origin batches
      if (dispatch.stock_deducted === true) {
        for (const item of (items || [])) {
          if (item.stock_batch_id) {
            const qBatch = client.from('stock_batches').select('*').eq('id', item.stock_batch_id);
            const { data: bData } = await (qBatch && qBatch.maybeSingle ? qBatch.maybeSingle() : qBatch);
            const batch = Array.isArray(bData) ? bData[0] : bData;
            if (batch) {
              const curQty = parseFloat(batch.current_qty) || 0;
              const restoredQty = curQty + item.total_units_dispatched;
              const upb = item.units_per_box || batch.units_per_box || 10;
              const newBoxes = Math.floor(restoredQty / upb);
              const newLoose = restoredQty % upb;

              await client.from('stock_batches').update({
                current_qty: restoredQty,
                boxes_count: newBoxes,
                loose_count: newLoose
              }).eq('id', item.stock_batch_id);

              // Log compensating movement
              try {
                await client.from('stock_movements').insert([{
                  company_id: dispatch.company_id || 1,
                  batch_id: item.stock_batch_id,
                  movement_type: 'DISPATCH_REVERSAL',
                  quantity: item.total_units_dispatched,
                  reference_type: 'DISPATCH_REVERSAL',
                  reference_id: String(dispatch.id),
                  notes: `Reversal of dispatch ${dispatch.dispatch_no} (${reversalType}): ${reason || 'Return'}`
                }]);
              } catch (_) {}
            }
          }

          // Restore order_items dispatched and remaining counts
          const qOi = client.from('order_items').select('*').eq('id', item.order_item_id);
          const { data: oiData } = await (qOi && qOi.maybeSingle ? qOi.maybeSingle() : qOi);
          const orderItem = Array.isArray(oiData) ? oiData[0] : oiData;
          if (orderItem) {
            const ordUnits = parseInt(orderItem.ordered_units || orderItem.total_units || orderItem.quantity, 10);
            const prevDisp = parseInt(orderItem.dispatched_units || 0, 10);
            const newDisp = Math.max(0, prevDisp - item.total_units_dispatched);
            const newRem = ordUnits - newDisp;

            const upb = item.units_per_box || 10;
            const newDispBoxes = Math.floor(newDisp / upb);
            const newDispLoose = newDisp % upb;
            const newRemBoxes = Math.floor(newRem / upb);
            const newRemLoose = newRem % upb;

            await client.from('order_items').update({
              dispatched_units: newDisp,
              remaining_units: newRem,
              dispatched_boxes: newDispBoxes,
              dispatched_loose: newDispLoose,
              remaining_boxes: newRemBoxes,
              remaining_loose: newRemLoose
            }).eq('id', item.order_item_id);
          }

          itemsReversed.push({
            product_id: item.product_id,
            product_name: item.product_name,
            batch_no: item.batch_no,
            restored_units: item.total_units_dispatched
          });
        }
      }

      // 2. Recalculate order status
      const { data: allOrderItems } = await client.from('order_items').select('*').eq('order_id', dispatch.order_id);
      const totalDispatched = (allOrderItems || []).reduce((sum, oi) => sum + (parseInt(oi.dispatched_units, 10) || 0), 0);
      const totalRemaining = (allOrderItems || []).reduce((sum, oi) => sum + (parseInt(oi.remaining_units, 10) || 0), 0);

      const orderDispatchStatus = totalDispatched === 0 ? 'Pending Verification' : 'Partially Dispatched';
      const orderStatus = totalDispatched === 0 ? 'Pending' : 'Partially Dispatched';

      await client.from('orders').update({
        dispatch_status: orderDispatchStatus,
        status: orderStatus,
        total_dispatched_units: totalDispatched,
        total_remaining_units: totalRemaining
      }).eq('id', dispatch.order_id);

      // 3. Insert Reversal Audit Record
      const reversalNo = `REV-${Date.now().toString().slice(-6)}`;
      await this._safeInsert(client, 'dispatch_reversals', [{
        dispatch_id: dispatchId,
        reversal_no: reversalNo,
        reversal_type: reversalType,
        reason: reason || 'Customer cancellation or dispatch return',
        reversed_by: reversedBy || 'Godown Supervisor',
        items_reversed: itemsReversed,
        stock_restored: dispatch.stock_deducted === true
      }]);

      // 4. Mark Dispatch as Cancelled
      await this._safeUpdate(client, 'order_dispatches', {
        status: 'Cancelled',
        stock_deducted: false
      }, 'id', dispatchId);

      await this._syncDispatchToOrderNotes(client, dispatch.order_id, {
        ...dispatch,
        status: 'Cancelled',
        stock_deducted: false
      });

      return {
        success: true,
        dispatchId,
        reversalNo,
        orderDispatchStatus,
        orderStatus,
        stockRestored: dispatch.stock_deducted === true,
        itemsReversed
      };
    },

    /**
     * Query API: Get all Dispatches with optional filters
     * Reads from DB, orders.notes (DISPATCH_META), and local storage
     */
    async getDispatches(client, { orderId, status } = {}) {
      let list = [];
      try {
        const all = await this._safeSelectMany(client, 'order_dispatches', orderId ? 'order_id' : undefined, orderId);
        list = all ? [...all] : [];
      } catch (_) {
        list = [];
      }

      // 1. Merge with dispatches stored in orders.notes DISPATCH_META
      try {
        if (client && client.from) {
          let q = client.from('orders').select('id, order_no, client_name, notes');
          if (orderId) q = q.eq('id', orderId);
          const { data: ords } = await (q.then ? q : q.select('*'));
          (ords || []).forEach(o => {
            if (o.notes && /(?:DISPATCH_META|Dispatch_meta):/i.test(o.notes)) {
              try {
                const jsonStr = o.notes.replace(/^[\s\S]*?(?:DISPATCH_META|Dispatch_meta):/i, '').trim();
                const meta = JSON.parse(jsonStr);
                if (Array.isArray(meta.dispatches)) {
                  meta.dispatches.forEach(d => {
                    if (!d.order_no) d.order_no = o.order_no;
                    if (!d.client_name) d.client_name = o.client_name;
                    if (!list.some(existing => String(existing.id) === String(d.id) || existing.dispatch_no === d.dispatch_no)) {
                      list.push(d);
                    }
                  });
                }
              } catch (_) {}
            }
          });
        }
      } catch (_) {}

      // 2. Merge with local storage table
      const localTable = getLocalTable('order_dispatches');
      (localTable || []).forEach(d => {
        if (orderId && String(d.order_id) !== String(orderId)) return;
        if (!list.some(existing => String(existing.id) === String(d.id) || existing.dispatch_no === d.dispatch_no)) {
          list.push(d);
        }
      });

      if (status) {
        list = list.filter(d => (d.status || '').toLowerCase() === status.toLowerCase());
      }
      return list.sort((a, b) => (b.id || 0) - (a.id || 0));
    },

    /**
     * Query API: Get Dispatch details and its line items
     */
    async getDispatchDetails(client, dispatchId) {
      const dispatch = await this._safeSelectOne(client, 'order_dispatches', 'id', dispatchId);
      if (!dispatch) return null;
      const items = await this._safeSelectMany(client, 'dispatch_items', 'dispatch_id', dispatchId);
      return { dispatch, items };
    },

    /**
     * Query API: Get available QC-Approved saleable batches for dispatch
     */
    async getAvailableApprovedBatches(client, { productId } = {}) {
      try {
        let q = client.from('stock_batches').select('*').gt('current_qty', 0);
        const { data: batches } = await (q.then ? q : q.select('*'));
        let batchList = (batches || []).filter(b => {
          const isQuar = b.is_quarantine === true;
          const qc = b.qc_status || 'Approved';
          return !isQuar && qc === 'Approved';
        });

        // Enrich with item_name from inventory_items
        try {
          const { data: invItems } = await client.from('inventory_items').select('id, name, category, unit');
          if (invItems && invItems.length) {
            const invMap = new Map();
            invItems.forEach(i => invMap.set(i.id, i));
            batchList.forEach(b => {
              const inv = invMap.get(b.item_id);
              if (inv) {
                b.item_name = inv.name;
                b.category = inv.category;
                b.unit = inv.unit;
              }
            });
          }
        } catch (_) {}

        if (productId) {
          batchList = batchList.filter(b => b.product_id === productId || b.item_id === productId);
        }
        return batchList;
      } catch (_) {
        return [];
      }
    }
  };

  return {
    DispatchCalculator,
    StockGuard,
    Service
  };
});
