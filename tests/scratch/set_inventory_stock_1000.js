const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function updateAllStockToOneThousand() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  console.log('Fetching all inventory items and batches...');
  const { data: items, error: iErr } = await client.from('inventory_items').select('*');
  if (iErr) {
    console.error('Error fetching inventory items:', iErr);
    return;
  }

  const { data: batches, error: bErr } = await client.from('stock_batches').select('*').eq('item_type', 'Inventory');
  if (bErr) {
    console.error('Error fetching stock batches:', bErr);
    return;
  }

  console.log(`Found ${items.length} inventory items and ${batches.length} inventory batches.`);

  // 1. Update all inventory_items to stock: 1000
  for (const item of items) {
    const { error } = await client
      .from('inventory_items')
      .update({ stock: 1000 })
      .eq('id', item.id);
    if (error) {
      console.error(`Failed to update inventory_item ID ${item.id} (${item.name}):`, error);
    } else {
      console.log(`[inventory_items] ID ${item.id} (${item.name}): stock set to 1000 (was ${item.stock})`);
    }
  }

  // 2. Update all inventory stock_batches to current_qty: 1000, initial_qty: 1000
  for (const batch of batches) {
    const { error } = await client
      .from('stock_batches')
      .update({ current_qty: 1000, initial_qty: 1000 })
      .eq('id', batch.id);
    if (error) {
      console.error(`Failed to update stock_batch ID ${batch.id} (${batch.item_name}):`, error);
    } else {
      console.log(`[stock_batches] ID ${batch.id} (${batch.item_name}): current_qty set to 1000 (was ${batch.current_qty})`);
    }
  }

  console.log('--- VERIFICATION ---');
  const { data: finalItems } = await client.from('inventory_items').select('id, name, category, stock');
  const { data: finalBatches } = await client.from('stock_batches').select('id, item_id, item_name, current_qty').eq('item_type', 'Inventory');

  const finalBatchMap = {};
  finalBatches.forEach(b => {
    if (!finalBatchMap[b.item_id]) finalBatchMap[b.item_id] = 0;
    finalBatchMap[b.item_id] += (parseFloat(b.current_qty) || 0);
  });

  let allMatch = true;
  finalItems.sort((a, b) => a.id - b.id).forEach(it => {
    const bQty = finalBatchMap[it.id] !== undefined ? finalBatchMap[it.id] : it.stock;
    const ok = it.stock === 1000 && bQty === 1000;
    if (!ok) allMatch = false;
    console.log(`ID ${String(it.id).padStart(3)} | ${it.category.padEnd(10)} | ${it.name.padEnd(45)} | item.stock: ${it.stock} | batchTotal: ${bQty} | ${ok ? 'OK' : 'MISMATCH'}`);
  });

  console.log('All 27 items set to 1000:', allMatch);
}

updateAllStockToOneThousand();
