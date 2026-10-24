const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';
const client = createClient(supabaseUrl, supabaseKey);

const tables = [
  'companies',
  'warehouses',
  'branches',
  'products',
  'inventory',
  'inventory_batches',
  'orders',
  'order_items',
  'dispatches',
  'dispatch_items',
  'intercompany_transfers',
  'transfer_items',
  'purchases',
  'purchase_items',
  'clients',
  'suppliers',
  'expenses',
  'audit_logs',
  'system_roles',
  'user_role_assignments'
];

(async () => {
  for (const t of tables) {
    try {
      const { data, error } = await client.from(t).select('*');
      if (data && data.length > 0) {
        const matching = data.filter(row => JSON.stringify(row).toLowerCase().includes('anjani'));
        if (matching.length > 0) {
          console.log(`Table ${t} has ${matching.length} rows with Anjani:`);
          matching.forEach(r => {
            console.log('  row id:', r.id, 'fields:', Object.keys(r).filter(k => typeof r[k] === 'string' && r[k].toLowerCase().includes('anjani')).map(k => `${k}="${r[k]}"`));
          });
        }
      }
    } catch(err) {
      console.error(t, err);
    }
  }
})();
