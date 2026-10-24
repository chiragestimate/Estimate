const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://quxcvoywufjjynluntvg.supabase.co';
const anonKey = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

async function runDevModuleTests2() {
  const client = createClient(supabaseUrl, anonKey);
  await client.auth.signInWithPassword({
    email: 'admin@anjani.test',
    password: 'Test@Agro2026!'
  });

  const tests = [
    { name: 'Core: Companies', table: 'companies' },
    { name: 'Core: Branches', table: 'branches' },
    { name: 'Core: Warehouses', table: 'warehouses' },
    { name: 'Catalog: Products', table: 'products' },
    { name: 'Catalog: Product Packaging', table: 'product_packaging' },
    { name: 'Catalog: Clients', table: 'clients' },
    { name: 'Catalog: Suppliers', table: 'suppliers' },
    { name: 'Inventory: Items', table: 'inventory_items' },
    { name: 'Inventory: Batches', table: 'stock_batches' },
    { name: 'Inventory: Movements', table: 'stock_movements' },
    { name: 'Sales: Orders', table: 'orders' },
    { name: 'Sales: Order Items', table: 'order_items' },
    { name: 'Purchasing: Purchases', table: 'purchases' },
    { name: 'Purchasing: Purchase Items', table: 'purchase_items' },
    { name: 'Manufacturing: Formulations', table: 'formulations' },
    { name: 'Manufacturing: Formulation Ingredients', table: 'formulation_ingredients' },
    { name: 'Manufacturing: Production Batches', table: 'production_batches' },
    { name: 'Finance: Expenses', table: 'expenses' },
    { name: 'Finance: Accounts', table: 'accounts' },
    { name: 'Finance: Transactions', table: 'transactions' },
    { name: 'Intercompany: Relationships', table: 'intercompany_relationships' },
    { name: 'Security: Roles', table: 'roles' },
    { name: 'Security: Role Assignments', table: 'user_role_assignments' },
    { name: 'Security: Approval Requests', table: 'approval_requests' }
  ];

  for (const t of tests) {
    const { data, error } = await client.from(t.table).select('*').limit(1);
    if (error) {
      console.log(`FAIL: ${t.name} -> ${error.message}`);
    } else {
      console.log(`PASS: ${t.name} (${data ? data.length : 0} rows, columns: ${data && data[0] ? Object.keys(data[0]).slice(0, 4).join(', ') : 'empty'})`);
    }
  }
}

runDevModuleTests2();
