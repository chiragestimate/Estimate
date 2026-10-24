const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function testUpdate() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  // Try updating item 47 (Anjani Coragen-80 Ec) stock to 1000
  const { data: itemData, error: itemErr } = await client
    .from('inventory_items')
    .update({ stock: 1000 })
    .eq('id', 47)
    .select();
  console.log('Update inventory_items 47 result:', itemData, 'Error:', itemErr);

  // Try updating batch 82 (item 47 batch) current_qty to 1000, initial_qty to 1000
  const { data: batchData, error: batchErr } = await client
    .from('stock_batches')
    .update({ current_qty: 1000, initial_qty: 1000 })
    .eq('id', 82)
    .select();
  console.log('Update stock_batches 82 result:', batchData, 'Error:', batchErr);
}

testUpdate();
