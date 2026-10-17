/**
 * assets/js/dispatch-ui.js
 * Commercial Godown Verification & Multi-Batch Dispatch UI Controller
 *
 * Implements:
 * 1. Dispatches table rendering with live workflow status badges.
 * 2. Prepare Commercial Dispatch Slip modal & batch allocation selector.
 * 3. Godown packing completion verification modal (Operator signoff).
 * 4. Manager dispatch authorization modal (Approval).
 * 5. Gate exit execution modal (Single-posting physical stock deduction).
 * 6. Commercial tax invoice generation (Zero double-deduction).
 * 7. Safe dispatch reversal / customer return modal.
 * 8. Printable Commercial Dispatch Slip view modal.
 */

(function (window) {
  'use strict';

  let allDispatches = [];
  let activeDispatchFilter = '';
  let activeDispatchSearch = '';
  let currentActionDispatchId = null;

  const DISPATCH_UI = {
    /**
     * Load all dispatches from backend service
     */
    async loadDispatches() {
      try {
        UTILS.renderTableSkeleton('dispatches-table');
        const list = await window.DISPATCH_SERVICE.getDispatches(window.dbClient);
        allDispatches = list || [];
        this.renderDispatchesTable();
      } catch (err) {
        console.error('loadDispatches error:', err);
        APP.showToast('Failed to load dispatches: ' + err.message, 'error');
      }
    },

    /**
     * Render the Dispatches table with action buttons based on status
     */
    renderDispatchesTable() {
      const tbody = document.querySelector('#dispatches-table tbody');
      if (!tbody) return;

      let data = allDispatches;
      if (activeDispatchFilter) {
        data = data.filter(d => (d.status || '').toLowerCase() === activeDispatchFilter.toLowerCase());
      }
      if (activeDispatchSearch) {
        const q = activeDispatchSearch.toLowerCase();
        data = data.filter(d => 
          `${d.dispatch_no} ${d.order_no} ${d.client_name} ${d.vehicle_no || ''} ${d.transporter_name || ''} ${d.eway_bill_no || ''}`.toLowerCase().includes(q)
        );
      }

      const totalInfo = document.getElementById('dispatch-total-info');
      if (totalInfo) totalInfo.textContent = `${data.length} dispatch${data.length !== 1 ? 'es' : ''}`;

      if (!data.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="10"><div class="empty-state"><h3>No dispatches found</h3><p>Click "+ Prepare Dispatch" to create your first dispatch slip.</p></div></td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(d => {
        const st = d.status || 'Pending Verification';
        let badgeClass = 'badge-warning';
        if (st === 'Verified') badgeClass = 'badge-info';
        else if (st === 'Approved') badgeClass = 'badge-primary';
        else if (st === 'Dispatched') badgeClass = 'badge-success';
        else if (st === 'Cancelled') badgeClass = 'badge-danger';

        const statusBadge = `<span class="badge ${badgeClass}">${st}</span>`;

        const boxesLoose = `<span style="font-weight:600;">${d.total_boxes_dispatched || 0} Boxes</span> <span style="color:var(--text-muted); font-size:11.5px;">+ ${d.total_loose_dispatched || 0} Loose</span>`;
        const vehicleInfo = d.vehicle_no 
          ? `<span style="font-weight:600; font-size:12px;">${d.vehicle_no}</span>${d.transporter_name ? `<br><span style="font-size:11px; color:var(--text-muted);">${d.transporter_name}</span>` : ''}`
          : '<span style="color:var(--text-muted); font-size:11px;">Not Assigned</span>';

        // Invoice column
        let invoiceHtml = '<span style="color:var(--text-muted); font-size:11px;">—</span>';
        if (d.invoice_no) {
          invoiceHtml = `<span class="badge badge-success" style="font-size:11px; font-weight:700;">${d.invoice_no}</span>`;
        } else if (st === 'Dispatched') {
          invoiceHtml = `<button class="btn btn-sm btn-secondary" onclick="openGenerateInvoice(${d.id})" style="padding:2px 8px; font-size:11px; white-space:nowrap;">+ Generate</button>`;
        }

        // Contextual workflow action buttons
        let actionsHtml = `
          <button class="action-btn view" onclick="viewDispatch(${d.id})" title="View Dispatch Slip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        `;

        if (st === 'Pending Verification') {
          actionsHtml += `
            <button class="btn btn-sm btn-primary" onclick="openVerifyDispatch(${d.id})" title="Godown Packing Verification" style="padding:2px 8px; font-size:11px; white-space:nowrap;">Verify</button>
          `;
        } else if (st === 'Verified') {
          actionsHtml += `
            <button class="btn btn-sm btn-primary" onclick="openApproveDispatch(${d.id})" title="Manager Authorization" style="padding:2px 8px; font-size:11px; white-space:nowrap;">Approve</button>
          `;
        } else if (st === 'Approved') {
          actionsHtml += `
            <button class="btn btn-sm btn-success" onclick="openExecuteDispatch(${d.id})" title="Gate Exit & Deduct Stock" style="padding:2px 8px; font-size:11px; background:#16a34a; color:#fff; white-space:nowrap;">Gate Pass</button>
          `;
        } else if (st === 'Dispatched') {
          actionsHtml += `
            <button class="btn btn-sm btn-secondary" onclick="openReverseDispatch(${d.id})" title="Safe Return / Reversal" style="padding:2px 8px; font-size:11px; color:var(--danger, #ef4444); white-space:nowrap;">Return</button>
          `;
        }

        return `<tr>
          <td class="cell-bold" style="white-space:nowrap;">${d.dispatch_no}</td>
          <td style="font-weight:600; white-space:nowrap;"><a href="javascript:void(0)" onclick="viewOrder(${d.order_id})" style="color:var(--primary); text-decoration:none;">${d.order_no}</a></td>
          <td class="cell-client">${d.client_name || '—'}</td>
          <td style="white-space:nowrap; font-size:12px;">${UTILS.fmtDate(d.dispatch_date)}</td>
          <td style="white-space:nowrap;">${boxesLoose}</td>
          <td class="text-center" style="font-weight:700; white-space:nowrap;">${d.total_units_dispatched || 0}</td>
          <td>${vehicleInfo}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center">${invoiceHtml}</td>
          <td class="text-center"><div class="row-actions" style="gap:4px; justify-content:center;">${actionsHtml}</div></td>
        </tr>`;
      }).join('');

      UTILS.applyMobileTableLabels('dispatches-table');
    },

    /**
     * Open Modal: Prepare Commercial Dispatch Slip
     */
    async openPrepareDispatch(preselectedOrderId = null) {
      try {
        const orderSelect = document.getElementById('disp-order-select');
        const slipNoField = document.getElementById('disp-slip-no');
        const dateField = document.getElementById('disp-date');
        const itemsContainer = document.getElementById('disp-items-container');

        if (dateField) dateField.value = new Date().toISOString().split('T')[0];
        if (slipNoField) slipNoField.value = `DSP-${Date.now().toString().slice(-6)}`;

        // Populate eligible orders (orders with un-dispatched items that are not cancelled)
        orderSelect.innerHTML = '<option value="">Select sales order…</option>';
        const ordersList = window.allOrders || [];
        const eligibleOrders = ordersList.filter(o => {
          const st = (o.status || '').toLowerCase();
          const dispSt = (o.dispatch_status || '').toLowerCase();
          const items = o.items || [];
          const totalOrd = items.reduce((s, it) => s + (parseInt(it.ordered_units || it.quantity, 10) || 0), 0);
          const totalDisp = items.reduce((s, it) => s + (parseInt(it.dispatched_units, 10) || 0), 0);
          const hasRemaining = items.length === 0 || totalOrd === 0 || totalDisp < totalOrd;

          return st !== 'cancelled' && dispSt !== 'fully dispatched' && hasRemaining;
        });

        eligibleOrders.forEach(o => {
          const opt = document.createElement('option');
          opt.value = o.id;
          opt.textContent = `${o.order_no} — ${o.client_display || o.client_name} (${UTILS.fmtDate(o.date)})`;
          if (preselectedOrderId && String(o.id) === String(preselectedOrderId)) {
            opt.selected = true;
          }
          orderSelect.appendChild(opt);
        });

        if (preselectedOrderId) {
          await this.onDispatchOrderSelected(preselectedOrderId);
        } else {
          itemsContainer.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Please select a sales order above to view order items.</p>';
        }

        APP.openModal('prepare-dispatch-modal');
      } catch (err) {
        console.error('openPrepareDispatch error:', err);
        APP.showToast('Failed to open dispatch preparation: ' + err.message, 'error');
      }
    },

    /**
     * When an order is selected in Prepare Dispatch modal
     */
    async onDispatchOrderSelected(orderId) {
      const itemsContainer = document.getElementById('disp-items-container');
      if (!orderId) {
        itemsContainer.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Please select a sales order above to view order items.</p>';
        return;
      }

      itemsContainer.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';

      try {
        const { data: orderItems, error: oiErr } = await window.dbClient.from('order_items').select('*').eq('order_id', orderId);
        if (oiErr) throw oiErr;

        if (!orderItems || orderItems.length === 0) {
          itemsContainer.innerHTML = '<p style="color:var(--danger, #ef4444); font-size:13px;">No line items found for this sales order.</p>';
          return;
        }

        // Fetch QC-Approved batches from stock_batches
        const approvedBatches = await window.DISPATCH_SERVICE.getAvailableApprovedBatches(window.dbClient);

        let tableHtml = `
          <table class="line-items-table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg); border-bottom:1px solid var(--border);">
                <th>Product</th>
                <th>Pack Size</th>
                <th>Ordered</th>
                <th>Dispatched</th>
                <th>Remaining</th>
                <th style="width:140px;">Dispatch Qty (Units)</th>
                <th style="width:220px;">Physical Approved Batch <span class="required">*</span></th>
                <th>Breakdown (Boxes + Loose)</th>
              </tr>
            </thead>
            <tbody>
        `;

        orderItems.forEach(it => {
          const ord = parseInt(it.ordered_units || it.total_units || it.quantity, 10) || 0;
          const disp = parseInt(it.dispatched_units || 0, 10);
          const rem = it.remaining_units !== undefined ? parseInt(it.remaining_units, 10) : Math.max(0, ord - disp);
          const upb = parseInt(it.units_per_box || it.bottles_per_box || 10, 10) || 10;

          // Filter batches matching this product with flexible name and ID mapping
          const itName = String(it.product_name || '').toLowerCase().trim();
          let matchingBatches = approvedBatches.filter(b => 
            (b.product_id && b.product_id === it.product_id) ||
            (b.item_id && b.item_id === it.product_id) ||
            (b.item_name && String(b.item_name).toLowerCase().trim() === itName) ||
            (b.item_name && String(b.item_name).toLowerCase().includes(itName)) ||
            (itName && String(b.item_name || '').toLowerCase().includes(itName.split(' ')[0]))
          );

          if (!matchingBatches.length && approvedBatches.length > 0) {
            matchingBatches = approvedBatches;
          }

          let batchOptions = matchingBatches.map(b => 
            `<option value="${b.id}" data-batch-no="${b.batch_no}" data-qty="${b.current_qty}">${b.batch_no} ${b.item_name ? `(${b.item_name})` : ''} — Avail: ${b.current_qty} units</option>`
          ).join('');

          if (!matchingBatches.length) {
            batchOptions = '<option value="">No QC-Approved batches available</option>';
          }

          tableHtml += `
            <tr data-order-item-id="${it.id}" data-units-per-box="${upb}">
              <td style="font-weight:600; color:var(--text);">${it.product_name}</td>
              <td><span class="badge badge-neutral">${it.packing_size || it.packaging_size || '1 Litre'}</span></td>
              <td>${ord}</td>
              <td style="color:var(--text-muted);">${disp}</td>
              <td style="font-weight:700; color:var(--primary);">${rem}</td>
              <td>
                <input class="form-input disp-item-qty" type="number" min="0" max="${rem}" value="${rem}" 
                  oninput="DISPATCH_UI.recalcLineBreakdown(this, ${upb})" 
                  style="width:100%; font-weight:700; padding:6px 8px;">
              </td>
              <td>
                <select class="form-select disp-item-batch" style="width:100%; font-size:11.5px; padding:6px 8px;">
                  ${batchOptions}
                </select>
              </td>
              <td>
                <span class="disp-item-breakdown" style="font-size:12px; font-weight:600; color:var(--text-muted);">
                  ${Math.floor(rem / upb)} Boxes + ${rem % upb} Loose
                </span>
              </td>
            </tr>
          `;
        });

        tableHtml += '</tbody></table>';
        itemsContainer.innerHTML = tableHtml;
      } catch (err) {
        console.error('Failed to load order items:', err);
        itemsContainer.innerHTML = `<p style="color:var(--danger, #ef4444); font-size:13px;">Error: ${err.message}</p>`;
      }
    },

    recalcLineBreakdown(inputEl, unitsPerBox) {
      const row = inputEl.closest('tr');
      const qty = parseInt(inputEl.value, 10) || 0;
      const breakdownEl = row.querySelector('.disp-item-breakdown');
      if (breakdownEl) {
        const boxes = Math.floor(qty / unitsPerBox);
        const loose = qty % unitsPerBox;
        breakdownEl.textContent = `${boxes} Boxes + ${loose} Loose`;
      }
    },

    /**
     * Submit Prepare Dispatch Slip
     */
    async submitPrepareDispatch() {
      const orderId = parseInt(document.getElementById('disp-order-select')?.value, 10);
      const dispatchNo = document.getElementById('disp-slip-no')?.value;
      const dispatchDate = document.getElementById('disp-date')?.value;
      const vehicleNo = document.getElementById('disp-vehicle-no')?.value;
      const transporterName = document.getElementById('disp-transporter')?.value;
      const driverContact = document.getElementById('disp-driver-contact')?.value;
      const ewayBillNo = document.getElementById('disp-eway-bill')?.value;
      const notes = document.getElementById('disp-notes')?.value;

      if (!orderId) {
        APP.showToast('Please select a sales order.', 'error');
        return;
      }

      const rows = document.querySelectorAll('#disp-items-container tbody tr');
      const items = [];

      for (const row of rows) {
        const orderItemId = parseInt(row.getAttribute('data-order-item-id'), 10);
        const upb = parseInt(row.getAttribute('data-units-per-box'), 10) || 10;
        const qtyInput = row.querySelector('.disp-item-qty');
        const batchSelect = row.querySelector('.disp-item-batch');

        const qty = parseInt(qtyInput?.value, 10) || 0;
        if (qty > 0) {
          const batchId = parseInt(batchSelect?.value, 10);
          const selectedOpt = batchSelect?.options[batchSelect.selectedIndex];
          const batchNo = selectedOpt?.getAttribute('data-batch-no') || '';

          if (!batchId || !batchNo) {
            APP.showToast('Please select a QC-Approved batch for all dispatched items.', 'error');
            return;
          }

          items.push({
            order_item_id: orderItemId,
            stock_batch_id: batchId,
            batch_no: batchNo,
            total_units_dispatched: qty,
            units_per_box: upb
          });
        }
      }

      if (!items.length) {
        APP.showToast('Please enter dispatch quantity (> 0) for at least one item.', 'error');
        return;
      }

      try {
        APP.showToast('Creating Commercial Dispatch Slip…', 'info');
        const res = await window.DISPATCH_SERVICE.prepareDispatch(window.dbClient, {
          order_id: orderId,
          dispatch_no: dispatchNo,
          dispatch_date: dispatchDate,
          vehicle_no: vehicleNo,
          transporter_name: transporterName,
          driver_contact: driverContact,
          eway_bill_no: ewayBillNo,
          notes: notes,
          items: items,
          idempotency_key: `DSP-PREP-${dispatchNo}-${orderId}`
        });

        APP.showToast(`Dispatch Slip #${res.dispatch.dispatch_no} created successfully!`, 'success');
        APP.closeModal('prepare-dispatch-modal');
        await this.loadDispatches();
        if (typeof window.loadOrders === 'function') window.loadOrders();
      } catch (err) {
        console.error('submitPrepareDispatch error:', err);
        APP.showToast('Dispatch preparation failed: ' + err.message, 'error');
      }
    },

    /**
     * Open Godown Packing Completion Verification modal
     */
    async openVerifyDispatch(dispatchId) {
      currentActionDispatchId = dispatchId;
      const details = await window.DISPATCH_SERVICE.getDispatchDetails(window.dbClient, dispatchId);
      if (!details || !details.dispatch) {
        APP.showToast('Dispatch not found', 'error');
        return;
      }

      const d = details.dispatch;
      const items = details.items || [];

      const body = document.getElementById('verify-dispatch-body');
      body.innerHTML = `
        <div style="background:var(--bg); padding:12px; border-radius:8px; border:1px solid var(--border); margin-bottom:14px; font-size:13px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span><strong>Dispatch Slip:</strong> ${d.dispatch_no}</span>
            <span><strong>Order:</strong> ${d.order_no}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span><strong>Client:</strong> ${d.client_name}</span>
            <span><strong>Total Units:</strong> ${d.total_units_dispatched} (${d.total_boxes_dispatched} Boxes + ${d.total_loose_dispatched} Loose)</span>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <h5 style="margin:0 0 8px; font-size:13px;">Items to Verify</h5>
          <table class="line-items-table" style="width:100%; font-size:12px;">
            <thead><tr><th>Product</th><th>Batch</th><th>Boxes</th><th>Loose</th><th>Total Units</th></tr></thead>
            <tbody>
              ${items.map(it => `
                <tr>
                  <td>${it.product_name}</td>
                  <td><code>${it.batch_no}</code></td>
                  <td>${it.boxes_dispatched}</td>
                  <td>${it.loose_dispatched}</td>
                  <td><strong>${it.total_units_dispatched}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Verified By (Godown Operator / Supervisor) <span class="required">*</span></label>
          <input class="form-input" id="verify-by-name" value="Godown Operator" placeholder="Operator name…">
        </div>
        <div class="form-group">
          <label class="form-label">Physical Packaging Verification Notes</label>
          <textarea class="form-textarea" id="verify-notes" rows="2">Physical corrugated cartons, batch seal intact, bottle count and labeling verified.</textarea>
        </div>
      `;

      APP.openModal('verify-dispatch-modal');
    },

    async submitVerifyDispatch() {
      if (!currentActionDispatchId) return;
      const verifiedBy = document.getElementById('verify-by-name')?.value || 'Godown Operator';
      const notes = document.getElementById('verify-notes')?.value;

      try {
        await window.DISPATCH_SERVICE.verifyPacking(window.dbClient, {
          dispatchId: currentActionDispatchId,
          verifiedBy: verifiedBy,
          verificationNotes: notes
        });
        APP.showToast('Packing verification confirmed!', 'success');
        APP.closeModal('verify-dispatch-modal');
        await this.loadDispatches();
        if (typeof window.loadOrders === 'function') window.loadOrders();
      } catch (err) {
        APP.showToast('Verification failed: ' + err.message, 'error');
      }
    },

    /**
     * Open Manager Dispatch Authorization modal
     */
    async openApproveDispatch(dispatchId) {
      currentActionDispatchId = dispatchId;
      const details = await window.DISPATCH_SERVICE.getDispatchDetails(window.dbClient, dispatchId);
      if (!details || !details.dispatch) return;
      const d = details.dispatch;

      const body = document.getElementById('approve-dispatch-body');
      body.innerHTML = `
        <div style="background:var(--bg); padding:12px; border-radius:8px; border:1px solid var(--border); margin-bottom:14px; font-size:13px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span><strong>Dispatch Slip:</strong> ${d.dispatch_no}</span>
            <span><strong>Verified By:</strong> ${d.verified_by || 'Godown Operator'}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span><strong>Client:</strong> ${d.client_name}</span>
            <span><strong>Total Volume:</strong> ${d.total_units_dispatched} units</span>
          </div>
        </div>

        <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">
          Authorizing this commercial dispatch confirms customer credit and authorizes the logistics gate pass.
        </p>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Approved By (Manager / Director) <span class="required">*</span></label>
          <input class="form-input" id="approve-by-name" value="Dispatch Manager" placeholder="Manager name…">
        </div>
        <div class="form-group">
          <label class="form-label">Approval Remarks</label>
          <textarea class="form-textarea" id="approve-notes" rows="2">Authorized for commercial logistics and gate exit.</textarea>
        </div>
      `;

      APP.openModal('approve-dispatch-modal');
    },

    async submitApproveDispatch() {
      if (!currentActionDispatchId) return;
      const approvedBy = document.getElementById('approve-by-name')?.value || 'Dispatch Manager';
      const notes = document.getElementById('approve-notes')?.value;

      try {
        await window.DISPATCH_SERVICE.approveDispatch(window.dbClient, {
          dispatchId: currentActionDispatchId,
          approvedBy: approvedBy,
          approvalNotes: notes
        });
        APP.showToast('Dispatch approved for gate exit!', 'success');
        APP.closeModal('approve-dispatch-modal');
        await this.loadDispatches();
        if (typeof window.loadOrders === 'function') window.loadOrders();
      } catch (err) {
        APP.showToast('Approval failed: ' + err.message, 'error');
      }
    },

    /**
     * Open Gate Exit & Single-Posting Physical Stock Deduction modal
     */
    async openExecuteDispatch(dispatchId) {
      currentActionDispatchId = dispatchId;
      const details = await window.DISPATCH_SERVICE.getDispatchDetails(window.dbClient, dispatchId);
      if (!details || !details.dispatch) return;
      const d = details.dispatch;

      const body = document.getElementById('execute-dispatch-body');
      body.innerHTML = `
        <div style="background:rgba(22, 163, 74, 0.08); padding:12px; border-radius:8px; border:1px solid rgba(22, 163, 74, 0.3); margin-bottom:14px; font-size:13px;">
          <div style="font-weight:700; color:#16a34a; margin-bottom:4px;">SINGLE-POSTING PHYSICAL STOCK DEDUCTION</div>
          <p style="margin:0; font-size:12px; color:var(--text);">
            Confirming gate exit will physically deduct the <strong>${d.total_units_dispatched} units</strong> from warehouse origin batches <strong>EXACTLY ONCE</strong>, and update order remaining balance.
          </p>
        </div>

        <div class="form-grid product-form-grid" style="gap:10px;">
          <div class="form-group">
            <label class="form-label">Gate Officer</label>
            <input class="form-input" id="gate-officer-name" value="Security Gatekeeper">
          </div>
          <div class="form-group">
            <label class="form-label">Vehicle Registration No</label>
            <input class="form-input" id="gate-vehicle-no" value="${d.vehicle_no || ''}" placeholder="GJ-01-AB-1234">
          </div>
          <div class="form-group">
            <label class="form-label">Transporter Name</label>
            <input class="form-input" id="gate-transporter-name" value="${d.transporter_name || ''}" placeholder="Shreeji Logistics">
          </div>
          <div class="form-group">
            <label class="form-label">Government E-Way Bill No</label>
            <input class="form-input" id="gate-eway-bill" value="${d.eway_bill_no || ''}" placeholder="EWB-2026-99988">
          </div>
        </div>
      `;

      APP.openModal('execute-dispatch-modal');
    },

    async submitExecuteDispatch() {
      if (!currentActionDispatchId) return;
      const dispatchedBy = document.getElementById('gate-officer-name')?.value || 'Gate Officer';
      const vehicleNo = document.getElementById('gate-vehicle-no')?.value;
      const transporterName = document.getElementById('gate-transporter-name')?.value;
      const ewayBillNo = document.getElementById('gate-eway-bill')?.value;

      try {
        APP.showToast('Deducting inventory & posting gate exit…', 'info');
        const res = await window.DISPATCH_SERVICE.executeDispatch(window.dbClient, {
          dispatchId: currentActionDispatchId,
          dispatchedBy: dispatchedBy,
          vehicleNo: vehicleNo,
          transporterName: transporterName,
          ewayBillNo: ewayBillNo
        });

        APP.showToast(`Gate Pass posted! Stock deducted. Order status: ${res.orderDispatchStatus}`, 'success');
        APP.closeModal('execute-dispatch-modal');
        await this.loadDispatches();
        if (typeof window.loadOrders === 'function') window.loadOrders();
      } catch (err) {
        APP.showToast('Gate exit execution failed: ' + err.message, 'error');
      }
    },

    /**
     * Open Commercial Tax Invoice Generation modal (Zero Double-Deduction)
     */
    async openGenerateInvoice(dispatchId) {
      currentActionDispatchId = dispatchId;
      const details = await window.DISPATCH_SERVICE.getDispatchDetails(window.dbClient, dispatchId);
      if (!details || !details.dispatch) return;
      const d = details.dispatch;
      const items = details.items || [];

      const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.total_amount) || 0), 0);
      const tax = subtotal * 0.12;
      const grandTotal = subtotal + tax;

      const body = document.getElementById('generate-invoice-body');
      body.innerHTML = `
        <div style="background:rgba(12, 57, 37, 0.08); padding:12px; border-radius:8px; border:1px solid var(--border); margin-bottom:14px; font-size:13px;">
          <div style="font-weight:700; color:var(--primary); margin-bottom:4px;">ZERO DOUBLE-DEDUCTION GUARANTEE</div>
          <p style="margin:0; font-size:12px; color:var(--text);">
            Physical stock was already deducted at gate pass exit. This tax invoice records financial billing with <strong>is_stock_deducted: false</strong> so inventory is NEVER deducted a second time.
          </p>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px;">
          <span><strong>Dispatch Slip:</strong> ${d.dispatch_no}</span>
          <span><strong>Client:</strong> ${d.client_name}</span>
        </div>

        <div class="form-grid product-form-grid" style="gap:10px; margin-bottom:14px;">
          <div class="form-group">
            <label class="form-label">Invoice Number</label>
            <input class="form-input" id="inv-no" value="INV-${Date.now().toString().slice(-6)}" style="font-weight:700;">
          </div>
          <div class="form-group">
            <label class="form-label">Created By (Accountant)</label>
            <input class="form-input" id="inv-creator" value="Accounts Team">
          </div>
        </div>

        <div style="background:var(--bg); padding:12px; border-radius:8px; border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
            <span>Subtotal:</span><strong>${UTILS.fmtCurrency(subtotal)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
            <span>GST (12%):</span><strong>${UTILS.fmtCurrency(tax)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:800; border-top:1px solid var(--border); padding-top:6px; color:var(--primary);">
            <span>Grand Total:</span><span>${UTILS.fmtCurrency(grandTotal)}</span>
          </div>
        </div>
      `;

      APP.openModal('generate-invoice-modal');
    },

    async submitGenerateInvoice() {
      if (!currentActionDispatchId) return;
      const invNo = document.getElementById('inv-no')?.value;
      const createdBy = document.getElementById('inv-creator')?.value || 'Accountant';

      try {
        const res = await window.DISPATCH_SERVICE.generateInvoiceForDispatch(window.dbClient, {
          dispatchId: currentActionDispatchId,
          invoiceNo: invNo,
          createdBy: createdBy
        });

        APP.showToast(`Commercial Invoice #${res.invoice.invoice_no} created (Zero Double-Deduction)!`, 'success');
        APP.closeModal('generate-invoice-modal');
        await this.loadDispatches();
      } catch (err) {
        APP.showToast('Invoice generation failed: ' + err.message, 'error');
      }
    },

    /**
     * Open Safe Reversal / Customer Return modal
     */
    async openReverseDispatch(dispatchId) {
      currentActionDispatchId = dispatchId;
      const details = await window.DISPATCH_SERVICE.getDispatchDetails(window.dbClient, dispatchId);
      if (!details || !details.dispatch) return;
      const d = details.dispatch;

      const body = document.getElementById('reverse-dispatch-body');
      body.innerHTML = `
        <div style="background:rgba(239, 68, 68, 0.08); padding:12px; border-radius:8px; border:1px solid rgba(239, 68, 68, 0.3); margin-bottom:14px; font-size:13px;">
          <div style="font-weight:700; color:var(--danger, #ef4444); margin-bottom:4px;">SAFE DISPATCH REVERSAL & STOCK RESTORATION</div>
          <p style="margin:0; font-size:12px; color:var(--text);">
            Reversing this dispatch will safely restore <strong>${d.total_units_dispatched} units</strong> back to origin warehouse batches and restore remaining balance on Order #${d.order_no}.
          </p>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Reversal Reason / Type <span class="required">*</span></label>
          <select class="form-select" id="rev-type">
            <option value="CUSTOMER_RETURN">Customer Return / Rejection</option>
            <option value="DAMAGED_IN_TRANSIT">Damaged in Transit Return</option>
            <option value="CANCELLATION">Order Cancellation at Gate</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Reason Notes</label>
          <textarea class="form-textarea" id="rev-reason" rows="2" placeholder="Vehicle breakdown, quality dispute, transport return…"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Authorized Supervisor</label>
          <input class="form-input" id="rev-by-name" value="Godown Supervisor">
        </div>
      `;

      APP.openModal('reverse-dispatch-modal');
    },

    async submitReverseDispatch() {
      if (!currentActionDispatchId) return;
      const reversalType = document.getElementById('rev-type')?.value || 'CUSTOMER_RETURN';
      const reason = document.getElementById('rev-reason')?.value || 'Customer return';
      const reversedBy = document.getElementById('rev-by-name')?.value || 'Godown Supervisor';

      try {
        APP.showToast('Restoring physical stock and reversing dispatch…', 'info');
        const res = await window.DISPATCH_SERVICE.cancelOrReverseDispatch(window.dbClient, {
          dispatchId: currentActionDispatchId,
          reversalType: reversalType,
          reason: reason,
          reversedBy: reversedBy
        });

        APP.showToast(`Dispatch reversed! Stock restored. Reversal Ref: ${res.reversalNo}`, 'success');
        APP.closeModal('reverse-dispatch-modal');
        await this.loadDispatches();
        if (typeof window.loadOrders === 'function') window.loadOrders();
      } catch (err) {
        APP.showToast('Reversal failed: ' + err.message, 'error');
      }
    },

    /**
     * View Commercial Dispatch Slip detailed modal
     */
    async viewDispatch(dispatchId) {
      try {
        const details = await window.DISPATCH_SERVICE.getDispatchDetails(window.dbClient, dispatchId);
        if (!details || !details.dispatch) {
          APP.showToast('Dispatch details not found', 'error');
          return;
        }

        const d = details.dispatch;
        const items = details.items || [];

        const content = document.getElementById('view-dispatch-content');
        content.innerHTML = `
          <div style="border: 2px solid var(--border); padding: 20px; border-radius: 8px; background: var(--bg);">
            <!-- Dispatch Slip Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid var(--border); padding-bottom: 14px; margin-bottom: 14px;">
              <div>
                <h3 style="margin:0; font-size:20px; font-weight:800; color:var(--text);">COMMERCIAL DISPATCH SLIP / GATE PASS</h3>
                <p style="margin:3px 0 0; font-size:12px; color:var(--text-muted);">Slip No: <strong style="color:var(--text);">${d.dispatch_no}</strong> | Date: <strong>${UTILS.fmtDate(d.dispatch_date)}</strong></p>
              </div>
              <div style="text-align:right;">
                <span class="badge ${d.status === 'Dispatched' ? 'badge-success' : 'badge-warning'}" style="font-size:13px; padding:4px 10px;">${d.status}</span>
                <p style="margin:4px 0 0; font-size:11px; color:var(--text-muted);">${d.stock_deducted ? 'Stock Deducted: YES' : 'Stock Deducted: PENDING'}</p>
              </div>
            </div>

            <!-- Client & Order Info -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px; font-size:13px;">
              <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);">
                <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700; margin-bottom:4px;">Customer Details</div>
                <div style="font-size:15px; font-weight:800; color:var(--text);">${d.client_name}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Order Ref: <strong>${d.order_no}</strong></div>
              </div>
              <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; border:1px solid var(--border);">
                <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700; margin-bottom:4px;">Logistics & Gate Exit</div>
                <div>Vehicle: <strong>${d.vehicle_no || 'Not Assigned'}</strong></div>
                <div>Transporter: <strong>${d.transporter_name || 'Direct'}</strong></div>
                <div>E-Way Bill: <strong>${d.eway_bill_no || '—'}</strong></div>
              </div>
            </div>

            <!-- Itemized Physical Batches Table -->
            <div style="margin-bottom:16px;">
              <h4 style="margin:0 0 8px; font-size:14px; font-weight:700;">Dispatched Items & Batch Allocation</h4>
              <table class="line-items-table" style="width:100%; font-size:12.5px;">
                <thead>
                  <tr style="background:var(--bg); border-bottom:1px solid var(--border);">
                    <th>Product SKU</th>
                    <th>Pack Size</th>
                    <th>Allocated Batch</th>
                    <th>Boxes</th>
                    <th>Loose</th>
                    <th>Total Dispatched</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(it => `
                    <tr>
                      <td style="font-weight:600;">${it.product_name}</td>
                      <td><span class="badge badge-neutral">${it.packaging_size}</span></td>
                      <td><code>${it.batch_no}</code></td>
                      <td><strong>${it.boxes_dispatched}</strong> Boxes</td>
                      <td>${it.loose_dispatched} Loose</td>
                      <td style="font-weight:800; color:var(--primary);">${it.total_units_dispatched} units</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="border-top:2px solid var(--border); font-weight:800;">
                    <td colspan="3">TOTAL COMMERCIAL VOLUME</td>
                    <td>${d.total_boxes_dispatched} Boxes</td>
                    <td>${d.total_loose_dispatched} Loose</td>
                    <td style="color:var(--primary);">${d.total_units_dispatched} Units</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Signatures / Audit Trail -->
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; border-top:1px dashed var(--border); padding-top:14px; font-size:11.5px; color:var(--text-muted);">
              <div>
                <strong>1. Packing Verified:</strong><br>
                ${d.verified_by || 'Pending'}<br>
                <span>${d.verified_at ? UTILS.fmtDate(d.verified_at) : ''}</span>
              </div>
              <div>
                <strong>2. Dispatch Approved:</strong><br>
                ${d.approved_by || 'Pending'}<br>
                <span>${d.approved_at ? UTILS.fmtDate(d.approved_at) : ''}</span>
              </div>
              <div>
                <strong>3. Gate Officer / Security:</strong><br>
                ${d.dispatched_by || 'Pending'}<br>
                <span>${d.dispatched_at ? UTILS.fmtDate(d.dispatched_at) : ''}</span>
              </div>
            </div>
          </div>
        `;

        APP.openModal('view-dispatch-modal');
      } catch (err) {
        console.error('viewDispatch error:', err);
        APP.showToast('Failed to view dispatch: ' + err.message, 'error');
      }
    },

    printDispatchSlip() {
      window.print();
    }
  };

  // Expose globally for HTML event handlers
  window.DISPATCH_UI = DISPATCH_UI;
  window.openPrepareDispatch = (orderId) => DISPATCH_UI.openPrepareDispatch(orderId);
  window.onDispatchOrderSelected = (orderId) => DISPATCH_UI.onDispatchOrderSelected(orderId);
  window.submitPrepareDispatch = () => DISPATCH_UI.submitPrepareDispatch();
  window.openVerifyDispatch = (id) => DISPATCH_UI.openVerifyDispatch(id);
  window.submitVerifyDispatch = () => DISPATCH_UI.submitVerifyDispatch();
  window.openApproveDispatch = (id) => DISPATCH_UI.openApproveDispatch(id);
  window.submitApproveDispatch = () => DISPATCH_UI.submitApproveDispatch();
  window.openExecuteDispatch = (id) => DISPATCH_UI.openExecuteDispatch(id);
  window.submitExecuteDispatch = () => DISPATCH_UI.submitExecuteDispatch();
  window.openGenerateInvoice = (id) => DISPATCH_UI.openGenerateInvoice(id);
  window.submitGenerateInvoice = () => DISPATCH_UI.submitGenerateInvoice();
  window.openReverseDispatch = (id) => DISPATCH_UI.openReverseDispatch(id);
  window.submitReverseDispatch = () => DISPATCH_UI.submitReverseDispatch();
  window.viewDispatch = (id) => DISPATCH_UI.viewDispatch(id);
  window.printDispatchSlip = () => DISPATCH_UI.printDispatchSlip();

  // Wire search and status pills on document ready
  document.addEventListener('DOMContentLoaded', () => {
    // Search input
    document.getElementById('dispatch-search-input')?.addEventListener('input', e => {
      activeDispatchSearch = e.target.value || '';
      DISPATCH_UI.renderDispatchesTable();
    });

    // Status filter pills
    document.querySelectorAll('#dispatch-status-pill-filters .cat-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('#dispatch-status-pill-filters .cat-pill').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeDispatchFilter = e.target.getAttribute('data-status') || '';
        DISPATCH_UI.renderDispatchesTable();
      });
    });
  });

})(typeof window !== 'undefined' ? window : this);
