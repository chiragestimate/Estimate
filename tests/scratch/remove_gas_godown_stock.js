const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function removeGasGodownStock() {
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log('Finding batches for Gas Godown (ID 532 or name "Gas Godown")...');
  const { data: batches, error: bErr } = await client
    .from('stock_batches')
    .select('*')
    .or('warehouse_id.eq.532,warehouse.ilike.%Gas Godown%');

  console.log('Found batches:', batches);

  if (batches && batches.length > 0) {
    for (const b of batches) {
      console.log(`Deleting batch ID ${b.id} (${b.batch_no} - ${b.item_name})...`);
      const { error: delErr } = await client
        .from('stock_batches')
        .delete()
        .eq('id', b.id);
      if (delErr) {
        console.error('Delete error:', delErr);
      } else {
        console.log(`Successfully deleted batch ID ${b.id}`);
      }
    }
  }

  // Also check if any stock_movements exist for this batch/warehouse
  const { data: remaining } = await client
    .from('stock_batches')
    .select('*')
    .or('warehouse_id.eq.532,warehouse.ilike.%Gas Godown%');
  console.log('Remaining batches in Gas Godown:', remaining?.length || 0);
}

removeGasGodownStock();
