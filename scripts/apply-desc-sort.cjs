const fs = require('fs');
const path = require('path');

function updateFile(relPath, fn) {
  const fullPath = path.join(__dirname, '..', relPath);
  let content = fs.readFileSync(fullPath, 'utf8');
  const updated = fn(content);
  if (content !== updated) {
    fs.writeFileSync(fullPath, updated, 'utf8');
    console.log(`Updated ${relPath}`);
  } else {
    console.log(`No changes needed for ${relPath}`);
  }
}

// 1. purchases.js
updateFile('assets/js/purchases.js', (c) => {
  c = c.replace(
    /window\.dbClient\.from\('purchases'\)\.select\('\*'\)\.order\('date',\s*\{\s*ascending:\s*false\s*\}\)/g,
    "window.dbClient.from('purchases').select('*').order('id', { ascending: false })"
  );
  c = c.replace(
    /allPurchases\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(.*?pRes\.data.*?\);/g,
    'allPurchases = UTILS.sortLatestFirst(pRes.data || [], p => p.purchase_no || p.id);'
  );
  c = c.replace(
    /allPurchases\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(allPurchases.*?\);\s*renderTable\(allPurchases\);/g,
    'allPurchases = UTILS.sortLatestFirst(allPurchases, p => p.purchase_no || p.id);\n    renderTable(allPurchases);'
  );
  c = c.replace(
    /filtered\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(filtered,\s*p\s*=>\s*p\.purchase_no.*?\);/g,
    'filtered = UTILS.sortLatestFirst(filtered, p => p.purchase_no || p.id);'
  );
  return c;
});

// 2. orders.js
updateFile('assets/js/orders.js', (c) => {
  c = c.replace(
    /window\.dbClient\.from\('orders'\)\.select\('\*'\)\.order\('created_at',\s*\{\s*ascending:\s*false\s*\}\)/g,
    "window.dbClient.from('orders').select('*').order('id', { ascending: false })"
  );
  c = c.replace(
    /allOrders\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(ordersData.*?\);/g,
    'allOrders = UTILS.sortLatestFirst(ordersData || [], o => o.order_no || o.id);'
  );
  c = c.replace(
    /data\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(data,\s*o\s*=>\s*o\.order_no.*?\);/g,
    'data = UTILS.sortLatestFirst(data, o => o.order_no || o.id);'
  );
  c = c.replace(
    /data\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(data,\s*it\s*=>\s*it\.order_no.*?\);/g,
    'data = UTILS.sortLatestFirst(data, it => it.order_no || it.order_id || it.id);'
  );
  return c;
});

// 3. daily-transactions.js
updateFile('assets/js/daily-transactions.js', (c) => {
  c = c.replace(
    /window\.dbClient\.from\('daily_transactions'\)\.select\('\*'\)\.order\('date',\s*\{ascending:\s*false\}\)/g,
    "window.dbClient.from('daily_transactions').select('*').order('id', { ascending: false })"
  );
  c = c.replace(
    /allDailyTransactions\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(txnData.*?\);/g,
    'allDailyTransactions = UTILS.sortLatestFirst(txnData || [], t => t.txn_no || t.id);'
  );
  c = c.replace(
    /return\s+(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)\(list,\s*t\s*=>\s*t\.txn_no.*?\);/g,
    'return UTILS.sortLatestFirst(list, t => t.txn_no || t.id);'
  );
  return c;
});

// 4. clients.js
updateFile('assets/js/clients.js', (c) => {
  c = c.replace(
    /const\s*\{\s*data:\s*clientsData,\s*error\s*\}\s*=\s*await\s*window\.dbClient\.from\('clients'\)\.select\('\*'\)(?:\.order\('id',\s*\{\s*ascending:\s*false\s*\}\))?;/g,
    "const { data: clientsData, error } = await window.dbClient.from('clients').select('*').order('id', { ascending: false });"
  );
  c = c.replace(
    /allClients\s*=\s*\(clientsData\s*\|\|\s*\[\]\)\.sort\(.*?\);/g,
    'allClients = UTILS.sortLatestFirst(clientsData || []);'
  );
  c = c.replace(
    /filtered\s*=\s*\[\.\.\.filtered\]\.sort\(.*?\);/g,
    'filtered = UTILS.sortLatestFirst(filtered);'
  );
  return c;
});

