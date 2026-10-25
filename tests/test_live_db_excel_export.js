const fs = require('fs');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const reportsCore = require('../assets/js/reports-core.js');
const core = reportsCore.Service;

const env = fs.readFileSync('assets/js/database.js', 'utf8');
const urlMatch = env.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = env.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/);
const sb = createClient(urlMatch[1], keyMatch[1]);

async function verifyLiveDbExport() {
  console.log('Querying live database...');
  const { data: orders } = await sb.from('orders').select('*');
  const { data: orderItems } = await sb.from('order_items').select('*');
  const { data: clients } = await sb.from('clients').select('*');

  console.log(`Live DB Records: Orders=${orders.length}, OrderItems=${orderItems.length}, Clients=${clients.length}`);

  // Test full reporting engine
  const custReport = core.getCustomerSalesReport({ orders, orderItems, clients });
  const summaryData = core.formatCustomerSalesForExport(custReport);
  const productDetailsData = core.formatCustomerProductDetailsForExport({ orders, orderItems, clients });
  const transactionsData = core.formatSalesTransactionsForExport({ orders, orderItems, clients });

  console.log('\n--- Live Summary Table ---');
  console.table(summaryData);

  console.log('\n--- Live Customer-Wise Product Details ---');
  console.table(productDetailsData.map(r => ({
    Customer: r['Customer Name'],
    Order: r['Order Number'],
    Product: r['Product Name'],
    Pack: r['Packaging Size'],
    OrdQty: r['Total Ordered Quantity'],
    DispQty: r['Total Dispatched Quantity'],
    PendQty: r['Pending Quantity'],
    Boxes: r['Dispatched Boxes'],
    Rate: r['Unit Rate (₹)'],
    Total: r['Line Total (₹)'],
    Status: r['Line Status'],
    DispatchRef: r['Dispatch Reference'],
    Inv: r['Invoice Number']
  })));

  console.log('\n--- Live Sales Transactions (first 4) ---');
  console.table(transactionsData.slice(0, 4));

  // Build Excel file
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(summaryData);
  core.applySheetFormatting(ws1, summaryData, XLSX);
  XLSX.utils.book_append_sheet(wb, ws1, 'Customer Summary');

  const ws2 = XLSX.utils.json_to_sheet(productDetailsData);
  core.applySheetFormatting(ws2, productDetailsData, XLSX);
  XLSX.utils.book_append_sheet(wb, ws2, 'Customer-Wise Product Details');

  const ws3 = XLSX.utils.json_to_sheet(transactionsData);
  core.applySheetFormatting(ws3, transactionsData, XLSX);
  XLSX.utils.book_append_sheet(wb, ws3, 'Sales Transactions');

  const liveExportPath = 'tests/scratch/Live_ERP_Business_Report.xlsx';
  XLSX.writeFile(wb, liveExportPath);
  console.log(`\nWorkbook written to: ${liveExportPath}`);

  // Validate workbook
  const readWb = XLSX.readFile(liveExportPath);
  console.log('Worksheets in live export:', readWb.SheetNames);
  if (readWb.SheetNames.length < 3) {
    throw new Error('Expected at least 3 sheets!');
  }

  // Verification checks
  const kisanSummary = summaryData[0];
  if (kisanSummary['Ordered Units'] !== 590) throw new Error(`Expected 590 ordered units, got ${kisanSummary['Ordered Units']}`);
  if (kisanSummary['Dispatched Units'] !== 590) throw new Error(`Expected 590 dispatched units, got ${kisanSummary['Dispatched Units']}`);
  if (kisanSummary['Pending Units'] !== 0) throw new Error(`Expected 0 pending units, got ${kisanSummary['Pending Units']}`);
  if (kisanSummary['Boxes Dispatched'] !== 59) throw new Error(`Expected 59 boxes, got ${kisanSummary['Boxes Dispatched']}`);
  if (kisanSummary['Total Billed (₹)'] !== 610500) throw new Error(`Expected ₹610,500 billed, got ${kisanSummary['Total Billed (₹)']}`);

  console.log('\nLIVE DATABASE EXCEL EXPORT VALIDATED 100% SUCCESSFULLY!');
}

verifyLiveDbExport().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
