const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://quxcvoywufjjynluntvg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XickYJH_8m0FTaJaT2k8TA_X2MEJSDr';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tables = [
  'tenants',
  'companies',
  'branches',
  'warehouses',
  'user_role_assignments',
  'clients',
  'suppliers',
  'products',
  'product_packaging',
  'inventory_items',
  'stock_batches',
  'stock_movements',
  'formulations',
  'production_batches',
  'packaging_orders',
  'orders',
  'order_items',
  'order_dispatches',
  'invoices',
  'intercompany_transfers',
  'transactions',
  'expenses',
  'general_ledger',
  'audit_logs',
  'system_notifications'
];

async function runHealthCheck() {
  console.log('====================================================');
  console.log('--- SUPABASE DATABASE INTEGRITY & HEALTH CHECK ---');
  console.log('====================================================\n');

  const results = {};
  for (const t of tables) {
    try {
      const { data, count, error } = await supabase.from(t).select('*', { count: 'exact', head: false });
      if (error) {
        results[t] = { status: 'ERROR', error: error.message };
      } else {
        results[t] = { status: 'OK', count: data.length, rows: data };
      }
    } catch (e) {
      results[t] = { status: 'EXCEPTION', error: e.message };
    }
  }

  // Print table summary
  console.log('TABLE STATUS & ROW COUNTS:');
  for (const [tbl, info] of Object.entries(results)) {
    if (info.status === 'OK') {
      console.log(`  - ${tbl.padEnd(25)}: ${info.count} records`);
    } else {
      console.log(`  - ${tbl.padEnd(25)}: [${info.status}] ${info.error}`);
    }
  }

  console.log('\nINTEGRITY ASSERTIONS:');
  let issues = 0;

  // 1. Check negative stock batches
  if (results.stock_batches?.rows) {
    const negBatches = results.stock_batches.rows.filter(b => Number(b.current_qty ?? b.quantity) < 0);
    if (negBatches.length > 0) {
      console.log(`  ❌ FAIL: Found ${negBatches.length} negative stock batches!`);
      issues++;
    } else {
      console.log('  ✔ PASS: Zero negative stock batches');
    }
  }

  // 2. Check stock balance reconciliation (inventory_items vs stock_batches)
  if (results.inventory_items?.rows && results.stock_batches?.rows) {
    let balanceMismatches = 0;
    for (const item of results.inventory_items.rows) {
      const batches = results.stock_batches.rows.filter(b => b.item_id === item.id && b.item_type === 'Inventory');
      const batchSum = batches.reduce((sum, b) => sum + Number(b.current_qty || 0), 0);
      const diff = Math.abs(Number(item.stock || 0) - batchSum);
      if (diff > 0.001) {
        console.log(`  ⚠️ Item ${item.id} (${item.name}): inventory_items.stock=${item.stock}, batchSum=${batchSum}`);
        balanceMismatches++;
      }
    }
    if (balanceMismatches === 0) {
      console.log('  ✔ PASS: All inventory items match sum of stock batches');
    } else {
      console.log(`  ℹ️ NOTE: ${balanceMismatches} items have balance variations`);
    }
  }

  // 3. Check orphaned order items
  if (results.order_items?.rows && results.orders?.rows) {
    const orderIds = new Set(results.orders.rows.map(o => o.id));
    const orphanedItems = results.order_items.rows.filter(oi => oi.order_id && !orderIds.has(oi.order_id));
    if (orphanedItems.length > 0) {
      console.log(`  ❌ FAIL: Found ${orphanedItems.length} orphaned order items`);
      issues++;
    } else {
      console.log('  ✔ PASS: Zero orphaned order items');
    }
  }

  // 4. Check orphaned dispatches
  if (results.order_dispatches?.rows && results.orders?.rows) {
    const orderIds = new Set(results.orders.rows.map(o => o.id));
    const orphanedDispatches = results.order_dispatches.rows.filter(d => d.order_id && !orderIds.has(d.order_id));
    if (orphanedDispatches.length > 0) {
      console.log(`  ❌ FAIL: Found ${orphanedDispatches.length} orphaned dispatches`);
      issues++;
    } else {
      console.log('  ✔ PASS: Zero orphaned dispatches');
    }
  }

  console.log(`\nINTEGRITY AUDIT COMPLETE: ${issues} critical issue(s) detected.\n`);
}

runHealthCheck();
