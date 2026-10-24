const fs = require('fs');
let code = fs.readFileSync('assets/js/inventory-core.js', 'utf8');

// Normalize line endings to find the block
const startMarker = 'async reverseReferenceStock({ referenceId, referenceNo = null, movementType = \'DISPATCH_REVERSAL\', notes = null }) {';
const endMarker = 'async deductStock(itemId, qtyToDeduct) {';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found!');
  process.exit(1);
}

const replacement = `async reverseReferenceStock({ referenceId, referenceNo = null, movementType = 'DISPATCH_REVERSAL', notes = null }) {
      const db = this.getDb();
      if (!db || !referenceId) return;

      try {
        const { data: movements, error } = await db
          .from('stock_movements')
          .select('*')
          .eq('txn_id', referenceId)
          .lt('qty', 0); // Outflows

        if (error || !movements || movements.length === 0) return;

        const affectedItemIds = new Set();
        const compMovements = [];

        // Parallel fetch of unique affected batch rows
        const uniqueBatchIds = Array.from(new Set(movements.map(m => m.batch_id).filter(Boolean)));
        const batchMap = new Map();
        if (uniqueBatchIds.length > 0) {
          const { data: bRows } = await db.from('stock_batches').select('id, current_qty, item_id').in('id', uniqueBatchIds);
          (bRows || []).forEach(b => batchMap.set(b.id, { ...b }));
        }

        for (const mov of movements) {
          const restoreQty = Math.abs(parseFloat(mov.qty) || 0);
          if (restoreQty <= 0) continue;

          if (mov.batch_id && batchMap.has(mov.batch_id)) {
            const bRow = batchMap.get(mov.batch_id);
            const cur = Math.max(0, parseFloat(bRow.current_qty) || 0);
            bRow.current_qty = cur + restoreQty;
            if (bRow.item_id) affectedItemIds.add(bRow.item_id);
          }
          if (mov.item_id) affectedItemIds.add(mov.item_id);

          compMovements.push({
            item_id: mov.item_id || null,
            batch_id: mov.batch_id,
            txn_type: movementType,
            qty: restoreQty,
            reference_type: 'reversals',
            txn_id: referenceId,
            reference_no: referenceNo,
            notes: notes || ('Reversal of movement #' + mov.id),
            created_at: new Date().toISOString()
          });
        }

        // Parallel persist restored batch quantities and comp movements
        const persistTasks = [];
        for (const [batchId, bData] of batchMap.entries()) {
          persistTasks.push(db.from('stock_batches').update({ current_qty: bData.current_qty }).eq('id', batchId));
        }
        if (compMovements.length > 0) {
          const stampedComp = window.TENANT_CONTEXT ? window.TENANT_CONTEXT.stamp(compMovements) : compMovements;
          persistTasks.push(db.from('stock_movements').insert(stampedComp));
        }
        await Promise.all(persistTasks);

        // Clean reversed outflow records
        await db.from('stock_movements').delete().eq('txn_id', referenceId).lt('qty', 0);

        // Sync all affected items concurrently
        await Promise.all(Array.from(affectedItemIds).map(itemId => this.syncItemStock(itemId)));
      } catch (err) {
        console.warn('[INVENTORY_CORE] reverseReferenceStock notice:', err);
      }
    },

    /**
     * Backward-compatible simple deductStock wrapper.
     */
    `;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync('assets/js/inventory-core.js', code);
console.log('Successfully updated reverseReferenceStock in inventory-core.js');