// 5. suppliers.js
updateFile('assets/js/suppliers.js', (c) => {
  c = c.replace(
    /const\s*\{\s*data:\s*suppliersData,\s*error\s*\}\s*=\s*await\s*window\.dbClient\.from\('suppliers'\)\.select\('\*'\)(?:\.order\('id',\s*\{\s*ascending:\s*false\s*\}\))?;/g,
    "const { data: suppliersData, error } = await window.dbClient.from('suppliers').select('*').order('id', { ascending: false });"
  );
  c = c.replace(
    /allSuppliers\s*=\s*\(suppliersData\s*\|\|\s*\[\]\)\.sort\(.*?\);/g,
    'allSuppliers = UTILS.sortLatestFirst(suppliersData || []);'
  );
  c = c.replace(
    /filtered\s*=\s*\[\.\.\.filtered\]\.sort\(.*?\);/g,
    'filtered = UTILS.sortLatestFirst(filtered);'
  );
  return c;
});

// 6. products.js
updateFile('assets/js/products.js', (c) => {
  c = c.replace(
    /window\.dbClient\.from\('products'\)\.select\('\*'\)(?:\.order\('id',\s*\{\s*ascending:\s*false\s*\}\))?,/g,
    "window.dbClient.from('products').select('*').order('id', { ascending: false }),"
  );
  c = c.replace(
    /allProducts\s*=\s*\(prodRes\.data\s*\|\|\s*\[\]\)\.sort\(.*?\);/g,
    'allProducts = UTILS.sortLatestFirst(prodRes.data || []);'
  );
  c = c.replace(
    /return\s+(?:list\.sort\(.*?\)|UTILS\.sortLatestFirst\(list\));/g,
    'return UTILS.sortLatestFirst(list);'
  );
  return c;
});

// 7. inventory.js
updateFile('assets/js/inventory.js', (c) => {
  c = c.replace(
    /allInventory\.sort\(.*?\);/g,
    'allInventory = UTILS.sortLatestFirst(allInventory);'
  );
  c = c.replace(
    /filtered\.sort\(.*?\);/g,
    'filtered = UTILS.sortLatestFirst(filtered);'
  );
  return c;
});

// 8. expenses.js
updateFile('assets/js/expenses.js', (c) => {
  c = c.replace(
    /allExpenses\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(expRes\.data.*?\);/g,
    'allExpenses = UTILS.sortLatestFirst(expRes.data || []);'
  );
  c = c.replace(
    /filtered\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(filtered,\s*e\s*=>\s*e\.id\);/g,
    'filtered = UTILS.sortLatestFirst(filtered);'
  );
  return c;
});

// 9. transactions.js
updateFile('assets/js/transactions.js', (c) => {
  c = c.replace(
    /allTransactions\s*=\s*txnData\s*\|\|\s*\[\];/g,
    'allTransactions = UTILS.sortLatestFirst(txnData || [], t => t.ref_no || t.id);'
  );
  c = c.replace(
    /filtered\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(filtered,\s*t\s*=>\s*t\.ref_no.*?\);/g,
    'filtered = UTILS.sortLatestFirst(filtered, t => t.ref_no || t.id);'
  );
  return c;
});

// 10. production.js
updateFile('assets/js/production.js', (c) => {
  c = c.replace(
    /allProductions\s*=\s*(?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)?\(prodBatches.*?\);/g,
    'allProductions = UTILS.sortLatestFirst(prodBatches || [], b => b.batch_no || b.id);'
  );
  c = c.replace(
    /renderTable\((?:UTILS\.sortByNumericIdDesc|UTILS\.sortLatestFirst)\(filtered,\s*b\s*=>\s*b\.batch_no.*?\)\);/g,
    'renderTable(UTILS.sortLatestFirst(filtered, b => b.batch_no || b.id));'
  );
  return c;
});

console.log('Finished applying universal sortLatestFirst across all modules.');
