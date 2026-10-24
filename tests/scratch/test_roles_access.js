const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const anonKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function testAccess() {
  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  // 1. Test unauthenticated (anon role)
  console.log('--- Testing unauthenticated (anon role) ---');
  const { data: anonData, error: anonErr } = await anonClient.from('inventory_items').select('id, name').limit(1);
  console.log('inventory_items (anon):', anonErr ? anonErr.message : `OK (${anonData.length} rows)`);

  const { data: anonOrders, error: anonOrdersErr } = await anonClient.from('orders').select('id').limit(1);
  console.log('orders (anon):', anonOrdersErr ? anonOrdersErr.message : `OK (${anonOrders.length} rows)`);

  const { data: anonAudit, error: anonAuditErr } = await anonClient.from('audit_logs').select('id').limit(1);
  console.log('audit_logs (anon):', anonAuditErr ? anonAuditErr.message : `OK (${anonAudit.length} rows)`);

  // 2. Test authenticated
  console.log('\n--- Testing authenticated role (admin@anjani.test) ---');
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: loginData, error: loginErr } = await authClient.auth.signInWithPassword({
    email: 'admin@anjani.test',
    password: 'Test@Agro2026!'
  });

  if (loginErr) {
    console.error('Login failed:', loginErr.message);
    return;
  }
  console.log('Login successful! User ID:', loginData.user.id);

  const { data: authInv, error: authInvErr } = await authClient.from('inventory_items').select('id, name').limit(1);
  console.log('inventory_items (auth):', authInvErr ? authInvErr.message : `OK (${authInv.length} rows)`);

  const { data: authOrders, error: authOrdersErr } = await authClient.from('orders').select('id').limit(1);
  console.log('orders (auth):', authOrdersErr ? authOrdersErr.message : `OK (${authOrders.length} rows)`);

  const { data: authAudit, error: authAuditErr } = await authClient.from('audit_logs').select('id').limit(1);
  console.log('audit_logs (auth):', authAuditErr ? authAuditErr.message : `OK (${authAudit.length} rows)`);
}

testAccess();
