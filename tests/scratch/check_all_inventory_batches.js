const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function main() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  
  const { data: batches, error } = await client.from('stock_batches').select('*').eq('item_type', 'Inventory');
  console.log('Error:', error);
  console.log('Total inventory batches:', batches.length);
  batches.forEach(b => {
    console.log(`Batch ID ${b.id} | item_id: ${b.item_id} | ${b.item_name} | current_qty: ${b.current_qty} | initial_qty: ${b.initial_qty} | price: ${b.purchase_price} | wh: ${b.warehouse}`);
  });
}
main();
