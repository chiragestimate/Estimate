const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';
const client = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
  const { data: batches } = await client.from('stock_batches').select('*');
  console.log('--- Stock Batches with current_qty !== initial_qty ---');
  batches.filter(b => b.current_qty !== b.initial_qty).forEach(b => {
    console.log(`Batch ID: ${b.id}, Name: ${b.item_name}, current: ${b.current_qty}, initial: ${b.initial_qty}, WH: ${b.warehouse_id}`);
  });

  const { data: inv } = await client.from('inventory_items').select('*');
  console.log('\n--- Inventory items with stock !== 1000 ---');
  inv.filter(i => i.stock !== 1000).forEach(i => {
    console.log(`Inv ID: ${i.id}, Name: ${i.name}, stock: ${i.stock}`);
  });
}

checkAll().catch(console.error);
