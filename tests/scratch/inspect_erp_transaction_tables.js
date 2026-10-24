const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function inspectSchema() {
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const tables = [
    'dispatches',
    'orders',
    'order_items',
    'stock_movements',
    'transfers',
    'intercompany_transfers',
    'intercompany_links',
    'purchases',
    'purchase_items',
    'production',
    'warehouses',
    'companies'
  ];

  for (const t of tables) {
    const { data, error } = await client.from(t).select('*').limit(1);
    if (!error) {
      console.log(`\n=== TABLE: ${t} ===`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else {
        console.log('(table empty)');
      }
    } else {
      console.log(`\n=== TABLE: ${t} (ERROR: ${error.message}) ===`);
    }
  }
}

inspectSchema();
