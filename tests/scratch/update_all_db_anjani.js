const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';
const client = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('--- Updating Supabase Database Records ---');

  // 1. Warehouses
  const { data: whData, error: whErr } = await client
    .from('warehouses')
    .update({ name: 'Afield Crop Care Main Plant Warehouse' })
    .eq('id', 1)
    .select();
  console.log('Warehouses updated:', whData, whErr);

  // 2. Branches
  const { data: brData, error: brErr } = await client
    .from('branches')
    .update({ name: 'Afield Crop Care Head Office' })
    .eq('id', 209)
    .select();
  console.log('Branches updated:', brData, brErr);

  // 3. Products
  const { data: prods } = await client.from('products').select('*');
  for (const p of prods || []) {
    if (p.name && p.name.includes('Anjani')) {
      const newName = p.name.replace(/Anjani/g, 'Afield');
      const { error } = await client.from('products').update({ name: newName }).eq('id', p.id);
      console.log(`Product ${p.id} updated: ${p.name} -> ${newName}`, error || 'OK');
    }
  }

  // 4. Order items
  const { data: oItems } = await client.from('order_items').select('*');
  for (const oi of oItems || []) {
    if (oi.product_name && oi.product_name.includes('Anjani')) {
      const newName = oi.product_name.replace(/Anjani/g, 'Afield');
      const { error } = await client.from('order_items').update({ product_name: newName }).eq('id', oi.id);
      console.log(`Order item ${oi.id} updated: ${oi.product_name} -> ${newName}`, error || 'OK');
    }
  }

  // 5. Purchase items
  const { data: pItems } = await client.from('purchase_items').select('*');
  for (const pi of pItems || []) {
    if (pi.item_name && pi.item_name.includes('Anjani')) {
      const newName = pi.item_name.replace(/Anjani/g, 'Afield');
      const { error } = await client.from('purchase_items').update({ item_name: newName }).eq('id', pi.id);
      console.log(`Purchase item ${pi.id} updated: ${pi.item_name} -> ${newName}`, error || 'OK');
    }
  }

  // 6. Orders (notes metadata)
  const { data: orders } = await client.from('orders').select('*');
  for (const o of orders || []) {
    if (o.notes && o.notes.includes('Anjani')) {
      const newNotes = o.notes.replace(/Anjani/g, 'Afield');
      const { error } = await client.from('orders').update({ notes: newNotes }).eq('id', o.id);
      console.log(`Order ${o.id} notes updated`, error || 'OK');
    }
  }

  console.log('✓ All Supabase DB records updated successfully!');
})();
