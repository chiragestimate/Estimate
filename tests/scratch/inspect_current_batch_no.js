const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function main() {
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { data: purchases } = await client.from('purchases').select('id, purchase_no, supplier_name');
  const purMap = {};
  purchases.forEach(p => purMap[p.id] = p);

  const { data: batches } = await client.from('stock_batches').select('id, item_id, item_name, batch_no, purchase_id').not('purchase_id', 'is', null);
  console.log('Stock batches linked to purchases:');
  batches.forEach(b => {
    const p = purMap[b.purchase_id];
    console.log(`Batch ${b.id}: item ${b.item_name} | current batch_no: ${b.batch_no} | purchase: ${p ? p.purchase_no : 'none'} (id ${b.purchase_id})`);
  });

  const { data: pItems } = await client.from('purchase_items').select('id, purchase_id, item_name, batch_no');
  console.log('\nPurchase items:');
  pItems.forEach(pi => {
    const p = purMap[pi.purchase_id];
    console.log(`PurchaseItem ${pi.id}: item ${pi.item_name} | current batch_no: ${pi.batch_no} | purchase: ${p ? p.purchase_no : 'none'}`);
  });
}
main();
