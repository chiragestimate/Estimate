const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const supabaseKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

const client = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data: orders, error } = await client.from('orders').select('id, order_no, notes').order('id', { ascending: false }).limit(3);
  console.log('recent orders notes:');
  orders.forEach(o => {
    console.log(`Order ${o.id} (${o.order_no}):`, o.notes);
  });
})();
