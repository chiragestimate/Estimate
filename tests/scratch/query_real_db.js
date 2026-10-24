const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function main() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  const { data: batches, error: bErr } = await client.from('stock_batches').select('*');
  console.log('STOCK BATCHES ERROR:', bErr);
  console.log('STOCK BATCHES:', batches);

  const { data: products, error: pErr } = await client.from('products').select('*');
  console.log('PRODUCTS ERROR:', pErr);
  console.log('PRODUCTS:', products?.map(p => ({ id: p.id, name: p.name })));
}

main();
