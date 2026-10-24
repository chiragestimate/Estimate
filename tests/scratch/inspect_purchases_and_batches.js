const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function main() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  console.log('=== PURCHASES ===');
  const { data: purchases, error: purErr } = await client
    .from('purchases')
    .select('id, purchase_no, supplier_name, purchase_date, p_status, total_amount')
    .order('id', { ascending: true });
  console.log('Purchases count:', purchases?.length, 'error:', purErr);
  purchases?.forEach(p => {
    console.log(`ID: ${p.id} | No: ${p.purchase_no} | Supplier: ${p.supplier_name} | Status: ${p.p_status} | Date: ${p.purchase_date}`);
  });

  console.log('\n=== PURCHASE ITEMS ===');
  const { data: pItems, error: piErr } = await client
    .from('purchase_items')
    .select('id, purchase_id, item_id, item_name, quantity, batch_no')
    .order('purchase_id', { ascending: true });
  console.log('Purchase items count:', pItems?.length, 'error:', piErr);
  pItems?.forEach(pi => {
    console.log(`Purchase ID: ${pi.purchase_id} | Item ID: ${pi.item_id} | Name: ${pi.item_name} | Qty: ${pi.quantity} | batch_no: ${pi.batch_no}`);
  });

  console.log('\n=== STOCK BATCHES ===');
  const { data: batches, error: bErr } = await client
    .from('stock_batches')
    .select('id, item_id, item_name, item_type, batch_no, purchase_id, supplier_id, warehouse, current_qty')
    .order('id', { ascending: true });
  console.log('Stock batches count:', batches?.length, 'error:', bErr);
  batches?.forEach(b => {
    console.log(`Batch ID: ${b.id} | item_id: ${b.item_id} | item_type: ${b.item_type} | batch_no: ${b.batch_no} | purchase_id: ${b.purchase_id} | name: ${b.item_name}`);
  });
}

main();
