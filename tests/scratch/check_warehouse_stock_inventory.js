const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function main() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  
  // Check warehouse_stock
  const { data: whStock, error: whErr } = await client.from('warehouse_stock').select('*').limit(10);
  console.log('warehouse_stock count/sample:', whStock ? whStock.length : 0, 'error:', whErr);
  if (whStock && whStock.length > 0) {
    console.log('warehouse_stock sample:', whStock[0]);
  }

  // Check all inventory_items company_ids
  const { data: items } = await client.from('inventory_items').select('id, company_id, category, name');
  const companyCounts = {};
  items.forEach(i => {
    companyCounts[i.company_id] = (companyCounts[i.company_id] || 0) + 1;
  });
  console.log('inventory_items by company_id:', companyCounts);

  // Check all stock_batches item_types
  const { data: batches } = await client.from('stock_batches').select('item_type, count()');
  console.log('stock_batches item types:', batches);
}
main();
