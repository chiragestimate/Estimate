const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function main() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  
  const { data: items, error: iErr } = await client.from('inventory_items').select('id, name, category, stock');
  if (iErr) {
    console.error('Error fetching inventory items:', iErr);
    return;
  }
  const { data: batches, error: bErr } = await client.from('stock_batches').select('id, item_id, item_name, current_qty, purchase_price, initial_qty').eq('item_type', 'Inventory');
  if (bErr) {
    console.error('Error fetching stock batches:', bErr);
    return;
  }

  const batchMap = {};
  batches.forEach(b => {
    if (!batchMap[b.item_id]) batchMap[b.item_id] = [];
    batchMap[b.item_id].push(b);
  });

  console.log('--- ALL INVENTORY ITEMS ---');
  items.sort((a, b) => a.id - b.id).forEach(it => {
    const itemBatches = batchMap[it.id] || [];
    const batchTotal = itemBatches.reduce((sum, b) => sum + (parseFloat(b.current_qty) || 0), 0);
    console.log(`[ID ${String(it.id).padStart(3)}] ${it.category.padEnd(10)} | ${it.name.padEnd(45)} | item.stock: ${String(it.stock).padStart(6)} | batchTotal: ${String(batchTotal).padStart(6)} (${itemBatches.length} batch)`);
  });
}
main();
