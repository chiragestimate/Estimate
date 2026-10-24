const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function main() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  
  const tables = [
    'inventory_items', 'stock_batches', 'products', 'product_batches',
    'inventory', 'stocks', 'item_stock', 'inventory_transactions',
    'stock_movements', 'production_orders'
  ];

  for (const t of tables) {
    const { count, error } = await client.from(t).select('*', { count: 'exact', head: true });
    if (!error) {
      console.log(`Table '${t}': exists, count = ${count}`);
    } else {
      console.log(`Table '${t}': ${error.code} - ${error.message}`);
    }
  }
}
main();
