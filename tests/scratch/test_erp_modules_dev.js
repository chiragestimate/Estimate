const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const anonKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function runDevModuleTests() {
  console.log('=== RUNNING ERP DEV ENVIRONMENT MODULE TESTS ===\n');

  // 1. Authenticate
  const client = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'admin@anjani.test',
    password: 'Test@Agro2026!'
  });

  if (authErr) {
    console.error('FAIL: Could not sign in:', authErr.message);
    process.exit(1);
  }
  console.log('PASS: Authentication successful (Role: authenticated, UID:', authData.user.id, ')');

  const testResults = [];

  // Helper test runner
  async function testOp(name, fn) {
    try {
      const res = await fn();
      if (res && res.error) {
        testResults.push({ name, status: 'FAIL', error: res.error.message, code: res.error.code });
        console.log(`FAIL: ${name} -> ${res.error.message} (${res.error.code || ''})`);
      } else {
        testResults.push({ name, status: 'PASS', details: res ? res.data : 'OK' });
        console.log(`PASS: ${name}`);
      }
    } catch (e) {
      testResults.push({ name, status: 'ERROR', error: e.message });
      console.log(`ERROR: ${name} -> ${e.message}`);
    }
  }

  // 1. Core Tenant & Org
  await testOp('Core: Companies SELECT', () => client.from('companies').select('id, name, code').limit(5));
  await testOp('Core: Branches SELECT', () => client.from('branches').select('id, name, company_id').limit(5));
  await testOp('Core: Warehouses SELECT', () => client.from('warehouses').select('id, name, branch_id').limit(5));

  // 2. Products & Packaging
  await testOp('Catalog: Products SELECT', () => client.from('products').select('id, name, category').limit(5));
  await testOp('Catalog: Product Packaging SELECT', () => client.from('product_packaging').select('id, product_id, pack_size').limit(5));
  await testOp('Catalog: Clients SELECT', () => client.from('clients').select('id, name').limit(5));
  await testOp('Catalog: Suppliers SELECT', () => client.from('suppliers').select('id, name').limit(5));

  // 3. Inventory Operations
  await testOp('Inventory: Items SELECT', () => client.from('inventory_items').select('id, name, current_stock, unit').limit(5));
  await testOp('Inventory: Batches SELECT', () => client.from('stock_batches').select('id, batch_no, current_qty').limit(5));
  await testOp('Inventory: Movements SELECT', () => client.from('stock_movements').select('id, movement_type, quantity').limit(5));

  // 4. Sales Orders & Items
  await testOp('Sales: Orders SELECT', () => client.from('orders').select('id, order_no, status, total_amount').limit(5));
  await testOp('Sales: Order Items SELECT', () => client.from('order_items').select('id, order_id, product_id, quantity').limit(5));

  // 5. Purchases
  await testOp('Purchasing: Purchases SELECT', () => client.from('purchases').select('id, invoice_no, total_amount').limit(5));
  await testOp('Purchasing: Purchase Items SELECT', () => client.from('purchase_items').select('id, purchase_id, item_id, quantity').limit(5));

  // 6. Production & Formulations
  await testOp('Manufacturing: Formulations SELECT', () => client.from('formulations').select('id, name, target_output_qty').limit(5));
  await testOp('Manufacturing: Formulation Ingredients SELECT', () => client.from('formulation_ingredients').select('id, formulation_id, item_id').limit(5));
  await testOp('Manufacturing: Production Batches SELECT', () => client.from('production_batches').select('id, batch_no, status').limit(5));

  // 7. Expenses & Financials
  await testOp('Finance: Expenses SELECT', () => client.from('expenses').select('id, expense_date, category, amount').limit(5));
  await testOp('Finance: Accounts SELECT', () => client.from('accounts').select('id, name, type').limit(5));
  await testOp('Finance: Transactions SELECT', () => client.from('transactions').select('id, amount, type').limit(5));

  // 8. Intercompany
  await testOp('Intercompany: Relationships SELECT', () => client.from('intercompany_relationships').select('id, parent_company_id, subsidiary_company_id').limit(5));

  // 9. RBAC & Security
  await testOp('Security: Roles SELECT', () => client.from('roles').select('id, name').limit(5));
  await testOp('Security: Role Assignments SELECT', () => client.from('user_role_assignments').select('id, user_email, role_name').limit(5));
  await testOp('Security: Approval Requests SELECT', () => client.from('approval_requests').select('id, entity_type, status').limit(5));

  // 10. Audit & Extended (Currently not in schema cache due to missing grant)
  await testOp('Audit: audit_logs SELECT (Current State)', () => client.from('audit_logs').select('id').limit(1));
  await testOp('Audit: rbac_audit_logs SELECT (Current State)', () => client.from('rbac_audit_logs').select('id').limit(1));
  await testOp('Sales: order_dispatches SELECT (Current State)', () => client.from('order_dispatches').select('id').limit(1));
  await testOp('Sales: invoices SELECT (Current State)', () => client.from('invoices').select('id').limit(1));

  console.log('\n=== DEV ENVIRONMENT MODULE TESTING SUMMARY ===');
  const passed = testResults.filter(t => t.status === 'PASS').length;
  const failed = testResults.filter(t => t.status !== 'PASS').length;
  console.log(`Total Tested: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
}

runDevModuleTests();
