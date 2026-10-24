const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function fixPurchaseBatches() {
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { data: purchases, error: purErr } = await client.from('purchases').select('id, purchase_no, supplier_name, date');
  if (purErr) {
    console.error('Error fetching purchases:', purErr);
    return;
  }

  console.log(`Found ${purchases.length} purchases.`);

  for (const p of purchases) {
    console.log(`\nUpdating batches and items for Purchase ID ${p.id} (${p.purchase_no})...`);
    
    // Update stock_batches
    const { data: updatedBatches, error: bErr } = await client
      .from('stock_batches')
      .update({
        batch_no: p.purchase_no,
        purchase_date: p.date
      })
      .eq('purchase_id', p.id)
      .select('id, item_name, batch_no');

    if (bErr) {
      console.error(`Error updating stock_batches for purchase ${p.purchase_no}:`, bErr);
    } else {
      console.log(`Updated ${updatedBatches?.length || 0} stock_batches to ${p.purchase_no}`);
    }

    // Update purchase_items
    const { data: updatedItems, error: iErr } = await client
      .from('purchase_items')
      .update({
        batch_no: p.purchase_no
      })
      .eq('purchase_id', p.id)
      .select('id, item_name, batch_no');

    if (iErr) {
      console.error(`Error updating purchase_items for purchase ${p.purchase_no}:`, iErr);
    } else {
      console.log(`Updated ${updatedItems?.length || 0} purchase_items to ${p.purchase_no}`);
    }
  }

  console.log('\n--- VERIFICATION OF ALL INVENTORY BATCHES ---');
  const { data: finalBatches } = await client
    .from('stock_batches')
    .select('id, item_id, item_name, batch_no, purchase_id, purchase_date')
    .eq('item_type', 'Inventory')
    .order('id', { ascending: true });

  finalBatches.forEach(b => {
    console.log(`Batch ${String(b.id).padStart(3)} | ${b.batch_no.padEnd(8)} | pur_id: ${String(b.purchase_id).padEnd(5)} | ${b.item_name}`);
  });
}

fixPurchaseBatches();
